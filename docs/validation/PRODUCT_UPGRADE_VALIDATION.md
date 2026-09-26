# Quotalis product upgrade — final validation

Date: 2026-09-09. Baseline: `7c228009`. Validated implementation: `17c99c02`.
Environment: Windows, native Tauri/WebView2, Dev channel only.

## Result

The scoped product upgrade passes engineering validation. Providers now uses one
list/detail composition, settings/navigation share a coherent structure, supported
login actions have bounded execution and explicit outcomes, and analytics reject
several previously misleading aggregations. This is not certification that all
70 providers can authenticate on this machine, nor owner visual approval or an
installer release. External-auth and migration limitations are listed below.

Audit and architecture: [product audit](PRODUCT_UPGRADE_AUDIT.md).
Provider capability inventory: [auth audit](PRODUCT_UPGRADE_AUTH_AUDIT.md).

## Delivered architecture

- Navigation groups existing stable destinations by Monitor, Workspace,
  Appearance & Limits, Preferences and System. Deep-link IDs remain compatible.
- Providers has searchable/filterable operational rows, explicit enabled/attention
  counts, a common action rail and Overview / Connections & accounts / Display
  preferences slots. Existing provider-specific credential controls occupy the
  same reusable composition. Keyboard tabs support arrows, Home/End and RTL.
- Interactive login capability is explicit: Codex, Claude, Kiro and Vertex use
  supported CLI entrypoints; Copilot uses its device flow. Generic web dashboards
  no longer masquerade as completed sign-in. Account removal preserves active
  identity; unknown account IDs fail before saving.
- Copilot presents the public user code and verification URI, correlated to the
  initiating request. Private device codes and credentials are not emitted.
- Optional persisted workspace density/navigation preserve old settings.
  Existing settings events propagate changes across surfaces; existing Structure
  Theme resolution colors workspace chrome. Provider identity remains separate.
- Shared Current Limits owns its CSS, so opening Providers before Dashboard works.
  Independent quota tables, trend panels, current cards and provenance captions
  expose different information without inventing a cross-provider denominator.
- Demo uses shared deterministic configuration and clear labels on Dashboard and
  Providers. Demo Providers cannot mount credential editors or alter real
  monitoring/reorder state. Count, scenario, history and provider selection remain
  user-facing controls.

## Correctness changes

Quota comparisons use the last selected-range observation per provider/account,
not a share of unrelated quotas. Real zero is preserved. Trend deltas require one
series and sufficient distinct buckets. Spend summaries require valid homogeneous
contracts, currency and known period; their caption identifies cumulative readings,
not spend accrued during the chosen date range. Balance and credits remain distinct.
Errored snapshots cannot expose cached quota/cost as current. Local token history
is explicitly device-wide, not falsely attributed to the selected account. The
existing billing-channel eligibility gate continues to suppress unproven local
costs. No new pricing source or token-to-dollar inference was introduced.

## Native-discovered settings defect and repair

Two Settings surfaces could repeatedly persist competing last-tab values on each
shared update. Concurrent read/modify/save calls could overwrite newer workspace
preferences. Before repair, 4 of 12 alternating density readbacks were wrong.

The tab hook now writes only on local navigation, the shared patch endpoint locks
its entire read/modify/save transaction, and Settings publishes a protected sibling
file by atomic replacement. Temporary files are cleaned up on failure. A concurrent
reader test rejects partial JSON. Fresh read-only review found no P1/P2 in this
repair scope. Native repetition with both surfaces open passed all 12 readbacks.

Historical evidence: `persistence-before.json` and
`persistence-repeat.json` (withdrawn to the ignored local archive noted below).
Other legacy settings writers and separate processes are outside this endpoint's
transaction mutex; no application-wide serialization guarantee is claimed.

## Quality gates

| Gate | Actual result |
| --- | --- |
| `cargo test --workspace` | Desktop: 457 passed, 0 failed, 1 existing ignored; core library: 1624 passed; CLI binary: 1 passed; doc tests: 0. |
| Full frontend Vitest | 947 passed across 155 files. |
| Final test-fixture correction | Current Limits: 5/5 passed after replacing an incomplete monetary fixture with a fully typed value. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Passed after final settings repair. |
| `cargo fmt --all -- --check` | Passed. |
| TypeScript / production Vite build | Passed as native build prerequisites. |
| Locale parity | 1107 Rust/TypeScript keys match. This is parity, not complete translation coverage. |
| Fresh native Dev build | Passed: Tauri dev config, `dev-channel`, debug, no bundle. |
| New skipped/focused tests scan | None introduced. Existing ignored Rust test retained. |
| Targeted credential-pattern scan | No private-key/provider-token findings in added source lines. Not a comprehensive security audit. |
| `git diff --check` | Passed. |
| Native persistence regression | 12/12 requested values survived immediate readback with both surfaces open. |

Local raw logs: `.local/upgrade-settings-recovery-tests.log`,
`.local/upgrade-frontend-recovery.log`, `.local/upgrade-final-fixture-test.log`,
`.local/upgrade-clippy-recovery.log`, `.local/upgrade-native-verified-build.log`.
Historical source scan: `upgrade-source-scans.json` (withdrawn to the ignored
local archive noted below).
Vite retains a large-chunk warning; this phase makes no new CPU/FPS or bundle-size
performance claim. Failed intermediate test/build attempts were repaired rather
than hidden with skipped tests.

## Native visual evidence

These former-brand Quotalis captures and JSON companions were withdrawn from
the current public tree on 2026-09-27. Audit copies are retained only in
ignored `.local/historical-product-upgrade-2026-09-27/`. The rows below
describe the earlier Dev run; they are not current Quotalune release images.

Captured from the freshly built Dev process, not a browser mock. CUA restored and
resized its real window; CDP captured its WebView2 contents. JSON companions record
viewport, direction, density, Demo indicator and root overflow. A missing Demo
indicator on General is not evidence that its persisted Demo setting is off.

| Capture | Verified state |
| --- | --- |
| Providers dark | Real data, enabled filter, Codex/Claude operational states and action rail. |
| Connections | Real connection panel; no external sign-in submitted. |
| Providers light | Ceramic Pearl, readable provider chrome. |
| Arabic Demo | Six simulated providers, RTL, explicit read-only explanation. |
| Demo controls | Actual configuration controls, visibly simulated. |
| Narrow | 624 CSS pixels wide, stacked content, no root horizontal overflow. |
| Preferences | Compact density and top navigation. |
| Dashboard Demo | Six simulated current-limit cards; money/credits differentiated. |
| Quota comparison | Simulated trend panels and independent observations with explicit scope caption. |

All standard captures are 1040×688 CSS pixels. Captures preserve actual content;
no metrics, UI text or pixels were substituted. Presentation was restored to
English, Obsidian Orbit, comfortable/side navigation and Demo off after proof.
Personal installation/data were not launched, migrated or modified.

## Remaining scope and release boundaries

- No external consent or credential submission was performed. Provider audits are
  source/capability evidence, not 70 successful live sign-ins. CLI stdin is closed;
  interactive terminal-only variants cannot complete through this UI.
- Gemini app-managed login is intentionally unavailable until a matching supported
  flow is established. Existing credential detection/setup remains.
- Profiles select monitoring membership, not a resolved credential identity.
  Unsupported new references are rejected; existing stored data is preserved.
- Credential stores retain their existing authorities. A unified credential-store
  migration is separate work, not silently claimed complete here.
- Windows process lifetime tests are real subprocess fixtures. Unix process-group
  handling is implemented but not runtime-tested on this host.
- Arabic/native responsive proof covers the shown surfaces. Some existing labels
  and provider-supplied window names remain English.
- No installer, push, production promotion, 3D mode or follow-on phase was started.

## Implementation slices

`c7278058` audit; `8c9378d9` navigation; `1eacea4f` quota semantics;
`4b54ac05` shared preferences; `0d1661da` Providers/Demo composition;
`3f057697` auth supervision/challenges; `36c5c5b6` analytics/profile truth;
`17c99c02` settings recovery and final visual integration. Evidence-only changes
follow these implementation commits.
