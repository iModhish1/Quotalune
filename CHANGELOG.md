# Changelog

All notable changes to QuotaArc are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versioning: [semver](https://semver.org/).
The inherited Win-CodexBar history is archived in `docs/UPSTREAM_CHANGELOG.md`.

## [0.12.0] — Unreleased

### Added

- A unified provider connection workspace with provider-specific supported
  methods and clearer connection status.
- Dedicated analytics for observed provider windows, local activity and data
  quality, plus a configurable planetary dashboard and Demo Mode.
- Notification history, provider reset details, profiles, collections and
  customizable presentation surfaces.
- Quotalune as the visible product name while preserving existing installation
  and data identities for upgrade continuity.

### Improved

- Monetary displays distinguish provider-reported Spend, Balance and Credits;
  unavailable values remain unavailable instead of becoming estimated spend.
- English and Arabic presentation, provider ordering, themes and accessibility
  across the desktop workspace.

## [0.10.1] — 2026-09-07

### Added

- A detached, live-refreshing Collections window rendering a saved
  `collection_layout` on the real desktop — previously write-only from
  the app's own point of view (Settings could save it, but nothing else
  read it).

### Fixed

- 88 of 200 provider brand-color / meter-track combinations fell under
  WCAG's 3:1 non-text contrast floor (as low as 1.05:1) for the
  `adaptive` provider identity and several fixed identities; provider
  accent colors are now nudged the minimum amount needed to stay
  legible instead of rendered raw.
- Corrected several stale claims in the 0.10.0 reconciliation handoff
  documents (Personal-promotion status, notification threshold
  customization, native Collections state) after auditing current
  source rather than trusting the prior report.

## [0.10.0] — 2026-09-06

### Added

- A dedicated Provider Display workspace with independently selectable and reorderable usage windows.
- Twenty-four structure themes and twenty-four contrast-protected provider identities.
- Expanded compact surface catalog, live previews, placement controls, Arabic localization and RTL layouts.
- Official QuotaArc mark finishes and configurable prominence across the application surfaces.

### Changed

- Settings is resizable, maximizable and full-screen capable with responsive sidebar, top and bottom navigation.
- Provider hover, wheel navigation and delayed folding now use shared interaction rules across surface families.
- Usage meters support configurable shapes, value modes, fill directions and per-provider overrides.

### Fixed

- Provider glyph sizing and meter contrast across structure/theme combinations.
- Edge and corner docking, compact footprint reclamation and detached Settings target discovery.
- Light-theme contrast, narrow-window overflow and Arabic RTL alignment regressions.

## [0.1.0] — 2026-09-02

First QuotaArc release. Built on the Win-CodexBar foundation (MIT) with an
original product experience on top — see `docs/FOUNDATION_AUDIT.md` for the
full provenance and reuse decisions.

### Added
- **Surface Engine**: Edge Arc (edge-snapped glass capacity strip, left/right,
  hover details, optional click-through) and Top Arc (top-center pill, hover
  expansion with plan/reset context), both with hide-during-fullscreen,
  opacity, and scale controls; live editor in Settings → Surfaces and tray
  menu toggles.
- **Design system**: QuotaArc tokens (`--qa-*`), status semantics with
  non-color signals, ArcGauge signature arc, AnimatedNumber, Motion for React
  integration with Full/Reduced/Off levels and `prefers-reduced-motion`.
- **Brand**: original capacity-arc mark, app icon set (16–512 px + ICO),
  light/dark tray marks, reproducible icon pipeline
  (`scripts/generate-icons.mjs`).
- **Packaging**: Tauri NSIS per-user installer (primary, no admin), MSI
  bundles for managed deployment, portable zip; SHA-256 checksums; signing
  hooks prepared (unsigned until a certificate is configured).
- **CI**: GitHub Actions PR gate (fmt/clippy/tests, locale drift, typecheck,
  frontend tests) and tag-driven release workflow with draft publishing.
- Central product-identity module `rust/src/paths.rs` giving QuotaArc fully
  separate config/data directories (`%AppData%\QuotaArc`,
  `%LOCALAPPDATA%\QuotaArc`) from any co-installed Win-CodexBar.

### Inherited
- Provider engine: 67 providers with parsers, OAuth/API-key/cookie/CLI auth,
  adaptive refresh, pace and session-equivalent forecast math, cost pricing,
  redaction, settings/secure-file storage, CLI, tray icon rendering — from
  Win-CodexBar (MIT), keeping upstream commit portability.

### Changed
- Product identity: QuotaArc naming across UI (8 languages), installer,
  binary (`QuotaArc.exe`), bundle id `app.quotaarc.desktop`, version line
  restarted at 0.1.0.
- Updater points at `quotaarc/quotaarc` releases (fails gracefully until the
  first published release).

### Retained (upstream-compatible)
- `CODEXBAR_*` environment-variable protocol for hooks/CLI integrations and
  the `CODEXBAR_PROOF_MODE` / `CODEXBAR_SEED_USAGE_JSON` proof harness.
