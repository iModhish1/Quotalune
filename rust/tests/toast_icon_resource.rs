//! Regression guard for the packaged toast icon resource name.
//!
//! The Windows toast is branded by resolving a Tauri *resource* whose name is
//! declared in `tauri.conf.json` and looked up by literal string in the shell's
//! `main.rs`. Nothing in the type system ties those two together, so a rebrand
//! that renames only one of them compiles cleanly, ships, and silently drops
//! the logo from every notification — with nothing but a `tracing::warn!` at
//! startup to show for it.
//!
//! This test reads both files and fails when the resolved literal in
//! `main.rs` is not among the names the bundle actually packages. That exact
//! divergence is what shipped once already.

use std::path::PathBuf;

fn repo_root() -> PathBuf {
    // CARGO_MANIFEST_DIR is `<repo>/rust` for this crate.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("rust/ always has a parent directory")
        .to_path_buf()
}

fn read(relative: &str) -> String {
    let path = repo_root().join(relative);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()))
}

/// Every destination name the bundle maps a brand asset onto.
fn packaged_resource_names() -> Vec<String> {
    let config = read("apps/desktop-tauri/src-tauri/tauri.conf.json");
    let config: serde_json::Value = serde_json::from_str(&config).expect("valid Tauri config");
    config["bundle"]["resources"]
        .as_object()
        .expect("bundle.resources object")
        .values()
        .map(|destination| {
            destination
                .as_str()
                .expect("resource destination string")
                .to_string()
        })
        .collect()
}

/// The literal names `main.rs` asks Tauri to resolve as resources.
fn resolved_icon_literals() -> Vec<String> {
    read("apps/desktop-tauri/src-tauri/src/main.rs")
        .lines()
        .filter(|line| line.contains(".resolve(") && line.contains("BaseDirectory::Resource"))
        .filter_map(|line| {
            let after = line.split(".resolve(").nth(1)?;
            let quoted = after.split('"').nth(1)?;
            Some(quoted.to_string())
        })
        .collect()
}

#[test]
fn every_resolved_toast_resource_is_actually_packaged() {
    let packaged = packaged_resource_names();
    let resolved = resolved_icon_literals();

    assert!(
        !packaged.is_empty(),
        "no packaged resource destinations parsed from tauri.conf.json"
    );
    assert!(
        !resolved.is_empty(),
        "no BaseDirectory::Resource lookups found in main.rs"
    );

    for name in &resolved {
        assert!(
            packaged.iter().any(|candidate| candidate == name),
            "main.rs resolves resource {name:?}, but tauri.conf.json packages only {packaged:?}. \
             The toast would ship without its icon."
        );
    }
}

#[test]
fn packaged_toast_icon_is_not_under_a_retired_brand_name() {
    let packaged = packaged_resource_names();
    for name in &packaged {
        assert_ne!(
            name, "quotalis-icon-128.png",
            "the packaged toast icon still uses the retired Quotalis name"
        );
    }
}
