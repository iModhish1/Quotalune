# Personal promotion — rollback manifest

Created 2026-09-11, before any modification to the currently-installed
Personal application. This documents Personal exactly as it exists right
now — not a restoration of the pre-Product-V3-incident state. That
historical incident remains documented separately in
`docs/validation/CLAUDE_HANDOFF_RECONCILIATION.md` and related files as
**INCIDENT — NOT COMPOUNDED**; this manifest is unrelated to it.

## Old installed state (as found, before promotion)

| Fact | Value |
|---|---|
| Display name | `QuotaArc` |
| Installed version | `0.10.1` |
| Executable path | `C:\Users\imodhish\AppData\Local\QuotaArc\QuotaArc.exe` |
| Executable SHA256 | `763e4f3228fd2ca08c16c2f55744bfe32336893133c3155b3aef789501e78efd` |
| Executable size | 32,420,864 bytes |
| Executable built | 2026-09-07 00:30:06 |
| Product name (version resource) | `QuotaArc` |
| Company name (version resource) | `quotaarc` |
| Uninstaller | `C:\Users\imodhish\AppData\Local\QuotaArc\uninstall.exe` |
| Install location | `C:\Users\imodhish\AppData\Local\QuotaArc` |
| Uninstall registry key | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\QuotaArc` (exported to `uninstall-registry-entry.reg`/`.xml` in the backup dir below) |
| Start Menu shortcut | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\QuotaArc.lnk` |
| Shortcut target | `C:\Users\imodhish\AppData\Local\QuotaArc\QuotaArc.exe` |
| Shortcut working dir | `C:\Users\imodhish\AppData\Local\QuotaArc` |
| AUMID (live, via `Get-StartApps`) | `app.quotaarc.desktop` — matches source (`TOAST_AUMID` stable branch in `rust/src/paths.rs`, and `identifier` in `apps/desktop-tauri/src-tauri/tauri.conf.json`) |
| Pinned to Start currently? | Not conclusively determined via safe read-only cmdlets — `Export-StartLayout` (legacy tile-grid API) shows no `Quota`/`Codex` entry, but Windows 11's actual pinned-apps list is not exposed by that cmdlet. Real pinned status will be confirmed visually against the live Start UI before any pin action, per H12/H13. |

## Real data locations (backed up byte-for-byte, not decrypted)

| Path | Contents | Size |
|---|---|---|
| `%APPDATA%\QuotaArc` | `settings.json` (secure-file wrapped: `format`/`version`/`protection`/`payload` — protected, not decrypted for this manifest), `history.db`+`-wal`+`-shm` (SQLite, WAL mode — was actively written as of 2026-09-10 03:58, confirming very recent real use), `profiles.json`, `api_keys.json` (secure, byte-copied only, never read), `manual_cookies.json` (secure, byte-copied only, never read), `window_geometry.json`, `notification-dedupe.json`, `.tray-pin-default-v1`, `backups/`, `codex-accounts/`, `logs/` | 5.5 MB |
| `%LOCALAPPDATA%\QuotaArc` | Install directory: `QuotaArc.exe`, `uninstall.exe`, `quotaarc-icon-128.png`, plus local scanner output dirs `local-usage/`, `claude-usage-probe/`, `cost-usage/` | 32 MB |
| `%LOCALAPPDATA%\app.quotaarc.desktop` | WebView2 runtime cache (`EBWebView/`) — browser cache/cookies for the embedded webview, **not** app settings, fully regenerable. **Not backed up** (223 MB, disposable runtime cache, no user data). | 223 MB |

No process named `QuotaArc.exe` was running at backup time (`tasklist` checked immediately before backup) — the recent `history.db-wal` timestamp reflects the last real session, not a concurrent write during this backup.

## Backup location

```
N:\QuotaArc\personal-rollback\20260911-025812\
  AppData-Roaming-QuotaArc\      <- byte-for-byte copy of %APPDATA%\QuotaArc
  AppData-Local-QuotaArc\        <- byte-for-byte copy of %LOCALAPPDATA%\QuotaArc (install dir)
  QuotaArc.lnk.bak                <- copy of the original Start Menu shortcut file
  uninstall-registry-entry.reg    <- exported uninstall registry key (reg export)
  uninstall-registry-entry.xml    <- same, as PowerShell CliXml
  QuotaArc.exe.sha256              <- hash of the pre-promotion executable
  uninstall.exe.sha256             <- hash of the pre-promotion uninstaller
  roaming-data-hashes.txt          <- SHA256 of every file in the Roaming data dir
```

All copies were made with `cp -a` (preserves mode/timestamps) directly from
the live paths; no file inside was opened, parsed, or decrypted except
`settings.json`'s top-level JSON structure (to confirm it is
secure-file-wrapped, not to read its `payload`).

## Exact rollback procedure

If the promoted build fails its smoke test, or Personal's data becomes
inaccessible/corrupted after the upgrade:

1. **Do not attempt DPAPI-level repair or decrypt anything.** DPAPI-
   protected payloads (`settings.json`'s `payload`, and by the same
   mechanism likely `api_keys.json`/`manual_cookies.json`) are tied to
   the current Windows user account's DPAPI master key. As long as the
   restore happens under the **same Windows user account**
   (`imodhish`, unchanged), a byte-for-byte file restore of these files
   is sufficient — DPAPI unprotection happens at runtime by the app
   itself, not by this backup/restore process.
2. Close Quotalis/QuotaArc if running (`taskkill /F /IM Quotalis.exe`
   or `/IM QuotaArc.exe`, whichever the promoted build's process name
   is).
3. Run the **new** install's uninstaller if one was created (do not run
   the OLD `uninstall.exe.sha256`-matching uninstaller after a new one
   has replaced files at the same path — check which uninstaller is
   currently present first).
4. Restore data: copy `N:\QuotaArc\personal-rollback\20260911-025812\
   AppData-Roaming-QuotaArc\*` back over `%APPDATA%\QuotaArc\`
   (overwrite).
5. Restore the install directory: copy `AppData-Local-QuotaArc\*` back
   over `%LOCALAPPDATA%\QuotaArc\` (overwrite) — this restores the
   exact 0.10.1 `QuotaArc.exe` and its uninstaller.
6. Restore the Start Menu shortcut: copy `QuotaArc.lnk.bak` back to
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\QuotaArc.lnk`.
7. Re-import the uninstall registry entry if the new installer replaced
   or removed it: `reg import uninstall-registry-entry.reg`.
8. Verify: launch the restored `QuotaArc.exe`, confirm version 0.10.1
   (`(Get-Item ...).VersionInfo.FileVersion`), confirm SHA256 matches
   `QuotaArc.exe.sha256`, confirm Dashboard/Settings load with the same
   provider/profile data as before.

## What is and is not recoverable

- **Recoverable**: every file in the two backed-up directories, the
  Start Menu shortcut, the uninstall registry entry — all copied
  byte-for-byte, hashes recorded.
- **Not backed up, but low-risk**: `app.quotaarc.desktop\EBWebView`
  (223 MB WebView2 cache) — pure runtime cache, regenerates
  automatically on next launch, contains no settings or history.
- **Not independently recoverable if lost after this point**: any
  write Personal makes to its data files *between this backup and a
  future failure* (e.g. if the user runs the OLD 0.10.1 build again
  after this backup but before the promotion, any new history samples
  it records won't be in this snapshot). This backup is a snapshot at
  2026-09-11 02:58 AST, not a continuous journal.
- **DPAPI consideration**: the `protection` field in `settings.json`
  (and presumably `api_keys.json`/`manual_cookies.json`) ties the
  encrypted payload to the current Windows user's DPAPI master key. A
  restore under a *different* Windows user account, or after a Windows
  credential/profile reset, would leave the payload undecryptable even
  though the file itself is intact. This is a pre-existing property of
  the app's own secure-storage design, not something introduced by this
  backup.

## Historical incident (unrelated, kept separate)

The Product V3-era Personal-contamination incident remains documented in
this repo's earlier forensic files (`CLAUDE_HANDOFF_RECONCILIATION.md`
and related). Status: **INCIDENT — NOT COMPOUNDED**. This promotion
manifest does not restore, alter, or reference that incident's state —
it is a separate, current-state backup taken immediately before a
new, explicitly owner-authorized promotion.
