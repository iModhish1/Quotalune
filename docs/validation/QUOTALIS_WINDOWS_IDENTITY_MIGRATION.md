# Quotalis Windows Identity Migration — Decision + Implementation

Date: 2026-09-08. Worktree: `N:\QuotaArc\quotalis-rebrand`, branch
`integration/quotalis-public-rebrand` (based on `b3ad28ed`, then `6e935416`).

This document is the required decision (owner spec section 10) before any
executable/bundle-identifier/installer/Start-Menu work is attempted, **now
updated with the Option A implementation results** from the follow-up
packaging-identity pass (HEAD `6e935416` → this pass). **No code changes
described as "Option B" below have been made** — that section remains a
decision record only.

## Implemented (this pass)

| Item | Before | After | Evidence |
|---|---|---|---|
| Tauri `productName` | `QuotaArc` | `Quotalis` | `tauri.conf.json:3` |
| Tauri `mainBinaryName` | `QuotaArc` | `Quotalis` | `tauri.conf.json:84` |
| Tauri Dev `productName` | `QuotaArc Dev` | `Quotalis Dev` | `tauri.dev.conf.json:3` |
| Tauri Dev `mainBinaryName` | `QuotaArcDev` | `QuotalisDev` | `tauri.dev.conf.json:4` |
| Bundle `publisher` | unset (derived "quotaarc" from the identifier) | `Quotalis` | `tauri.conf.json` bundle section |
| Cargo `[[bin]] name` | `QuotaArc` | `Quotalis` | `apps/desktop-tauri/src-tauri/Cargo.toml` |
| Bundle identifier | `app.quotaarc.desktop` / `.dev` | **unchanged** (Option A) | `tauri.conf.json:5`, `tauri.dev.conf.json:5` |
| Data directory | `%APPDATA%\QuotaArc[-Dev]` | **unchanged** (Option A) | `rust/src/paths.rs::APP_DIR_NAME` |
| Registry Run value / Toast AUMID | `QuotaArc` / `app.quotaarc.desktop` | **unchanged** (Option A, documented as `LEGACY_SECURITY_COMPATIBILITY`) | `rust/src/paths.rs` |
| `paths::USER_AGENT` | `QuotaArc` | `Quotalis` | self-referential outbound header only |
| `paths::INSTALLER_STEM` | `QuotaArc[-Dev]` | `Quotalis[-Dev]` | new `LEGACY_INSTALLER_STEM` constant preserves the old value for documentation |
| `paths::CURRENT_EXE_NAME` (new) | — | `Quotalis.exe` / `QuotalisDev.exe` | new constant |
| `paths::LEGACY_EXE_NAME` (new) | — | `QuotaArc.exe` / `QuotaArcDev.exe` | new constant, reference-only (see below) |

### Real native evidence: a fresh Dev build

```
cargo build --features dev-channel -p codexbar-desktop-tauri
```
produced `target\debug\Quotalis.exe` directly — the renamed Cargo `[[bin]]`
name took effect immediately, no manual file rename. Inspected with
PowerShell `Get-Item ... | .VersionInfo` (real, on this machine, not
simulated):

```
Path: N:\QuotaArc\quotalis-rebrand\target\debug\Quotalis.exe
SHA256: 69FAF836E6810BD0A8D16040C5FA702E73114E9EF6FD64C097DB4DC328470A73
ProductName: Quotalis
FileDescription: Quotalis
CompanyName: Quotalis   (was "quotaarc", derived from the identifier, until
                          the "publisher" field was added — see above)
FileVersion / ProductVersion: 0.10.1
```

This is Windows' own embedded VERSIONINFO resource (populated by
`tauri-build` from `tauri.conf.json`), inspected via the real OS API — the
strongest evidence available without launching the GUI and taking a
screenshot (still not possible in this environment).

### Audit result: no dual current/legacy detection logic was needed

The follow-up audit (owner spec section 7/8/9) searched every site that
matches `QuotaArc.exe`/`codexbar.exe`-shaped strings in production code
(`rust/src/settings.rs`, `rust/src/updater.rs`,
`apps/desktop-tauri/src-tauri/src/tray_visibility.rs`) and found:

- **`updater.rs::is_installer_asset_name`** matches by suffix only
  (`-setup.exe` / `.msi`), never by product-name prefix — it already
  recognizes `QuotaArc-1.2.3-x64-Setup.exe` and `Quotalis-1.2.3-x64-Setup.exe`
  identically. Proven by a new test,
  `installer_asset_matching_recognizes_both_legacy_and_current_brand`.
- **`updater.rs::windows_update_relaunch_path`** and
  **`settings.rs::start_at_login_exe_path`** both resolve
  `std::env::current_exe()` dynamically and only special-case an even
  *older* legacy alias (`codexbar-cli.exe`/`codexbar-desktop.exe`, predating
  QuotaArc itself) — neither hardcodes "QuotaArc.exe", so renaming the
  built executable requires no changes here.
- **`tray_visibility.rs::matches_current_exe`/`matches_exe_file_name`** are
  generic path-comparison functions; their `QuotaArc.exe`/`codexbar.exe`
  test fixtures are illustrative example data, not brand-dependent
  production logic.

Net result: `paths::LEGACY_EXE_NAME` was added for documentation/rollback
reference (owner spec section 7's requested naming convention), but **no
runtime code path actually needed to branch on it** — a genuinely lower-risk
outcome than the original spec anticipated, verified by reading the real
logic rather than assumed.

### Not implemented this pass (real remaining work)

- **NSIS/MSI installer build and inspection** (sections 13-16, 35): no
  `makensis` on this machine's PATH; Tauri's bundler can fetch its own NSIS
  tooling on first `cargo tauri build`, but actually running a full bundle
  build, inspecting the resulting installer's display name/shortcut/
  uninstall metadata, and packaging a Dev-branded test installer was not
  attempted this pass — it needs its own dedicated pass with real installer
  output to inspect, not assumed from config alone.
- **Simulated legacy-upgrade fixture + installer run** (section 36): not
  built — this requires the installer artifact above to exist first.
- **Start Menu pin preservation test** (sections 11/12): requires an actual
  install; not performed. The bundle-identity reasoning (preserved
  AppUserModelID under Option A) is unchanged from the original decision,
  but it is still a prediction, not yet verified against a real Windows
  Start Menu pin.
- **Secure-storage compatibility test with Dev fixtures** (sections 21/22,
  33): not built this pass — no secure-storage identifier was touched
  (confirmed unchanged), so there is nothing new to verify compatibility
  against, but the owner's requested *positive* proof ("old secure files
  still decrypt after rename") was not produced either, since no encrypted
  fixture exists to test against without real user secrets.
- **Registry Run value / Start-at-login rename**: intentionally left
  as `QuotaArc`/`QuotaArc Dev` — out of this pass's scope (see
  `LEGACY_SECURITY_COMPATIBILITY` doc comment in `paths.rs`); renaming it
  would leave a stale registry entry for any user who already enabled
  start-at-login under the old value, which needs its own toggle-time
  migration logic, not a bare string rename.
- **Version bump**: not performed — see
  `docs/validation/QUOTALIS_PUBLIC_REBRAND.md` for the recorded
  recommendation.

## Current identity (unchanged this pass)

| Identifier | Personal | Dev |
|---|---|---|
| Tauri bundle identifier | `app.quotaarc.desktop` | `app.quotaarc.desktop.dev` |
| `productName` (drives the built exe name) | `QuotaArc` | `QuotaArc Dev` |
| `mainBinaryName` | `QuotaArc` | `QuotaArcDev` |
| `[[bin]] name` (Cargo, produces the raw debug binary) | `QuotaArc` | `QuotaArc` (same, channel selected by Cargo feature) |
| Data directory | `%APPDATA%\QuotaArc`, `%LOCALAPPDATA%\QuotaArc` | `%APPDATA%\QuotaArc-Dev`, `%LOCALAPPDATA%\QuotaArc-Dev` |
| Installer output pattern | `QuotaArc-{version}-x64-Setup.exe` | n/a (Dev is unpackaged) |
| Window title, tray tooltip, About name, Settings header | now say **Quotalis** (this pass) | same |

The bundle identifier (`app.quotaarc.desktop`) is what Windows actually
uses to recognize "this is the same app across versions" — for
`tauri-plugin-single-instance`, for any future code-signing/certificate
pinning, for Explorer/Start-Menu shortcut resolution, and (per
`apps/desktop-tauri/src-tauri/Cargo.toml`'s own comment, discovered during
this audit) for a **real historical bug** where an older
`target\debug\QuotaArc.exe` could be launched after a newer build
completed, specifically because Tauri's bundle output and Cargo's raw
`[[bin]]` output used to disagree — this identifier is load-bearing for
correctness today, not just branding.

## Option A: preserve the legacy bundle/AppUserModel identity

Keep `app.quotaarc.desktop` / `app.quotaarc.desktop.dev` as the Windows
identity **forever internally**, even after the public product is fully
"Quotalis" everywhere a user can see text. Only `productName` (→ window
title / installer display strings) and `mainBinaryName` (→ the shipped
`.exe` filename) change to Quotalis-branded values.

- **Pros**: Windows treats every future release as the *same application*
  as today's QuotaArc — single-instance detection, any future code-signing
  identity, and (most importantly) the user's **Start Menu pin survives
  automatically**, because Windows keys a pinned shortcut to the
  underlying AppUserModelID, which Tauri derives from the bundle
  identifier, not from `productName`. No custom migration code is needed
  for pins. Lowest risk of an accidental "two apps installed side by side"
  outcome.
- **Cons**: the identifier string itself (`app.quotaarc.desktop`) stays
  permanently in metadata a technically curious user could inspect (e.g.
  Windows' "Installed apps" registry key `App Paths`, or `Get-AppxPackage`-
  style tooling for MSIX — not applicable here since this is an NSIS/EXE
  installer, but the identifier does appear in the uninstall registry key
  name and in crash-report/telemetry-style app identifiers if any are ever
  added). Not visible in any normal-user-facing UI.

## Option B: migrate to a new Quotalis bundle identity

`app.quotalis.desktop` / `app.quotalis.desktop.dev`, with an explicit
compatibility/migration strategy: new installer registers the new
identity, detects a legacy QuotaArc install, offers/performs an
uninstall-old + install-new sequence, and the app itself performs the data
migration (section 6/7 of the owner's original rebrand spec) on first
launch under the new identity.

- **Pros**: fully clean identity, no lingering "quotaarc" string anywhere
  in Windows-visible metadata.
- **Cons**: Windows will not recognize `app.quotalis.desktop` as related
  to `app.quotaarc.desktop` — a Start Menu pin is **not** preserved
  automatically (matches the owner's own section 11 concern: "If Windows
  cannot preserve the existing pin automatically... do not modify
  undocumented Windows Start databases... report that the owner may need
  to pin manually"). Real risk of a transitional period where both
  `QuotaArc` and `Quotalis` appear as separate Start Menu / "Installed
  Apps" entries if the uninstall-old step is skipped, delayed, or fails
  partway. Requires new installer logic (upgrade code handling, an
  uninstall-then-install sequence or an NSIS migration script) that does
  not exist today and needs its own design + test pass before any Personal
  use.

## Decision: **Option A** — preserve the legacy bundle/AppUserModel
identity, migrate only the display name and exe filename

Rationale, directly from the owner's own stated priorities:

> "Prefer seamless user upgrade over aesthetic identifier purity."
> "Do not risk the Start database."

Option A gets the user a real Quotalis experience — new window title, new
tray tooltip, new About screen, new installer display name, new `.exe`
filename on disk (`Quotalis.exe` / `QuotalisDev.exe`) — with **zero** risk
to their existing Start Menu pin, zero risk of Windows treating the
upgrade as a new/unrelated app, and zero new installer-migration logic to
design, build, and test before this can safely reach Personal. It also
avoids inventing an uninstall/reinstall sequence, which is exactly the
kind of hard-to-reverse, real-install-affecting change this session's
operating rules require confirming explicitly before attempting — and the
owner's own spec (section 25/30) says not to touch Personal until this is
validated anyway.

Option B remains available as a deliberate **future** step (e.g. if the
owner later wants zero trace of the string "quotaarc" anywhere, including
internal Windows metadata) but should not be the default path for the
first Quotalis release. If pursued later, it needs its own dedicated
design pass covering the exact uninstall/upgrade sequence, tested against
a real installed legacy QuotaArc on a disposable VM/user profile before
ever running against a real Personal install.

## What Option A requires (not yet implemented this pass)

1. `productName` → `"Quotalis"` / `"Quotalis Dev"` in
   `tauri.conf.json` / `tauri.dev.conf.json` (bundle identifier fields
   left untouched).
2. `mainBinaryName` → `"Quotalis"` / `"QuotalisDev"`.
3. Cargo `[[bin]] name` in `apps/desktop-tauri/src-tauri/Cargo.toml` →
   `"Quotalis"` (currently `"QuotaArc"`) — this changes the raw
   `target\debug\Quotalis.exe` filename Cargo produces, which several
   places currently hardcode as `codexbar.exe`/`QuotaArc.exe`-pattern
   strings for legacy-install detection (`rust/src/settings.rs`,
   `rust/src/updater.rs`, `tray_visibility.rs`) — **every one of those
   needs updating to recognize `Quotalis.exe` as the *current* name while
   still recognizing `QuotaArc.exe`/`QuotaArc-Desktop.exe` as the *legacy*
   name to detect an upgrade from**, not simply renamed in place (that
   would break the very detection they exist for).
4. `updater.rs`'s installer-filename matching (`QuotaArc-{version}-x64-
   Setup.exe`) needs the same current/legacy dual recognition once the
   Tauri bundler config's `productName` changes what filename it actually
   produces.
5. A real Dev-only build + launch verification that the renamed exe still
   passes single-instance detection, tray icon registration, and
   (critically) that a *pinned Dev Start Menu shortcut from before this
   change* still resolves — this is the concrete test of whether the
   AppUserModelID-preservation reasoning above actually holds in practice
   on this machine, not just in theory.

None of the above has been done in this pass — this document is the
decision and requirements list that step needs, produced now so the next
pass has a real starting point instead of re-litigating Option A vs B.

## Data path (unaffected by this decision)

Because the bundle identifier is unchanged under Option A, the data
directory Tauri resolves (`app_data_dir()`, keyed off the bundle
identifier internally by the OS-level path resolver) **stays
`%APPDATA%\QuotaArc` / `%LOCALAPPDATA%\QuotaArc`** — no data migration is
actually required under Option A, which removes an entire category of
risk (history.db preservation, DPAPI-encrypted file preservation,
interrupted-migration recovery) that Option B would have required. This
is a second, independent point in favor of Option A: the owner's sections
5-8 (data migration) become moot rather than merely "handled safely" —
there is no migration to perform at all.
