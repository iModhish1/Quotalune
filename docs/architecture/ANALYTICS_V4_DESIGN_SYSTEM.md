# Cosmic Dashboard implementation contract

Owner reference: `docs/design/analytics-v4/concepts/CONCEPT_A_COSMIC_REVISED.png`.
The owner rejected later sheets and explicitly requested direct implementation.
The original selected image is the visual contract; no replacement design is used.

## Composition and ownership

`DashboardAnalyticsPanel` retains one range/filter and one shared analytical
model. `CosmicDashboard.css` supplies the selected static celestial composition.
`ProviderPlanet` layers original bundled provider SVGs over a decorative globe;
its SVG arc receives only a validated physical quota's used percentage. Cached
readings of providers requiring authentication never become active arcs.

The Quotalis master mark and orbit glyph files are unchanged. `ProviderIcon`
only adds a provider ID attribute for local contrast correction; no SVG source
is replaced. Background: generated static PNG, 1,945,524 bytes, bundled locally.
No CDN, WebGL, new dependency or perpetual animation has been introduced.

## Meaning and disclosure

- Quota amounts, resets, authentication and currencies retain the existing
  truth layer. No pricing calculation or provider adapter was modified.
- The status ribbon prioritizes active providers, next reset and attention.
  Highest usage and reported cumulative spend remain in the More disclosure.
- Planetary instruments show used/remaining explicitly; physical-window and
  account metadata are disclosed below each provider.
- Attention retains categorical priority and existing reconnect actions.
- Trend uses actual observed data with a labeled padded percentage domain,
  preserved gaps/reset boundaries and mean/previous-mean comparison only when
  existing comparison eligibility succeeds. Higher usage is not labeled profit.
- Reset uses explicit non-overlapping time bands; it is not a linear axis.
  The overview shows each provider's next known reset; all windows remain in
  the detailed schedule.
- The usage matrix shows the latest observed physical quota in each elapsed
  daily bucket beginning at the selected range start. It never fills missing
  samples, averages accounts or copies points to simulate density. Expanded
  rows preserve separate physical windows. Threshold colors use persisted
  warning/critical settings. The separate observation-coverage chart remains
  accessible through Data Quality.

## Interaction, themes and layout

`QuotalisSelect` is a dependency-free single-selection listbox/combobox with
search, keyboard navigation, active descendants, selection checks, Escape,
outside dismissal and focus restoration. Fixed portal positioning clamps to
the viewport, respects RTL, and cleans up scroll/resize/pointer listeners.
Animations are 120 ms and removed with reduced motion.

Structure colors still originate in `resolveCatalogTheme`. Cosmic art is
decorative behind legible analytical panels; light themes receive opaque
surfaces. Performance presets continue to control ECharts. Compact/dense modes
reduce instrument size and spacing. At narrow widths the editorial row becomes
a single column and the matrix scrolls inside its own region.

## Validation contract

Generated images are design references, never native proof. Native evidence
must come from rebuilt `QuotalisDev.exe`, with Demo labeled and real data tested
separately. Original logo assets, Personal, auth stores and provider semantics
must remain untouched. Owner visual acceptance is a separate checkpoint.
