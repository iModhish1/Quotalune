# Professional product upgrade: architecture audit and implementation plan

Starting revision: `7c228009`, 2026-09-09. Acceptance pending.
This extends the single-Dashboard decision; no 3D/Spatial replacement.

## Evidence from the current implementation

| Area | Existing architecture | Proven weakness / action |
| --- | --- | --- |
| Providers | `ProvidersTab` → sidebar + shared `ProviderDetailPane` → credential/usage sections | Sidebar derives success from absence of `error`, ignoring explicit `errorState`. Correct state model first; build list/detail workspace around existing capability-specific controls. |
| Auth | Detail commands and provider credential dispatchers | Independent read-only source coverage audit pending; live provider login cannot be claimed from a mock or opening a website. |
| Navigation | `settingsTabs.ts` flat list of 16 destinations | Provider Display precedes Providers; analytics/preferences/system mixed. Group existing stable tab IDs without breaking deep links or native whitelist. |
| Settings | Rust settings + typed patch/events + `useSettings` | Central persistence already exists; do not build a competing store. Chart detail reads animation once per provider; navigation is webview-local storage. Audit event consistency and migrate purposeful preferences into shared settings. |
| Analytics | Rust history snapshot + pure dashboard selectors + SVG charts | `rankProvidersByShare` divides unrelated provider quota percentages by their sum and labels it usage share. Denominators are not comparable; replace with explicit per-provider quota observations, never a synthetic cross-provider share. |
| Provider money | `CostSection` displays generic cost labels; `CostHistoryChart` prefixes `$` | Carry proven quantity/currency semantics into detail; suppress ambiguous historical monetary chart data until its contract proves units. |
| Demo | Existing seeded generator and effective hooks | Dashboard supports Demo, Providers uses live hooks/detail commands only. Add clearly separated read-only simulated provider presentation with no credential actions. |
| Visual system | Existing Structure Theme, Provider Identity, chart components | Reuse tokens and compositions; improve task hierarchy, information tables and state rails, not isolated color edits. |

## Dependency-ordered phases

1. Audit and ledger: inspect provider/auth/backend/settings/chart paths, freeze interfaces and document unknowns.
2. Information architecture: grouped stable destinations; reusable workspace framing; verify keyboard navigation and RTL.
3. Providers and connections: authoritative states, searchable/filterable list, grouped reusable detail composition and capability-driven action rail. Prevent stale async responses crossing provider boundaries.
4. Analytics correctness: remove dimensionally invalid aggregates; verify account/time/currency scope and detail money; add counterexample tests.
5. Shared customization and templates: shared persisted preferences and live propagation, readable comparison/detail tables, consistent animations/density where justified.
6. Demo: reuse generator/configuration, explicitly read-only simulated Providers view, no real auth/history mutation.
7. Validation: relevant gates after each implementation slice; full frontend/Rust/type/build/locale gates and fresh native Dev evidence at final code revision. Record authentication paths tested structurally versus live external account completion separately.

## Acceptance and boundaries

K01–K09 are tracked in `tasks/MASTER_REQUIREMENTS.md`. Source audit is not proof of
successful remote authentication for every provider. No credentials are fabricated,
no unsupported metric is inferred, no Personal data/install is touched. Unknown
semantics produce an explicit unavailable state. Existing theme resolution,
provider identity, lazy loading and local estimation safety remain authoritative.

## Review checkpoints

Each phase records files, behavior, tests, evidence and remaining gaps before its
commit. A green unit test does not replace native visual proof. Final PASS requires
the delivered scope to satisfy the owner's product criteria; no blanket claim of
production readiness while external account verification remains unperformed.
