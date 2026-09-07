# Quotalis Windows Identity Migration — Decision

Date: 2026-09-08. Worktree: `N:\QuotaArc\quotalis-rebrand`, branch
`integration/quotalis-public-rebrand` (based on `b3ad28ed`).

This document is the required decision (owner spec section 10) before any
executable/bundle-identifier/installer/Start-Menu work is attempted. **No
code changes described as "Option B" below have been made** — this is the
decision record, not the implementation.

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
