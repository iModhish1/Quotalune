# Phase 6 — Visual Baseline Critique

Captured at HEAD `b81ed5e3` (Phase 5.2 close), real native CDP capture
against a fresh `QuotalisDev.exe`, Demo Mode ON, default six-provider
Connected Showcase, Codex selected. `docs/images/dashboard/phase6/QUOTALIS_PHASE6_BASELINE.png`.

## Audit at original resolution

| Aspect | Finding |
|---|---|
| Body size | Reasonable — six clearly separate, adequately-sized spheres. Not the "tiny dots" problem from earlier phases. |
| Central core | **Fails.** Nearly invisible — its `core`/`bg` colors in the default Obsidian theme are close enough that it reads as a faint smudge, not "a meaningful visual anchor" (owner section 4). Currently just a plain icosahedron with no engraved detail, rings, or calibration marks. |
| Provider name readability | Good — the Phase 5.2 always-visible labels work well and are legible. |
| Glyph readability | **Fails.** There is no provider icon/logo anywhere in the scene — only a flat identity color and a text label. A viewer cannot visually associate "this teal sphere" with "Codex the product" the way the 2D `ProviderIcon` component already does elsewhere in the app. This is the single largest gap (owner section 6). |
| Usage-ring readability | Functional but generic — a thin "Saturn ring" arc. Reads as decorative planet iconography rather than a deliberate instrument-dial encoding (owner section 7). |
| Orbit hierarchy | **Missing entirely.** No visible track/guide connects a provider's position to the core — bodies simply float at fixed points with no structural context (owner section 15). |
| Lighting | Flat and generic — one ambient + one directional light, no rim highlight, materials read as plain matte plastic rather than "smoked metal" (owner section 17). |
| Depth | All six bodies sit at the same Z depth (a flat ring in the XZ-plane) — reads as 2D icons arranged in a circle rather than a true 3D composition (owner section 16). |
| Selection clarity | **Fails outright.** Codex is genuinely selected (confirmed via the nav list's highlighted row and the populated detail panel), but the Codex body in the canvas is visually identical to every unselected body. This is the explicitly-required Phase 6 fix (owner section 9) and the most severe finding here. |
| Hover | No hover treatment differentiated from this static state was visible in the baseline (not exercised in this capture, but the underlying `hoveredId` state has no dedicated visual treatment in the engine as of this HEAD beyond an aria-hidden DOM label). |
| Empty dark space | Noticeable negative space above and around the ring — the six bodies occupy a small fraction of the canvas, most of which is empty near-black. Combined with the invisible core, the canvas reads sparse. |
| Right-side panel balance | Functional and clean, but visually generic — nav rows are plain rounded rectangles with no provider icon (owner section 24), and the detail panel is a flat label/value list rather than a designed hierarchy (owner sections 25/26). |
| Canvas / DOM seam | Clean — no visible artifact where the WebGL canvas meets the surrounding chrome. |
| Camera angle | A static, slightly-elevated top-down framing. Functional but generic — doesn't yet read as a deliberate "observatory instrument" viewing angle. |
| Overall Quotalis identity | **Fails the section 52 test as-is.** The scene currently reads as "a small solar system of Saturn-like planets" — exactly the "generic Three.js planets tutorial" failure mode the phase's own quality bar warns against. The individual pieces (real data, real theme colors, real accessibility companion) are all correct; the *visual language* has not yet been art-directed toward "ancient precision observatory." |

## Priority ranking for Phase 6 work

1. **Selection highlight** (owner section 9 — explicitly required, currently the most severe functional/visual gap).
2. **Provider glyph integration** (owner section 6 — the single biggest contributor to "generic solar system" rather than "Quotalis").
3. **Central core redesign** (owner section 4 — currently invisible, must become a real anchor).
4. **Orbit/track structure** (owner section 15 — currently absent).
5. **Lighting/material pass** (owner sections 17-18 — flat matte plastic → smoked metal/obsidian).
6. **Usage-ring refinement** (owner section 7 — functional but generic).
7. Hover treatment, label density policy, detail-panel/navigator visual hierarchy, depth variation, background treatment — all real but lower-severity than the six items above.

This ordering drove the implementation sequence for the rest of Phase 6 (see `PHASE6_PRODUCTION_3D.md` for the evidence log of what was actually built and verified).

## First redesign pass — re-critique (same HEAD-in-progress, six providers, Codex selected)

Re-captured against a freshly rebuilt Dev binary after the `engine.ts`
redesign (instrument-hub core + calibration rings, real glyph labels,
orbit-guide tracks, static starfield, selection ring, depth jitter,
smoked-metal materials). Full-canvas capture:
`docs/images/dashboard/phase6/QUOTALIS_3D_PRODUCTION_SIX_v2.png`. Two
zoomed crops taken directly from the live canvas (native CDP
`Page.captureScreenshot` with a `clip`, not a resized export) to check
legibility claims that don't hold up at thumbnail size:
`docs/images/dashboard/phase6/QUOTALIS_3D_CODEX_ZOOM.png` and
`docs/images/dashboard/phase6/QUOTALIS_3D_CORE_ZOOM.png`.

| Aspect | Re-check |
|---|---|
| Selection highlight | **Fixed.** The Codex zoom shows a distinct thin ring traced around the full sphere in addition to the thicker partial usage-ring arc — two visually separable rings, not one. Combined with the persistent emissive glow (0.3 vs 0.15 for hover, 0 for neither), Codex reads unambiguously as "the selected one" at both thumbnail and zoomed scale. |
| Glyph integration | **Fixed.** The real Codex (OpenAI swirl) glyph renders crisp and correctly tinted above the "Codex" text label, at both native and zoomed resolution — a viewer can now visually identify the provider, not just read its name. |
| Central core | **Improved, intentionally still quiet.** The zoom shows a faceted icosahedron hub with a small emissive highlight point and two concentric calibration rings — a real anchor, no longer a smudge. It stays deliberately dim relative to the provider bodies (owner section 4 explicitly forbids a glowing-sun read); the calibration rings are what carry the "instrument" identity at overview scale, not raw brightness. |
| Orbit/track structure | **Fixed.** A thin single orbit-guide track now visibly connects all six bodies at overview scale, giving the ring real structural context that was previously absent. |
| Lighting/materials | **Improved.** The Codex zoom shows a visible specular highlight and a smoked-metal (not flat matte) falloff across the sphere, consistent with the raised metalness/roughness tuning and the new rim light. |
| Usage-ring readability | **Improved.** The thick partial arc (usage%) and the thin full selection ring are now visually distinct elements rather than one ambiguous ring, which was the baseline's core complaint. |
| Overall identity | Passes the section 52 questions at the 6-provider/Codex-selected state: who (glyph + label), how much (arc fill), which one (selection ring + stronger glow), status (detail panel, unchanged from Phase 5.2/4), and the scene no longer reads as an unadorned "planets tutorial" thumbnail. This is one state of the required matrix, not the full Phase 6 sign-off — 1/12/24-provider framing, theme matrix, RTL, narrow/maximized, and the remaining screenshot set are still open (see `PHASE6_PRODUCTION_3D.md`). |

## Reset-proximity marker (owner section 8)

Added after the pass above: a small amber dot on a provider's ring,
visible only when its real `resetsAt` falls within the same
`RESET_SOON_MS` (1 hour) window the 2D dashboard's own `resetSoon`
alert already uses (`dashboardSelectors.ts`'s `RESET_SOON_MS`, imported
by the new `providers3d/resetProximity.ts` rather than a second
hardcoded threshold). Shares one geometry/material across every
provider (never per-provider).

Native proof: `docs/images/dashboard/phase6/QUOTALIS_3D_RESET_MARKER_ZOOM.png`
shows the marker clearly on Codex (real `resetsAt` ~45 minutes out).
Cross-checked against all six providers' live `resetsAt`/marker-visible
state via the debug registry: only Codex (45m) and no other provider
(2h-\~2 days out) shows the marker -- confirms the visual matches the
real threshold, not just "renders something." The marker's first
implementation (`RESET_MARKER_RADIUS = 0.05`) was checked and found too
small to read without 6x digital zoom; raised to `0.09` plus
`depthTest: false`/a higher `renderOrder` (matching the selection
ring's own treatment) so it isn't partially swallowed by the body mesh
at some camera angles. Unit-tested directly in `resetProximity.test.ts`
(6 tests: null/unparsable/past/boundary/soon/far), since `engine.ts`
itself cannot be exercised for WebGL logic in jsdom.

Process note: the first capture taken after this redesign
(`QUOTALIS_3D_PRODUCTION_SIX_v1_raw.png`, not kept) showed one body
(DeepSeek) filling most of the frame with an oversized label. Inspecting
live engine state via CDP (`camera.position`/`controls.target`) showed
this was leftover OrbitControls camera drift from earlier manual
interaction in this same native session, not a rendering defect — reset
via the engine's own `resetView()` (same call the UI's "Reset View"
button makes) produced the clean framing shown above. Recorded here
because it is exactly the kind of false-positive a screenshot-only
critique would misdiagnose as a bug; the live CDP state check is the
actual evidence.
