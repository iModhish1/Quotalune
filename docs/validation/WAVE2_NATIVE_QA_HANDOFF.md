# Wave 2 Native QA Handoff — Tray Studio + Windows Notifications

Status: **NATIVE — DEFERRED, ENVIRONMENT BLOCKED.** Code and automated tests
are in place; no native pixel evidence exists yet. Nothing in this document is
a PASS. The release gate stays closed until this handoff and the Wave 1 handoff
(`WAVE1_NATIVE_QA_HANDOFF.md`) are both executed on a machine with real pixel
access.

Why it is blocked: the session that built Wave 2 could launch a verified
`QuotalisDev.exe`, but screenshots returned `BACKGROUND_ONLY`, the hardened
launcher exposes no CDP port, and UIA reaches the WebView2 host without
addressable content. Do not retry those avenues; use a session with Computer
Use or real screenshots.

Personal (`Quotalis.exe`, `app.quotaarc.desktop`) is frozen. Every step below
is Dev only (`QuotalisDev.exe`, `app.quotalis.desktop.dev`, `QuotaArc-Dev`).

## 0. Reconcile and build

```bash
git rev-parse HEAD
git status --short
node scripts/build-dev-verified.mjs
```

Embedded HEAD must equal `git rev-parse HEAD`; channel `dev`; AUMID
`app.quotalis.desktop.dev`. Launch only through the sanctioned Dev launcher.

## 1. What code already guarantees (verify, don't re-derive)

| Area | Where | Tested contract |
| --- | --- | --- |
| Tray config | `rust/src/settings/provider_tray.rs` | 6 styles (`ring arc bar badge orbit mark`), `identity` provider/quotalis, legacy settings load, invalid values normalize |
| Renderer | `rust/src/tray/provider.rs` `render_provider_icon_spec` | 64×64 RGBA, deterministic, every style distinct, unknown ≠ 0 ≠ 100 for gauge styles, orbit lights full track at 100, Quotalis mark only replaces the center |
| Reconcile | `apps/desktop-tauri/src-tauri/src/provider_tray.rs` | catalog order, disabled providers drop, cap `MAX_PROVIDER_TRAY_ICONS = 8` (pins first), create/update/disable/re-enable/remove/switch ×50/×100 with no orphans or duplicates |
| Tooltip | same file + `tray_bridge.rs` | ≤127 UTF-16 units (`szTip` is 128 incl. terminator), 3 real rows, missing window = `—`, Arabic within limit, main tooltip keeps whole lines and ends `+N`, error text sanitized |
| Appearance | `provider_tray.rs::accent` | Tray scope Global → main application Quotalis palette; Override → per-indicator color |
| Tray fixture | `tray_qa_fixture.rs` | Dev-only, in memory, validated provider/state/percent, unavailable/error map to the real signals |
| Preview | `render_provider_tray_preview` → `TrayNativePreview.tsx` | Studio draws the exact native RGBA plus the exact tooltip, on dark and light taskbar plates |
| Explorer restart | `tray-icon 0.21.3` (`platform_impl/windows/mod.rs`) | Library re-registers each icon with its latest image/tooltip on `TaskbarCreated`; no app code needed |
| Toast text | `rust/src/notifications.rs::toast_template` | every title/body passes `UserFacingText::sanitize` (secrets, emails, profile paths, control chars) |
| Status toasts | `NotificationManager::observe_provider_status` | 2 consecutive failures → one localized, content-free toast; silent while failing; re-arms after a healthy refresh; respects master switch and category |
| Severity | `JournalEventKind::severity`, `NotificationType::severity` | Info / Warning / Critical from observed state only |
| History | `NotificationJournal::record_alert` | High/Critical/Exhausted recorded once per dedupe identity with configured level → observed usage |
| Activation | `notification_uri`/`parse_notification_uri`, `main.rs` single-instance | existing tests; fixture cases round-trip to real destinations |
| Notification fixture | `notification_qa_fixture.rs` | Dev-only, 6 cases, production copy EN/AR, 1 s rate limit, no history/dedupe writes |

## 2. Controls

- **Tray Studio:** Settings → Tray Studio. Changes persist to the Dev
  `providerTrayConfigs` and update the native icons immediately.
- **Tray fixture:** open the main window at `?window=structure-qa` → *Tray
  fixture* → set provider/state/percent/plan/reset/tokens → *Apply fixture*.
  Style, Used/Remaining and tooltip rows stay configured in Tray Studio, so the
  fixture exercises the production configuration. *Clear fixture* restores
  real data; a restart also clears it.
- **Notification fixture:** same route → *Notification fixture* → case +
  provider → *Send toast*. Switch language in the *Locale* fieldset for Arabic.
- **Appearance:** Settings → General → Appearance Composition → Tray.

## 3. Execute

Run every entry in `docs/validation/WAVE2_NATIVE_QA_MATRIX.json`. Save evidence
under `docs/images/v9/native/` at each entry's `expectedEvidence` path and set
that entry's `status` to `PASS` or `FAIL` with a one-line observation. Never
bulk-flip statuses.

Known limits to record, not to "fix" silently:

- Provider icons have one 64 px source; the main icon has one 32 px source
  (upscaled above 200 % scale). `tray_scale_percent` is persisted but not read
  by any renderer.
- Minimal mark intentionally shows no reading; the tooltip carries it.
- Fixture toasts do not write history — use a real Dev threshold crossing for
  `W2-NOTIF-HISTORY-ENTRY`.
- Status toasts are not recorded in history; milestone, session, pace and
  status toasts remain outside history coverage (the history header says so).
- A history database written by this build contains alert kinds an older
  build cannot decode; do not downgrade the Dev app dir between builds.

## 4. Defect loop

Capture → compare with `passCriteria` → if a real defect: fix the smallest
cause, rerun `cargo test --workspace` and `pnpm vitest run`, rebuild Dev,
recapture. Do not change the reconcile plan, tooltip budget or sanitizer
without extending their tests first.

## 5. Finish

Update this file's status line and the matrix. Run the full gates, commit,
then run `node scripts/build-dev-verified.mjs` after the last commit. Personal
promotion and any release remain blocked until Wave 1 native QA is also closed.
