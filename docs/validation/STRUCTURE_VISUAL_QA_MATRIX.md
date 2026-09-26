# Structure Visual QA Matrix — Wave 1D / Wave 1E

Historical path note: V9 native images cited in older rows were withdrawn from
the current public tree on 2026-09-27. They remain only in ignored local audit
storage and do not prove the current Quotalune build. The row statuses require
fresh native acceptance as described in the current reconciliation matrix.

## Honesty note

This matrix separates two genuinely different kinds of verification:

- **CODE VERIFIED** — a real, automated test (vitest/cargo) exercises the
  claim against real source, in jsdom or a pure function, without a native
  build. Reliable for logic, DOM shape, ARIA, and text content; cannot
  prove actual pixel rendering, real font metrics, real monitor placement,
  or animation smoothness.
- **NATIVE VISUAL VERIFIED** — an actual `QuotalisDev.exe` was launched,
  driven, and screenshotted, and a human or CDP-captured image was
  inspected. **None of the 14 forms have this yet.** This session could
  not perform it (see `WAVE1_NATIVE_QA_HANDOFF.md` for the exact,
  confirmed reason: no pixel-screenshot tool is authorized in this
  session, and the hardened launcher does not accept a remote-debugging
  port for the CDP technique this project used earlier in this same
  session). No row below claims NATIVE VISUAL VERIFIED — claiming it
  without a screenshot would be exactly the fabrication this project's
  own culture has consistently refused to do.

Columns match Wave 1D §48's list, plus four columns Wave 1E §29 adds:
**CODE READY** (has this form's code-level behavior, loading integration,
and fixture-panel support all landed — independent of native pixels),
**NATIVE VISUAL STATUS** (always `PENDING — ENVIRONMENT_BLOCKED` this
wave, never PASS — see the Honesty note above and
`WAVE1_NATIVE_QA_HANDOFF.md`), **FIXTURE ID** (the
`WAVE1_NATIVE_QA_MATRIX.json` entry id(s) the next session runs to close
this row), **EVIDENCE PATH** (where that capture will land once run). "—"
means not applicable to that form (e.g. a form with only 2 anchor slots
for pinned state).

**Wave 1F §34 clarification — three distinct kinds of evidence, not
one column's worth of "PASS"**: this matrix's per-form columns
(Collapsed/Expanded/Brand/etc.) are **CODE VERIFIED** only — a jsdom/
cargo test, never a screenshot. The **NATIVE VISUAL STATUS** column is
itself two different things depending on which `FIXTURE ID`s are
listed, and a reader must not conflate them:
- A `FIXTURE-*` id (lane `"fixture"` in `WAVE1_NATIVE_QA_MATRIX.json`)
  is **BROWSER FIXTURE** evidence once captured: a real production-
  component render, but in a plain Chromium tab, not the native
  compositor — it proves layout/CSS/data correctness, never native
  window chrome, DPI scaling, or compositor behavior.
- A `NATIVE-*` id (lane `"native"`) is **NATIVE WINDOW** evidence once
  captured: the actual `QuotalisDev.exe` top-arc WebView2, driven either
  by the fixed demo-mode dataset or (Wave 1F onward, entries with a
  `devControl` field) the real Structure QA fixture controller
  (`?window=structure-qa`) — this is the only evidence that can close a
  DPI/monitor-placement/compositor claim.
Both remain `PENDING — ENVIRONMENT_BLOCKED` for every row this wave
(this session captured zero screenshots of either kind) — the
distinction matters for the NEXT session, which may be able to unblock
the browser-fixture lane (no hardened-launcher dependency, see
`WAVE1_NATIVE_QA_HANDOFF.md` §2a) well before the native lane.

| Form (id) | Family | Collapsed | Expanded | Brand | Provider | Pin | Close | Drag | Move alt | Reset clipping | Icon/ring clipping | Anchor gap | Edge | Light | RTL | Provider-count | Native evidence | CODE READY | NATIVE VISUAL STATUS | FIXTURE ID | EVIDENCE PATH |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| crescent | Notch | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | CLOSED (not a defect, see STRUCTURE_ICON_RING_SAFE_BOX.md) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (1/3/6/12/24/70) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | NATIVE-FORM-ANCHOR-01, NATIVE-REFRESH-01, NATIVE-DATA-ERROR-01, NATIVE-DATA-TIMEOUT-01, FIXTURE-COUNT-01, FIXTURE-RESET-02, FIXTURE-WINDOWS-01, FIXTURE-DATA-LOADING-01, FIXTURE-DATA-REFRESHING-01, FIXTURE-DATA-UNAVAILABLE-01 | docs/images/v9/native/structures/{native,fixture}/... (see WAVE1_NATIVE_QA_MATRIX.json) |
| pebble | Notch | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by Notch family sweep) | docs/images/v9/native/structures/... |
| fan | Notch | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by Notch family sweep) | docs/images/v9/native/structures/... |
| seam | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (direct: 1/3/6/12/24/70) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | FIXTURE-COUNT-03 | docs/images/v9/native/structures/fixture/seam-count-24.png |
| ribbon | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by Notch family sweep) | docs/images/v9/native/structures/... |
| cradle | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by Notch family sweep) | docs/images/v9/native/structures/... |
| deck | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level; page-dots DOM scales with N, disclosed) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by Notch family sweep) | docs/images/v9/native/structures/... |
| satellite | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | NATIVE-FORM-ANCHOR-04, FIXTURE-EDGE-CORNER-01 | docs/images/v9/native/structures/... |
| flowline | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | CLOSED (not a defect, see STRUCTURE_ICON_RING_SAFE_BOX.md) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (1/3/6/12/24/70) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by FlowSurface family sweep) | docs/images/v9/native/structures/... |
| horizon | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | NATIVE-FORM-ANCHOR-03 | docs/images/v9/native/structures/native/structures/horizon-top-05-noir-constellation.png |
| petal | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by FlowSurface family sweep) | docs/images/v9/native/structures/... |
| orbital | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by FlowSurface family sweep) | docs/images/v9/native/structures/... |
| lens | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED (family-level, not this form specifically) | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | (none dedicated yet — covered by FlowSurface family sweep) | docs/images/v9/native/structures/... |
| reel | Reel | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED | WIRED (decision model; see connector notes below) | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED — interactive count capped at 3, but DOM mounts all N (disclosed, not fixed — see ReelSurface.test.tsx) | NONE | READY | PENDING — ENVIRONMENT_BLOCKED | NATIVE-FORM-ANCHOR-02, NATIVE-COUNT-70-01, NATIVE-RTL-01, FIXTURE-COUNT-02, FIXTURE-NAME-01, FIXTURE-RESET-01, FIXTURE-RTL-01, FIXTURE-PINNED-01 | docs/images/v9/native/structures/... |

Notes:
- "(direct)" marks the two Notch forms (seam, ribbon — plus cradle/deck/
  satellite via the same family harness) with their own dedicated
  assertions in `NotchSurface.test.tsx`, beyond the shared family sweep
  covering all 8 (`crescent`/`pebble`/`fan`/`seam`/`ribbon`/`cradle`/
  `deck`/`satellite`) via `NOTCH_FORMS.map(...)`.
- Icon/ring clipping: Wave 1E hand-computed the CSS clearance for
  `.flow-surface__brand`'s halo inside `.flow-surface__core`'s
  `overflow: hidden` (the one candidate flagged in Wave 1D) and found
  ≥14.5px of clearance in the tightest case — **closed as not a real
  defect**, documented in `STRUCTURE_ICON_RING_SAFE_BOX.md` along with a
  forward safe-box contract and one disclosed unchecked case (75%
  minimum structure scale). Marked CLOSED above only for crescent/
  flowline, the two forms actually hand-checked; the rest of the Notch/
  FlowSurface families share the same CSS structure but were not each
  individually re-measured — treat as the same low-risk finding, not a
  separately proven one.
- Anchor gap / connector: Wave 1E built the decision model
  (`structureConnector.ts` — `resolveStructureConnector()`, tested) for
  attached/connector-required/orientation/length, and corrected
  `structurePlacement.ts`'s own doc comment to stop overclaiming it
  drives native window positioning (see `STRUCTURE_COORDINATE_MODEL.md`
  for the real two-layer split). **Wave 1F wired it**: a shared render
  primitive (`StructureConnectorView.tsx`) now renders a decision-gated
  bridge in all three render families, using real measured gaps
  (`structureConnectorGeometry.ts`, cited derivations, not fabricated
  numbers) — Notch's pre-existing `.notch-connector` is now gated by the
  decision model instead of unconditional (same visual result, real
  12px gap, always required); horizon and reel (real 10px/8px gaps) now
  render a connector where none existed before; petal/orbital/lens
  correctly render none (their tuned envelopes already overlap core and
  details by design); flowline's real 36px gap exceeds the model's own
  maximum, a genuine disclosed placement finding, not bridged with an
  oversized connector. Native pixel verification of any of this has
  **not** occurred — code-level only, per the Honesty note above.
- Loading/Refreshing: Wave 1E wired `isRefreshing` (distinct from
  `initialLoading`) into FlowSurface/Reel (visible dot badge) and Notch
  (sr-only text only, see `NotchSurface.tsx` comment for why no new
  visual element was added blind). **Wave 1F added Error/Timeout**:
  `StageProvider.status` now has real `"error"`/`"timeout"` values
  (`stageProviders.ts`, derived from the same `ProviderUsageSnapshot.error`
  field Dashboard already reads — never fabricated), surfaced in
  NotchDetails' footer and FlowSurface/Reel's reset-row slot using the
  same shared `QuotalisLoadingError`/`QuotalisLoadingTimeout` locale keys
  `QuotalisAsyncState` already uses. See `LOADING_STATE_MATRIX.md` for
  the full production-surface wiring status (Dashboard/Analytics/
  Provider-connection actions).
- Edge/DPI/Light/RTL: code-only Light/Dark independence and RTL locale
  keys exist (see `THEME_COMPOSITION_AUDIT.md`); Wave 1E closed the DPI/
  logical-vs-physical coordinate model in `surfaces.rs` with tests at
  1.0/1.25/1.5/2.0 scale factors (native window positioning only — not a
  per-structure CSS concern). A structure-specific Light/RTL/edge/DPI
  visual check still has not been performed, native or otherwise.

## Verdict

STRUCTURE VISUAL QA — CODE: **READY**. Every form has real, automated
coverage for its shared behaviors (identity stability, Pin/Close
consistency, reset-clipping mitigation, keyboard movement, state-machine
transitions, provider-count scaling, and — new this wave — a distinct
Refreshing indicator), plus a Dev-only fixture QA panel
(`demo/ReelPreview.tsx`) that can drive every form through the full
provider-count/name/reset/windows/data-state/RTL-layout matrix using the
real production components.

STRUCTURE VISUAL QA — NATIVE: **PENDING — ENVIRONMENT_BLOCKED**, not
PASS, for all 14 forms. Zero native pixel verification has occurred. See
`WAVE1_NATIVE_QA_HANDOFF.md` and `WAVE1_NATIVE_QA_MATRIX.json` for
exactly what the next capable session runs to close this — the manifest
and capture script (`scripts/capture-native-structure-qa-matrix.mjs`)
are prepared but not executed this session, per explicit instruction.
