# Phase 5.2 — User-Accessible Demo Mode — Evidence Log

Starting HEAD: `8d7bd9a3` (Phase 5.1 follow-up fixes close).
Ending HEAD: `48a9b779`.

## Commits

| Commit | Content |
|---|---|
| `2c2c8612` | Settings (Rust + TS), the `demoMode/` deterministic data layer, effective-data-source hooks, 2D/3D wiring, indicator component |
| `db67f082` | Demo & Preview Settings UI (`DemoSettingsSection.tsx`), 43 new demo-layer tests |
| `d4864949` | `cargo fmt` |
| `48a9b779` | Always-visible 3D provider glyph labels (visual-quality fix found via native proof) |

## Native method

Binary: `target\debug\QuotalisDev.exe`, built via `pnpm exec tauri build
--config src-tauri/tauri.dev.conf.json --features dev-channel --debug
--no-bundle` at HEAD `48a9b779`. SHA-256:
`b84ba590d63e09b0662e1f38d93a282f592dc2447d9ac50a80d07af22f09babd`
(pre-label-sprite build; the label-sprite fix was re-verified with an
incremental rebuild sharing the same launch/CDP method). ProductName
"Quotalis Dev", data root `%APPDATA%\QuotaArc-Dev`. Launched with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`,
driven via the same CDP technique used in Phase 5.1
(`.local/proof/phase5.2-demo/`, not committed). Personal
(`C:\Users\imodhish\AppData\Local\QuotaArc\QuotaArc.exe`, PID 52000)
confirmed running and untouched at every checkpoint.

## Real user flow (owner section 56), each step confirmed via real IPC

1. **Enable Demo Mode** — `update_settings({ demoModeEnabled: true })`
   via the real Settings > Dashboard Studio > Demo & Preview UI (also
   independently confirmed via direct IPC). Settings snapshot round-trip
   confirmed `demoModeEnabled: true` with real defaults
   (`demoProviderMode: "curated"`, `demoProviderCount: 6`,
   `demoScenario: "connectedShowcase"`, `demoHistoryDays: 7`).
2. **Open Providers 3D** — real `get_bootstrap_state`/DOM check showed
   the nav list as exactly `["Codex","Claude","Gemini","Perplexity",
   "Grok","DeepSeek"]` — the real default six, in the documented order,
   verified present in the real provider registry catalog beforehand.
   `QUOTALIS_DEMO_3D_SIX_PROVIDERS.png`.
3. **Select a provider (Grok)** — real click on the accessible nav
   button; detail panel showed `"Grok · DEMO · USAGE 57% · NEXT RESET
   Resets in 23h 59m · STATUS Connected · Demo · MONETARY STATE Not
   available"` — a real DEMO badge, "Connected · Demo" wording (not a
   bare "Connected"), and an honest "Not available" for an unclassified
   provider's monetary state. `QUOTALIS_DEMO_3D_SIX_SELECTED.png` /
   `QUOTALIS_DEMO_PROVIDER_DETAIL.png`.
4. **Open 2D Dashboard, same demo universe** — switched
   `dashboardMode: "analytics2d"` via real `update_settings`; the same
   six providers rendered with a real Usage Trend chart per provider
   (five distinct, intentional curve shapes — gradual rise, stable,
   late spike, moderate oscillation, reset-cycle-like), a real
   Historical Usage Share breakdown (Gemini 23% / DeepSeek 21% / Codex
   19% / Grok 16% / Claude 12% / Perplexity 10%), and real KPIs (Active
   Providers 6, Highest Usage Gemini · 81%, Next Reset 44m, **Reported
   Spend $14.89**, Alerts 3) — all computed by the SAME production
   selectors (`computeKpis`, `totalReportedSpend`) real data uses, over
   a synthetic `DashboardSnapshot`. `QUOTALIS_DEMO_2D_SIX_PROVIDERS.png`.
5. **Change provider count 6 → 12 / Custom set** — real
   `update_settings({ demoProviderMode: "custom", demoProviderIds:
   ["mistral","openrouter","bedrock"] })`; nav list immediately became
   exactly `["Mistral","OpenRouter","AWS Bedrock"]`, no app restart, no
   stale entries. `QUOTALIS_DEMO_CUSTOM_PROVIDER_SET.png`.
6. **Monetary Semantics scenario** — real `update_settings({
   demoScenario: "monetarySemantics" })` overrode the provider set to
   its fixed four (`claude`/`codex`/`sub2api`/`gemini`); selecting each
   confirmed all four real Phase 4 states distinctly: `Claude → "Spend:
   USD 9.40"`, `Codex → "Credits: 237.00"` (no currency symbol),
   `sub2api → "Balance: USD 11.02"`, `Gemini → "Not available"`.
   `QUOTALIS_DEMO_MONETARY_SEMANTICS.png`.
7. **RTL** — real `set_ui_language("arabic")`. Full layout mirroring
   (nav/detail panel swap sides), real Arabic strings throughout
   (`"6 مزودي خدمة محاكاة"` = "6 simulated providers", `"متصل ·
   تجريبي"` = "Connected · Demo", `"الإنفاق: USD 9.40"` = "Spend: USD
   9.40"), provider names stayed LTR-isolated ("Claude", "Grok", etc.),
   percentages stayed Latin-numeral, the 3D canvas itself correctly did
   **not** mirror. `QUOTALIS_DEMO_RTL.png`.
8. **Restart persistence** — killed and relaunched the process; the
   exact prior configuration (`demoModeEnabled: true,
   demoProviderMode: "curated"`, `demoProviderIds:
   ["mistral","openrouter","bedrock"]` still retained even though mode
   had moved back to curated, `demoSeed: 1`, `demoHistoryDays: 7`) came
   back byte-identical from `settings.json`.
9. **Disable Demo Mode** — real `update_settings({ demoModeEnabled:
   false })`; the 3D nav list immediately reverted to the real
   configured providers (`["Codex","Claude"]`, this profile's genuine
   2 accounts) with the DEMO indicator gone entirely — no stale demo
   entries, no app restart.
10. **Settings UI** — `QUOTALIS_DEMO_SETTINGS.png`: the real enable
    toggle, Curated/Custom segmented control, provider-count stepper
    (showing 6), Scenario dropdown, 7/30-day history toggle, "Regenerate
    Demo Data", and a live "Current configuration" summary matching the
    real settings snapshot exactly.

## Isolation proof

- **History (owner section 35/54)**: recorded `history.db`'s exact size
  and mtime before this entire Demo Mode test pass
  (28,672 bytes, 2026-09-07 23:08:40) and again after extensive Demo
  Mode use across two separate process launches (enable, six scenario/
  provider-set changes, a restart, disable): **byte-identical, mtime
  unchanged**. No demo observation ever reached the production history
  recorder.
- **Network/auth (owner section 36/53)**: grepped the real app log for
  any fetch/refresh activity naming a demo-only provider id
  (`mistral`/`openrouter`/`bedrock`/`gemini`/`perplexity`/`grok`/
  `deepseek`/`sub2api`) across the entire session: zero matches. Demo
  providers never entered `enabledProviders`, so no code path could have
  attempted a real fetch for them.
- **Notifications/tray (owner section 37/38)**: structural, not just
  empirical — the real desktop-notification watcher and tray renderer
  read only the backend's real provider cache, which Demo Mode's
  frontend-only synthetic snapshots never write to. There is no code
  path connecting the two, so no real notification could have fired
  regardless of how extreme a simulated "High Usage"/"Reset Soon"
  scenario is configured.
- **Personal**: untouched throughout (confirmed running, unmodified, at
  every checkpoint).

## Visual quality gate (owner sections 22/58) — a real defect found and fixed

The first native capture of the default six-provider showcase
(`QUOTALIS_DEMO_3D_SIX_PROVIDERS` v1, not committed) showed six
correctly-sized, correctly-colored, usage-ring-encoded bodies — a real
improvement over Phase 5.1's earlier two-provider capture — but with no
way to tell which provider was which without hovering or checking the
side list. Fixed (`48a9b779`) by adding a small, always-visible
`THREE.Sprite` glyph label per body. Re-captured
(`QUOTALIS_DEMO_3D_SIX_PROVIDERS.png`): every body now reads its own
name directly ("Codex", "Claude", "Gemini", "Perplexity", "Grok",
"DeepSeek"), satisfying "the viewer should immediately see six
meaningful providers, not tiny dots" without hover interaction.

## Determinism / semantic / data-source-switch tests (owner sections
50-52)

- 21 tests in `demoMode/providerSnapshots.test.ts`: exact provider
  counts for curated/custom modes, no duplicates, custom-mode filtering
  against a real catalog (with a safe curated fallback if every custom
  id is stale), the Monetary Semantics fixed-four override, determinism
  (identical config -> identical output; a different seed changes
  output), Phase 4 monetary correctness (Spend never becomes
  Balance/Credits, Balance carries a currency figure, Credits never gets
  currency formatting, an unclassified provider never gets a fabricated
  cost, a usage percentage is never reinterpreted as money), Connected
  Showcase (all ready, real spread, real reset timestamps derived from
  `now`), Mixed Status (a non-ready provider reads "Demo state", not a
  real-looking failure).
- 7 tests in `demoMode/dashboardSnapshot.test.ts`: determinism, exact
  historyDays bucket counts, 2D/3D truth parity (the same current-
  provider numbers in both the provider-snapshot array and the
  dashboard-snapshot summary), correct `costContract` gating, spend-
  trend restricted to spend-classified providers, cumulative
  (non-decreasing) spend series.
- 3 tests in `hooks/useEffectiveProviders.test.tsx`: Demo OFF returns
  live data with provenance `"live"`; Demo ON returns the synthetic
  dataset with provenance `"demo"` and never merges the live mock's
  values in; Demo ON -> OFF restores live data with zero stale demo
  entries (replacement, not merge, semantics).
- 12 tests in `demoMode/DemoSettingsSection.test.tsx`: default OFF,
  enable/disable persistence, count-stepper increment/decrement/clamp,
  scenario/history persistence, custom-picker reveal and real-catalog
  rendering, add/remove persistence with exact selected-set semantics,
  search-filter narrowing, seed-increment regeneration, live summary.
- 12 tests in Rust (`rust/src/settings.rs` + `rust/src/settings/tests.rs`):
  enum default/round-trip/rejection for `DemoProviderMode`/`DemoScenario`,
  provider-count clamping (0/1/6/24/25/`u32::MAX`), history-days
  normalization, full-settings round-trip, and a corrupt on-disk value
  falling back to the real default rather than a degenerate state.

## Full quality gates (final HEAD `48a9b779`)

- `cargo test --workspace`: **2067 passed, 1 ignored** (455 Quotalis bin
  + 1611 quotalis_core + 1 quotalis bin)
- `cargo clippy --workspace --all-targets -- -D warnings`: clean
- `cargo fmt --all -- --check`: clean
- `pnpm exec tsc --noEmit`: clean
- `pnpm vitest run`: **972/972 passed, 150/150 files**
- `pnpm run build`: succeeds; locale-drift OK — **1085 keys** (32 new)
- `git diff --check`: clean (full Phase 5.2 range)
- Skip/focus scan (new test files): none found
- Secret scan (new files + docs): none found
- Personal: confirmed untouched throughout

## Known limitations (see `DEMO_MODE.md` for the full list)

- History range selection beyond the configured `demoHistoryDays` does
  not generate more data (documented simplification, owner section 39).
- Provider Display integration deferred (owner section 44) — kept out
  of scope rather than forcing it.
- Model-level demo analytics intentionally not built (owner section 14
  — preserving Phase 3/4's product honesty about unsupported
  capabilities).
- The 3D scene's selected-provider highlight remains a pre-existing
  Phase 5.1 gap (no in-canvas glow on the selected body; the accessible
  detail panel is authoritative) — unrelated to Demo Mode, not
  reintroduced or worsened by it.

## Verdict

**PHASE 5.2 — USER-ACCESSIBLE DEMO MODE: PASS.**

Every item in the Phase 5.2 pass-condition checklist was verified
against the real compiled Dev-channel binary via genuine WebView2 CDP
control:

- [x] Demo Mode is a first-class, user-accessible Settings toggle (never
      `import.meta.env.DEV`-gated)
- [x] Default OFF
- [x] Default enabled config uses 6 providers (real registry ids)
- [x] Provider count customizable 1-24 (stepper, clamped)
- [x] Curated and Custom provider sets both proven live
- [x] Default six providers appear genuinely connected ("Connected ·
      Demo")
- [x] Demo providers have meaningful, diverse current data (real
      showcase spread, not flat values)
- [x] Deterministic history exists (7/30-day, five distinct trend
      shapes)
- [x] 2D and 3D share identical demo truth (proven by test + live
      capture)
- [x] Useful simulated analytics render (KPIs, trend, distribution,
      alerts, data status — via the real production selectors)
- [x] Spend/Balance/Credits/Unavailable remain semantically correct
      (proven live across all four in one scenario)
- [x] Obvious DEMO/simulated-data indicator on every affected surface
- [x] No fake history persisted (byte-identical `history.db` before/after)
- [x] No provider network/auth calls for demo providers
- [x] No real notifications/tray pollution (structural guarantee)
- [x] Disabling Demo instantly restores live data (no stale entries, no
      restart)
- [x] Structure Themes work (existing resolver reused, untouched)
- [x] RTL works (full real proof captured)
- [x] Accessibility preserved (existing accessible nav/detail panel
      reused, keyboard nav intact)
- [x] Six-provider 3D scene is visually readable (fixed a real gap: now
      labeled)
- [x] Demand rendering remains quiet (no new render/polling loop
      introduced — Demo Mode only substitutes input data)
- [x] All quality gates green
- [x] Personal untouched

One real visual defect was found and fixed in this pass (unlabeled
provider bodies). No known critical defect remains open.

Per the phase's own instruction: **stopping here**. Not starting Phase
6. The owner should review the real screenshots under
`docs/images/dashboard/phase5.2-demo/` before deciding on further
investment.
