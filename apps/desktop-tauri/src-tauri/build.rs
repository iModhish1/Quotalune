fn main() {
    // Build provenance: embed git commit + dirty state + build timestamp.
    // These are exposed via env!() in Rust code and displayed in About.
    let commit = std::process::Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    println!("cargo:rustc-env=QA_BUILD_COMMIT={commit}");

    let dirty = std::process::Command::new("git")
        .args(["diff", "--quiet"])
        .status()
        .map(|s| !s.success())
        .unwrap_or(false);
    println!("cargo:rustc-env=QA_BUILD_DIRTY={dirty}");

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    println!("cargo:rustc-env=QA_BUILD_TIMESTAMP={ts}");

    println!("cargo:rustc-env=QA_BUILD_ARCH={}", std::env::consts::ARCH);
    println!("cargo:rerun-if-changed=build.rs");
    tauri_build::build()
}
