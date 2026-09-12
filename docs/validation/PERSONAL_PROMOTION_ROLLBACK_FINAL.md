# Personal Promotion — Rollback Checkpoint (Final, Pre-Install)

**This is the immediate pre-promotion rollback point.** It was captured
non-invasively (Personal was never launched to produce it) immediately
before building and installing the accepted Dev candidate as the new
Personal release.

## Identity

- Backup timestamp: `20260912-051322` (2026-09-12 05:13:22 local)
- Candidate source HEAD: `dfd81974c4a76922bbc1b5094b85468dc2d6f726`
- Backup directory: `N:\QuotaArc\personal-rollback\20260912-051322\`

## Pre-promotion Personal state (captured, not altered)

- Old Personal product: **QuotaArc**
- Old Personal version: **0.10.1**
- Old Personal executable: `C:\Users\imodhish\AppData\Local\QuotaArc\QuotaArc.exe`
- Old Personal executable SHA256: `763e4f3228fd2ca08c16c2f55744bfe32336893133c3155b3aef789501e78efd`
- Old Personal executable size: 32,420,864 bytes
- Personal AUMID: `app.quotaarc.desktop` (confirmed via `Get-StartApps`)
- Start Menu shortcut: `C:\Users\imodhish\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\QuotaArc.lnk` → target `QuotaArc.exe`
- Desktop shortcut: `C:\Users\imodhish\Desktop\QuotaArc.lnk` → same target
- Personal data root: `C:\Users\imodhish\AppData\Roaming\QuotaArc` (17 files, 5.5 MB)
- Data root last-modified before this promotion: **2026-09-10 03:59:08** (untouched throughout all of Phase 3N and up to the start of this promotion — independently confirmed)
- Uninstall registry key: `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\QuotaArc`

## Backup contents

```
personal-rollback/20260912-051322/
  app/
    QuotaArc.exe            (old Personal executable, byte-for-byte)
    uninstall.exe           (old Personal uninstaller)
    quotaarc-icon-128.png
  data/QuotaArc/            (full byte-for-byte copy of AppData\Roaming\QuotaArc,
                              including history.db, settings.json, profiles.json,
                              codex-accounts/ (DPAPI-backed, copied encrypted —
                              never decrypted), api_keys.json, manual_cookies.json,
                              logs/, backups/, window_geometry.json,
                              notification-dedupe.json, .tray-pin-default-v1)
  shortcuts/
    QuotaArc.StartMenu.lnk
    QuotaArc.Desktop.lnk
  registry/
    QuotaArc-uninstall-key.reg   (full uninstall registry key export)
  manifest.sha256           (SHA256 of every file above, 24 entries)
```

## Backup verification

- File count: 23 files backed up (6 app/shortcut/registry + 17 data files), plus the manifest itself = 24 manifest entries.
- Spot-check hash equality (backup vs. live, performed before any install step):
  - `QuotaArc.exe`: `763e4f32...` — **matches** live source
  - `history.db`: `e2ed45f8...` — **matches** live source
- No secrets were decrypted. `codex-accounts/` (DPAPI-protected auth state) and `api_keys.json`/`manual_cookies.json` were copied as opaque byte streams only.

## Rollback procedure (if this promotion needs to be reversed)

1. Stop the new Personal process if running.
2. Run the new Personal's own `uninstall.exe` (if installed via the canonical NSIS installer) — or, if that fails, delete `C:\Users\imodhish\AppData\Local\QuotaArc\` manually.
3. Restore `app/QuotaArc.exe`, `app/uninstall.exe`, `app/quotaarc-icon-128.png` from this backup into `C:\Users\imodhish\AppData\Local\QuotaArc\`.
4. Restore `data/QuotaArc/` byte-for-byte over `C:\Users\imodhish\AppData\Roaming\QuotaArc\` (delete anything the new version added first).
5. Re-import `registry/QuotaArc-uninstall-key.reg` (`reg import`) if the uninstall key was overwritten with new metadata.
6. Restore `shortcuts/QuotaArc.StartMenu.lnk` → Start Menu Programs, `shortcuts/QuotaArc.Desktop.lnk` → Desktop.
7. Verify: executable SHA256 matches `763e4f32...`, `Get-StartApps` shows version/AppID as before, app launches and loads existing history/settings correctly.

This checkpoint and the prior, older rollback checkpoint are both retained — neither is deleted by this promotion.
