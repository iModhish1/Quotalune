# Dashboard Structure Theme Integration

Phase 3.6. Branch `feature/v9-theme-runtime`, audited/implemented from HEAD
`dff4488a`.

## 1. Authoritative theme source

`apps/desktop-tauri/src/design-system/themeCatalog.ts` — `THEME_CATALOG`, a
24-entry array of `CatalogTheme` objects (9 hand-authored + 15 from
`createLibraryThemes`). Each theme carries real color fields (`bg`, `core`,
`coreEdge`, `accent`, `accent2`, `accent3`, `hairline`, `providerColors`) plus
an optional `identity`/`material` block (relief, ornament, text/muted colors,
etc.). `CANONICAL_THEME` (`01-obsidian-orbit`, "Obsidian Orbit") is the
default — its real accent is teal (`#2dd4bf`), not gold; see §7 below.

This is the **one** Structure Theme system in the app. Nothing new was added
to it or beside it this phase.

## 2. Persistence and resolution precedence (unchanged, already shipped)

- Rust: `Settings.catalog_theme` (global, `rust/src/settings.rs:1183`),
  `Settings.active_profile_catalog_theme` (derived per-profile cache,
  `:1189`), `Settings.surface_catalog_themes: HashMap<String,String>`
  (per-surface override, `:1195`) — `"dashboard"` is already a valid key here
  (`normalize_surface_catalog_themes`, `:1375`).
- TS: `SettingsSnapshot.catalogTheme` / `.activeProfileCatalogTheme` /
  `.surfaceCatalogThemes` (`types/bridge.ts:251`).
- Resolution: `design-system/themeResolution.ts::resolveCatalogTheme(settings,
  surface)` — precedence **surface override → active-profile override →
  global setting → `CANONICAL_THEME` default**. Each candidate is validated
  via `catalogBySlug`; an invalid slug falls through to the next tier, never
  to an unrelated theme.
- Per-profile: `rust/src/profiles.rs` `QuotaArcProfile.catalog_theme:
  Option<String>` — `None` inherits the global theme.
- Set via the real `set_catalog_theme(slug, scope)` IPC command
  (`lib/tauri.ts:123`).

**None of this needed to change.** The data path to a resolved `CatalogTheme`
for the `"dashboard"` surface already existed before this phase.

## 3. Where tokens are currently emitted (the real mechanism)

There is **no document-level cascade**. Nothing sets a catalog-theme slug as
a `data-*` attribute on `documentElement`/`body` (confirmed by exhaustive
grep). The two-valued `data-qa-theme="light"|"dark"` attribute
(`design-system/index.tsx`) is a **completely separate** mechanism — it
drives the `--qa-*` primitive token pool in `tokens.css`, and no Structure
Theme code ever reads or writes it.

The actual, only-existing mechanism is **per-component inline styles**: each
consumer (`CatalogUsageHero.tsx`, `TaskbarStage.tsx`, `TopOrbitStage.tsx`,
`EdgeOrbitStage.tsx`, `FloatingHudStage.tsx`, `MenuSurface.tsx`) calls
`catalogBySlug(resolveCatalogTheme(settings, surface).slug)`, then builds a
JS `style` object with a **component-private CSS-variable namespace** (e.g.
`--qa-hero-*`, `--qa-stage-*`, `--qa-menu-*`) and applies it to that
component's own root node. `MenuSurface.tsx` additionally sets
`data-catalog-theme` on its own root, giving `CatalogMenuSurface.css` a few
pre-declared descendant selectors (`.menu-surface[data-catalog-theme]
.menu-card`, etc.) — but that reach is scoped to `.menu-surface` (tray
flyout / detached popout chrome) and uses its own private namespace, not the
shared `--qa-*` tokens.

## 4. Why the Dashboard didn't receive it

`AnalyticsDashboard.tsx` already calls `resolveCatalogTheme(settings,
"dashboard")` — but the *only* place that result reaches is
`CatalogUsageHero` (via `DashboardBody`'s `catalog` prop), and the 2D
Analytics Dashboard explicitly passes `hideHero` to suppress that orbital
hero (Phase 2 decision: "no giant empty orbital hero in 2D mode"). None of
`DashboardAnalyticsPanel`, `KpiRow`, `UsageTrendSection`,
`ProviderDistribution`, `ResetSchedule`, `AlertsPanel`, `DataStatusPanel`, or
`DashboardHeader` import the catalog system or receive a theme value at all.
`DashboardAnalyticsPanel.css` styles every card from the light/dark-only
`--qa-*` primitive pool, which — as confirmed by exhaustive grep — no
Structure Theme code anywhere in the app ever touches.

**Root cause, precisely:** the resolved theme reaches exactly one consumer
(`CatalogUsageHero`), and that consumer is switched off in 2D mode. Every
other Dashboard surface never had a wire to the resolved theme at all.

## 5. Chosen integration point

Reuse the **exact existing pattern** (§3), extended to the analytics panel:

- New `apps/desktop-tauri/src/surfaces/dashboard/analytics/useDashboardStructureTheme.ts`
  hook: calls the same `resolveCatalogTheme(settings, "dashboard")` +
  `catalogBySlug` the app already calls, and derives a `CSSProperties`
  object under a new component-private namespace, `--qa-analytics-*`,
  mapping the resolved theme's real fields onto the semantic names
  requested (surface tiers, hairline, text tiers, structural accent,
  selection, shadow) — see `DASHBOARD_STRUCTURE_THEME_INTEGRATION.md` §6
  for the exact mapping.
- Applied once, as an inline `style` object on `.dashboard-analytics`'s root
  `<div>` in `DashboardAnalyticsPanel.tsx` — identical shape to how
  `CatalogUsageHero`/`TaskbarStage` apply their own namespaced vars to their
  own root.
- `DashboardAnalyticsPanel.css` updated so every card/heading/KPI rule reads
  `var(--qa-analytics-<name>, var(--qa-<fallback>))` — a real CSS variable
  **falls through to the existing light/dark token** wherever
  `--qa-analytics-*` isn't defined (i.e. everywhere outside
  `.dashboard-analytics`), so nothing outside the Dashboard changes.
- The shared chart primitives' structural bits (`.chart__baseline`,
  `.chart__axis` in `styles.css`, used by both `LineChart`/`BarChart`) get
  the same fallback chain, so they pick up Dashboard theming only when
  rendered inside `.dashboard-analytics` — the Settings-surface
  `CostHistoryChart`/`CreditsHistoryChart` charts (outside that scope) are
  completely unaffected.

This is not a second theme system: it is the same `resolveCatalogTheme` call,
the same `CatalogTheme` object, and the same "component computes an inline
CSS-variable-namespaced style object" mechanism every other themed surface
in the app already uses — applied to one more component that never had it
wired.

## 6. Semantic token mapping

All values are the *resolved* `CatalogTheme`'s own real fields — nothing
invented, nothing hardcoded per-dashboard:

| Semantic name | Source |
|---|---|
| `--qa-analytics-surface-primary` | `theme.core`, opacity-layered for the primary card |
| `--qa-analytics-surface-secondary` | `theme.core`, secondary opacity |
| `--qa-analytics-surface-tertiary` | `theme.core`, tertiary opacity |
| `--qa-analytics-hairline` | `theme.hairline` |
| `--qa-analytics-hairline-strong` | `theme.coreEdge` |
| `--qa-analytics-text-primary` | `theme.material?.text ?? --qa-ink-1` |
| `--qa-analytics-text-secondary` | `theme.material?.muted ?? --qa-ink-2` |
| `--qa-analytics-text-tertiary` | derived (reduced-opacity mix of the secondary text color) |
| `--qa-analytics-accent` | `theme.accent` (the theme's own structural accent — interactive chips/focus, never a provider color) |
| `--qa-analytics-accent-structural` | `theme.accent2` (the primary card's signature top-border accent) |
| `--qa-analytics-selection` | `theme.accent` at reduced opacity (active range-chip fill) |
| `--qa-analytics-shadow` | derived from `theme.core` (depth on the primary card) |

Warning/critical KPI and alert states are **not** themed — `--qa-status-high`
/`--qa-status-critical` stay exactly as-is (§13: semantic state must win over
decorative theme color, in every theme tested).

## 7. Phase 3.5's gold accent token — audited and refactored

Phase 3.5 added `--qa-accent-gold`/`--qa-accent-gold-soft` to `tokens.css`
(light+dark variants) and used it in exactly one place: the Usage Trend
card's top border. Audited per this phase's instruction: it was a **fixed,
theme-independent value** — every Structure Theme would have shown the same
gold line regardless of selection. That's exactly the "hardcodes Quotalis
gold regardless of Structure Theme" case this phase says to refactor.

**Refactored**: removed both tokens from `tokens.css`; the Trend card's top
border now reads `--qa-analytics-accent-structural` (§6), which resolves to
whatever the *active resolved theme's* own signature accent actually is.

**Real, honest consequence worth flagging to the owner**: the *default*
Structure Theme (`01-obsidian-orbit`, "Obsidian Orbit") has a real accent of
teal (`#2dd4bf`), not antique/champagne gold. The theme catalog does contain
a genuinely gold-accented entry (`sapphire-observatory`, accent `#d3b77e`),
but it is not the shipped default. This phase's job was to make the
Dashboard faithfully follow whatever Structure Theme is actually resolved —
which it now does — not to silently change `CANONICAL_THEME`'s colors or
invent a new default, since that's a global, cross-app content decision
outside a Dashboard-integration task's scope. If the owner wants the
*default* Quotalis experience to be gold-accented, that's a one-line change
to `CANONICAL_THEME.accent` in `themeCatalog.ts` (affecting every themed
surface app-wide, correctly, through this same pipeline) — not something to
special-case inside the Dashboard.

## 8. Structural vs provider identity — kept separate

Provider color resolution (`providerCreditsColor`, `providerCostColor`,
`ProviderIcon`, `buildAlerts`'s `providerName`) was **not touched**. Chart
series color continues to come from the provider-color palette exactly as
before Phase 3.6; only the chart's *structural* elements (baseline stroke,
axis text color, grid) follow the new `--qa-analytics-*` fallback chain.
Alert/KPI severity borders stay on `--qa-status-*`, never on
`--qa-analytics-*`. The existing Follow-Structure/Independent provider
presentation logic (`design-system/visualComposition.ts`) is untouched by
this phase — Dashboard structural theming and provider identity resolution
are separate code paths that don't call into each other.
