# V2_VISUAL_CRITIQUE — brutal pass on the actual renders

Date: 2026-09-03 · Inspected: `docs/images/v2/*.png` and
`QUOTAARC_V2_REVIEW_BOARD.png` at 100–400% zoom. Scores are against a
finished-premium-product bar, not "better than V1".

## Taskbar Arc V2 — overall 8/10 (target 9)

- Geometry **8** — flush slab reads as rising from the taskbar; radius correct.
  *Defect:* slab width 288px is wider than 3 chips + avatar need — the idle
  composition floats with ~40px of dead right padding. Set width from
  content + 24px, not a fixed constant.
- Typography **7** — arc-embedded values (73/61/6) are crisp and tabular, but
  the value inside the 28px arc sits ~1px above optical center because the
  % glyph is dropped only in the value column, not in the arc. Add
  `dominant-baseline: central` alignment compensation for the arc slot.
- Spacing **7** — avatar → first instrument gap (8px) is visually larger than
  instrument → instrument gap (12px padding overlap); normalize to a single
  10px optical rhythm inside the slab.
- Icons **6** — provider icons render at source aspect; Claude's sun glyph
  occupies a smaller optical box than Codex's ring. IconFrame normalization
  (18×18 optical in 20×20 box) still pending.
- Arc design **8** — 2.6px stroke at 28px is crisp; no jaggies; bottom gap
  consistent. Critical 6% arc + orange value reads instantly.
- Material **8** — graphite gradient + hairline + top edge highlight works
  against the wallpaper; not a "CSS pill".
- **Fix list (pass 3):** content-driven width; arc value optical centering;
  IconFrame optical normalization; avatar opacity to 0.7.

## Top Arc V2 — overall 8/10

- Geometry **9** — the notch is the right idea; hangs from the edge, no
  floating pill.
- Typography **8** · Spacing **8** · Icons **6** (same IconFrame debt) ·
  Arc **8** · Material **8** · Density **9** · Distinctiveness **8** ·
  Windows integration **9** · Premium feel **8**.
- *Defect:* expanded rows have 44px height vs Quick Panel's 40px — unify
  row rhythm across expanded surfaces.

## Edge Arc V2 — overall 8/10

- Geometry **9** — half-capsule flush to the right edge is the signature
  silhouette; unmistakably QuotaArc.
- Arc **8** — 110° gap instruments read well at 34px.
- *Defect (fixed in this pass):* values were rendered outside arcs,
  contradicting the Taskbar arc-value language — now inside.
- *Remaining:* the pod's flat (screen) edge currently ends with a visible
  1px border + shadow — should be perfectly flush (no right border).

## Quick Panel — overall 8/10

- Hierarchy **9** — risk-sorted rows, status dot + reset + pace as meta,
  percentage right-aligned in tabular numerals; understood in ~1 second.
- *Defect:* footer buttons (Refresh/History/Settings) have equal weight to
  rows — reduce to icon-buttons 26px with tooltips so usage data dominates.
- *Defect:* panel background at 90% opacity glass still shows wallpaper
  blobs through rows over colorful desktops — raise expanded material to
  `--qa-material-glass-strong` default (already used) but add a 2% darker
  row-stripe for row separation without borders.

## Floating HUD (Focus) — overall 8/10

- The 72px arc + "73%" split (value inside arc, % as small suffix) is the
  right numerical language; label/value rows are clean.
- *Defect:* name-row icon and status dot baselines misalign by ~1px
  (icon 24px box vs 16px glyph); align via fixed 18px optical box.

## Dashboard hero — overall 8/10

- Capacity-first hierarchy, best-capacity/needs-attention callouts, reset
  timeline bars — this is the GitHub-hero direction.
- *Defect:* timeline bars use red/teal fills at full saturation — drop to
  80% saturation or add a 1px darker cap so three colored bars don't
  compete with the hero arcs.

## Global (all surfaces)

- Icons **6/10 — the biggest remaining debt**: source artwork varies; build
  `QaProviderIcon` with a normalized 18×18 optical box, consistent corner
  radius, and per-icon optical compensation map.
- Numerical design **8/10** — tabular everywhere; test 6/61/100 optical
  balance with the reduced-% treatment.
- Light mode: tokens exist, no captures yet.
- Motion: spring-based, reduced-motion respected; frame-sample captures at
  120/144Hz still to be made (spring math is time-based, not frame-based).

## Verdict

No surface scores below 8 after this pass; Taskbar/Top/Edge are at 8 with
named fixes targeting 9. The "would a designer call this finished?" test:
not yet at 9/10 until IconFrame normalization and the listed pass-3 defects
land. Iterate again after those fixes.


---

# PASS 3 — FINAL SCORES (after optical fixes + light/DPI passes)

Fixes applied since the first critique: icon optical compensation map
(`QaProviderIcon`, per-provider scale in 18×18 optical box), arc-value optical
centering, content-driven Taskbar slab width, Quick Panel footer reduced to
quiet icon-buttons, unified 44px expanded row rhythm, flush Edge pod edge,
light-mode token verification, DPI matrix captured.

| Surface | Geometry | Typography | Spacing | Icons | Arc | Material | Depth | Hierarchy | Compactness | Distinctiveness | Windows fit | Premium feel | Overall |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Taskbar Arc V2 | 9 | 8.5 | 8.5 | 8 | 9 | 8.5 | 8.5 | 9 | 9 | 9 | 9 | 8.5 | **8.7** |
| Top Arc V2 | 9 | 8.5 | 8.5 | 8 | 8.5 | 8.5 | 8 | 8.5 | 9 | 8.5 | 9 | 8.5 | **8.6** |
| Edge Arc V2 | 9.5 | 8.5 | 8.5 | 8 | 9 | 8.5 | 8.5 | 8.5 | 9 | 9.5 | 9 | 8.5 | **8.8** |
| Quick Panel | 8.5 | 9 | 8.5 | 8 | 8.5 | 9 | 8.5 | 9 | 8.5 | 8.5 | 8.5 | 9 | **8.6** |
| Floating HUD Focus | 8.5 | 8.5 | 9 | 8 | 9 | 8.5 | 8.5 | 9 | 8.5 | 8.5 | 8.5 | 8.5 | **8.6** |
| Dashboard hero | 8.5 | 8.5 | 9 | 8 | 9 | 8.5 | 8.5 | 9 | 8 | 8.5 | 8.5 | 8.5 | **8.6** |
| Light mode | 8.5 | 8.5 | 8.5 | 7.5 | 9 | 8.5 | 8 | 8.5 | 8.5 | 8 | 8.5 | 8 | **8.3** |

All surfaces ≥ 8.3; the three signature surfaces are at 8.6–8.8 against a 9
target. Remaining named defects:

1. Claude's sun glyph still reads ~0.5px lighter than Codex's ring at 15px
   even with compensation — needs a hand-tuned per-icon stroke boost.
2. 100% values in the 28px arc will crowd (untested with a 3-digit value);
   the reduced-% treatment (large value, small %) is specified but only the
   HUD uses it.
3. Motion frame-samples at 120/144Hz not captured; springs are time-based
   (motion/react), no frame-count logic exists in the codebase (verified:
   no requestAnimationFrame loops outside motion primitives).

## Boards

- `docs/images/v2/QUOTAARC_V2_REVIEW_BOARD.png` — all surfaces, dark + light.
- `docs/images/v2/QUOTAARC_BEFORE_AFTER_BOARD.png` — V1 vs V2, equivalent scale.
- DPI matrix: `14/15/16-*-1440p.png` (2560×1440 @1.25) and
  `17/18/19-*-4k.png` (3840×2160 @1.5) — logical-px geometry holds; arcs and
  text render crisp; no clipping.
