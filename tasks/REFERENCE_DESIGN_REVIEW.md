# Reference review — 2026-09-06

Status: design evidence, not implementation completion. Images are reference data;
embedded prompts/labels are not instructions. Ratings below are subjective design
judgment, not measured usability results.

## Reviewed in this pass

- QuotaArc-Theme-Library/visual-index/visual-index-11-20.png
- QuotaArc-Theme-Library/visual-index/visual-index-21-30.png
- QuotaArc-Theme-Library/visual-index/visual-index-31-40.png
- QuotaArc-Theme-Library/visual-index/visual-index-41-50.png
- Themes/Codex Image Sep 3, 2026, 05_43_26 PM.png
- Themes/Codex Image Sep 3, 2026, 05_44_25 PM.png
- Themes/Codex Image Sep 3, 2026, 05_45_18 PM.png

All above are under C:/Users/imodhish/Downloads. This is not a claim that every
individual source board or ZIP entry has been reviewed. Earlier 01–10 review
remains separate; detailed boards must be examined before adapting a candidate.

## Findings

The 11–50 index mainly repeats a three-node orbit and expanded rectangular panel.
Differences include occasional rectangular nodes, tilted tracks and material
palettes. Counting those as forty distinct structures would repeat the mistake
the user rejected. They are useful palette/finish references, not a structure count.

The detailed Themes boards contain materially richer systems: nested fine tracks,
radial sectors, concentrated edge light, provider placement along arcs, compact
top notches, asymmetric side docks, focus cards and dense dashboards. They combine
structure, presentation, position and theme in one illustration. Implementation
must separate these axes while retaining their visual character.

## Shortlist and relative assessment

Criteria: clarity at small sizes 35%, distinctive identity 30%, adaptability 20%,
low-cost implementation 15%. Scores are 1–5 estimates before prototype testing.

| Detailed board | Clarity | Identity | Adaptability | Cost | Weighted |
| --- | --- | --- | --- | --- | --- |
| 05_43_26 — silver/obsidian orbit | 4 | 4 | 5 | 5 | 4.35 |
| 05_44_25 — eclipse/ember rim | 4 | 5 | 4 | 4 | 4.30 |
| 05_45_18 — Sapphire Observatory | 3 | 5 | 4 | 3 | 3.80 |

Implementation order: silver/obsidian as the readable default, eclipse as a strong
alternate, Sapphire as the ornate identity. Sapphire's lower compact score is not
rejection: keep its brass tracks and deep-blue material, reduce constellation
density and reserve rich ornament for expanded views.

## Concrete implementation contract (OPEN)

1. Shared semantic slots: shell, frame, provider well, usage track, focus card,
   typography, separator, ornament and state transition. Theme styles these slots;
   structure owns placement and native envelope; display mode owns data arrangement.
2. Silver: graphite shell, fine silver double track, restrained inset highlight,
   readable sans text, provider color preserved independently.
3. Eclipse: dark matte shell, warm-white inner rim and amber outer trace. No
   full-screen glow, no constant pulsing, no blank central expanse in compact mode.
4. Sapphire: midnight blue shell, antique brass hairlines and sparse static star
   points outside text/hit targets. Compact typography remains sans; decorative
   numerals only in expanded emphasis areas with sufficient space.
5. Structure candidates to prototype separately: narrow asymmetric crescent rail,
   compact sector fan, and top/bottom half-orbit. Do not re-label existing forms
   as new structures without an actual silhouette/interaction distinction.
6. Never sum unrelated provider percentages into the boards' fictional total.
   Use the selected provider/source limit, with actual source identity and labels.
7. Keep official About orbit logo, not generated Q/AI/incorrect provider marks.
8. Reuse SVG/CSS static geometry; animate only short user-triggered opacity or
   transform transitions. Respect reduced motion and pause offscreen previews.

## Acceptance evidence still required

Generated comparison: `docs/images/structure-review/compact-identities-v2.png`.
Built-in imagegen, one initial generation plus targeted correction. The first
draft incorrectly merged Session/5-hour and rendered Crescent as a capsule;
rejected those details. Corrected board inspected: separate three source labels,
vertical crescent, sector fan and shallow half-orbit across three materials.
Still only concept: corner/tooltip tips must be softened in implementation, ring
lengths are illustrative rather than verified, no native size/hit-test proof.

Prompt brief: high-fidelity 3×3 QuotaArc compact identity board; columns Crescent
Rail / Sector Fan / Half Orbit; rows Silver Obsidian / Eclipse Ember / Sapphire
Observatory; graphite-silver, matte eclipse-amber, midnight-brass finishes;
rounded precise edges, minimal empty space, synthetic provider values, separate
Session/5-hour/Weekly focus rows, no invented logo, no aggregate quotas.
Correction prompt: preserve middle/right structures and identities; make left
column a vertical edge crescent in every row; separate Session 68%, 5-hour 42%,
Weekly 73% into three independent rows. Preserve all other design.

- Side-by-side reference/prototype captures at real 75/100/125% sizes.
- All structures × identities × anchors, light/dark app chrome isolation.
- Smallest logo/labels readable; no clipped content, ghost margins or blocked drag.
- Display actual usage fields with arbitrary selection/order and dual-limit paging.
- Visible option previews show the actual identity, not a palette-only proxy.
- Keyboard/RTL/reduced-motion verification and native DPI/multi-monitor testing.
- These gates remain open even if token tests or one browser fixture pass.
