# Quotalis Inno Setup Release Pipeline — Audit

Date: 2026-09-08. Worktree: `N:\QuotaArc\quotalis-rebrand`, branch
`integration/quotalis-public-rebrand`.

## Scope

`scripts/windows-release-build.ps1` (documented as the canonical Windows
release path in `docs/BUILDING.md` and `docs/adr/0001-*.md` /
`docs/adr/0004-*.md`) and the Inno Setup script it drives,
`rust/installer/codexbar.iss`, plus everything they reference
(`scripts/verify-windows-executables.ps1`, `scripts/windows-smoke-install.ps1`).

## Pipeline map (as found, before any change)

| Field | Value |
|---|---|
| Input executable | `target\<target-triple>\release\Quotalis.exe` (Tauri build output — **already correctly named** from the earlier packaging-identity pass), copied to two legacy-named siblings: `codexbar.exe` and `codexbar-desktop.exe` |
| Separate CLI binary | Built via `cargo build --manifest-path rust\Cargo.toml --release --bin codexbar` |
| AppId | `QuotaArcDesktop` (Inno's own upgrade-continuity GUID/string — **a completely separate identity system from the Tauri bundle identifier** `app.quotaarc.desktop`; the two were never unified) |
| AppName | `QuotaArc` |
| AppVersion | passed in via `/DAppVersion=$version` |
| AppPublisher / URLs | `QuotaArc` / `github.com/quotaarc/quotaarc` (repo, issues, releases) |
| DefaultDirName | `{localappdata}\Programs\QuotaArc` |
| DefaultGroupName | `QuotaArc` |
| UninstallDisplayName | Inno derives this from `AppName` + `AppVerName` — `QuotaArc` |
| Shortcut names | `{autoprograms}\QuotaArc`, `{autodesktop}\QuotaArc`, both launching `codexbar.exe menubar` |
| Icons | `..\icons\icon.ico` (unbranded asset, shared with the Tauri build — no text) |
| Output filename | `CodexBar-$version-Setup.exe` (from `windows-release-build.ps1`'s `/DOutputBaseFilename` override — note this is NOT even "QuotaArc", it's the older "CodexBar" name, one generation further back) |
| Portable artifact | `CodexBar-$version-portable.exe` (a plain copy of the desktop exe, no separate portable logic) |
| CLI artifact | `CodexBarCLI-v$version-windows-x64.zip` |
| Upgrade behavior | `UsePreviousAppDir=yes`, `CloseApplications=yes` — standard Inno upgrade-in-place keyed on `AppId`, not on exact shipped filenames |
| Legacy detection | None specific to this pipeline beyond the AppUserModelID registry block it writes (see below) |

## Critical finding: this pipeline is already broken today, independent of branding

Verified by actually running the exact command the script issues:

```
$ cargo build --manifest-path rust/Cargo.toml --release --bin codexbar
error: no bin target named `codexbar` in default-run packages
help: available bin targets:
    quotaarc
```

`rust/Cargo.toml`'s `[[bin]]` has been named `quotaarc` (not `codexbar`) for
some time — a rename that predates this entire Quotalis rebrand session and
was never propagated into `windows-release-build.ps1`. **This canonical
script could not have produced a working release build in its form before
this audit began**, regardless of anything the Quotalis rebrand did. This
is a real, pre-existing drift bug, fixed as part of this pass (see below) —
not a Quotalis-specific issue, but it had to be fixed to prove the pipeline
at all.

## Critical finding: the real installed Personal app did NOT come from this pipeline

Personal's actual installed QuotaArc, inspected directly:

```
InstallLocation: C:\Users\imodhish\AppData\Local\QuotaArc
UninstallString: C:\Users\imodhish\AppData\Local\QuotaArc\uninstall.exe
```

Inno's `DefaultDirName={localappdata}\Programs\QuotaArc` would install to
`C:\Users\imodhish\AppData\Local\Programs\QuotaArc` — a **different path**
(note the extra `\Programs\` segment) than where Personal actually lives.
The path Personal actually uses matches exactly the pattern the Tauri NSIS
installer produces (confirmed directly: this session's own NSIS test
install landed at `C:\Users\imodhish\AppData\Local\Quotalis Dev`, the same
`{localAppData}\<ProductName>` shape, no `\Programs\` segment). **The real
Personal install was built by the Tauri/NSIS pipeline, not this Inno
pipeline** — despite the documentation calling the Inno path "canonical."

## Classification of every "CodexBar"/"codexbar"/"QuotaArc" occurrence found

| String | Location | Classification | Action |
|---|---|---|---|
| `AppId=QuotaArcDesktop` | `codexbar.iss` `[Setup]` | Legacy upgrade-continuity identity, own namespace, unrelated to `app.quotaarc.desktop` | **Preserved unchanged** — renaming would be a cosmetic AppId change with real (if this pipeline is ever used again) upgrade-continuity risk, exactly what the owner's Option A precedent warns against |
| `AppName`, `AppVerName`, `AppPublisher`, shortcut names, `UninstallDisplayName` (derived) | `codexbar.iss` `[Setup]`/`[Icons]` | Active visible brand | **Renamed to Quotalis** |
| `codexbar.exe`, `codexbar-cli.exe`, `codexbar-desktop.exe` (packaged files) | `codexbar.iss` `[Files]`/`[Icons]`/`[Run]`, `windows-release-build.ps1` | Active packaging input/output naming — not a persisted user-data identifier, not referenced by any real current-generation detection code (confirmed in the prior packaging-identity audit: `settings.rs`/`updater.rs`'s `codexbar-cli.exe`/`codexbar-desktop.exe` checks are for an even-older, already-dead alias, and were never satisfied by files this pipeline produces since this pipeline itself was never what built Personal) | **Renamed** to `quotalis.exe`/`quotalis-cli.exe`/`quotalis-desktop.exe` — see rationale below |
| `AppPublisherURL`/`AppSupportURL`/`AppUpdatesURL` = `github.com/quotaarc/quotaarc` | `codexbar.iss` | Real external link, ownership unverified | **Left unchanged** — same reasoning as the README (renaming to a repo that may not exist would break real links) |
| `CodexBar-$version-Setup.exe`, `CodexBar-$version-portable.exe`, `CodexBarCLI-v$version-windows-x64.zip` | `windows-release-build.ps1` | Active release-artifact naming | **Renamed to Quotalis** |
| `HKCU\...\AppUserModelId\app.quotaarc.desktop` registry block | `codexbar.iss` `[Registry]` | Ties the Inno-installed app to the **same** AppUserModelID the Tauri build uses (deliberately, per its own comment: "gives legacy installer builds the same stable Windows notification identity as the Tauri package") | **`app.quotaarc.desktop` preserved unchanged** (matches Option A exactly), but the `DisplayName` value written there (`"QuotaArc"`) is visible in Windows notification settings — **renamed to `"Quotalis"`** |
| `Write-Host "Building Win-CodexBar $version..."` | `windows-release-build.ps1` | Internal console log line | Renamed for consistency, not user-facing |
| `Win-CodexBar` in `$RepoUrl`/`$WorkRoot` defaults, `CodexBar\release-toolchain\pnpm` cache path | `windows-release-build.ps1` params | Real upstream repo URL / a local build-machine cache path convention | **Left unchanged** — same upstream-attribution and unverified-URL reasoning as elsewhere |

## Rationale for renaming the packaged exe filenames

Unlike the ~30 OS-keychain `CREDENTIAL_TARGET` strings and the
`secure_file.rs` format tag (never touched, real stored-data risk), the
`codexbar.exe`/`codexbar-cli.exe`/`codexbar-desktop.exe` filenames this
pipeline produces are **packaging output**, not a persisted identifier any
real user's data depends on:

- Inno's upgrade continuity is keyed on `AppId`, not on exact shipped
  filenames — renaming the packaged exe does not break `UsePreviousAppDir`.
- No current-generation code path reads these exact filenames as "the
  current install" (verified in the prior packaging audit — the only code
  that checks for `codexbar-cli.exe`/`codexbar-desktop.exe` is a
  much-older, already-inert legacy-alias fallback, and this pipeline was
  never what produced Personal's real binary anyway, per the finding
  above).
- The owner's own spec section 7 explicitly asks for exactly this: "The
  Inno pipeline must package Quotalis.exe, not QuotaArc.exe/CodexBar.exe...
  No post-build manual rename hack."

Given that instruction, this pass removes the artificial
copy-to-legacy-name bridge (`Copy-Item $sourceExe $desktopExe`) entirely —
the Tauri build already produces `Quotalis.exe` directly; `codexbar.iss`
(renamed `quotalis.iss`) now packages that file under its own name, with no
intermediate rename step.

## Recommendation: NSIS (Tauri-native) is the primary Personal installer

Evidence, not preference:

1. **It's what actually built the real installed Personal app** (path
   evidence above) — the Inno pipeline never did, despite the docs' claim.
2. **It's self-provisioning**: Tauri fetches its own NSIS/WiX tooling on
   first use (proven in the prior pass); Inno requires an operator to
   pre-install `JRSoftware.InnoSetup` manually (`Get-InnoSetupCompiler`
   throws if it's missing — confirmed absent on this machine before this
   pass, then installed via winget for this audit).
3. **It was already broken** (the `--bin codexbar` bug) independent of
   branding — evidence it has drifted out of active use and maintenance,
   while the Tauri path has clearly been kept current (it already produced
   correctly-named `Quotalis.exe` output before this audit even started,
   from the earlier packaging-identity pass).
4. **Already proven end-to-end this session**: real install → verify →
   uninstall cycle on this machine, Personal confirmed untouched by hash
   equality.

**Inno Setup becomes the secondary/legacy path**: still real, still
buildable (fixed and verified in this pass — see the closure report), kept
for whatever the CLI-only distribution and portable-zip use cases it was
originally built for, but not the path a fresh Personal release should
depend on going forward. `docs/BUILDING.md` is corrected in this pass to
describe reality rather than this stale claim (the two ADRs are left
untouched — they describe their own historical period in the past tense
and are accurate for it; per ADR convention a stale "current" claim gets
superseded by a new ADR, not edited in place).

## NSIS vs Inno vs MSI — feature comparison

| | NSIS (Tauri) | Inno Setup | MSI (Tauri/WiX) |
|---|---|---|---|
| Upgrade continuity | Keyed on Tauri bundle identifier (`app.quotaarc.desktop`) | Keyed on its own `AppId=QuotaArcDesktop` — separate namespace, preserved unchanged | Keyed on WiX `UpgradeCode` (auto-managed by Tauri) |
| Shortcut behavior | Start Menu shortcut via NSIS script, verified this session | Start Menu + optional desktop shortcut (its own `[Icons]` section) | Start Menu shortcut via WiX |
| Install path | `{localAppData}\<ProductName>` (verified: matches Personal's real install) | `{localappdata}\Programs\<ProductName>` (a different shape — never matched Personal's real path) | MSI-standard `Program Files` by default |
| Uninstall behavior | Standard Windows uninstall entry, verified end-to-end this session (install → verify → uninstall → verify clean) | Standard Inno uninstaller, not live-tested this session (static audit + fix only — see below) | Standard `msiexec` uninstall, not live-tested |
| Portable support | None built in | Yes (`CodexBar-$version-portable.exe` → now `Quotalis-$version-portable.exe`, a plain exe copy) | No |
| Bundle identity | Self-contained in `tauri.conf.json` | Separate `.iss` file, separate toolchain | Self-contained in `tauri.conf.json` |
| Toolchain provisioning | Self-provisioning (Tauri fetches NSIS automatically) | Manual (`winget install JRSoftware.InnoSetup`, done this session) | Self-provisioning (Tauri fetches WiX automatically) |
| Release-script authority | Not driven by `windows-release-build.ps1` today, but is what actually produces Personal's real installed binary | Driven by `windows-release-build.ps1`, documented (inaccurately, until this pass) as canonical | Not driven by `windows-release-build.ps1` |
| Additional artifacts | None | Standalone CLI zip, portable exe | Locale-specific MSI variants (8 languages, built this session) |

**Verdict**: NSIS = primary Personal installer (real evidence: it's what
built Personal, it self-provisions, it was live-tested end-to-end this
session). Inno = secondary, kept for its CLI-zip/portable artifacts, now
fixed (the pre-existing `--bin codexbar` bug) and rebranded, but not
live-installed this session (see below for why). MSI = tertiary,
build-verified in the prior packaging pass, not live-installed.

## Live installation test — result

The full `windows-release-build.ps1` run (against this branch, via a local
clone — the script's own documented, supported invocation, not bypassed)
was executed twice: once at `6bd17619` (proving the fix itself, at the
pre-bump version 0.10.1) and again at `f2f722b9` (proving the final,
version-bumped state). Both runs succeeded end-to-end (exit code 0),
producing real `Quotalis-<version>-Setup.exe` / `-portable.exe` /
`QuotalisCLI-v<version>-windows-x64.zip` artifacts with real SHA-256
sidecars and correct embedded metadata (`ProductName: Quotalis`,
`ProductVersion` matching the build). See
`docs/validation/QUOTALIS_PUBLIC_REBRAND.md`'s "FINAL 0.11.0 release
evidence" section for the exact final-run hashes — this audit document is
the design/findings record; that document is the evidence record for what
actually ran.
