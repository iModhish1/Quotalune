# Quotalis Rollback Plan

Date: 2026-09-08. Applies to the packaging-identity changes on
`integration/quotalis-public-rebrand` (HEAD at time of writing:
see the branch's own `git log`; built on top of `6e935416`).

## What was actually tested this pass (fixture-based, not a live install cycle)

The claims below were verified **executably against synthetic/tempdir
fixtures**, not by installing/uninstalling a real build on this machine:

- **History compatibility**: `dashboard_data::tests::
  legacy_history_db_is_fully_readable_after_reopening_with_a_fresh_store`
  builds a fixture `history.db`, closes the writing handle, reopens it with
  a brand-new `HistoryStore`, and proves row count / first-sample /
  last-sample / provider-account pairs / cost-data visibility all survive,
  plus that `build_dashboard_snapshot` queries it correctly.
- **Secure storage compatibility**: `secure_file::tests::
  legacy_format_tagged_secure_file_is_still_decryptable` builds a fixture
  file using the literal, unrenamed `"codexbar.secure-file"` format tag and
  the real Windows DPAPI `protect()` call, then proves the current
  `read_string()` decrypts it via the real `CryptUnprotectData` Windows API
  on this machine (not mocked).
- **Settings/profile compatibility**: `settings::tests::
  legacy_quotaarc_settings_fixture_survives_intact` and `...
  _profiles_fixture_survives_intact` deserialize realistic legacy-shaped
  `settings.json`/`profiles.json` fixtures and assert every named field
  (provider config, theme, provider presentation, Reset Display, Dashboard
  mode/preset, surface config, profile identity) survives.
- **Exact Dev binary + real installers**: `pnpm --dir apps/desktop-tauri
  exec tauri build --config src-tauri/tauri.dev.conf.json --features
  dev-channel --bundles nsis` (then `--bundles msi`) produced real,
  hash-verified artifacts — see
  `docs/validation/QUOTALIS_PUBLIC_REBRAND.md` for the exact paths/hashes.
  `QuotalisDev.exe` was launched (PID captured), confirmed to write only to
  `%APPDATA%\QuotaArc-Dev` (not the Personal root), and cleanly terminated.

## Real install/uninstall cycle — executed and verified (owner-authorized)

After explicit owner authorization, the built NSIS installer was actually
run on this machine. Full before/after evidence:

| Check | Before | After install | After uninstall |
|---|---|---|---|
| `QuotaArc` uninstall entry | `InstallLocation: ...\AppData\Local\QuotaArc`, `UninstallString: ...\QuotaArc\uninstall.exe` | **identical, byte-for-byte unchanged** | **identical, byte-for-byte unchanged** |
| `QuotaArc.lnk` Start Menu shortcut | `LastWriteTime: 9/7/2026 12:30:52 AM` | **same timestamp, untouched** | **same timestamp, untouched** |
| `QuotaArc.exe` SHA-256 | `763E4F3228FD2CA08C16C2F55744BFE32336893133C3155B3AEF789501E78EFD` | not re-checked (see next row) | **identical hash** — confirms the file was never touched |
| `Quotalis Dev` uninstall entry | absent | `InstallLocation: ...\AppData\Local\Quotalis Dev`, `Publisher: Quotalis`, `DisplayVersion: 0.10.1` | absent again (clean removal) |
| `Quotalis Dev.lnk` shortcut | absent | present, target = `...\Quotalis Dev\QuotalisDev.exe` (correct, not target\debug) | absent again |
| Install directory `...\Local\Quotalis Dev` | absent | present, contains `QuotalisDev.exe` (SHA-256 `4E97AD0CF1A5A7C517C3B2182F1D385F2C0CE0958EB9CDCCD0D9D56FB997593F`, ProductName/FileDescription "Quotalis Dev") | removed entirely |

Both the installer and uninstaller (`/S` — the standard, documented NSIS
silent-mode flag, not an undocumented one) exited with code 0.

The installed `QuotalisDev.exe` was also launched directly from its
installed path (PID 32152, confirmed via `Get-Process`), and the same
data-isolation check from the earlier Dev-build test was repeated: only
`%APPDATA%\QuotaArc-Dev` received fresh writes (`history.db-shm`,
`notification-dedupe.json`, `window_geometry.json`), never
`%APPDATA%\QuotaArc`. The process was then stopped before running the
uninstaller.

Baseline evidence (registry/shortcut snapshots taken *before* the install)
is saved under
`.local/recovery/pre-install-baseline-20260908/` in this worktree for
reference.

## What was NOT tested (and why)

- **A true side-by-side legacy-upgrade simulation** (installing an actual
  *pre-rebrand* QuotaArc-branded installer first, then running the
  Quotalis installer "over" it) was not performed — it would require
  building a separate installer artifact from a pre-rebrand commit, which
  was judged lower-value than the install/uninstall-cycle evidence above:
  the bundle identity (what actually determines upgrade-vs-side-by-side
  behavior in NSIS/Windows) is unchanged, and the fixture-based
  compatibility tests already prove data survives across the rename. The
  install/uninstall cycle above proves the *mechanics* (registry, shortcut,
  install directory, Personal isolation) all work correctly.
- **MSI install/uninstall** was not executed — only the NSIS path was
  exercised end-to-end; the MSI artifact was built and hash-verified
  (see `docs/validation/QUOTALIS_PUBLIC_REBRAND.md`) but not installed.
- **Start Menu pin preservation** could not be tested: no shortcut was
  pinned to Start before this test, so there was nothing to verify
  survives. This remains a genuine **MANUAL PERSONAL VERIFICATION
  REQUIRED** item — it can only be checked by someone with a real pinned
  QuotaArc tile going through a real upgrade.
- **Reinstall cycle** (install → uninstall → reinstall) was not performed;
  the single install → verify → uninstall → verify cycle above was judged
  sufficient evidence for this pass.

## Why rollback is unusually cheap under Option A

The single biggest advantage of Option A
(`docs/validation/QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md`) is that **no data
ever moves**. The bundle identifier (`app.quotaarc.desktop[.dev]`) and the
data directory (`%APPDATA%\QuotaArc[-Dev]`, `%LOCALAPPDATA%\QuotaArc[-Dev]`)
are byte-for-byte unchanged from what Personal already uses today. Rolling
back is therefore a pure *binary* swap, not a data-migration reversal —
there is no "undo the copy" step because nothing was ever copied.

## Rollback procedure (if a future Quotalis-branded Personal build needs to
be reverted to the last QuotaArc-branded build)

1. **Keep the last-known-good QuotaArc binary and installer.** Before any
   future Personal promotion, archive the currently-installed QuotaArc
   build's installer artifact (`QuotaArc-<version>-x64-Setup.exe`) and record
   its version number and SHA-256. This repo's own release process should
   already retain built installers; if not, copy the one currently installed
   under `%LOCALAPPDATA%\Programs\QuotaArc\` (or wherever the current
   Personal install lives) before upgrading.
2. **Uninstall or overwrite with the archived installer.** Because the
   bundle identifier does not change, running the archived QuotaArc
   installer over a Quotalis install upgrades/downgrades in place through
   the same NSIS upgrade-code machinery Windows already uses for every other
   QuotaArc version bump — this is not a special rollback code path, it is
   the same mechanism as any other version change.
3. **Data requires no action.** Since `APP_DIR_NAME`, `TOAST_AUMID`, and
   `REGISTRY_RUN_VALUE` are untouched, the reverted QuotaArc binary reads
   the exact same `%APPDATA%\QuotaArc\settings.json`, `history.db`,
   `profiles.json`, and secure-storage files the Quotalis build was already
   using — there is no "restore a backup" step because both binaries share
   one storage root the whole time.
4. **Start Menu / shortcuts.** Because the AppUserModelID is unchanged, the
   existing Start Menu shortcut continues pointing at whatever the installer
   most recently wrote there — reinstalling the archived QuotaArc build
   updates that shortcut's target back to the old binary automatically,
   the same way any other installer re-run does.
5. **Verify.** After rollback, confirm: the reverted app launches, reads the
   real local `history.db` (same row count as before rollback — see the
   verification pattern in `rust/src/commands/dashboard.rs`'s
   `manual_verification_against_real_history_db` test for how this repo
   already checks that), settings/profiles/collections/themes all load
   unchanged, and the window title/tray/About text reads "QuotaArc" again
   (confirming the rollback actually took effect, not a half-applied state).

## What would make rollback harder (and is therefore avoided)

- **Renaming the bundle identifier** (Option B) — would require Windows to
  treat the two versions as different applications; rollback would need an
  uninstall-old + install-different-identity-new sequence, not a simple
  version swap. This is exactly why Option A was chosen.
- **Migrating the data directory** — not done, so there is no "migrate back"
  step to design or test.
- **Renaming secure-storage/credential-target identifiers** — not done
  (`docs/validation/QUOTALIS_REBRAND_AUDIT.md` classifies these as
  `LEGACY_SECURITY_COMPATIBILITY`, untouched); a rollback never has to worry
  about credentials written under a new identifier being unreadable by the
  old binary, because the identifier never changed.
- **Renaming the Registry Run value** — not done this pass, for the same
  reason: a rollback would otherwise need to know whether to clean up a
  new-named entry or restore an old one.

## Known limitation

This plan is a procedure, not yet a tested one — no real install/uninstall/
rollback cycle has been executed in this pass (would require actually
installing over a real Windows environment, which the owner has explicitly
said not to do against Personal yet). Treat this as the designed procedure
to execute and verify during the installer-build pass that follows this one,
not as evidence rollback has already been proven to work end-to-end.
