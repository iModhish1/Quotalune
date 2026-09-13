//! JSON persistence for Codex accounts and usage snapshots.
//!
//! Mirrors `windows/.../stores.py` (MIT), using `secure_file` for account
//! metadata and the snapshot cache because both can contain account identity.

use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::str::FromStr;

use uuid::Uuid;

use crate::secure_file;

use super::file_locations::{accounts_file, snapshots_file};
use super::models::{CodexAccount, RemovedAccountIdentity};

fn ensure_parent_directory(path: &std::path::Path) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("store path has no parent directory: {}", path.display()),
        )
    })?;
    std::fs::create_dir_all(parent)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct AccountsFile {
    version: u32,
    accounts: Vec<CodexAccount>,
    #[serde(rename = "removedAccounts", default)]
    removed_accounts: Vec<RemovedAccountIdentity>,
}

impl Default for AccountsFile {
    fn default() -> Self {
        Self {
            version: Self::CURRENT_VERSION,
            accounts: Vec::new(),
            removed_accounts: Vec::new(),
        }
    }
}

impl AccountsFile {
    const CURRENT_VERSION: u32 = 2;
}

/// Reads/writes the accounts metadata.
pub struct AccountStore {
    file_path: PathBuf,
}

impl AccountStore {
    pub fn new() -> Self {
        Self {
            file_path: accounts_file(),
        }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { file_path: path }
    }

    pub fn load(&self) -> io::Result<(Vec<CodexAccount>, Vec<RemovedAccountIdentity>)> {
        if !self.file_path.exists() {
            return Ok((Vec::new(), Vec::new()));
        }
        let data = secure_file::read_string(&self.file_path)?;
        let file: AccountsFile = serde_json::from_str(&data)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        Ok((file.accounts, file.removed_accounts))
    }

    pub fn load_accounts(&self) -> io::Result<Vec<CodexAccount>> {
        Ok(self.load()?.0)
    }

    pub fn save(
        &self,
        accounts: &[CodexAccount],
        removed_accounts: Option<&[RemovedAccountIdentity]>,
    ) -> io::Result<()> {
        ensure_parent_directory(&self.file_path)?;
        let removed = match removed_accounts {
            Some(r) => r.to_vec(),
            None => self.load()?.1,
        };
        let file = AccountsFile {
            version: AccountsFile::CURRENT_VERSION,
            accounts: accounts.to_vec(),
            removed_accounts: removed,
        };
        let data = serde_json::to_vec_pretty(&file).map_err(io::Error::other)?;
        let data = String::from_utf8(data).map_err(io::Error::other)?;
        secure_file::write_string(&self.file_path, &data)
    }

    /// Merge discovered accounts into the stored list, deduping by identity.
    pub fn merge(
        &self,
        existing: &[CodexAccount],
        incoming: Vec<CodexAccount>,
    ) -> io::Result<Vec<CodexAccount>> {
        let removed = self.load()?.1;
        let mut result: Vec<CodexAccount> = existing
            .iter()
            .filter(|acct| !removed.iter().any(|r| r.matches(acct)))
            .cloned()
            .collect();
        for candidate in incoming {
            match result.iter_mut().find(|acct| acct.matches(&candidate)) {
                Some(existing_account) => existing_account.merge_from(&candidate),
                None => result.push(candidate),
            }
        }
        result.sort_by_key(|a| a.display_name().to_lowercase());
        Ok(result)
    }
}

impl Default for AccountStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Reads/writes the per-account usage snapshot cache.
pub struct SnapshotStore {
    file_path: PathBuf,
}

impl SnapshotStore {
    pub fn new() -> Self {
        Self {
            file_path: snapshots_file(),
        }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { file_path: path }
    }

    pub fn load(&self) -> io::Result<HashMap<Uuid, super::models::AccountUsageSnapshot>> {
        if !self.file_path.exists() {
            return Ok(HashMap::new());
        }
        // secure_file deliberately accepts legacy plaintext JSON, so existing
        // snapshot caches remain readable and are upgraded on the next save.
        let data = secure_file::read_string(&self.file_path)?;
        let file: serde_json::Value = serde_json::from_str(&data)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        let snapshots = file.get("snapshots");
        let Some(snapshots) = snapshots else {
            return Ok(HashMap::new());
        };
        let Some(object) = snapshots.as_object() else {
            return Ok(HashMap::new());
        };
        let mut result = HashMap::new();
        for (key, value) in object {
            if let Ok(id) = Uuid::from_str(key)
                && let Ok(snapshot) =
                    serde_json::from_value::<super::models::AccountUsageSnapshot>(value.clone())
            {
                result.insert(id, snapshot);
            }
        }
        Ok(result)
    }

    pub fn save(
        &self,
        snapshots: &HashMap<Uuid, super::models::AccountUsageSnapshot>,
    ) -> io::Result<()> {
        ensure_parent_directory(&self.file_path)?;
        let mut object = serde_json::Map::new();
        for (id, snapshot) in snapshots {
            object.insert(
                id.to_string(),
                serde_json::to_value(snapshot).map_err(io::Error::other)?,
            );
        }
        let file = serde_json::json!({ "snapshots": object });
        let data = serde_json::to_vec_pretty(&file).map_err(io::Error::other)?;
        let data = String::from_utf8(data).map_err(io::Error::other)?;
        secure_file::write_string_atomic(&self.file_path, &data)
    }
}

impl Default for SnapshotStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codex_accounts::models::{CodexAccountSource, utc_now};
    use crate::core::{
        BankedResetCard, BankedResetInventory, ProviderResetFacts, ResetDatum,
        ResetUnavailableReason,
    };

    fn store_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        super::super::file_locations::with_app_support_directory(dir.path().to_path_buf());
        dir
    }

    fn make_account(id: &str, source: CodexAccountSource) -> CodexAccount {
        CodexAccount::new(
            Uuid::parse_str(id).unwrap(),
            Some(format!("acct-{id}")),
            Some("person@example.com".to_string()),
            None,
            None,
            PathBuf::from(format!("/tmp/managed/{id}")),
            source,
            utc_now(),
            utc_now(),
            None,
        )
    }

    #[test]
    fn account_store_roundtrips() {
        let _guard = store_dir();
        let store = AccountStore::new();
        let acct = make_account(
            "11111111-1111-1111-1111-111111111111",
            CodexAccountSource::ManagedByApp,
        );
        store.save(&[acct], None).unwrap();
        let (loaded, _) = store.load().unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(
            loaded[0].nickname.as_deref().unwrap(),
            "acct-11111111-1111-1111-1111-111111111111"
        );
        crate::codex_accounts::file_locations::clear_app_support_directory_override();
    }

    #[test]
    fn snapshot_store_roundtrips() {
        let _guard = store_dir();
        let store = SnapshotStore::new();
        let id = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
        let snapshot = crate::codex_accounts::models::AccountUsageSnapshot {
            email: Some("a@b.c".to_string()),
            provider_account_id: None,
            plan: Some("pro".to_string()),
            allowed: Some(true),
            limit_reached: None,
            primary_window: Some(crate::codex_accounts::models::UsageWindowSnapshot::new(
                12.0, None, 18_000,
            )),
            secondary_window: None,
            credits: None,
            reset_facts: None,
            updated_at: utc_now(),
        };
        let mut map = HashMap::new();
        map.insert(id, snapshot.clone());
        store.save(&map).unwrap();
        let loaded = store.load().unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[&id].plan.as_deref().unwrap(), "pro");
        crate::codex_accounts::file_locations::clear_app_support_directory_override();
    }

    #[test]
    fn snapshot_store_preserves_distinct_reset_inventory_per_account() {
        let dir = tempfile::tempdir().unwrap();
        let store = SnapshotStore::with_path(dir.path().join("snapshots.json"));
        let first_id = Uuid::parse_str("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").unwrap();
        let second_id = Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap();
        let make_snapshot = |email: &str, count: u32, card_id: &str| {
            let observed_at = utc_now();
            let card = BankedResetCard::from_reported(
                Some(card_id.to_string()),
                Some("available"),
                Some("2026-12-01T00:00:00Z"),
            );
            crate::codex_accounts::models::AccountUsageSnapshot {
                email: Some(email.to_string()),
                provider_account_id: None,
                plan: Some("pro".to_string()),
                allowed: Some(true),
                limit_reached: None,
                primary_window: None,
                secondary_window: None,
                credits: None,
                reset_facts: Some(ProviderResetFacts {
                    observed_at,
                    provider_issued_resets: ResetDatum::unavailable(
                        ResetUnavailableReason::NotReported,
                    ),
                    last_actual_reset: ResetDatum::unavailable(ResetUnavailableReason::NotObserved),
                    next_weekly_reset: ResetDatum::unavailable(ResetUnavailableReason::NotReported),
                    banked_reset_cards: ResetDatum::known(BankedResetInventory::from_reported(
                        count,
                        vec![card],
                    )),
                }),
                updated_at: observed_at,
            }
        };
        let mut snapshots = HashMap::new();
        snapshots.insert(
            first_id,
            make_snapshot("first@example.com", 1, "first-card"),
        );
        snapshots.insert(
            second_id,
            make_snapshot("second@example.com", 2, "second-card"),
        );

        store.save(&snapshots).unwrap();
        let loaded = store.load().unwrap();

        let reset_inventory = |id: Uuid| {
            let facts = loaded[&id].reset_facts.as_ref().unwrap();
            let ResetDatum::Known { value } = &facts.banked_reset_cards else {
                panic!("reset inventory must remain known");
            };
            (
                value.reported_available_count,
                value.cards[0].opaque_id.clone(),
            )
        };
        assert_eq!(reset_inventory(first_id), (1, Some("first-card".into())));
        assert_eq!(reset_inventory(second_id), (2, Some("second-card".into())));
    }

    #[test]
    fn snapshot_store_reads_legacy_plaintext_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snapshots.json");
        let id = Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
        let provider_account_id = "acct-legacy-private-id";
        let email = "legacy-person@example.com";
        let snapshot = crate::codex_accounts::models::AccountUsageSnapshot {
            email: Some(email.to_string()),
            provider_account_id: Some(provider_account_id.to_string()),
            plan: Some("team".to_string()),
            allowed: Some(true),
            limit_reached: None,
            primary_window: None,
            secondary_window: None,
            credits: None,
            reset_facts: None,
            updated_at: utc_now(),
        };
        let legacy = serde_json::json!({
            "snapshots": {
                id.to_string(): snapshot,
            }
        });
        std::fs::write(&path, serde_json::to_vec_pretty(&legacy).unwrap()).unwrap();

        let loaded = SnapshotStore::with_path(path).load().unwrap();
        assert_eq!(loaded[&id].email.as_deref(), Some(email));
        assert!(loaded[&id].reset_facts.is_none());
        assert_eq!(
            loaded[&id].provider_account_id.as_deref(),
            Some(provider_account_id)
        );
    }

    #[cfg(windows)]
    #[test]
    fn snapshot_store_protects_account_identity_on_new_writes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snapshots.json");
        let store = SnapshotStore::with_path(path.clone());
        let id = Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap();
        let provider_account_id = "acct-private-provider-id";
        let email = "private-person@example.com";
        let snapshot = crate::codex_accounts::models::AccountUsageSnapshot {
            email: Some(email.to_string()),
            provider_account_id: Some(provider_account_id.to_string()),
            plan: Some("pro".to_string()),
            allowed: Some(true),
            limit_reached: None,
            primary_window: Some(crate::codex_accounts::models::UsageWindowSnapshot::new(
                34.0, None, 18_000,
            )),
            secondary_window: None,
            credits: None,
            reset_facts: None,
            updated_at: utc_now(),
        };
        let mut snapshots = HashMap::new();
        snapshots.insert(id, snapshot);

        store.save(&snapshots).unwrap();

        let raw = std::fs::read(&path).unwrap();
        assert!(
            !raw.windows(email.len())
                .any(|window| window == email.as_bytes()),
            "email must not be stored as plaintext"
        );
        assert!(
            !raw.windows(provider_account_id.len())
                .any(|window| window == provider_account_id.as_bytes()),
            "provider account id must not be stored as plaintext"
        );
        assert_eq!(
            secure_file::status(&path),
            secure_file::SecureFileStatus::Protected("windows-dpapi-user".to_string())
        );

        let loaded = store.load().unwrap();
        assert_eq!(loaded[&id].email.as_deref(), Some(email));
        assert_eq!(
            loaded[&id].provider_account_id.as_deref(),
            Some(provider_account_id)
        );
    }

    #[test]
    fn missing_store_loads_empty() {
        let dir = tempfile::tempdir().unwrap();
        crate::codex_accounts::file_locations::with_app_support_directory(dir.path().to_path_buf());
        let store = AccountStore::new();
        let (accounts, removed) = store.load().unwrap();
        assert!(accounts.is_empty() && removed.is_empty());
        crate::codex_accounts::file_locations::clear_app_support_directory_override();
    }
}
