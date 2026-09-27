# VISUAL_QA_REPORT — V2 implementation status

Historical note (2026-09-27): the V1–V6 screenshot archive was withdrawn from
the current public image tree. Its unchanged audit copies are under ignored
`.local/historical-v1-v6-2026-09-27/`. The paths below describe the original
capture set, not available public files or current Quotalune release proof.

Date: 2026-09-03 · Direction: merged (Edge Object geometry + Instrument density +
selective Glass). Screenshots use controlled synthetic data via the in-app demo stage
(`?window=demo&surface=X&state=Y`, plain-browser render — no personal data, no desktop clutter).

## Implemented (V2, on Dev)

1. **Design System V2**: premium-black tonal system (graphite 0–4, no #000/#111), space/radius/
   motion/z scales, provider accent tokens, edge-object radius families, light-mode counterpart,
   Qa* component layer (QaSurface with edge geometry + graphite/glass materials,
   QaCapacityArc/QaMicroArc, QaProviderInstrument, QaValue tabular numerals, QaResetTime,
   QaStatusIndicator, QaProfileAvatar, Quick Panel styles).
2. **Taskbar Arc V2** — rebuilt from scratch: Edge Object slab flush to the taskbar
   (rounded top corners only), provider instruments (icon + arc + tabular value), profile
   reduced to an avatar shown only when >1 profile exists ("DDefault" impossible by
   construction), hover peek, click morphs the same object into the **Quick Panel**
   (highest-risk-first rows, status dots, reset+pace meta, Refresh/History/Settings),
   window resizes with the surface. Debug text ("QuotaArc · live") deleted.
3. **Top Arc V2** — rebuilt as a top-edge notch: instruments idle, hover peek, click morphs
   into the provider summary (no Apple-Island imitation).
4. **Edge Arc V2** — rebuilt as an edge-flush pod (half-capsule): arc instruments, hover
   reveals name + reset inline; height follows provider count.
5. **Screenshot pipeline**: `vite build` + static serve + headless Chromium — deterministic,
   synthetic-only captures (repeatable for regression checks).

## Screenshot set (docs/images/v2/)

01-taskbar-v2-idle.png · 02-taskbar-v2-hover.png · 03-taskbar-v2-expanded.png ·
04-top-v2-idle.png · 05-top-v2-expanded.png · 06-edge-v2-idle.png ·
before-after-taskbar.png

## Before vs After (Taskbar Arc)

- Before: profile switcher + "DDefault" consumed the bar; flat rectangle; debug feel (3/10).
- After: pure instruments, arc-embedded tabular values, Edge Object slab, one-object morph
  into the Quick Panel. Status color + dot carry urgency; no names in idle; no debug text.

## Remaining (honest)

- Floating HUD V2 (Micro/Focus variants), Dashboard V2 hero shell, tray context-menu
  simplification: specified, not yet implemented — next continuation.
- Polish pass 3 (spring tuning at 120/144 Hz, DPI matrix 1440p@125% / 4K@150% captures):
  geometry is logical-px (DPI-safe by construction) but capture matrix still to run.
- Light-mode capture set (tokens exist; surfaces unverified in light).
- Performance: compact surfaces are solid graphite (no blur); idle-cost re-measurement pending
  the full V2 surface set.
