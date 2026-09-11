# External analytics tool evaluation — handoff

This session (running in a sandboxed environment with no network access to
clone/build/execute arbitrary third-party code) did **not** clone, build,
run, or test any external repository. Everything in this document is a
**handoff spec** for a separate execution environment (a different Claude
Code / Codex session, or a human) that has the ability to do so safely —
it lets that environment execute the third-party-lab portion without
repeating the research or the Quotalis-side data audit already done here.

Nothing below is a claim that these tools work, are safe, or are
integrated. Status for all of them is **NOT INSTALLED / EXTERNAL
EVALUATION REQUIRED** until a session with real execution capability
completes the steps below and records real results.

## Why this boundary exists

Downloading and executing code from external, unvetted sources is outside
this session's operating constraints, regardless of authorization —
supply-chain risk (arbitrary install/postinstall scripts, unreviewed
binaries, unknown network behavior) is not something to accept on the
strength of a README looking credible. This is a hard limit, not a
preference, and holds even when a task explicitly requests it.

## What each candidate must be tested for, before any integration decision

For every project below, the executing environment must record:

| Field | What to capture |
|---|---|
| Official repo | The canonical upstream URL (avoid mirrors) |
| Version/tag to evaluate | An exact pinned tag or commit SHA — never "latest" |
| License | Exact SPDX identifier; note any copyleft (GPL/AGPL) implications before any code/asset reuse |
| Build command | Exact command(s), in an isolated environment (project-local `pnpm`/`uv`/`venv`/`cargo build` — never global install) |
| Test command | Exact command(s), and the resulting pass/fail count |
| Input fixture | A sanitized, synthetic fixture with no real prompts/credentials — never point it at real user data during evaluation |
| Network behavior | Every outbound connection observed during build/test/run — flag anything that isn't strictly local |
| Expected output | What the tool actually produced, verbatim or a faithful excerpt |
| Quotalis adapter contract | Which of Quotalis's normalized `AnalyticsSource`/`AnalyticsObservation` shapes (see `ANALYTICS_SUPERSTACK_VALIDATION.md`) this tool's output would need to map into |
| Security questions | Postinstall/build scripts inspected? Any credential/file-system access beyond the fixture? Any auto-update or phone-home behavior? |
| Decision criteria | Maintained (recent commits)? Compatible license? Local-first (no mandatory cloud/account)? Genuinely adds capability Quotalis's own scanners can't already provide? |

## Candidates (from the supplied research package, classified against real Quotalis data in `AI_USAGE_RESEARCH_INTEGRATION.md`)

### 1. ccusage
- **What it's for**: local Claude Code/Codex CLI usage-cost reporting from the same class of local JSONL transcripts Quotalis's own `cost_scanner.rs` already parses.
- **Why evaluate it anyway, given Quotalis already has a working scanner**: compare parser robustness/edge-case handling (malformed lines, rotated logs, multiple CLI versions) against `cost_scanner.rs`'s own handling — a genuine improvement to Quotalis's *own* parser is worth adopting as a pattern even without adopting the tool itself. Do not import its cost/pricing logic — Quotalis's billing-channel-eligibility gate (`CostSummary::cost_eligible()`, permanently `false` for local logs today) is authoritative and must not be bypassed by an external tool's own price-per-token assumptions.
- **Quotalis adapter contract if ever integrated**: would map to a `TokenObservation` under `AnalyticsSource::ClaudeLocalActivity`/`CodexLocalActivity` — token counts only, never cost.
- **Status**: NOT INSTALLED / EXTERNAL EVALUATION REQUIRED.

### 2. models.dev (metadata catalog)
- **What it's for**: model display names, provider relationships, context-window limits, capability metadata.
- **Constraint**: per this session's own hard rule, a model catalog must never be used to imply a proven billing channel or price. If integrated, it may only ever supply *display* metadata (a friendlier model name, a context-limit badge) — never cost.
- **Integration shape if adopted**: a versioned local snapshot (JSON file checked into the repo, manually refreshed), not a runtime network dependency — Quotalis has no mandatory-internet requirement and this must not introduce one.
- **Status**: NOT INSTALLED / EXTERNAL EVALUATION REQUIRED.

### 3. genai-prices
- **What it's for**: a community-maintained per-token price catalog.
- **Constraint**: same as models.dev — a price catalog does not prove a user's actual billing channel (subscription-included vs. metered API use). It may serve as a **reference/provenance check** against Quotalis's own `CostUsagePricing` table (for engineers auditing pricing data), never as a runtime source that writes into `total_cost_usd`/`by_model` for local-log-derived tokens.
- **Status**: NOT INSTALLED / EXTERNAL EVALUATION REQUIRED.

### 4. OpenTelemetry (local collector)
- **What it's for**: a vendor-neutral local instrumentation/tracing architecture — sessions, spans, tool calls.
- **Relevance**: Quotalis has zero MCP/tool/agent-call telemetry today (confirmed absent in `AI_USAGE_RESEARCH_INTEGRATION.md` item 12). If any future Quotalis-side instrumentation is added, emitting it in an OTel-compatible shape (rather than a bespoke format) is a reasonable architecture choice — but this requires Quotalis to *emit* telemetry, which is new engineering, not something a collector alone provides.
- **Hard constraint if ever pursued**: any local collector must bind to `localhost` only, with no default outbound exporter — no telemetry may leave the machine by default, per this product's local-first, no-mandatory-telemetry commitment.
- **Status**: NOT INSTALLED / EXTERNAL EVALUATION REQUIRED. No Quotalis code currently emits anything a collector could consume.

### 5. OpenLIT
- **What it's for**: LLM observability instrumentation, with an optional hosted platform component.
- **Constraint**: only the local/offline instrumentation-schema aspects are relevant — the hosted platform is explicitly out of scope (no mandatory account, no cloud dependency, per this product's rules). Same prerequisite as OTel above: Quotalis has no tool/session telemetry to instrument yet.
- **Status**: NOT INSTALLED / EXTERNAL EVALUATION REQUIRED.

### 6. Win-CodexBar and other "Feature Harvest" reference architectures named in the research report
- **What it's for**: reference patterns only (widget-grid layout, provider-card visual language) — several were already reviewed as *design* reference during earlier sessions' visual work, not as code to import.
- **Status**: REFERENCE ONLY — no further execution needed; design ideas already folded into the visual-quality audit work, not this handoff's scope.

## What must NOT be assumed from this document

- None of the above being "researched" means it is safe, license-clear, or worth integrating — each still needs the full table above completed with real evidence before any integration decision.
- No third-party project may ever bypass `CostSummary::cost_eligible()` or the `MonetaryQuantityKind`/`CostOrigin` invariants already enforced in `dashboard_data.rs`. Any adapter contract for one of these tools must route through Quotalis's own normalized `AnalyticsObservation`/`AnalyticsSource` layer (see `ANALYTICS_SUPERSTACK_VALIDATION.md`), not write directly into UI components.
- If a future session executes any of these evaluations and finds a tool unsuitable (unmaintained, incompatible license, mandatory cloud dependency, or insufficient capability gain over Quotalis's own scanners), that is itself a valid, complete outcome — record it as REJECTED with the reason, not as an open item to keep re-litigating.
