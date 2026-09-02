# Packaging & distribution

## Artifacts

| Artifact | Built by | Notes |
|---|---|---|
| `QuotaArc-X.Y.Z-x64-Setup.exe` | `pnpm exec tauri build --bundles nsis` | **Primary.** Tauri NSIS bundler, `installMode: currentUser` — per-user, no admin, installs to `%LOCALAPPDATA%\QuotaArc`, optional launch-after-install. |
| `QuotaArc-X.Y.Z-x64_<lang>.msi` | `pnpm exec tauri build --bundles msi` | WiX bundles per language (en-US, zh-CN, zh-TW, ja-JP, ko-KR, es-ES, ru-RU, tr-TR) for managed deployment. |
| `QuotaArc-X.Y.Z-x64-Portable.zip` | release workflow (zips the release `QuotaArc.exe`) | No registry writes by the zip itself; WebView2 runtime is bootstrapped by the exe policy. |
| `SHA256SUMS.txt` | release workflow | Published alongside every release. |

## Verified on a clean-ish user path (2026-09-02, this machine)

1. `QuotaArc_0.1.0_x64-setup.exe /S` → installs to `%LOCALAPPDATA%\QuotaArc`,
   creates `HKCU\...\Uninstall` entry (DisplayName "QuotaArc", version 0.1.0),
   auto-launches `QuotaArc.exe`. No admin prompt (per-user).
2. App launches and runs from the installed path.
3. `uninstall.exe /S` → registry entry removed, binaries removed; user data
   (`%APPDATA%\QuotaArc`, e.g. `cost-usage` cache) is intentionally **retained**
   so reinstall/upgrade keeps history. This is the documented data policy.

## WinGet

Manifest preparation happens after the first stable GitHub release with final
repo URLs (the winget manifest pins an installer SHA-256). Target id:
`QuotaArc.QuotaArc`. The release workflow's SHA256SUMS.txt is the source for
`InstallerSha256`.

## Microsoft Store (future)

MSIX packaging of a Tauri 2 app is feasible (identity `app.quotaarc.desktop`
is already Store-shaped); documented as non-blocking for v1.

## Code signing

See `docs/CODE_SIGNING.md`. The pipeline accepts `WINDOWS_PFX_BASE64` /
`WINDOWS_PFX_PASSWORD` secrets and signs with signtool (SHA-256 + timestamp)
when present; without them, artifacts are built unsigned and clearly labeled.
