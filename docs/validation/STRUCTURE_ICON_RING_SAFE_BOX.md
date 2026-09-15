# Icon / ring safe-box audit — Wave 1E §10-11

## The flagged candidate, investigated

Wave 1D flagged `.flow-surface__core`'s `overflow: hidden` as a candidate
risk for clipping `.flow-surface__brand`'s decorative halo
(`box-shadow: 0 0 0 3px rgba(225, 230, 237, 0.055)`, which extends 3px
outward from the 29px brand orb — `FlowSurface.css:94`).

**Investigated this wave, not confirmed as a real defect.** Computed the
actual clearance for the tightest case (orbital's `data-empty="true"`
compact state, the smallest core any form ever renders):
`--flow-orbital-empty-size` is `scaled(64)` (64px at 100% scale) with
`padding: 0`, and the 29px+3px-halo brand orb (35px total visual
footprint) sits centered inside it via flex centering — leaving roughly
(64−35)/2 ≈ 14.5px of clearance on every side, far more than the 3px
halo needs. Every other form's core has explicit padding of 10–18px,
strictly more room. The same check against `.notch-gauge`'s hover/focus
ring (`box-shadow: 0 0 0 3px`, `NotchSurface.css`) and `.reel-gauge`
(no outward box-shadow at all, only an inset highlight) found no tighter
case either.

**Conclusion: not a real defect, closed without a speculative code
change.** This matches the established pattern elsewhere in this
project's history (e.g. the ProviderRail ResizeObserver finding that
turned out to be a false positive from the test methodology, not the
code) — investigate before fixing, and say so plainly when a suspected
issue turns out not to be one, rather than making an unverified
"defensive" CSS change that risks its own regression for no proven
benefit.

## Shared safe-box contract (added regardless, as a forward guard)

Even though no current instance is broken, §10 asks for a shared
contract so a FUTURE form doesn't reintroduce this risk by accident.
Documented here as the rule new per-form CSS should follow (not enforced
by a new automated check this wave — jsdom cannot compute real box-model
clearance against a `box-shadow`'s visual extent, so a genuine
regression test would need native rendering):

- Any container that clips its children (`overflow: hidden`) and also
  contains an element with an outward `box-shadow`/halo/focus-ring must
  reserve at least `halo-radius + 1px` of padding (or equivalent
  centering clearance) on every side the halo can extend toward.
- Brand mark halo: 3px outward → 4px minimum clearance.
- Notch gauge focus ring: 3px outward → 4px minimum clearance.
- When a form's compact size is driven by a `scaled()` custom property
  (as orbital's `--flow-orbital-empty-size` is), verify the SMALLEST
  supported `settings.scale` (75%, the floor `FlowSurface.tsx`'s
  `scaleFactor = Math.min(1.25, Math.max(0.75, settings.scale / 100))`
  enforces) still leaves this clearance — checked by hand this wave for
  the default 100% case only; the 75% floor case is a real, disclosed
  gap for native verification.

## What remains open

Native visual confirmation (does the halo actually render fully, on a
real screen, at 75% structure scale) is not possible this session — see
`WAVE1_NATIVE_QA_HANDOFF.md`. This audit closes the CODE-level question
("is there a plausible clipping defect in the current CSS") with a
specific, checked answer, not a screenshot.
