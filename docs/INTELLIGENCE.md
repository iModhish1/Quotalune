# Intelligence

QuotaArc must be more than a meter. The intelligence layer turns provider
snapshots into capacity observations, computed locally and deterministically —
no external AI model involved.

## Inherited engine (Win-CodexBar)

The core math ships in the inherited shared crate and is heavily unit-tested
(1,390 backend tests):

| Capability | Module |
|---|---|
| Burn pace vs. sustainable rate | `rust/src/core/usage_pace.rs` |
| Session-equivalent exhaustion forecast | `rust/src/core/session_equivalent_forecast.rs` |
| Reset windows / ETA | `rust/src/core/rate_window.rs`, `session_quota.rs` |
| Cost pricing + projections | `rust/src/core/cost_pricing.rs`, `models_dev_pricing.rs` |
| Confidence gating | forecast modules return availability, not guesses |

## Presentation rules

- Recommendations are framed as **capacity observations** ("Codex has more
  headroom right now"), never unreliable guarantees.
- Low sample data renders an explicit **"Not enough history"** state instead
  of false precision; forecasts only display when the engine reports them as
  available.
- Surfaces show at most: remaining %, reset countdown, and (where available)
  pace. Deep detail lives in the dashboard's pace/forecast views.

## QuotaArc roadmap

History retention (raw → hourly → daily downsampling with bounded retention)
builds on the inherited SQLite machinery (`rust/src/core/sqlite.rs`) and is
planned as the next wave; the current release stores what upstream stores
(settings, snapshots, cost caches) under `%APPDATA%\QuotaArc` /
`%LOCALAPPDATA%\QuotaArc`.
