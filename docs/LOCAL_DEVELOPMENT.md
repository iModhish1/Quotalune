# Local development

QuotaArc has two local channels. Both can be installed at the same time and
never touch each other's data.

| | Personal (default) | Development |
|---|---|---|
| Display name | QuotaArc | QuotaArc Dev |
| Data root | `%APPDATA%\QuotaArc`, `%LOCALAPPDATA%\QuotaArc` | `%APPDATA%\QuotaArc-Dev`, `%LOCALAPPDATA%\QuotaArc-Dev` |
| Bundle id | `app.quotaarc.desktop` | `app.quotaarc.desktop.dev` |
| Registry/AUMID | `QuotaArc` | `QuotaArc Dev` / `QuotaArc.Dev` |
| Update checks | Local channel by default (no polling) | Local channel (never polls) |

The channel is a **compile-time** cargo feature (`dev-channel`) — it is not a
runtime setting, so no code path or test can accidentally point a dev build at
personal data.

## Commands

```powershell
# Tests (Personal data root is never used by tests; stores resolve per channel)
cargo test --manifest-path rust/Cargo.toml
cargo test --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml
pnpm --dir apps/desktop-tauri test

# Personal release build + installer (the owner's daily build)
pnpm --dir apps/desktop-tauri install --frozen-lockfile
pnpm --dir apps/desktop-tauri exec tauri build --bundles nsis,msi

# Development build (QuotaArc-Dev data root, "QuotaArc Dev" identity)
pnpm --dir apps/desktop-tauri exec tauri build --config src-tauri/tauri.dev.conf.json --features dev-channel --bundles nsis

# Dev run against the Vite dev server (hot reload)
pnpm --dir apps/desktop-tauri dev   # then: cargo run in src-tauri with dev config

# Proof / synthetic data (no real credentials touched)
CODEXBAR_PROOF_MODE=popOut CODEXBAR_SEED_USAGE_JSON=<abs-path-to.json> ./target/release/QuotaArc.exe
```

## Guarantees

- A `dev-channel` build resolves every store, log, cache, registry value, and
  toast AUMID through `rust/src/paths.rs`, which switches on the feature flag.
- Tests never write to either channel's live stores: unit tests use pure
  functions and temp dirs.
- `CODEXBAR_SEED_USAGE_JSON` injects a synthetic snapshot for visual proof;
  it never reads or writes provider credentials.
- Before any destructive change to the persistent data model, make a
  timestamped backup of `%APPDATA%\QuotaArc` (excluding credential stores —
  secrets stay in Windows secure storage).

## Data-model migrations

`profiles.json` carries `schemaVersion`. Migrations are pure functions tested
in `rust/src/profiles.rs` (see `migrate_from_legacy`); a 0.1.0 install
migrates into one "Default" profile with a "Main" account per enabled
provider on first load of 0.2.x.

## Secret scanning

Run `node scripts/scan-secrets.mjs` before committing anything unusual; CI
runs it in the PR gate. Before the first public release, also run a full
gitleaks pass over git history (docs/PUBLIC_RELEASE_READINESS.md).
