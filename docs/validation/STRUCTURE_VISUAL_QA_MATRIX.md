# Structure Visual QA Matrix — Wave 1D

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

Columns match Wave 1D §48's list. "—" means not applicable to that form
(e.g. a form with only 2 anchor slots for pinned state).

| Form (id) | Family | Collapsed | Expanded | Brand | Provider | Pin | Close | Drag | Move alt | Reset clipping | Icon/ring clipping | Anchor gap | Edge | Light | RTL | Provider-count | Native evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| crescent | Notch | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (1/3/6/12/24/70) | NONE |
| pebble | Notch | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| fan | Notch | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| seam | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (direct: 1/3/6/12/24/70) | NONE |
| ribbon | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| cradle | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| deck | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level; page-dots DOM scales with N, disclosed) | NONE |
| satellite | Notch | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED (direct) | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation, direct) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| flowline | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (1/3/6/12/24/70) | NONE |
| horizon | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| petal | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| orbital | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| lens | FlowSurface | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (content-height floor) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED (family-level) | NONE |
| reel | Reel | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED | CODE VERIFIED (truncation) | NOT AUDITED | NOT BUILT | NOT NATIVE-TESTED | NOT NATIVE-TESTED | NOT NATIVE-TESTED | CODE VERIFIED — interactive count capped at 3, but DOM mounts all N (disclosed, not fixed — see ReelSurface.test.tsx) | NONE |

Notes:
- "(direct)" marks the two Notch forms (seam, ribbon — plus cradle/deck/
  satellite via the same family harness) with their own dedicated
  assertions in `NotchSurface.test.tsx`, beyond the shared family sweep
  covering all 8 (`crescent`/`pebble`/`fan`/`seam`/`ribbon`/`cradle`/
  `deck`/`satellite`) via `NOTCH_FORMS.map(...)`.
- Icon/ring clipping: not audited beyond a quick grep for `overflow:hidden`
  near gauge/mark containers this wave; `.flow-surface__core`'s
  `overflow: hidden` wrapping the brand mark's decorative halo
  (`box-shadow` glow) is the one candidate spot flagged for native visual
  inspection — not confirmed as an actual defect, not changed blind.
- Anchor gap: `structurePlacement.ts`'s `DEFAULT_GAP = 6` is the one
  shared numeric contract that exists; it is not yet wired into any of
  the 14 forms' own CSS-positioned detail panels (those still use their
  own tuned per-form offsets from earlier waves) — a real, open
  integration gap, not claimed closed.
- Connector: only the Notch family has an actual connector element
  (`.notch-connector`, pre-existing). FlowSurface/Reel have none — not
  built this wave.
- Edge/DPI/Light/RTL: code-only Light/Dark independence and RTL locale
  keys exist (see `THEME_COMPOSITION_AUDIT.md`) but no structure-specific
  Light/RTL/edge/DPI check has been performed, native or otherwise.

## Verdict

STRUCTURE VISUAL QA: **PARTIAL (code)** / **NOT PASSED (native)** — every
form has real, automated coverage for its shared behaviors (identity
stability, Pin/Close consistency, reset-clipping mitigation, keyboard
movement, state-machine transitions, provider-count scaling), but zero
native pixel verification has occurred for any of the 14 forms. See
`WAVE1_NATIVE_QA_HANDOFF.md` for exactly what the next capable session
needs to do to close this.
