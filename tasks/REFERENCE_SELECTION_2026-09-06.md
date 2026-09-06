# Reference selection — structures and materials

Status: implementation in progress, NOT visual/native acceptance.

## Evidence scope

All four user library paths were inventoried, including the ZIP central directory without extraction. Selected visual review: Obsidian Orbit system board, Aurora Bloom system board, Theme Library visual index 01–10, and the separate Aurora Bloom reference in Downloads/Themes. This is not a claim that every library image has been inspected.

Generated concept: `docs/images/structure-review/compact-structures-materials-v1.png`, built-in image generation, synthetic data. Not a runtime screenshot. Its metallic rim is intentionally stronger than the current runtime. Some Reel contour tips still need rounding; do not blindly convert those tips into production geometry.

## Qualitative shortlist, not measured benchmark scores

1. Seam: best reference fidelity and edge footprint. Keep compact single-provider collapse; details open inward. Existing implementation requires final curve/motion review.
2. Collection: best user control, independent elements, shrinking tray and detachable grouping. Reuse the collections model; do not create another incompatible settings store.
3. Ribbon: most economical horizontal information layout. Ensure corner and vertical presentation are independent of its material.
4. Reel: distinctive browsing, but largest interaction risk. Wheel cycles, hover details must not select another provider. Do not promote its visual concept until live interactions pass.

Large decorative orbit/fan references are not selected for persistent desktop display. Their material language can be reused without copying their footprint.

## Material shortlist

- Smoked Silver: existing neutral baseline.
- Aurora Bloom: iridescent midnight/cyan/violet layered finish.
- Solar Ember: warm alloy, bronze contour and warm highlight.
- Ceramic Pearl: genuinely light ceramic surface with dark readable text.

The three new material IDs are distinct from archived legacy geometry themes. Existing saved choices are preserved. New materials retain canonical provider ring colors, independent of material accents.

## Current implementation and evidence

`surfaceMaterial.ts` is the paint-only shared contract for FlowSurface, NotchSurface and ReelSurface. Material output contains no size, placement, motion loop or blur. Text and muted text contrast tests cover base colors; they are not a substitute for composited screenshot review.

Browser script `scripts/check-reference-materials.cjs` exercises 13 compact previews × 3 new materials, verifies unchanged host bounds and present material tokens, and captures each page. These are preview checks, not all placements/states, native windows, input or performance acceptance.

Screenshots: `output/playwright/aurora-bloom-material.png`, `solar-ember-material.png`, `ceramic-pearl-material.png`. Initial inspection found faint provider glyphs in the light Flow/Reel renderers; corrected by a shared light-material glyph treatment. No new structures are claimed complete by this material packet.

## Generation prompt (production brief)

Use case: ui-mockup. High-fidelity QuotaArc compact structure design review, neutral gray background, four columns Seam/Reel/Collection/Ribbon using Claude 73%, Codex 21%, Gemini 58% synthetic quotas. Continuous soft edges, no sharp corners, no oversized empty orbits, no clock hands. Show compact and collapsed/revealed states; Collection shows three instruments, one detached and a tray of two. Hover details have curved bridges, Session 73%, Weekly 7%. Same Collection geometry in Obsidian Silver, Aurora Bloom, Solar Ember, Ceramic Pearl below; distinguish finish, contour, texture and light, preserve provider ring colors. Footer: Concept / synthetic data / runtime validation pending. No fake dimension claims or logo redesign.

## Remaining gates

Gallery follow-up: added local-only selection of all 13 preview structures across all 7 catalog entries. Hover/focus expands only the current card; blur/leave folds it. Uses the real StructurePreview/FlowSurface renderers with measured envelope fitting, not raster mockups. Bounded 180 ms opacity entry, no repeat loop, disabled for reduced motion. New test verifies switching to Seam, one focused expanded card and zero persistence calls. Current live Dev still predates this gallery change and independent detail checkboxes; rebuild/relaunch required before native acceptance.

Verification this packet: frontend 96 files / 523 tests passed, zero skipped; TypeScript and Vite production build passed; focused Rust catalog validation 2 passed (1444 filtered in shared lib, not a full backend run). Browser owner session closed. The new material layer adds no requestAnimationFrame, timers, blur or continuously animated effects. Actual CPU/GPU impact has not been measured.

Review remaining library candidates before declaring the shortlist exhaustive. Finish actual structure recomposition, collection integration, all orientations/corners/states, shared configurable reveal size, provider-specific visibility, Arabic/RTL, settings organization and light app theme. Native input is still unavailable in this session (prior Access denied); do not call browser evidence native proof. Installed/Personal app untouched.
