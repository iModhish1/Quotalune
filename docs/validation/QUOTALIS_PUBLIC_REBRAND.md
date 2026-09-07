# Quotalis Public Rebrand — Validation

Date: 2026-09-08. Worktree: `N:\QuotaArc\quotalis-rebrand`, branch
`integration/quotalis-public-rebrand`. Covers all three rebrand passes on
this branch: the active-UI text rename (`14f57d67`), the packaging-identity
follow-up (`4ac69f55`..`0661f4c9`), and this installation/compatibility
closure pass.

## Installation/compatibility closure (this pass)

### Real installer artifacts built and hashed

`pnpm --dir apps/desktop-tauri exec tauri build --config
src-tauri/tauri.dev.conf.json --features dev-channel --bundles nsis`
(then `--bundles msi`) — Tauri fetched its own NSIS/WiX tooling
automatically (no manual toolchain install was needed or performed):

| Artifact | Path | SHA-256 | Size |
|---|---|---|---|
| Dev binary | `target\debug\QuotalisDev.exe` | `607B2385695EF1D81E1911F024A0D3D4B3356B683927C333437BFA6F377E8D4A` | 51,310,080 bytes |
| NSIS installer | `target\debug\bundle\nsis\Quotalis Dev_0.10.1_x64-setup.exe` | `B6AF32A2698BC924A125510EFFCAA2AE785DEBA4A3D5016FD64D2289A7400AF7` | 10,155,868 bytes |
| MSI installer (en-US) | `target\debug\bundle\msi\Quotalis Dev_0.10.1_x64_en-US.msi` | `82D40EA7B9823D356FEFF26A1AB9683C949F908E7B1590BB7FB3F3C5B77B35AE` | 15,933,440 bytes |

`QuotalisDev.exe`'s embedded VersionInfo: `ProductName`/`FileDescription`
= "Quotalis Dev", `CompanyName` = "Quotalis", `FileVersion` = 0.10.1 — this
resolves the prior report's open question: Tauri's bundler, invoked with
the documented `--config tauri.dev.conf.json --features dev-channel`
command from `docs/LOCAL_DEVELOPMENT.md`, does produce a distinctly-named
`QuotalisDev.exe` (not merely `Quotalis.exe` compiled with the dev-channel
feature, which is what a raw `cargo build` produces instead).

7 additional localized MSI variants were also produced (zh-CN, zh-TW,
ja-JP, ko-KR, es-ES, ru-RU, tr-TR) — not individually hashed.

### Real Dev launch + isolation proof

`QuotalisDev.exe` was launched directly (`Start-Process ... menubar`),
producing PID 40020, confirmed running via `Get-Process`. Comparing
`%APPDATA%\QuotaArc-Dev` and `%APPDATA%\QuotaArc` file timestamps before
and after the launch showed only the Dev root's `history.db-wal`,
`notification-dedupe.json`, and `window_geometry.json` updated — the
Personal root's own near-simultaneous `settings.json` write was traced to
an unrelated, already-running `QuotaArc.exe` process (PID 37408, from the
original `N:\QuotaArc\quotaarc` worktree's own debug build, pre-existing
and untouched by this session) rather than any cross-contamination from
the Dev launch. The test process was then cleanly terminated
(`Stop-Process`, confirmed not running afterward).

### Secure-storage, history, and settings/profile compatibility — proven executably

See `docs/validation/QUOTALIS_ROLLBACK_PLAN.md`'s "What was actually
tested this pass" section for the full list of 4 new fixture-based Rust
tests (history reopen, DPAPI-backed secure-file round-trip, settings
fixture, profiles fixture) — all passing, all using synthetic data, no
Personal secrets read or exposed.

### New finding: a second, older packaging pipeline still says CodexBar

While investigating the installer toolchain (owner spec section 7),
`scripts/windows-release-build.ps1` — documented in `docs/BUILDING.md` and
two ADRs as **the canonical release path** — was found to drive a
completely separate Inno Setup pipeline
(`rust/installer/codexbar.iss`, 9 occurrences of "CodexBar"/"codexbar")
building the standalone `rust` crate's own CLI binary (`cargo build --bin
quotaarc` — already renamed to `quotaarc` at some point in this project's
history, predating this session, but never renamed further to `quotalis`).
This is distinct from the Tauri NSIS/MSI bundler exercised above and
**was not touched this pass** — it needs its own dedicated audit (Inno
Setup toolchain availability, whether it's still the actual mechanism used
for real releases or superseded by the Tauri bundler, and the same
current/legacy dual-naming care applied everywhere else in this rebrand)
before being renamed. Portable-package support (owner spec section 10)
lives inside this same script (`CodexBar-$version-portable.exe`) and was
not independently tested for the same reason.

### Not attempted: actual installer execution

No installer (NSIS or MSI) was run/installed — see
`docs/validation/QUOTALIS_ROLLBACK_PLAN.md` for why this is treated as
requiring explicit confirmation rather than being silently attempted or
silently skipped.

## Before / after matrix

| Surface | Before | After |
|---|---|---|
| Window titles (main, Settings, Collections, flyout, Edge/Top/Taskbar Arc, Float Bar) | QuotaArc | Quotalis |
| Tray tooltip / "Open QuotaArc" menu label | QuotaArc | Quotalis |
| About screen (`get_app_info().name`) | QuotaArc | Quotalis |
| Settings shell header brand name + logo mark label | QuotaArc | Quotalis |
| Error boundary heading/button | QuotaArc | Quotalis |
| Collections window wordmark | QuotaArc | Quotalis |
| Dashboard Studio settings copy | QuotaArc | Quotalis |
| 9 locale files' `AppName` + brand prose (About/tray/hooks/shortcuts/etc.) | QuotaArc | Quotalis (all languages, Arabic UI keeps the Latin wordmark) |
| README title/intro/highlights/acknowledgments | QuotaArc | Quotalis (+ historical note; upstream Win-CodexBar/CodexBar attribution preserved verbatim) |
| CHANGELOG | (no rebrand entry) | `[Unreleased]` entry added, historical entries untouched |
| Tauri `productName` / `mainBinaryName` (Personal + Dev) | QuotaArc / QuotaArc / QuotaArc Dev / QuotaArcDev | Quotalis / Quotalis / Quotalis Dev / QuotalisDev |
| Bundle `publisher` metadata | unset (derived "quotaarc") | Quotalis |
| Cargo `[[bin]] name` | QuotaArc | Quotalis |
| `paths::USER_AGENT` | QuotaArc | Quotalis |
| `paths::INSTALLER_STEM` | QuotaArc[-Dev] | Quotalis[-Dev] (legacy value kept as `LEGACY_INSTALLER_STEM`) |
| Dev/proof/release scripts referencing the built exe | `QuotaArc.exe`/`QuotaArcDev.exe` | `Quotalis.exe`/`QuotalisDev.exe` |
| Bundle identifier (`app.quotaarc.desktop[.dev]`) | QuotaArc | **unchanged, intentionally** (Option A) |
| Data directory (`%APPDATA%\QuotaArc[-Dev]`) | QuotaArc | **unchanged, intentionally** (Option A) |
| Registry Run value / Toast AUMID | QuotaArc | **unchanged, intentionally**, documented as `LEGACY_SECURITY_COMPATIBILITY` |
| ~30 OS-keychain credential-target strings, `secure_file.rs` format tag | QuotaArc-derived | **unchanged, intentionally** — real user credential/secret compatibility risk, not touched |

## Intentional legacy references (verified still present, classified)

- `Win-CodexBar` / `CodexBar` upstream attribution (Cargo.toml, README,
  CHANGELOG, `paths.rs`/`snapshot.rs` doc comments) — third-party
  provenance, never renamed.
- `%APPDATA%\QuotaArc\hooks.json` locale path hint (9 languages) — the real,
  current, unmigrated path; a regression test
  (`no_locale_value_says_quotaarc_except_the_documented_legacy_path_hint`)
  pins this as the one allowed exception.
- `NotificationSoundThemeQuotaArc` / `TrayOpenQuotaArc` locale key
  identifiers — mirror `LocaleKey` enum variants and (for the former) a
  persisted `NotificationSoundTheme::CodexBar` enum wire value; only their
  display VALUES were renamed.
- `LEGACY_EXE_NAME`, `LEGACY_INSTALLER_STEM` (new `paths.rs` constants),
  `APP_DIR_NAME`, `REGISTRY_RUN_VALUE`, `TOAST_AUMID` — all documented
  `LEGACY_SECURITY_COMPATIBILITY`/data-continuity identifiers, intentionally
  unchanged.
- `codexbar-cli.exe`/`codexbar-desktop.exe` legacy-alias checks in
  `settings.rs`/`updater.rs` — pre-date QuotaArc entirely, unrelated to this
  rebrand, untouched.
- ~30 `CREDENTIAL_TARGET: &str = "codexbar-<provider>"` constants and
  `secure_file.rs`'s `"codexbar.secure-file"` format tag — real stored-data
  compatibility risk, explicitly out of scope, unchanged.

## Windows metadata (real, inspected evidence)

A fresh `cargo build --features dev-channel -p codexbar-desktop-tauri` in
this worktree produced `target\debug\Quotalis.exe`. Its embedded Windows
VERSIONINFO resource, read via PowerShell `Get-Item ... .VersionInfo`:

```
ProductName: Quotalis
FileDescription: Quotalis
CompanyName: Quotalis
FileVersion / ProductVersion: 0.10.1
```

This is real, on-disk, OS-verified evidence — not a config-file assumption.

## Test evidence

- `cargo test --workspace`: **1977 passed, 0 failed, 1 ignored** (455 +
  1522 + 1 across the two crates plus a doc-test run), including 4 new
  Quotalis-specific regression tests:
  - `paths::tests::public_brand_is_quotalis_legacy_windows_identity_is_quotaarc`
  - `locale::tests::no_locale_value_says_quotaarc_except_the_documented_legacy_path_hint`
  - `commands::system::tests::app_info_reports_the_current_public_brand`
  - `updater::tests::installer_asset_matching_recognizes_both_legacy_and_current_brand`
- `cargo clippy --workspace --all-targets -- -D warnings`: clean.
- `cargo fmt --all -- --check`: clean.
- `npx vitest run` (frontend): **793 tests passed** across 130 files,
  including every production surface's rendered-brand assertion updated to
  "Quotalis" (About, Settings header, error boundary, Collections,
  Dashboard Studio, tray-adjacent aria-labels).
- `npx tsc --noEmit`: clean. `npm run build`: succeeded.
- `node scripts/scan-secrets.mjs`: clean.
- `node scripts/check-locale-drift.mjs`: clean, 981 keys still match
  between Rust and TS in both directions.
- `git diff --check`: clean (only benign LF→CRLF checkout-normalization
  warnings, no real whitespace errors).

## Known limitations (honest, not attempted this pass)

- **No NSIS/MSI installer was actually built or inspected.** This machine
  has no `makensis` on PATH; Tauri can fetch its own NSIS tooling on first
  `cargo tauri build`, but that build (and inspecting the resulting
  installer's display name, shortcut, and uninstall-registry metadata) was
  not attempted. Sections 13-16, 35 of the packaging spec remain open.
- **No simulated legacy-upgrade fixture or installer run.** Requires the
  installer artifact above to exist first; not built.
- **No Start Menu pin preservation test against a real install.** The
  Option A reasoning (stable AppUserModelID → Windows preserves the pin) is
  architecturally sound and matches how Windows resolves shortcut identity,
  but has not been verified against an actual pinned QuotaArc shortcut on
  this machine.
- **No native screenshot/GUI launch.** Same limitation as every prior phase
  in this project — no native capture capability in this environment. The
  Windows VERSIONINFO inspection above is the strongest available
  substitute evidence, clearly labeled as such.
- **Registry Run value not renamed.** Deliberately deferred — see
  `paths.rs`'s `REGISTRY_RUN_VALUE` doc comment for why a bare rename would
  leave a stale registry entry for anyone who already enabled
  start-at-login.
- **Version not bumped.** Current version is `0.10.1` everywhere
  (`rust/Cargo.toml`, `apps/desktop-tauri/src-tauri/Cargo.toml`,
  `tauri.conf.json`). Recommendation, not applied: **0.11.0** as the first
  Quotalis-branded release — a real product rebrand plus packaging-identity
  change is a minor bump under this project's existing semver practice
  (patch bumps are reserved for the incremental fixes already documented
  in `rust/CHANGELOG.md`'s recent history), and reusing `0.10.1` for a
  materially renamed binary would make two different products share one
  version string. Left for the owner/release process to apply when this
  branch is actually promoted, per "do not bump version" discipline
  established earlier in this project.
- **Personal untouched.** No install, no version bump, no promotion — this
  entire pass stayed in the `integration/quotalis-public-rebrand` worktree
  and branch.
