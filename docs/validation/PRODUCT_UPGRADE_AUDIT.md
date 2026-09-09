# Professional product upgrade: architecture audit and implementation plan

Starting revision: `7c228009`, 2026-09-09. Acceptance pending.
This extends the single-Dashboard decision; no 3D/Spatial replacement.

## Evidence from the current implementation

| Area | Existing architecture | Proven weakness / action |
| --- | --- | --- |
| Providers | `ProvidersTab` → sidebar + shared `ProviderDetailPane` → credential/usage sections | Sidebar derives success from absence of `error`, ignoring explicit `errorState`. Correct state model first; build list/detail workspace around existing capability-specific controls. |
| Auth | Detail commands and provider credential dispatchers | All 70 IDs audited in PRODUCT_UPGRADE_AUTH_AUDIT.md; interactive capability now shares one registry between DTO and dispatch. External remote completion remains unverified. |
| Navigation | `settingsTabs.ts` flat list of 16 destinations | Provider Display precedes Providers; analytics/preferences/system mixed. Group existing stable tab IDs without breaking deep links or native whitelist. |
| Settings | Rust settings + typed patch/events + `useSettings` | Central persistence already exists; do not build a competing store. Chart detail reads animation once per provider; navigation is webview-local storage. Audit event consistency and migrate purposeful preferences into shared settings. |
| Analytics | Rust history snapshot + pure dashboard selectors + SVG charts | `rankProvidersByShare` divides unrelated provider quota percentages by their sum and labels it usage share. Denominators are not comparable; replace with explicit per-provider quota observations, never a synthetic cross-provider share. |
| Provider money | `CostSection` displays generic cost labels; `CostHistoryChart` prefixes `$` | Detail now carries quantity and currency semantics. Tracing established cost-history is the separate USD CLI-scanner path, already empty under Phase 4C eligibility; no new currency inference or fabricated zero was added. |
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

### Phase 2: navigation taxonomy

Stable destination IDs now grouped into Monitor, Workspace, Appearance & limits,
Preferences and System. Side navigation exposes group labels; top/bottom layouts
retain compact strips and the same keyboard traversal. No native route was added.
Validation: 24 focused navigation tests passed; production build/typecheck passed.

### Phase 4a: counterexample-driven analytics correction

Removed cross-provider quota share normalization. The comparison table now uses
last buckets from the selected history range, per provider/account, preserves true
zero and rejects invalid percentages. Native `ProviderSummary` is current-state,
not a historical mean (`rust/src/dashboard_data.rs`); the table therefore uses
trend buckets explicitly. Trend comparison rejects mixed accounts/duplicate buckets.
Spend totals reject non-finite values and any inconsistent point instead of silently
presenting a partial total. Account rows use neutral labels to avoid exposing IDs.
Validation: 68 analytics tests passed; production build/typecheck passed.

### Phase 3 / 6: reusable provider workspace and Demo boundary

Providers uses one searchable list/detail shell, operational-state text, status
filter, enabled/attention counts and selected provider heading. One shared detail
composition groups Overview, Connections and Presentation. Hidden panels remain
mounted to preserve unsaved input; provider changes remount that composition.
Keyboard tabs support arrows/Home/End and RTL. All existing credential-specific
controls remain in the Connections slot; no provider-specific page fork.

Demo uses the existing effective-provider generator and shared controls. Its
Providers view never mounts the real credential pane and disables monitoring
mutations/reorder. It is explicitly labeled simulated/read-only. Real history and
credential commands remain separate. Native appearance evidence is now recorded in
`PRODUCT_UPGRADE_VALIDATION.md`.

### Phase 5: shared settings propagation

`Settings.workspace_preferences` is optional, preserving legacy navigation for
older files. Lenient field parsing isolates malformed density/navigation from the
rest of Settings; writes normalize supported values. The existing Tauri patch and
events remain the only persistence path. A read-only React projection supplies
animation/density to charts and surrounding UI; no second store was introduced.
Profile/global Structure Theme now colors Settings/Providers using the existing
resolver. Dashboard surface overrides remain local; provider identity palettes are
not rewritten by the workspace theme. Existing reduced-motion policy still wins.

### Analytics contract review

| Output | Contract / action |
| --- | --- |
| Active providers | Ready with no error; configuration availability is not authentication success. |
| Highest quota / alerts | Selected real quota window, provider threshold settings; errored snapshots excluded. Quotas are independently normalized for display, never a share of unrelated plans. |
| Reset schedule | Real parseable future instant from selected window; no timestamp means unavailable, never fabricated now. |
| Quota comparison | Last selected-range bucket per provider/account; neutral account labels; no cross-provider denominator. |
| Trend change | Percentage-point difference between bucket halves; one provider/account, >=4 unique buckets; no token/spend inference. |
| Spend KPI | Latest cumulative reported Spend per series, known period and uniform currency/kind, no invalid points. Caption explicitly says readings, not accrued spend in selected date range. |
| Balance / credits | Separate quantity names; credits do not acquire a currency symbol. Unknown provider semantics unavailable. |
| Provider detail | Window labels from adapter metadata/snapshot; unhealthy snapshots do not expose stale quota/pace/cost as current. |
| Detail token history | Exact local log totals; device-wide/all log accounts, explicitly captioned. Selected email does not claim to scope tokens. |
| Detail cost history | USD local-scanner contract, currently empty because billing eligibility is unproven. Phase 4C safety unchanged. |
| Legacy monetary rows | Existing contract gates remain; no promotion to provider-reported Spend. |
| Freshness / provenance | Observed timestamp and actual source label; sidebar distinguishes disabled/auth/offline/error/stale/unavailable. |

No new pricing, billing-channel inference, token-to-cost conversion or historical
reset reconstruction was introduced. Profile membership is not credential account
switching: unresolved new credential references are rejected before storage.

Validation checkpoint: 938 frontend tests passed across 152 files, TypeScript,
production build and desktop cargo check passed before the final token-selection
and login-supervision regression tests. Final results will be recorded separately.

Final implementation revision `17c99c02` and full native/gate evidence are recorded
in [PRODUCT_UPGRADE_VALIDATION.md](PRODUCT_UPGRADE_VALIDATION.md). Native proof also
exposed and closed a cross-window last-tab/settings feedback race; its before/after
readbacks and the remaining legacy-writer scope are documented there.
