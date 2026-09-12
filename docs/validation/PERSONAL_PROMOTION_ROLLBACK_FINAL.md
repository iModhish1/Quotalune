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

**Corrected 2026-09-12 during post-release reconciliation; NOT EXECUTED.**
The original step 2 incorrectly described NSIS and proposed deleting the old
application directory. Actual promotion used Inno and installed into a separate
directory. Those obsolete instructions must not be followed.

Rollback is a future, explicitly authorized Personal operation, not a Dev QA
step. This document does not authorize stopping, uninstalling, restoring or
changing the current Personal application.

1. Before any change, identify the running Personal processes by exact executable
   path and obtain a fresh backup of the **current 0.11.0 state**, including opaque
   credentials, SQLite database/WAL/SHM consistently captured after an authorized
   orderly shutdown, both install locations, shortcuts and relevant registry
   metadata. Preserve newer history/settings; the pre-promotion snapshot is older.
2. Revalidate the historical backup payloads against its manifest and the pinned
   old executable hash. Resolve any payload mismatch before proceeding. See the
   manifest qualification below; do not claim the self-entry validates itself.
3. Confirm the real registered uninstall entry:
   `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\QuotaArcDesktop_is1`.
   At reconciliation it identifies Inno's
   `C:\Users\imodhish\AppData\Local\Programs\Quotalis\unins000.exe` and install
   location `C:\Users\imodhish\AppData\Local\Programs\Quotalis\`.
   Re-read and verify these values at rollback time. Do not substitute the legacy
   `Local\QuotaArc\uninstall.exe` or guess an uninstaller from its filename.
4. Only in that authorized rollback phase, use the verified new install's supported
   uninstaller. It owns shared shortcut/AUMID registration metadata; account for
   those removals explicitly. If uninstall fails, stop and diagnose. **There is no
   recursive-delete fallback**, particularly against the old `Local\QuotaArc` app
   or the shared `Roaming\QuotaArc` data root.
5. Verify the retained old app at `Local\QuotaArc\QuotaArc.exe` first. Restore its
   app files from this backup only if necessary. A historical-data restore is a
   separate explicit decision: it discards post-backup changes. Do not overwrite
   shared data or delete newly added files merely because the binary is rolled back.
   Keep the fresh 0.11.0 backup available for recovery in either direction.
6. Restore legacy uninstall metadata/shortcuts only where the verified rollback
   requires it, from their captured backups. Reconcile current and legacy shell
   identity separately. Use supported owner pin/unpin actions if needed; do not
   modify undocumented Start storage.
7. Verify the old executable's full SHA256
   `763e4f3228fd2ca08c16c2f55744bfe32336893133c3155b3aef789501e78efd`, shortcut
   target/AUMID, and then authorized native launch, real history/settings and
   credential continuity. A rollback is not successful merely because files copied.

## Post-release read-only backup verification — 2026-09-12

All 24 recorded entries were checked against files under the exact backup root.
**23 payload entries match**, including the old executable and the captured data.
The remaining entry is `manifest.sha256` itself: its recorded digest does not match
the final manifest bytes. This self-entry cannot certify the manifest's integrity.
No backup file or manifest was edited, regenerated, decrypted or restored.

Thus the available evidence is payload consistency with the retained manifest,
not an independently authenticated or fully matching 24-entry manifest. The backup
is retained and inspectable; full rollback execution has not been rehearsed.
Preserve this qualification when reporting readiness. The historical promotion
PASS remains a record of that earlier acceptance, not proof these later findings
were absent.

This checkpoint and the prior, older rollback checkpoint are both retained — neither is deleted by this promotion.
