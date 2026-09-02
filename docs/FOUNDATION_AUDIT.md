# FOUNDATION_AUDIT — QuotaArc Phase 0

Date: 2026-09-02
Auditor: QuotaArc engineering (automated discovery pass)
Scope: candidate repositories, licenses, architecture, build/test verification, reuse decision matrix.

## 1. Executive summary

QuotaArc is built on the **Win-CodexBar** Windows port of CodexBar as its provider/auth/shell
foundation, re-branded and re-experienced as an original premium product. The upstream was
verified as active, MIT-licensed, and green on build + tests in this environment before any
QuotaArc work started. Visual identity, surface system, design system, motion, intelligence
presentation, and product naming are QuotaArc-original.

## 2. Repositories inspected

| Repository | Role | License | Last push (UTC) | Stars | Verdict |
|---|---|---|---|---|---|
| nesszer/Win-CodexBar | Primary upstream (Windows, Tauri 2 + Rust + React) | MIT | 2026-08-31 | 1014 | **ADOPT as foundation** |
| Finesssee/Win-CodexBar | Redirects to nesszer/Win-CodexBar (repo id 1128458168) | MIT | — | — | Same repo; nesszer is canonical |
| steipete/CodexBar | macOS original (Swift), root of family | MIT | 2026-09-02 | 20835 | Reference only (macOS code N/A) |
| CodeZeno/Claude-Code-Usage-Monitor | Taskbar widget reference | MIT | 2026-08-28 | 437 | Concepts only — pure Win32 app, not Tauri; code not portable |
| warpirate/pillar-dynamic-island-for-windows | Overlay/HUD reference | MIT | 2026-08-24 | 4 | Concepts only — window flags + fullscreen heuristic + Motion for React |
| jamesbrink/burnrate | Analytics/updater reference | MIT | 2026-08-27 | 2 | Patterns only — keyring v3, tauri-plugin-updater v2 |

### Canonical upstream determination

`Finesssee/Win-CodexBar` returns GitHub API "Moved Permanently" → repository 1128458168 =
`nesszer/Win-CodexBar`. nesszer is the live canonical repo (branch `main`; side branches:
`codex/anchor-docs-only-regex`, `codex/move-pr-check-to-circleci`, `feat/inapp-report-funnel`,
`fix/updater-nesszer-urls`). nesszer is a fork of `steipete/CodexBar` (macOS). The winget
package is published under `Finesssee.Win-CodexBar`, which is a legacy publisher name, not a
separate codebase.

## 3. Upstream verification (done, not assumed)

Executed in this session on the cloned `main` @ `5a128f24` ("Show Codex account reset times"):

| Gate | Result |
|---|---|
| `cargo build -p codexbar` (shared crate, MSVC, Rust 1.98.0) | ✅ ok (1m45s) |
| `cargo test --manifest-path rust/Cargo.toml` | ✅ **1388 passed, 0 failed** |
| `pnpm run tauri:build:debug` (shell incl. frontend build) | ✅ ok (3m47s) → `codexbar-desktop-tauri.exe` |
| `pnpm test` (vitest) | ✅ **291 passed / 47 files** |

Environment notes: Node 24.18, pnpm 11.24, VS 2019 Build Tools (C++ workload), Rust
stable-x86_64-pc-windows-msvc. The default `rustup` install on this machine selected the
`windows-gnu` host and failed with `dlltool.exe: program not found`; fixed by installing and
defaulting `stable-x86_64-pc-windows-msvc`. Tauri MSVC builds require the MSVC toolchain.

## 4. Upstream architecture (as adopted)

Cargo workspace: `rust/` = `codexbar` shared crate (providers, settings, cookies, tray pixels,
CLI); `apps/desktop-tauri/src-tauri` = Tauri 2 shell (default member, depends on `codexbar` via
path). Frontend: React 18 + Vite 6 + TS 5.6 under `apps/desktop-tauri/src`.

- Provider refresh: `core::provider_factory::instantiate_provider` → `Provider::fetch_usage`
  → shell `commands/providers.rs` (semaphore + timeout) → `AppState.provider_cache` → events → React `useProviders`.
- Settings: `%AppData%\CodexBar\settings.json` (+ sibling stores) via `secure_file` (DPAPI-capable).
- Tray: `tray_bridge` + `tray_menu`; icon RGBA rendered in shared crate.
- Float bar: detached always-on-top transparent window (`floatbar/`), with minimized-window
  park-coordinate handling, multi-monitor recovery, and DPI scale handling (verified in source).
- Proof harness: `CODEXBAR_PROOF_MODE` env opens target surfaces for automated capture.
- 73 provider modules under `rust/src/providers/` (ProviderId enum: 67 variants).
- Backend deps current: tokio 1, reqwest 0.12 (rustls), serde, clap 4, tracing, thiserror 2,
  chrono 0.4, rusqlite 0.32 (bundled), aes-gcm 0.10, image 0.25.
- Frontend deps minimal: @tauri-apps/api 2.10, react 18.3, vite 6, vitest 3, TS 5.6.
- Windows-specific: DPAPI cookie decrypt, DWM dark caption, start-at-login (`HKCU\...\Run`),
  WebView2 bootstrap; theme pinning quirk documented (`.theme(Some(Dark))` for detached windows).
- Existing intelligence primitives in `rust/src/core/`: `usage_pace.rs`,
  `session_equivalent_forecast.rs`, `adaptive_refresh.rs`, `cost_pricing.rs`,
  `models_dev_pricing.rs`, `redactor.rs`, `sqlite.rs`, `rate_window.rs`, `session_quota.rs`.

## 5. Reuse decision matrix

| Component | Best source | Strategy | Rewrite? | Risk | License | Notes |
|---|---|---|---|---|---|---|
| Provider engine (67 providers, parsers, auth) | Win-CodexBar | inherit | no | low | MIT | Keep structure upstream-compatible; port upstream fixes |
| Credential security (DPAPI, secure_file, cookies) | Win-CodexBar | inherit | no | low | MIT | Security-critical; do not fork logic |
| Settings stores | Win-CodexBar | inherit + path abstraction | partial | low | MIT | All `join("CodexBar")` sites route through new `paths` module → `%AppData%\QuotaArc` |
| Browser cookie import | Win-CodexBar | inherit | no | medium | MIT | Chromium App-Bound encryption is fragile; keep upstream cadence |
| Tauri shell (tray, windows, IPC, auto-refresh) | Win-CodexBar | inherit + extend | partial | low | MIT | Surface Engine added alongside floatbar |
| Float bar infra (geometry, topmost guard) | Win-CodexBar | evolve into Edge Arc / Floating HUD | partial | low | MIT | Strong DPI/multi-monitor handling verified |
| CLI (`codexbar.exe`) | Win-CodexBar | inherit, rebrand binary name | no | low | MIT | Keep `codexbar` crate name internally if renames risk damage; user-facing name QuotaArc |
| Taskbar behavior concepts | CodeZeno | adapt concepts only | n/a | medium | MIT | Pure Win32 impl; re-express via Tauri + Win32 where needed |
| Overlay window recipe | PILLAR | adapt concepts | partial | low | MIT | transparent+undecorated+alwaysOnTop+skipTaskbar; content-fullscreen heuristic (WS_POPUP/no-caption ≥90% monitor) |
| Motion system | PILLAR pattern | adopt **Motion for React** (v11+, actively maintained successor of Framer Motion) | yes | low | MIT | QuotaArc motion primitives built on it; reduced-motion supported |
| Burn-rate/forecast concepts | burnrate + upstream `usage_pace`/`session_equivalent_forecast` | extend | partial | low | MIT | Upstream math exists; QuotaArc adds confidence framing + UI |
| Updater | burnrate pattern | tauri-plugin-updater v2 (signed) | yes | medium | MIT | Requires signing keys before enabling remote updates |
| Installer | Win-CodexBar (Inno Setup `codexbar.iss`) + Tauri bundler | Tauri NSIS (per-user) primary; WiX MSI secondary | partial | medium | MIT | Brief prefers NSIS per-user; Inno config kept as reference |
| Brand / UI / design system / surfaces | QuotaArc | **original** | yes | low | — | No upstream UI reuse beyond bridge contracts |
| Diagnostics/proof harness | Win-CodexBar | inherit + rename | no | low | MIT | Proves surfaces for automated QA |

## 6. Licensing / provenance

- Upstream `LICENSE`: MIT, "Copyright (c) 2025 Peter Steinberger" (CodexBar root). Retained.
- Upstream `NOTICE`: includes **codexcontrol** (MIT, Copyright (c) 2026 Adem Isler) for the
  `rust/src/codex_accounts/` multi-account port. Obligation: retain notice. **Retained.**
- All four reference repos: MIT (verified via GitHub API `license.spdx_id`).
- No GPL/AGPL/copyleft code present in the inheritance chain. No proprietary assets copied.
- QuotaArc license: **MIT**, with upstream copyright chain preserved in `LICENSE`/`NOTICE`.

## 7. Rebrand surface (measured)

- `join("CodexBar")` path call sites in Rust: **17** (config/data/cache/log/hooks/token-accounts/widget-snapshot/openai-dashboard/pricing).
- Other `"CodexBar"` string literals in `rust/src`: **34** (registry Run key, logging, CLI).
- In Tauri shell sources: **2**.
- `tauri.conf.json`: productName "CodexBar Desktop", identifier `com.codexbar.desktop`, window title.
- Frontend: brand strings localized under `src/i18n`.

**Strategy:** introduce `codexbar::paths` (single source of truth for app dirs, name overridable
per product build) and route all 17 call sites through it; QuotaArc build sets `QuotaArc` as the
directory/registry/product name. Do **not** rename the crate symbols (`codexbar::*`) — that would
damage upstream commit portability. Product identity lives in: `paths`, `tauri.conf.json`,
installer metadata, tray/UI strings, binary product name.

Config separation result: QuotaArc reads/writes `%AppData%\QuotaArc` — zero collision with an
installed Win-CodexBar.

## 8. Upstream sync strategy

Documented in `docs/UPSTREAM_SYNC.md`. Summary: `upstream` remote = nesszer/Win-CodexBar;
periodic `git fetch upstream` → `upstream-sync` branch → rebase onto `main` → conflict-isolated
integration (QuotaArc code lives in added modules + thin injection points, minimizing overlap).
Rebrand kept out of provider/parser/auth files except the centralized `paths` module.

## 9. Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| Browser cookie import breaks with Chromium App-Bound Encryption updates | medium | Track upstream; DPAPI path already handled there |
| Unsigned installers trigger SmartScreen | medium | SignPath/CI signing prepared (docs/CODE_SIGNING.md); SHA-256 published |
| VS2019 Build Tools age (upstream CI uses newer) | low | Build verified green here; move to VS2022 BT in CI |
| Tauri WebView2 shared-profile theme quirk | low | Keep `.theme(Some(Dark))` pinning on detached windows (upstream rule) |
| Upstream uses CircleCI for PR checks | low | QuotaArc ships GitHub Actions equivalents (least-privilege) |

## 10. Decision

**Proceed with Win-CodexBar (nesszer/main @ 5a128f24) as the QuotaArc foundation.** It is the
only candidate that satisfies: active maintenance, MIT, Windows-native Tauri architecture,
provider breadth (67 providers), credential security, and a green build/test matrix in this
environment. Building from scratch would waste the provider engine and credential security work;
the other candidates contribute concepts only.
