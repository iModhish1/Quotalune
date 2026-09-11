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
    // QA_BUILD_COMMIT is only as fresh as the last time this script ran --
    // without watching the repo's actual HEAD, a commit made in ANY crate
    // (this one included) without touching build.rs itself leaves cargo
    // free to reuse a cached build-script run and bake a stale commit into
    // an otherwise-fresh binary. Explicit git-state watches close that gap
    // (see scripts/build-dev-verified.mjs, which relies on git_head from
    // `--print-build-info` matching the real `git rev-parse HEAD`).
    println!("cargo:rerun-if-changed=../../../.git/HEAD");
    println!("cargo:rerun-if-changed=../../../.git/index");
    tauri_build::build()
}
