# Changelog

All notable changes to QuotaArc are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versioning: [semver](https://semver.org/).
The inherited Win-CodexBar history is archived in `docs/UPSTREAM_CHANGELOG.md`.

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
