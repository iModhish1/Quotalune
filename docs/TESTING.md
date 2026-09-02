# Testing

## Gates (all must pass before merge/release)

| Gate | Command |
|---|---|
| Rust format | `cargo fmt --manifest-path rust/Cargo.toml --all -- --check` |
| Rust lint | `cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings` (shell crate likewise) |
| Backend tests | `cargo test --manifest-path rust/Cargo.toml` (1390+ tests: parsers, normalization, reset math, forecast math, redaction, settings round-trip) |
| Shell tests | `cargo test --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml` (366 tests: command contracts, menu resolution, surface patch clamps) |
| Locale drift | `pnpm --dir apps/desktop-tauri run check-locale` (824 keys, Rust ↔ TS parity) |
| Typecheck + build | `pnpm --dir apps/desktop-tauri run build` |
| Frontend tests | `pnpm --dir apps/desktop-tauri test` (297 tests: surfaces, state transitions, error states, accessibility basics, design system) |

CI runs these on Windows via `.github/workflows/pr-check.yml`.

## Windows / window-manager testing

The brief's surface-behavior matrix (DPI, multi-monitor, Explorer restart,
sleep/resume, fullscreen, auto-hide, monitor unplug) is exercised with:

- **Proof harness** (inherited): `CODEXBAR_PROOF_MODE=trayPanel|popOut|settings`
  opens a target surface with blur-dismiss suppressed for automation.
- **Synthetic data**: `CODEXBAR_SEED_USAGE_JSON=<path>` seeds a bridge-shaped
  provider snapshot so surfaces can be validated without credentials.
- Validated in this session on native Windows: Edge Arc + Top Arc creation,
  edge-snap/top-center positioning, DPI-scaled geometry, live seeded data,
  topmost persistence over other applications.

Follow-up windows hardening items are tracked in the build report (Phase 5
list): Explorer-restart reassertion for the new surfaces and a scripted
multi-monitor matrix.

## Installer testing

See `docs/PACKAGING.md` — silent install, launch, and silent uninstall were
executed against the real NSIS artifact on 2026-09-02.

## Updater testing

The updater's installer-name parser, SHA-256 verification, and apply-script
generation have unit tests in `rust/src/updater.rs`. End-to-end update flow
requires a published release; blocked on the first `quotaarc/quotaarc` release
and documented in the build report.
