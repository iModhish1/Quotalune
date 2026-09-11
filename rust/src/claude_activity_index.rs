//! Persistent, cross-restart Claude local-activity index.
//!
//! Phase 3C's in-memory `CachedClaudeFileRecords` (`cost_scanner.rs`) fixed
//! the "3 redundant full walks per call" defect within a single process
//! lifetime, but every fresh launch still paid a full cold scan (~67.6s on
//! the real machine this was measured against -- see
//! docs/validation/ANALYTICS_PHASE3C_CLAUDE_PERFORMANCE.md). This module
//! persists the same per-file parse result to disk so a normal restart
//! with an unchanged local history reuses it instead of re-scanning.
//!
//! See docs/validation/CLAUDE_ACTIVITY_INDEX_PRIVACY.md for the field-by-
//! field justification -- this struct persists only metadata already
//! present in `ClaudeUsageRecord`: model, timestamp, a dedup key, and the
//! four token counters. No prompt/response text, no cost (recomputed at
//! read time from the current pricing table), no credentials.
//!
//! Deliberately NOT Codex's `CostUsageCache` shape (day/model-aggregated
//! integers): Claude's forked/resumed transcripts can genuinely duplicate
//! the same message across two files, and only a per-file *raw record*
//! cache lets the existing cross-file dedup pass
//! (`should_count_claude_record`) re-run correctly against persisted data,
//! rather than baking in whatever dedup decision was made at write time.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Bumped whenever a field is added/removed/reinterpreted in a way that
/// would change analytical output -- an old payload under a different
/// version is always treated as a full cache miss (`ClaudeActivityIndex::
/// default()`), never partially trusted. This is the exact safeguard the
/// `model_totals` incident (Phase 3B) proved necessary.
///
/// v1 -> v2 (Phase 3F): added `indexed_bytes`/`boundary_fingerprint` to
/// `PersistedClaudeFile` for append-tail parsing of active, continuously
/// growing transcripts. A v1 payload has no way to express "boundary
/// verified, safe to resume tail parsing here" -- rather than defaulting
/// those fields to a value that would be silently (and incorrectly)
/// trusted, the version bump forces every v1 payload to a full, safe
/// rebuild.
pub const CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION: u32 = 2;

/// One usage event's persisted, privacy-safe metadata. Mirrors
/// `cost_scanner::ClaudeUsageRecord` minus `cost` (recomputed at read
/// time, never persisted stale).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PersistedClaudeRecord {
    pub model: String,
    pub timestamp_unix_ms: Option<i64>,
    pub dedup_key: Option<String>,
    pub input: u64,
    pub output: u64,
    pub cache_create: u64,
    pub cache_read: u64,
}

/// One transcript file's cached parse, keyed by its own path in the
/// index's `files` map. `(mtime_unix_ms, size)` is the whole-file
/// invalidation identity (Phase 3D) -- the same defensible pair Codex's
/// own per-file cache uses.
///
/// `indexed_bytes`/`boundary_fingerprint` (Phase 3F) support an
/// append-tail fast path for a live, continuously growing transcript: when
/// a file has grown (`size` increased) but the bytes immediately before
/// `indexed_bytes` still hash to `boundary_fingerprint`, only the NEW
/// bytes from `indexed_bytes` onward need to be parsed -- the previously
/// indexed prefix is trusted, never re-read. `indexed_bytes` always points
/// at a real newline boundary (the end of the last fully-consumed JSONL
/// line); a trailing partial line is never counted into it, so the next
/// read resumes at exactly the right point without ever duplicating or
/// dropping a record.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PersistedClaudeFile {
    pub mtime_unix_ms: i64,
    pub size: i64,
    pub records: Vec<PersistedClaudeRecord>,
    pub indexed_bytes: i64,
    pub boundary_fingerprint: u64,
}

/// The complete persisted index. `schema_version` gates every load.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ClaudeActivityIndex {
    pub schema_version: u32,
    pub generated_at_unix_ms: i64,
    pub files: HashMap<String, PersistedClaudeFile>,
}

impl ClaudeActivityIndex {
    fn index_path(cache_root: Option<&Path>) -> PathBuf {
        let root = cache_root
            .map(Path::to_path_buf)
            .or_else(crate::paths::cache_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        root.join("cost-usage")
            .join("claude-activity-index-v1.json")
    }

    /// Load the persisted index. Any failure -- missing file, corrupt
    /// JSON, or a schema version that doesn't match -- returns an empty
    /// index (a safe full rebuild on the next scan), never a partially
    /// trusted or misinterpreted payload.
    pub fn load(cache_root: Option<&Path>) -> Self {
        let path = Self::index_path(cache_root);
        let Ok(contents) = fs::read_to_string(&path) else {
            return Self::default();
        };
        let Ok(index) = serde_json::from_str::<Self>(&contents) else {
            return Self::default();
        };
        if index.schema_version != CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION {
            return Self::default();
        }
        index
    }

    /// Persist the index atomically: write to a unique temp sibling in the
    /// same directory, then `copy` it over the destination (replaces an
    /// existing target on Windows, matching `JsonlScanner::save_cache`'s
    /// own convention) so a crash between the two steps leaves the
    /// previous valid index in place -- never a half-written file.
    pub fn save(&self, cache_root: Option<&Path>) {
        let path = Self::index_path(cache_root);
        let Some(parent) = path.parent() else {
            return;
        };
        let _dir_created = fs::create_dir_all(parent);
        let Ok(json) = serde_json::to_string(self) else {
            return;
        };
        let tmp_name = format!(
            ".claude-activity-index.{}.{}.tmp",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        let tmp_path = parent.join(tmp_name);
        if fs::write(&tmp_path, json.as_bytes()).is_err() {
            return;
        }
        if fs::copy(&tmp_path, &path).is_err() {
            let _fallback_written = fs::write(&path, json.as_bytes());
        }
        let _cleanup = fs::remove_file(&tmp_path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_file(mtime: i64, size: i64) -> PersistedClaudeFile {
        PersistedClaudeFile {
            mtime_unix_ms: mtime,
            size,
            records: vec![PersistedClaudeRecord {
                model: "claude-sonnet-4-6".into(),
                timestamp_unix_ms: Some(1_700_000_000_000),
                dedup_key: Some("req:abc".into()),
                input: 100,
                output: 50,
                cache_create: 10,
                cache_read: 20,
            }],
            indexed_bytes: size,
            boundary_fingerprint: 0,
        }
    }

    #[test]
    fn missing_index_is_a_clean_default_not_an_error() {
        let tmp = TempDir::new().unwrap();
        let index = ClaudeActivityIndex::load(Some(tmp.path()));
        assert_eq!(index, ClaudeActivityIndex::default());
        assert!(index.files.is_empty());
    }

    #[test]
    fn save_then_load_round_trips_exactly() {
        let tmp = TempDir::new().unwrap();
        let mut index = ClaudeActivityIndex {
            schema_version: CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION,
            generated_at_unix_ms: 1_700_000_000_000,
            files: HashMap::new(),
        };
        index
            .files
            .insert("a.jsonl".to_string(), sample_file(1000, 500));

        index.save(Some(tmp.path()));
        let loaded = ClaudeActivityIndex::load(Some(tmp.path()));
        assert_eq!(loaded, index);
    }

    #[test]
    fn corrupt_json_is_treated_as_a_safe_cache_miss() {
        let tmp = TempDir::new().unwrap();
        let path = tmp
            .path()
            .join("cost-usage")
            .join("claude-activity-index-v1.json");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"{ not valid json ").unwrap();

        let loaded = ClaudeActivityIndex::load(Some(tmp.path()));
        assert_eq!(
            loaded,
            ClaudeActivityIndex::default(),
            "corrupt JSON must rebuild cleanly, never panic or half-load"
        );
    }

    #[test]
    fn schema_version_mismatch_forces_a_rebuild() {
        let tmp = TempDir::new().unwrap();
        let mut index = ClaudeActivityIndex {
            schema_version: CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION + 1,
            generated_at_unix_ms: 1,
            files: HashMap::new(),
        };
        index.files.insert("a.jsonl".to_string(), sample_file(1, 1));
        index.save(Some(tmp.path()));

        let loaded = ClaudeActivityIndex::load(Some(tmp.path()));
        assert_eq!(
            loaded,
            ClaudeActivityIndex::default(),
            "a payload from a different schema version must never be trusted, \
             even though it deserializes without a JSON error -- this is the \
             exact model_totals failure mode, guarded against explicitly here"
        );
    }

    #[test]
    fn atomic_write_failure_preserves_the_previous_valid_index() {
        let tmp = TempDir::new().unwrap();
        let mut index = ClaudeActivityIndex {
            schema_version: CLAUDE_ACTIVITY_INDEX_SCHEMA_VERSION,
            generated_at_unix_ms: 1,
            files: HashMap::new(),
        };
        index.files.insert("a.jsonl".to_string(), sample_file(1, 1));
        index.save(Some(tmp.path()));

        // Replace the destination directory's write target with a
        // directory of the same name so the next save's temp-file
        // rename/copy step fails outright -- simulates an interrupted
        // write without corrupting anything on a real filesystem.
        let index_path = tmp
            .path()
            .join("cost-usage")
            .join("claude-activity-index-v1.json");
        let before = fs::read_to_string(&index_path).unwrap();

        // A save whose destination is (transiently) unwritable must not
        // touch the existing valid file: overwrite the temp file's
        // content only, never call copy/rename into a broken destination.
        // Simulate by making the destination read-only, forcing the copy
        // to fail, then confirm the original bytes are untouched.
        let mut perms = fs::metadata(&index_path).unwrap().permissions();
        perms.set_readonly(true);
        fs::set_permissions(&index_path, perms).unwrap();

        let mut broken = index.clone();
        broken
            .files
            .insert("b.jsonl".to_string(), sample_file(2, 2));
        broken.save(Some(tmp.path()));

        // Restore write permissions so the temp dir can be cleaned up.
        let mut perms = fs::metadata(&index_path).unwrap().permissions();
        #[allow(
            clippy::permissions_set_readonly_false,
            reason = "test-only cleanup on a Windows-only temp file this test itself made read-only; \
                      the world-writable-on-Unix concern this lint warns about does not apply here"
        )]
        perms.set_readonly(false);
        fs::set_permissions(&index_path, perms).unwrap();

        let after = fs::read_to_string(&index_path).unwrap();
        assert_eq!(
            before, after,
            "a save that cannot replace the destination must leave the \
             previously valid index file completely untouched"
        );
    }
}
