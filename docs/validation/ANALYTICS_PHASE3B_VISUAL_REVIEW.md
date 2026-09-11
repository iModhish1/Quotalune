# Analytics Superstack — Phase 3B Native Visual Review

Native pass against a real, freshly-built `QuotalisDev.exe` (dev-channel,
preflight-verified: `channel=dev exe=QuotalisDev.exe app_dir_name=QuotaArc-Dev`)
on a real machine with genuine Codex and Claude local activity history (497+
indexed Codex rollout files spanning ~30 days, real Claude transcript files).
Driven via the existing CDP proof harness (`.local/proof/claude-audit/`).
This is inspection-first, not a "tests pass so it's done" pass — three real
defects were found and two were fixed in this same session; the third is
documented as an open, reproduced, root-caused issue.

## Defect 1 — FIXED: raw giant integers instead of compact numbers

**Found**: `Analytics → Tokens` and `Analytics → Models`, viewed against real
data, rendered full unformatted integers — `63,747,046,211`,
`59,510,984,827`, `32,733,319,425` — dominating the page. Confirmed via
`docs/images/analytics-superstack/ANALYTICS_SUPERSTACK_TOKENS_CODEX.png`
(before) vs the same path (after, overwritten once fixed).

**Fix**: added `apps/desktop-tauri/src/lib/analytics/formatTokens.ts`
(`formatCompactTokens`/`formatExactTokens`) — magnitude-based k/M/B/T
formatting with the exact value preserved in a `title` tooltip attribute.
Wired into both `TokenAnalytics.tsx` and `ModelAnalytics.tsx`. Verified
natively: Codex's cards now read `63.9B`, `63.7B`, `59.5B`, `118.6M`; the
Models table reads `32.7B`, `29.1B`, `1.2B`, `612.8M`, `121.3M`, `77.1M`,
`7.2M`, `393.9k`, `380k`, `77.4k` — consistent across seven orders of
magnitude on the same real dataset. 4 new/updated unit tests
(`formatTokens.test.ts` + one regression test in `TokenAnalytics.test.tsx`
pinning the exact defect: a value that used to render as a raw 11-digit
integer must render compactly with the exact value only in `title`).

## Defect 2 — FIXED: Model Analytics showed an empty table despite 63B+ real tokens

**Found**: on first native launch, `Analytics → Models` rendered zero rows
for Codex (`modelTotals: []`) even though the same snapshot's `total.
totalTokens` was a genuine ~70 billion. Root-caused by direct IPC
inspection (`get_codex_workspaces_snapshot`), not assumption: this
machine's `WorkspaceUsageSidecar` (`rust/src/codex_workspaces/sidecar.rs`)
already held a **whole-snapshot cache** written by a previous session
*before* `model_totals` existed. `load_latest_snapshot` returns a
cache-hit's stored payload verbatim, with no rescan, whenever
`payload_format_version` matches the current `PAYLOAD_FORMAT_VERSION`
constant — which it did, because deserializing an old payload with
`#[serde(default)]` silently produces `model_totals: []` rather than
failing, so the version check never caught it. The result: this new field
would have stayed permanently empty on any real user's machine with an
existing cache, until their history window naturally rotated out the
cached entry — Model Analytics would have looked broken/empty for
Codex-heavy users specifically, the ones with the most reason to use it.

**Fix**: bumped `PAYLOAD_FORMAT_VERSION` (`sidecar.rs`) from `3` to `4`,
forcing exactly one real rescan on any machine with a pre-existing cache.
Added `codex_workspaces::sidecar::tests::
stale_payload_format_version_is_treated_as_a_cache_miss`, which publishes a
snapshot, manually downgrades its stored format version, and asserts
`load_latest_snapshot` now returns `None` (cache miss) rather than serving
the stale payload. Verified natively end to end: after the rebuild, the
same real machine's `modelTotals` populated with 10 real models (`unknown`
32.7B, `gpt-5.6-sol` 29.1B, `gpt-6-astra` 1.2B, down to `codex-auto-review`
77.4k), correctly ranked, correct `lastObserved` timestamps.

## Defect 3 — FOUND, NOT FIXED: Claude's `getProviderChartData` takes ~100–112 seconds on real data

**Found**: on this real machine, the Claude section of both `Tokens` and
`Models` stayed stuck on `…` (the loading state) for roughly two minutes
after the tab was opened — not a permanent hang, but far past what any
loading-state UI should tolerate. Reproduced twice independently
(Tokens: 112.3s; Models: 100.2s) via direct `invoke("get_provider_chart_data",
{providerId:"claude"})` timing and via polling the live DOM for the
resolved state. The command *did* eventually return correct real data
(`thirtyDayTokens: 11,178,477`, `topModel: "claude-sonnet-5"`) — this is a
performance defect, not a correctness one.

**Root cause (not yet fixed)**: `build_provider_chart_data_with_cancel`
(`apps/desktop-tauri/src-tauri/src/commands/chart.rs`) calls
`get_daily_token_history("claude", 30)` on every invocation with no
persistent cache comparable to Codex's `WorkspaceUsageSidecar` — Claude's
path re-walks and re-parses every local transcript file from scratch each
time the Tokens or Models tab is opened, unlike Codex's indexed/cached
`codex_workspaces` path. On a machine with a large accumulated Claude
transcript history, this scales directly with corpus size and is the exact
gap section 33 ("shared local activity query layer") and section 34
("performance") of this phase's brief were anticipating.

**Current mitigation (already in place, not new)**: `TokenAnalytics.tsx`
and `ModelAnalytics.tsx` never show a stale-zero value while this is
in flight (fixed in this pass — the provider-comparison row used to fall
back to a literal `0` during loading; now it withholds the whole comparison
section until both providers' real state has resolved). The `…` loading
indicator is honest, but there is no timeout/skeleton messaging for a
multi-second wait, and no cross-tab cache: switching from Tokens to Models
and back re-triggers the same ~100s fetch a second time.

**Recommended follow-up** (out of scope for this pass — flagging, not
fixing, given the size of the actual fix: giving Claude's local scanner a
persistent incremental cache is a multi-file backend change comparable to
`codex_workspaces`' own sidecar, not a quick patch): add a
`ClaudeLocalActivity`-scoped cache with the same incremental-resume
strategy `cost_scanner.rs`'s `CostUsageCache` already uses for Codex, and
share one fetch across Tokens/Models/Activity within a session so opening
all three tabs costs one scan, not three.

## Confirmed correct (no defect)

- Capability gating: both tabs correctly show/hide per real registry state;
  Codex's richer breakdown vs Claude's total-only summary is honest and
  matches `docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md` exactly — no
  fabricated parity.
- Model identity: raw model IDs preserved verbatim (`gpt-5.6-sol`,
  `opencode-zen/x-preview-f-free`, `openrouter/stealth/ox-alpha`) — no
  silent renaming/merging.
- `unknown` (Codex's `CODEX_UNATTRIBUTED_MODEL` bucket) surfaced honestly
  as the single largest bucket on this real dataset (51.3% share) rather
  than hidden or mislabeled.
- `Last observed` correctly uses relative time (`Updated just now`, `14
  hours ago`, `25 days ago`) via the existing `formatRelativeUpdated`.
- Dashboard → Analytics navigation, tab switching, and provider-scoped
  fetch (`providerId`) all worked correctly through manual native clicks.

## Not yet reviewed this pass

Activity/Heatmap, Analytics Overview rebuild, Data Sources visual polish,
light theme, RTL, responsive breakpoints, and large-corpus (25k/100k/250k)
synthetic benchmarking were not exercised in this pass — this review is
scoped to the Tokens and Models native inspection this phase's hard rule
required before any further visual work. See the conversation's final
report for the complete list of what remains open.

## Screenshots

- `docs/images/analytics-superstack/ANALYTICS_SUPERSTACK_TOKENS_CODEX.png` — Codex, post-fix, compact formatting.
- `docs/images/analytics-superstack/ANALYTICS_SUPERSTACK_TOKENS_CLAUDE.png` — Claude, post-fix, resolved after ~112s.
- `docs/images/analytics-superstack/ANALYTICS_SUPERSTACK_MODELS_CODEX.png` — Codex ranked table, post-fix.
- `docs/images/analytics-superstack/ANALYTICS_SUPERSTACK_MODELS_CLAUDE.png` — full table + Claude section, resolved after ~100s.
