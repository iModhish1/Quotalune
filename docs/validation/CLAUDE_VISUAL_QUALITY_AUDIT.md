# Claude visual quality audit — 2026-09-10

Historical evidence note (2026-09-27): the Quotalis-era screenshots cited
below were withdrawn from the current public image tree. Audit copies are
retained only in ignored
`.local/historical-claude-continuation-2026-09-27/`. The grading below is
historical and does not establish current Quotalune visual acceptance.

Wave D §1 (baseline capture + grading, required before any design work).
Real native screenshots against a freshly rebuilt, `dev-preflight`-
verified `QuotalisDev.exe`, demo mode on (12 simulated providers,
`connectedShowcase` scenario) for representative content. Screenshots
in the local historical audit directory noted above.

**Scope note, stated up front:** this document covers baseline capture
and honest grading only — the mandatory first step of Wave D. Concept
generation (3 directions each for Dashboard/Analytics/Providers, 2 for
Controls/Settings), self-selection, and multi-cycle native fidelity
implementation loops are real, substantial design work that was **not**
completed in this pass and is not claimed here. Grading a page below A
is not itself a fix; nothing below should be read as "already
addressed."

## Grades

| Surface | Screenshot | Grade | Why |
|---|---|---|---|
| Dashboard Overview (PopOut) | `CLAUDE_DASHBOARD_OVERVIEW.png` | **B** | Clean, legible, on-brand provider cards with real cosmic-styled icons (Codex as a blue globe, Claude as an orange starburst), clear "Limits now" hierarchy, working pagination (1–2/12). But visually flat next to the target "premium cosmic observatory" direction — no depth, texture, or background treatment; reads as a competent utility panel, not a signature surface. Narrow fixed width (~630px) constrains it to a single-column list even with 12 providers loaded. |
| Analytics | `CLAUDE_ANALYTICS_DEMO.png` | **B** | The strongest of the three today — a real cosmic background image is visible (a planet/starfield), tabbed sub-navigation (Overview/Usage trends/Local activity/Resets/Providers/History/Data quality) is clear and purposeful, KPI row (Active Providers/Next Reset/Alerts) is legible. Held back from A by the bottom dock nav consuming roughly a third of vertical space in this window size, pushing the actual "Trend intelligence" chart — presumably the page's centerpiece — below the fold before any scrolling. |
| Providers | `CLAUDE_PROVIDERS.png` | **B** | Functional and information-dense in a good way: status-count filter chips (All/Enabled/Reporting/Needs attention/Disabled) with live counts, a clear demo-mode disclosure banner, a working per-provider "Limits now" preview with a direct "View analytics" link. Same bottom-dock-eats-the-viewport issue as Analytics limits visible content to roughly the top third of the page before scrolling. Visually plainer than Analytics — no background treatment, flat dark panels. |
| Settings → Reset Display | `CLAUDE_CONTROLS_closed.png`, `_open.png`, `_selected_closed.png` (Wave C) | **B** | Already documented in `CLAUDE_CONTROL_QA_VALIDATION.md` — clean, working `QuotalisSelect` controls, live bilingual preview. Same dock-nav space pressure. |
| Settings, light theme | `CLAUDE_LIGHT_THEME.png` (Wave C) | **C** | Real, unfixed contrast defect: several sidebar nav labels and the page title render in low-contrast light gray against the light background, materially harder to read than the dark theme's equivalent. Flagged in `CLAUDE_CONTROL_QA_VALIDATION.md`; repeated here because it is a genuine, currently-open visual-quality gap, not resolved by anything in this pass. |

No screenshot was captured this pass for Workspace, Profiles,
Collections, Usage & Spend, or Notifications Settings specifically as
standalone pages — grading those without a real baseline would be
guessing, so they are left ungraded here rather than assigned a
plausible-sounding score.

## Cross-cutting finding: bottom dock navigation eats the viewport

Both `CLAUDE_ANALYTICS_DEMO.png` and `CLAUDE_PROVIDERS.png` (and every
Settings screenshot from Wave C) show the same structural issue: a
persistent bottom navigation dock (Dashboard/Workspace/Providers/
Settings, each expandable) occupies a large, fixed fraction of the
window's vertical space regardless of what page is showing above it —
in these captures, roughly 300–350px of a ~1024px-tall window, over
30%. This is not a per-page defect; it is a layout-level constraint that
directly caused the Analytics page's own centerpiece ("Trend
intelligence") to be pushed below the fold in a window size that should
comfortably fit it. Any redesign work on Dashboard/Analytics/Providers
should treat this as a shared, foundational constraint to address once
(e.g. a collapsible or auto-hiding dock, or a narrower always-visible
strip with the expanded picker as a transient overlay) rather than
something each page's own redesign should route around independently.

## Verdict

**DASHBOARD VISUAL QUALITY: PARTIAL** (baseline graded B, real
cross-cutting layout issue identified; concepts/implementation not
attempted this pass — not claimed as PASS).
**ANALYTICS VISUAL QUALITY: PARTIAL** (same basis; Analytics is the
strongest existing surface of the three graded).
**PROVIDERS VISUAL QUALITY: PARTIAL** (same basis).
