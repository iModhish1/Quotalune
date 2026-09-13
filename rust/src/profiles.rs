//! QuotaArc Profiles and ProviderAccounts — the application-level personalization model.
//!
//! A **Profile** is a named context the user switches between (Main, Coding,
//! Work, Night…). It selects which provider accounts are visible, and how the
//! app looks and behaves while active. A **ProviderAccount** is one
//! user-named identity at a provider (Claude "Work", Codex "Research"); it is
//! NOT a provider. Accounts are referenced by UUID — never by mutable display
//! names — so history and settings stay stable across renames.
//!
//! Storage: a versioned JSON document (`profiles.json`) persisted through the
//! same DPAPI-capable secure-file layer as settings. Account records never
//! contain secrets: only credential *references* (source + identifier) that
//! describe an intended source. Runtime provider fetch currently uses its ambient
//! credential configuration; profile membership does not switch credentials.
//!
//! Migration: schema 1 is created on first load. Existing 0.1.0
//! installations migrate into a single "Default" profile with one "Main"
//! account per enabled provider — no user action required after upgrade.

use crate::core::ProviderId;
use crate::settings::{Settings, ThemePreference};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub const PROFILES_SCHEMA_VERSION: u32 = 1;

/// UUID string newtype for account/profile identity (stored as plain string
/// in JSON; validated at creation).
pub type EntityId = String;

fn now_epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn new_id() -> EntityId {
    uuid::Uuid::new_v4().to_string()
}

/// A user-named identity at a provider. Never contains secrets.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ProviderAccount {
    pub id: EntityId,
    /// CLI name of the provider (e.g. "claude", "codex") — stable enum mapping.
    pub provider: String,
    pub display_name: String,
    pub enabled: bool,
    /// Credential reference: where the secret lives, never the secret itself.
    /// e.g. `{ "source": "api-keys-store" }`, `{ "source": "cli-session" }`,
    /// `{ "source": "codex-token-account", "id": "..." }`.
    pub credential_reference: CredentialReference,
    /// Optional accent override (CSS color) for this account in surfaces.
    pub accent: Option<String>,
    /// Free-form user tags ("Work", "Research", "Backup").
    pub tags: Vec<String>,
    /// Optional user notes about this account (never secrets).
    pub notes: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct CredentialReference {
    /// Which secure store holds the credential: "none" | "cli-session" |
    /// "api-keys-store" | "codex-token-account" | "oauth-store" |
    /// "manual-cookies" | "browser-session" | "external".
    pub source: String,
    /// Optional identifier within that store.
    pub id: Option<String>,
}

impl Default for CredentialReference {
    fn default() -> Self {
        Self {
            source: "none".to_string(),
            id: None,
        }
    }
}

impl CredentialReference {
    /// A reference meaning "uses whatever the provider CLI/session provides".
    pub fn cli_session() -> Self {
        Self {
            source: "cli-session".to_string(),
            id: None,
        }
    }
}

/// A named application context: accounts + surfaces + appearance + policies.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct QuotaArcProfile {
    pub id: EntityId,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    /// `None` inherits the global theme.
    pub theme: Option<ThemePreference>,
    /// `None` inherits the global orbital catalog theme.
    pub catalog_theme: Option<String>,
    /// Optional in-app accent override (CSS color).
    pub accent: Option<String>,
    /// Optional profile mark: monogram of the name, or an imported asset id.
    pub mark: Option<ProfileMark>,
    /// Surface visibility for this profile.
    pub surfaces: ProfileSurfaces,
    /// Accounts visible while this profile is active (UUIDs).
    pub account_ids: Vec<EntityId>,
    /// High/critical usage thresholds for notifications while active.
    pub high_usage_threshold: u8,
    pub critical_usage_threshold: u8,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Profile visual mark: keep the QuotaArc mark, a name monogram, or an
/// imported image (stored in the managed assets directory — never a source
/// path into the user's filesystem).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProfileMark {
    Default,
    Monogram,
    Image { asset_id: String },
}

/// Per-profile surface visibility.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct ProfileSurfaces {
    pub edge_arc: bool,
    pub top_arc: bool,
    pub taskbar_arc: bool,
    pub float_bar: bool,
}

impl ProfileSurfaces {
    fn from_settings(settings: &Settings) -> Self {
        Self {
            edge_arc: settings.edge_arc_enabled,
            top_arc: settings.top_arc_enabled,
            taskbar_arc: settings.taskbar_arc_enabled,
            float_bar: settings.float_bar_enabled,
        }
    }
}

impl Default for QuotaArcProfile {
    fn default() -> Self {
        Self::new("Profile")
    }
}

impl QuotaArcProfile {
    pub fn new(name: &str) -> Self {
        let ts = now_epoch_secs();
        Self {
            id: new_id(),
            name: name.to_string(),
            description: None,
            enabled: true,
            theme: None,
            catalog_theme: None,
            accent: None,
            mark: None,
            surfaces: ProfileSurfaces::default(),
            account_ids: Vec::new(),
            high_usage_threshold: 80,
            critical_usage_threshold: 95,
            created_at: ts,
            updated_at: ts,
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = now_epoch_secs();
    }
}

impl Default for ProviderAccount {
    fn default() -> Self {
        Self::new(ProviderId::Claude, "Account")
    }
}

impl ProviderAccount {
    pub fn new(provider: ProviderId, display_name: &str) -> Self {
        let ts = now_epoch_secs();
        Self {
            id: new_id(),
            provider: provider.cli_name().to_string(),
            display_name: display_name.to_string(),
            enabled: true,
            credential_reference: CredentialReference::cli_session(),
            accent: None,
            tags: Vec::new(),
            notes: None,
            created_at: ts,
            updated_at: ts,
        }
    }

    pub fn provider_id(&self) -> Option<ProviderId> {
        ProviderId::from_cli_name(&self.provider)
    }

    /// Capability matrix for this account's provider (see
    /// [`account_capabilities`]).
    pub fn capabilities(&self) -> AccountCapabilities {
        self.provider_id()
            .map(account_capabilities)
            .unwrap_or_else(AccountCapabilities::minimal)
    }

    pub fn touch(&mut self) {
        self.updated_at = now_epoch_secs();
    }
}

/// What a provider's authentication can legitimately support. Derived from
/// the provider integration, never user-configurable — this prevents the UI
/// from offering unsupported multi-account behavior.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AccountCapabilities {
    /// Multiple credentials can be stored side by side (API-key providers).
    pub supports_multiple_stored_accounts: bool,
    /// More than one account can be monitored concurrently.
    pub supports_concurrent_monitoring: bool,
    /// The account in use can be switched by the user inside QuotaArc.
    pub supports_account_switching: bool,
    /// CLI tooling supports isolated accounts/configs.
    pub supports_cli_isolation: bool,
    pub supports_oauth: bool,
    pub supports_api_key: bool,
    pub supports_browser_session: bool,
    /// The provider reports a stable account identity on usage responses.
    pub supports_official_account_identity: bool,
    pub supports_usage: bool,
    pub supports_costs: bool,
    pub supports_reset_windows: bool,
}

impl Default for AccountCapabilities {
    fn default() -> Self {
        Self::minimal()
    }
}

impl AccountCapabilities {
    fn minimal() -> Self {
        Self {
            supports_multiple_stored_accounts: false,
            supports_concurrent_monitoring: false,
            supports_account_switching: false,
            supports_cli_isolation: false,
            supports_oauth: false,
            supports_api_key: false,
            supports_browser_session: false,
            supports_official_account_identity: false,
            supports_usage: false,
            supports_costs: false,
            supports_reset_windows: false,
        }
    }

    /// Base: this provider can report usage.
    fn with_usage(mut self) -> Self {
        self.supports_usage = true;
        self
    }
}

/// Providers whose primary auth is an API key: several keys can be stored
/// and monitored as separate accounts.
const API_KEY_MULTI_ACCOUNT_PROVIDERS: &[ProviderId] = &[
    ProviderId::OpenRouter,
    ProviderId::DeepSeek,
    ProviderId::Groq,
    ProviderId::Fireworks,
    ProviderId::DeepInfra,
    ProviderId::Mistral,
    ProviderId::Venice,
    ProviderId::NanoGPT,
    ProviderId::OpenAIApi,
    ProviderId::AzureOpenAI,
    ProviderId::Xai,
    ProviderId::LiteLLM,
    ProviderId::LLMProxy,
];

/// Providers with inherited multi-account support (Codex token accounts).
const INHERITED_MULTI_ACCOUNT_PROVIDERS: &[ProviderId] = &[ProviderId::Codex];

/// Providers that authenticate through a single official CLI/browser session
/// on this machine (Claude Code, Gemini CLI, Copilot CLI, …). QuotaArc reads
/// the session; it must not manufacture additional ones.
const SINGLE_SESSION_PROVIDERS: &[ProviderId] = &[
    ProviderId::Claude,
    ProviderId::Cursor,
    ProviderId::Gemini,
    ProviderId::Antigravity,
    ProviderId::Copilot,
    ProviderId::OpenCode,
    ProviderId::OpenCodeGo,
    ProviderId::Kiro,
    ProviderId::Windsurf,
    ProviderId::Kimi,
];

/// Capability matrix for a provider. Conservative by construction: unknown
/// providers get usage-only.
pub fn account_capabilities(provider: ProviderId) -> AccountCapabilities {
    let mut caps = AccountCapabilities::minimal().with_usage();
    caps.supports_reset_windows = true;

    if API_KEY_MULTI_ACCOUNT_PROVIDERS.contains(&provider) {
        caps.supports_api_key = true;
        caps.supports_multiple_stored_accounts = true;
        caps.supports_concurrent_monitoring = true;
        caps.supports_account_switching = true;
        caps.supports_costs = true;
    } else if INHERITED_MULTI_ACCOUNT_PROVIDERS.contains(&provider) {
        caps.supports_oauth = true;
        caps.supports_multiple_stored_accounts = true;
        caps.supports_concurrent_monitoring = true;
        caps.supports_account_switching = true;
        caps.supports_costs = true;
        caps.supports_official_account_identity = true;
    } else if SINGLE_SESSION_PROVIDERS.contains(&provider) {
        caps.supports_oauth = true;
        caps.supports_browser_session = true;
        caps.supports_account_switching = true;
        caps.supports_costs = true;
    }

    caps
}

/// Whether a provider is represented as "Single active CLI account" in the
/// UI (no additional stored identities).
pub fn is_single_session(provider: ProviderId) -> bool {
    SINGLE_SESSION_PROVIDERS.contains(&provider)
        && !INHERITED_MULTI_ACCOUNT_PROVIDERS.contains(&provider)
}

/// The persisted profile store.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ProfileStore {
    pub schema_version: u32,
    pub profiles: Vec<QuotaArcProfile>,
    pub accounts: Vec<ProviderAccount>,
    /// The currently active profile. Always resolves (falls back to first).
    pub active_profile_id: EntityId,
}

impl Default for ProfileStore {
    fn default() -> Self {
        let profile = QuotaArcProfile::new("Default");
        Self {
            schema_version: PROFILES_SCHEMA_VERSION,
            active_profile_id: profile.id.clone(),
            profiles: vec![profile],
            accounts: Vec::new(),
        }
    }
}

/// Migrate a legacy (0.1.0) settings file into a schema-1 store: one
/// "Default" profile, one "Main" account per enabled provider, surfaces
/// carried into the profile. Pure function — unit tested.
pub fn migrate_from_legacy(settings: &Settings) -> ProfileStore {
    let mut store = ProfileStore::default();
    let mut profile = QuotaArcProfile::new("Default");
    profile.surfaces = ProfileSurfaces::from_settings(settings);
    // Legacy settings already own the global preference. The new default
    // profile inherits it; migration must not silently pin a second copy.
    profile.theme = None;
    profile.catalog_theme = None;

    // Deterministic order: HashSet iteration must not leak into storage.
    let mut provider_names: Vec<String> = settings.enabled_providers.iter().cloned().collect();
    provider_names.sort();
    for provider_cli_name in provider_names {
        if let Some(provider) = ProviderId::from_cli_name(&provider_cli_name) {
            let mut account = ProviderAccount::new(provider, "Main");
            account.credential_reference = if is_single_session(provider) {
                CredentialReference::cli_session()
            } else {
                CredentialReference::default()
            };
            profile.account_ids.push(account.id.clone());
            store.accounts.push(account);
        }
    }

    store.active_profile_id = profile.id.clone();
    store.profiles = vec![profile];
    store
}

impl ProfileStore {
    pub fn path() -> Option<PathBuf> {
        crate::paths::config_dir().map(|p| p.join("profiles.json"))
    }

    /// Load the store, migrating/creating as needed. Never fails hard: a
    /// corrupt store degrades to a fresh default (settings are authoritative
    /// for provider enablement, so nothing user-visible is lost).
    pub fn load() -> Self {
        let Some(path) = Self::path() else {
            return Self::default();
        };
        let Ok(raw) = crate::secure_file::read_string(&path) else {
            return Self::migrate_if_needed();
        };
        match serde_json::from_str::<ProfileStore>(&raw) {
            Ok(mut store) => {
                store.normalize();
                store
            }
            Err(error) => {
                tracing::warn!(%error, "profiles.json unreadable; starting from default store");
                Self::migrate_if_needed()
            }
        }
    }

    /// Create the store from legacy settings when no store file exists yet.
    /// The migrated store is persisted immediately so the Default profile
    /// exists on disk right after the first launch of 0.2.x.
    pub fn migrate_if_needed() -> Self {
        let store = migrate_from_legacy(&Settings::load());
        let needs_write = Self::path().map(|p| !p.exists()).unwrap_or(false);
        if needs_write {
            let _save = store.save();
        }
        store
    }

    pub fn save(&self) -> Result<(), String> {
        let Some(path) = Self::path() else {
            return Err("Could not resolve profiles path".to_string());
        };
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        crate::secure_file::write_string(&path, &json).map_err(|e| e.to_string())
    }

    /// Keep invariants: active profile exists, ids unique, thresholds sane.
    pub fn normalize(&mut self) {
        if self.profiles.is_empty() {
            *self = Self::default();
        }
        if !self.profiles.iter().any(|p| p.id == self.active_profile_id)
            && let Some(first) = self.profiles.first()
        {
            self.active_profile_id = first.id.clone();
        }
        let mut seen = std::collections::HashSet::new();
        self.profiles.retain(|p| seen.insert(p.id.clone()));
        self.accounts.retain(|a| seen.insert(format!("a:{}", a.id)));
        for profile in &mut self.profiles {
            let account_ids: std::collections::HashSet<String> =
                self.accounts.iter().map(|a| a.id.clone()).collect();
            profile.account_ids.retain(|id| account_ids.contains(id));
            profile.high_usage_threshold = profile.high_usage_threshold.clamp(1, 99);
            profile.critical_usage_threshold = profile.critical_usage_threshold.clamp(1, 100);
            profile.catalog_theme = profile
                .catalog_theme
                .as_deref()
                .and_then(crate::settings::canonical_catalog_theme);
        }
        self.schema_version = PROFILES_SCHEMA_VERSION;
    }

    pub fn active_profile(&self) -> &QuotaArcProfile {
        self.profiles
            .iter()
            .find(|p| p.id == self.active_profile_id)
            .or_else(|| self.profiles.first())
            .expect("normalize guarantees a profile")
    }

    pub fn active_profile_mut(&mut self) -> Option<&mut QuotaArcProfile> {
        let id = self.active_profile_id.clone();
        self.profiles.iter_mut().find(|p| p.id == id)
    }

    /// Accounts visible in the active profile.
    pub fn active_accounts(&self) -> Vec<&ProviderAccount> {
        let active = self.active_profile();
        self.accounts
            .iter()
            .filter(|a| active.account_ids.contains(&a.id))
            .collect()
    }

    pub fn account_by_id(&self, id: &str) -> Option<&ProviderAccount> {
        self.accounts.iter().find(|a| a.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn legacy_settings() -> Settings {
        Settings {
            enabled_providers: ["claude".to_string(), "codex".to_string()]
                .into_iter()
                .collect(),
            edge_arc_enabled: true,
            top_arc_enabled: false,
            ..Settings::default()
        }
    }

    #[test]
    fn migration_creates_default_profile_with_main_accounts() {
        let store = migrate_from_legacy(&legacy_settings());
        assert_eq!(store.schema_version, PROFILES_SCHEMA_VERSION);
        assert_eq!(store.profiles.len(), 1);
        assert_eq!(store.profiles[0].name, "Default");
        assert!(store.profiles[0].theme.is_none());
        assert_eq!(store.accounts.len(), 2);
        assert_eq!(store.accounts[0].display_name, "Main");
        assert_eq!(store.accounts[0].provider, "claude");
        assert_eq!(store.accounts[1].provider, "codex");
        assert_eq!(store.profiles[0].account_ids.len(), 2);
        assert!(store.profiles[0].surfaces.edge_arc);
        assert!(!store.profiles[0].surfaces.top_arc);
        assert_eq!(store.active_profile_id, store.profiles[0].id);
    }

    #[test]
    fn migration_is_idempotent_in_shape() {
        let a = migrate_from_legacy(&legacy_settings());
        let b = migrate_from_legacy(&legacy_settings());
        assert_eq!(a.profiles.len(), b.profiles.len());
        assert_eq!(a.accounts.len(), b.accounts.len());
        // ids are random, so only shape is compared
    }

    #[test]
    fn capability_matrix_disallows_unsupported_multi_account() {
        let claude = account_capabilities(ProviderId::Claude);
        assert!(claude.supports_oauth);
        assert!(!claude.supports_multiple_stored_accounts);
        assert!(is_single_session(ProviderId::Claude));

        let openrouter = account_capabilities(ProviderId::OpenRouter);
        assert!(openrouter.supports_api_key);
        assert!(openrouter.supports_multiple_stored_accounts);
        assert!(!is_single_session(ProviderId::OpenRouter));

        let codex = account_capabilities(ProviderId::Codex);
        assert!(codex.supports_multiple_stored_accounts);

        let unknown = account_capabilities(ProviderId::ZoomMate);
        assert!(unknown.supports_usage);
        assert!(!unknown.supports_multiple_stored_accounts);
    }

    #[test]
    fn normalize_repairs_broken_active_profile() {
        let mut store = migrate_from_legacy(&legacy_settings());
        let other = QuotaArcProfile::new("Other");
        let other_id = other.id.clone();
        store.profiles.push(other);
        store.active_profile_id = "missing".to_string();
        store.normalize();
        assert_eq!(store.active_profile_id, store.profiles[0].id);
        assert!(store.profiles.iter().any(|p| p.id == other_id));
    }

    #[test]
    fn normalize_drops_corrupt_profile_catalog_theme() {
        let mut store = migrate_from_legacy(&legacy_settings());
        store.profiles[0].catalog_theme = Some("not-a-theme".to_string());
        store.normalize();
        assert!(store.profiles[0].catalog_theme.is_none());
    }

    #[test]
    fn normalize_drops_dangling_account_references() {
        let mut store = migrate_from_legacy(&legacy_settings());
        let profile_id = store.profiles[0].id.clone();
        store
            .profiles
            .iter_mut()
            .find(|p| p.id == profile_id)
            .unwrap()
            .account_ids
            .push("ghost".to_string());
        store.normalize();
        assert!(!store.profiles[0].account_ids.contains(&"ghost".to_string()));
    }

    #[test]
    fn accounts_never_embed_secrets() {
        let account = ProviderAccount::new(ProviderId::Claude, "Work");
        let json = serde_json::to_string(&account).unwrap();
        assert!(json.contains("cli-session"));
        assert!(!json.to_lowercase().contains("token"));
        assert!(!json.to_lowercase().contains("apikey"));
        assert!(!json.to_lowercase().contains("secret"));
    }

    #[test]
    fn profile_round_trips_through_json() {
        let mut store = migrate_from_legacy(&legacy_settings());
        let mut p = QuotaArcProfile::new("Night");
        p.theme = Some(ThemePreference::Dark);
        p.catalog_theme = Some("05-noir-constellation".to_string());
        p.account_ids = store.accounts.iter().map(|a| a.id.clone()).collect();
        store.profiles.push(p);
        let json = serde_json::to_string(&store).unwrap();
        let mut back: ProfileStore = serde_json::from_str(&json).unwrap();
        back.normalize();
        assert_eq!(back.profiles.len(), store.profiles.len());
        assert_eq!(back.profiles[1].name, "Night");
        assert!(matches!(
            back.profiles[1].theme,
            Some(ThemePreference::Dark)
        ));
        assert_eq!(back.profiles[1].catalog_theme.as_deref(), None,);
    }
}
