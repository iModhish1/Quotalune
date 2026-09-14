# Structure / Surface System Audit — 2026-09-14

## Registry (real, code-grounded, not the historical example list)

The actual current registry is `FLOW_SURFACE_FORM_CATALOG` in
`apps/desktop-tauri/src/design-system/flowSurface.ts` — **14 forms**, all
declared as one typed union (`FlowSurfaceForm`), all backed by **one live
native window** (the file's own top comment: "the one live Flow Surface
window... never creates a second native window"). This is architecturally
significant: the owner's screenshot complaint of "multiple separate-looking
windows" cannot mean literal separate OS windows — there is only ever one —
so it must be a visual/CSS layering issue inside that one window, not a
window-management defect. This audit does not find evidence of an actual
second OS window anywhere in the surface system.

Three render paths share this one registry:

| Render path | Forms | Component |
| --- | --- | --- |
| FlowSurface (direct) | `flowline`, `horizon`, `petal`, `orbital`, `lens` | `flow-surface/FlowSurface.tsx` |
| ReelSurface | `reel` | `reel/ReelSurface.tsx` |
| NotchSurface + NotchDetails | `crescent`, `seam`, `ribbon`, `cradle`, `deck`, `satellite`, `pebble`, `fan` | `notch/NotchSurface.tsx`, `notch/NotchDetails.tsx`, geometry in `notch/footprints.json` |

## Per-structure record

| ID | Display name | Default anchor | Anchor options | Render path | Drag affordance | Pin control | Close control |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `crescent` | Crescent Rail | right | all 9 | Notch | `.notch-grip` CSS pill (rotates/repositions per anchor) | shared `StructurePinButton` (fixed this wave) | "Collapse details" (fixed this wave) |
| `pebble` | Pebble | right | all 9 | Notch | `.notch-grip` | same | same |
| `fan` | Fan | bottom | all 9 | Notch | `.notch-grip` | same | same |
| `seam` | Seam | right | all 9 | Notch | `.notch-grip` | same | same |
| `ribbon` | Ribbon | top | all 9 | Notch | `.notch-grip` (rotated) | same | same |
| `cradle` | Cradle | bottom-right | all 9 | Notch | `.notch-grip` | same | same |
| `deck` | Deck | right | all 9 | Notch | `.notch-grip` | same | same |
| `satellite` | Satellite | right | all 9 | Notch | `.notch-grip` (rotates when folded/rotated) | same | same |
| `flowline` | Flowline | right | all 9 | FlowSurface | `⋮` glyph button | shared `StructurePinButton` | `×`, "Collapse details" |
| `reel` | Orbit Reel | right | 9 excl. `top-left`/`top-right`-before-`bottom` ordering differs slightly, effectively all | ReelSurface | `⋮` glyph (fixed this wave, was `⠿`) | shared `StructurePinButton` (fixed this wave) | `×`, "Collapse details" |
| `horizon` | Horizon | top | all 9 | FlowSurface | same as flowline | same | same |
| `petal` | Petal | bottom-right | 9 minus straight edges reordered, effectively all | FlowSurface | same | same | same |
| `orbital` | Orbital | bottom-right | same as petal | FlowSurface | same | same | same |
| `lens` | Lens | bottom-right | same as petal | FlowSurface | same | same | same |

Provider presentation, brand mark, RTL and Light/Dark theming are shared
across all three render paths via the same `QaProviderIcon`,
`OfficialQuotaArcMark`/`QuotaArcMark`, `catalogBySlug`/`providerColor` and
`surfaceMaterialStyle` calls — confirmed by reading all three components,
not assumed. `providerId === "openai" ? "codex" : providerId` icon
normalization is applied identically in FlowSurface and NotchDetails
(matching comment: "matching NotchDetails.tsx's identical normalization").

## This wave's real finding and fix (see commit `a26e8ffb`)

The Pin/Close controls had drifted across the three render paths — a
concrete instance of exactly what the owner's screenshots describe
("inconsistent Close button", "inconsistent Pin button"):

- FlowSurface already carried a documented "Wave 6 Phase 4" correction:
  replaced an ambiguous `⌖` crosshair glyph with a real SVG pin icon and a
  dynamic "Pin details"/"Unpin details" aria-label.
- **ReelSurface never received that correction** — it still rendered the
  literal `⌖` character, with a *static* "Pin details" label that stayed
  wrong even while the panel was already pinned. This is a real
  accessibility bug (screen readers always announced the wrong action), not
  only a visual inconsistency.
- **NotchDetails** used plain "Pin"/"Unpin" text with no icon at all, and
  its Close button said "Close usage details" where the other two paths say
  "Collapse details" for the identical action.

Fixed by extracting one canonical `StructurePinButton`
(`design-system/StructureControls.tsx`) and wiring all three render paths
to it, aligning NotchDetails' Close label, and aligning ReelSurface's drag
glyph (`⠿` → `⋮`, matching FlowSurface). Regression tests added in
`ReelSurface.test.tsx` and the new `NotchDetails.test.tsx` assert the shared
icon/dynamic-label behavior specifically, so this exact class of drift is
now a test gate rather than something that can silently regress again.

**Deliberately not touched this wave:** the notch forms' own drag-grip
*visual* (`.notch-grip`, a small pill that widens on hover) is a carefully
per-form-tuned CSS construct with more than a dozen position/rotation
overrides across the 8 notch forms (`crescent`, `ribbon`, `cradle`,
`satellite`, `deck`, `pebble`, `fan` each have their own exact placement
rule in `NotchSurface.css`). It already works, is already visually distinct
from a generic three-dot glyph in a deliberate, tuned way, and unifying it
with FlowSurface/ReelSurface's `⋮` glyph would be a much larger, riskier
visual change across 8 sub-forms with no native screenshot iteration to
validate it against. Classified as a legitimate candidate for a *future*,
dedicated visual pass (owner request §5, §8), not silent drift.

## What this audit did NOT verify (honest scope)

This session did not build/launch a fresh isolated Dev and capture native
screenshots of all 14 forms this wave — the Pin/Close fix above is a small,
mechanical, source-level correctness fix verified by the project's real
test suite (203 files / 1254 tests, `tsc` clean, production build, locale
parity all passing), not a claim of native visual acceptance. The following
remain **open**, matching their existing `تجاري`/`مفتوح` status in
`tasks/MASTER_REQUIREMENTS.md` (B02–B14 and similar rows) rather than being
newly closed by this audit:

- Reproducing/fixing the owner's other screenshot categories: detached-
  looking provider orb vs. Quotalis orb, huge empty structure surfaces,
  clipped reset text, clipped provider icons, excessive anchor↔panel gap,
  hard/angular clipping vs. shape-safe geometry, progress ring partially
  outside safe bounds.
- A shared safe-area token/function system (owner §7) — not built this
  wave; each form still uses its own hand-tuned CSS insets.
- Native visual QA matrix across collapsed/hover/expanded/pinned/dragged ×
  Light/Dark × RTL × edge-of-monitor for all 14 forms (owner §29–§31) — not
  performed this wave.
- Large-provider-count fixtures (1/3/6/12/24/70) for structure rendering
  specifically (owner §16) — not built this wave.
- Structure state-machine documentation/tests (owner §15) — not written
  this wave.

## Verdict

STRUCTURE SYSTEM: **PARTIAL** — one real, verified Pin/Close consistency
fix landed with regression coverage; the registry itself is now accurately
documented (this file) rather than assumed from the historical example
list; the much larger visual-redesign and native-QA scope remains open,
honestly deferred rather than claimed complete.
