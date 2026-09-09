# ADR: One Analytics Dashboard

Date: 2026-09-09. Status: accepted product decision; implementation verified at `c90b12a7`.

The owner retired full 3D and the Spatial prototype. Comparing visualization
engines added navigation and maintenance costs without improving the primary
questions: usage, remaining quota, reset timing and provider attention.

Dashboard now has one lazy-loaded Analytics implementation in both Settings and
the separate Dashboard window. Focused provider windows remain separate.
Three.js, WebGL, scene lifecycle, experimental routes and the mode registry are
removed. Legacy settings resolve to Analytics on read; no direct file migration
is necessary. No replacement visualization mode will be introduced.

The space identity remains through static themed surfaces, calibration marks,
SVG instruments and reset timelines. There is no animated cosmic background.
The existing Demo generator, history snapshot, monetary semantics, Structure
Theme and Provider Identity systems remain authoritative.

Phase 5/5.1/5.2/6 and Spatial validation documents describe historical work;
their original screenshots and measurements are preserved, not rewritten.
The last pre-retirement revision is `9733e8ab`. Git retains the removed code.

Current verification and measurements: `docs/validation/DASHBOARD_CONSOLIDATION.md`.
