# Quotalis Rollback Plan

Date: 2026-09-08. Applies to the packaging-identity changes on
`integration/quotalis-public-rebrand` (HEAD at time of writing:
see the branch's own `git log`; built on top of `6e935416`).

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
