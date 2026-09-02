# VISUAL_AUDIT — QuotaArc current surfaces (pre-V2)

Date: 2026-09-03 · Ratings are honest, 1–10, against a product-grade bar
(reference: Codenotch-quality compact instruments). Evidence: live captures in
`docs/images/` plus the running installed build.

## Taskbar Arc (current)

Evidence: `docs/images/taskbar-arc.png`, live window.
- Visual hierarchy **3/10** — profile switcher ("D" monogram + "Default") occupies ~40% of the
  bar; provider chips are an afterthought; the capacity number (the product's whole point) is
  not visually dominant.
- Typography **4/10** — mixed sizes, no tabular alignment discipline, the monogram + name read
  as the reported "DDefault" concatenation bug.
- Geometry **4/10** — long flat rectangle, generic pill radius, no relationship to the taskbar
  it floats above.
- Material **3/10** — flat dark rectangle; no depth, no taskbar integration.
- Motion **2/10** — appears/disappears; hover does nothing visible.
- Information density **3/10** — mostly label, little data.
- Brand expression **3/10** — Arc not present as identity.
- Interaction **3/10** — click does nothing; no quick panel.
- Accessibility **4/10** — labels exist.
- **Overall: 3/10 — a debug strip, not a product.**

## Top Arc (current)

Evidence: `docs/images/top-arc-pill.png`.
- Hierarchy **5/10** — arcs + one % are readable but everything is equally weighted.
- Typography **5/10** — % is fine; "resets" text is ad-hoc.
- Geometry **5/10** — pill is fine; flat bottom edge lacks craft.
- Material **5/10** — glass tone exists but depth is weak.
- Motion **4/10** — morph exists between states; no update/notification language.
- Density **6/10** — reasonable.
- Brand **5/10** — brand mark present but decorative.
- Interaction **4/10** — hover-expand works; click does nothing.
- **Overall: 5/10 — acceptable, not premium.**

## Edge Arc (current)

Evidence: `docs/images/edge-arc-strip.png`.
- The long vertical strip is exactly the "debug strip" failure: rows of equal-sized arcs and
  labels, no edge-attachment language, hover reveal is nice but the idle state is noisy.
- **Overall: 4/10.**

## Float Bar (inherited)

Upstream DNA (CodexBar layout, "CodexBar" titles until the last fix), horizontal/vertical
pills. **Overall: 5/10** as a layout, but not QuotaArc's identity.

## Dashboard

Evidence: `docs/images/dashboard.png`.
- The inherited card stack works functionally; settings-first hierarchy, dense text, legacy
  Mac-parity components, weak hero moment. Capacity is not the visual protagonist.
- **Overall: 5/10.**

## Profile switcher

- The "DDefault" visual bug (monogram + name rendered adjacent at small sizes) is
  **release-blocking**. Compact surfaces should never show both.
- **Overall: 3/10** in compact contexts.

## Global failures (fix in V2)

1. No shared Arc identity across surfaces (each surface draws arcs differently).
2. No material system — flat rectangles with arbitrary radii.
3. Profile UI permanently consumes compact-surface space.
4. Debug text ("QuotaArc · live") visible.
5. No morphing: windows appear rather than transform from the clicked object.
6. Typography: no tabular-numeral discipline, no scale hierarchy.
7. No light-mode design (dark-only today).
