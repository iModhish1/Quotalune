# Wave 6 continuation checkpoint

Written per the owner's explicit context-limit protocol: finish a coherent
slice, test it, commit it, record exact state here, continue from this file
in the next session — do not ask the owner to re-scope.

## Branch / HEAD

- Branch: `feature/v9-theme-runtime`
- HEAD: `6ba4ae62` — "Wave 6 Phase 3: main navigation normalization"
- Prior checkpoints: `fcd0938d` (Profiles regression fix), `4596468e`
  (Profiles page, Phase 2), `f902cec8` (Collections first-class tab)

## Execution order (owner's 21-phase spec)

1. ~~Profiles page~~ — **DONE**
2. ~~Main navigation normalization~~ — **DONE** (this checkpoint)
3. Structure Theme vs Icon/Provider Presentation UX — NOT STARTED (next)
4. Follow Structure / Independent mode — NOT STARTED
5. Visual theme-bleed investigation — NOT STARTED
6. Theme Composer — NOT STARTED
7. Full UI density audit — NOT STARTED
8. Density/layout corrections — NOT STARTED
9. Before/after proof — NOT STARTED
10. Bounded Fable concept pass — NOT STARTED
11. New Structure Themes — NOT STARTED
12. New Icon/Provider Presentation Themes — NOT STARTED
13. Theme combination matrix — NOT STARTED
14. Light-theme validation — NOT STARTED
15. Motion ownership — NOT STARTED
16. Performance — NOT STARTED
17. Full Dev/native QA — NOT STARTED
18. Version decision — NOT STARTED
19. Personal backup — NOT STARTED
20. Personal promotion — NOT STARTED
21. Final verification — NOT STARTED

(The owner's phase numbers in their latest message start at 1 = Profiles;
Collections from the prior checkpoint predates that numbering and isn't
renumbered here.)

## What's actually done and verified (not asserted)

### Phase 0 — Collections (checkpoint `f902cec8`, accepted complete)

Unchanged this session. First-class tab, native-verified.

### Phase 1 — Profiles page (checkpoint `4596468e`, + regression fix `fcd0938d`)

Real page, reuses the existing profile store/commands. **Regression found
and fixed same-session**: the owner spotted (via a live screenshot) that
profile row names weren't rendering — root-caused via CDP computed-style
inspection to a flexbox collapse (name span squeezed to width:0 by
competing action buttons in a ~200px column) plus several invented CSS
variable names. Fixed: two-line row layout, real design tokens
(`--qa-graphite-2/3`, `--qa-hairline`, `--qa-status-critical`, `--qa-accent`
via `color-mix`). Native-verified the fix (row-name width 0px → ~152px).

### Phase 2 — Main navigation normalization (checkpoint `6ba4ae62`, this session)

**Dashboard investigation (done first, per explicit instruction not to
invent a route)**: traced the real architecture before touching anything.
Verdict — **A: a real Dashboard already exists.** It's `PopOutPanel.tsx`,
rendered in the shared `main` window via `SurfaceMode::PopOut` +
`SurfaceTarget::Dashboard` (already the cold-launch default target,
`main.rs::primary_window_request()`). It was simply missing from the
`MainRoute` vocabulary and the Settings sidebar — nothing was invented, an
existing surface was given a proper route.

**Also found**: the tray's "Pop Out Dashboard" item was a real naming
mismatch — it opens the detached flyout window, which mounts `TrayPanel`
(the compact tray popover), not `PopOutPanel`/the Dashboard at all. Fixed
alongside adding the real Dashboard entry: old item relabeled "Pop Out
Panel" (new `TrayPopOutPanel` key), old `TrayPopOutDashboard` key and its 7
translated lines removed (mirrors the `TrayShowWindow` cleanup from the
Collections slice).

**What was built:**
- `shell::MainRoute::Dashboard` — the one route targeting the main-window
  Dashboard instead of a settings tab. `settings_tab()` now returns
  `Option<&'static str>` (`None` for Dashboard) — explicit at the type
  level.
- `open_or_focus_main_window`'s Dashboard branch reuses
  `main.rs::primary_window_request()` — same target cold launch uses, not
  a second definition.
- New `open_dashboard` Tauri command + `openDashboard()` JS wrapper
  (mirrors `open_settings_window`/`open_flyout_window`).
- New tray item "Dashboard" → `MenuAction::OpenMainRoute(MainRoute::Dashboard)`.
- Sidebar: "Dashboard" is a distinct button (not `role="tab"`) rendered
  before the settings tablist — correct ARIA, since activating it
  navigates away to a different window rather than switching a tabpanel
  here. Reuses `.settings-tab` styling exactly, one thin separating rule.
- `TAB_META` reordered to the target hierarchy: primary product
  (`providerDisplay`, `collections`) → organization (`profiles`,
  `providers`) → customization (`themes`, `usageSpend`, `notifications`)
  → system/config (`general`, `menuBar`, `menu`, `surfaces`, `advanced`,
  `about`). No tabs removed, none duplicated.

**Explicitly not done** (correctly out of scope, not an oversight):
- No visual section-header/divider treatment for the four hierarchy
  groups — that's a Phase 7 density/layout concern, not a Phase 3
  route-ordering concern. Groups exist only in comment-documented order
  right now.
- No structural density redesign — only the one new element (Dashboard
  button) follows the "no oversized cards / no dead space" principle;
  existing tab/nav padding was left as-is per explicit scope ("only
  remove clearly excessive shell/navigation spacing... do not start the
  full density redesign yet").

## Tests (all currently green, except one pre-existing unrelated flake)

- Frontend: `npx vitest run` → **672/672 passing**, EXCEPT one
  intermittently-flaky, pre-existing, unrelated test:
  `src/hooks/useTrayPanelLayout.sizing.test.tsx` > "does not feed
  measurement style changes back into another auto-fit pass" — confirmed
  via git-stash A/B testing to fail at ~1-in-4 rate on BOTH the
  pre-Phase-3 commit and the current commit, in isolation, with zero
  relation to anything touched this session (tray-panel resize/auto-fit
  timing, not navigation/Settings). Flagged as a separate background task
  (`task_21a3501f`) rather than "fixed" as an incidental Phase-3 side
  effect. Excluding that one file: 669/669.
- Frontend typecheck: `npx tsc --noEmit` → clean.
- Rust shell crate: **447/447 passing** (445 → 447; new:
  `dashboard_route_is_not_a_settings_tab_and_reopens_the_main_window`,
  `dashboard_is_a_primary_entry_distinct_from_pop_out_panel`, plus an
  added assertion in `open_main_app_and_named_routes_resolve_distinctly`).
- Rust shared crate: **1474/1474 passing** (unchanged — nothing in
  `rust/src/` itself was touched this phase, only its Tauri-layer
  consumers and locale files).
- `cargo clippy --all-targets -- -D warnings`: clean, both crates.
- `cargo fmt --all -- --check`: clean, both crates.
- Locale-drift check: **972/972 keys matched** (971 → 972 across the two
  Profiles+Phase3 slices; new keys this phase: `TabDashboard`,
  `TrayDashboard`, `TrayPopOutPanel`; removed: `TrayPopOutDashboard` and
  its 7 translated lines).
- Secret scan / skip-focus scan / `git diff --check`: clean (the two
  `.skip(1)` matches in `main.rs` are `Iterator::skip`, not test-skip
  directives — pre-existing, unrelated false positives).

## Native proof (real Dev binary + WebView2 IPC via CDP, not unit tests only)

- Profiles regression fix: row-name width went from 0px (invisible) to
  ~152px (real, screenshot-confirmed) after the CSS fix.
- Dashboard nav: clicked "Dashboard" in the real sidebar → confirmed the
  shared `main` window's body actually re-rendered as `PopOutPanel`
  content (provider grid, quota meters, "Default" profile switcher, per
  the captured DOM text) — not a stub or a no-op. Screenshot sent.
- Dashboard nav at 480px narrow width: button still visible, correctly
  sized (icon-only mode via existing `@media(max-width:560px)` rules),
  no overlap. Screenshot sent.
- Dashboard nav under `dir="rtl"`: border/margin sides swap as expected
  (checked in "side" navigation mode — the `[data-navigation="top"/
  "bottom"]` RTL branch specifically wasn't separately exercised in this
  pass; the CSS mirrors the existing, already-correct `.settings-tabs`
  RTL pattern by inspection, but a dedicated top/bottom+RTL native check
  is still open if the owner wants full confidence there).
- **Still not done** (accepted external blocker, unchanged from prior
  checkpoints): a physical mouse click on the real Windows system tray
  icon. Tray→Dashboard routing is verified at the Rust unit-test level
  only.

## Known defects found and fixed this session (not left in place)

1. (Carried from Phase 1 checkpoint) Missing Collections tab icon, stale
   `TrayShowWindow` locale key.
2. Profiles page row-name collapsing to 0-width (the owner's screenshot
   catch) — see above.
3. Tray "Pop Out Dashboard" naming mismatch (opens `TrayPanel`, not the
   Dashboard) — found during the Phase 3 Dashboard investigation, fixed
   alongside adding the real Dashboard route.

## Exact next step (Phase 3 in the owner's numbering — Structure Theme vs Icon/Provider Presentation UX)

Not started. Per the owner's spec:
- Implement an explicit composition model: **Structure Theme** +
  **Provider/Icon Presentation**, with a "Provider Presentation Source:
  [Follow Structure] / [Independent]" control.
- "Follow Structure" must show clear provenance ("Provider Presentation:
  Following Solar Ember"), not present "Adaptive" as an unrelated theme
  card.
- "Independent" must not mutate the Structure Theme's background/
  geometry/material/ornaments/macro-motion — only presentation changes.
- Per-provider override on top, ONLY if the current Provider Identity
  architecture supports it cleanly (owner: "Use current architecture...
  do not add this if it requires duplicating the current identity
  system").
- Centralize resolution in one pure function, conceptually
  `resolveVisualComposition({ structureTheme, providerPresentationSource,
  selectedPresentation, providerIdentity, providerOverride, semanticState })`
  — no mutable module globals, same input → same output, and the Settings
  preview + production surfaces must both call it (not separate logic).

Files to start from (not yet inspected this session — inspect before
assuming shape, same discipline as the Dashboard investigation):
- `apps/desktop-tauri/src/design-system/themeResolution.ts` — likely
  where structure/identity resolution already partially lives; read it
  first.
- `apps/desktop-tauri/src/design-system/themeCatalog.ts` — `CatalogTheme`
  shape (has both `identity` and `material` fields already — this may be
  exactly the structure/presentation split, or may need one).
- `apps/desktop-tauri/src/surfaces/settings/tabs/ProviderDisplayTab.tsx`
  and its `ProviderIdentityGallery`/`UsageDisplaySection` children — the
  existing Provider Identity configuration UI, to extend rather than
  duplicate.
- Provider Identity Rust-side storage: search for how `providerIdentity`/
  accent overrides currently persist in `Settings` (likely
  `provider_limit_presentation`/`global_limit_presentation` in
  `rust/src/settings.rs`, already seen this session via
  `command_profiles.rs`'s `set_provider_limit_presentation`/
  `set_global_limit_presentation` commands — these may already BE most of
  this system under a different name; confirm before building anything
  new).

## Personal status (must not be touched until Phase 19-20 in the owner's numbering)

- Personal is on **0.10.1**. Not touched this session.
- Version bump to **0.11.0** remains the working assumption, to be
  confirmed at the version-decision phase.

## Process notes for the next session

- Dev binary + vite dev server pattern (unchanged from the Phase 1
  checkpoint): `pnpm run dev` on port 1420, then
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
  target/debug/QuotaArc.exe`. Rust command/route changes require a real
  rebuild + relaunch (`cargo build` then kill+relaunch the exe); pure
  frontend/CSS changes hot-reload via vite without relaunching.
- `topArcEnabled` toggle trick (to force the main workspace to auto-open
  for testing) was used again this session and restored afterward each
  time — verified via `get_surface_settings` before/after both times.
- When `cargo build` fails with "Access is denied" removing
  `QuotaArc.exe`, the previous Dev instance is still running — find and
  kill it (`tasklist //FI "IMAGENAME eq QuotaArc.exe"` /
  `taskkill //F //PID <pid>`) before rebuilding. `cargo check` (no
  binary link) works fine while the exe is locked, for pure compile-error
  iteration.
- Scratch CDP verification scripts live in `.local/` (not committed,
  reusable as templates for the next phase's native checks).

## Overall verdict so far

**NOT PASSED** — 2 of the owner's 21 phases complete and verified (plus
the pre-numbered Collections slice). Continuing per the owner's explicit
"do not stop, do not ask to re-scope" instruction.
