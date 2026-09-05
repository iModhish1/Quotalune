# Implementation Plan: Quota Island Foundation Reset

## Overview

Replace the active multi-theme orbital runtime with one compact, Windows-first
canonical surface foundation. This plan is subordinate to
`docs/FOUNDATION_UI_BLUEPRINT.md`: the visual acceptance gate must be approved
before any new UI implementation begins. The existing catalog remains preserved
as inactive source material; future themes vary tokens only, never layout,
interaction, or provider semantics.

## Architecture Decisions

- Use one small movable `QuotaIsland`, not an orbital chart, as the sole live
  overlay.
- Use Rust as the sole owner of native bounds, monitor recovery, placement, and
  one-expanded-window coordination.
- Treat all third-party Notchy/Notchi repositories as reference material only. No source code will be copied: the MIT projects are macOS/Xcode apps, and Notchi is GPL-3.0-only.
- Make one `QuotaIsland` overlay with compact, hover, expanded, pinned, and
  dragging states. Settings and Dashboard remain normal windows; legacy
  Taskbar, Edge, HUD, and Quick Panel overlays remain retired from production.
- Archive inactive theme catalog entries without deleting assets or history. Only Obsidian Orbit remains selectable at runtime during the foundation phase.

## Task List

### Phase 0: Visual foundation gate

- [ ] Task 0: Approve the canonical compact/expanded composition and motion
  storyboard in `docs/FOUNDATION_UI_BLUEPRINT.md`.

### Checkpoint: Visual contract

- [ ] Human confirms the design boards are the desired direction.
- [ ] No implementation proceeds while the visual contract is ambiguous.

### Phase 1: Canonical runtime inventory and archival boundary

- [x] Task 1: Map every active catalog/geometry/motion runtime import and define the archive boundary.
- [x] Task 2: Preserve inactive catalog data under an explicit archive namespace and expose one canonical theme contract.

### Checkpoint: Runtime boundary

- [ ] Build and focused tests pass.
- [ ] Only the canonical theme is selectable in production Settings and live surfaces.

### Phase 2: Canonical composition

- [ ] Task 3: Rebuild `QuotaIsland` from the approved compact/expanded
  composition, replacing the current failed visual implementation.
- [x] Task 4: Retire legacy Taskbar and Edge overlays from the production path and preserve them only in Git history. HUD and Quick Panel retirement remains part of Task 5.
- [ ] Task 5: Keep Dashboard and Settings as normal windows; repair clipping and flex collapse.

### Checkpoint: Live Windows usability

- [ ] Fresh Dev binary shows compact overlays without desktop obstruction.
- [ ] One overlay expands at a time through the native coordinator.

### Phase 3: Placement and interaction

- [ ] Task 6: Implement canonical placement persistence, monitor-safe clamping,
  anchor presets, free drag, and recovery actions.
- [ ] Task 7: Implement exclusive expanded state, keyboard behaviour, and
  reduced motion.

### Checkpoint: Interaction candidate

- [ ] Fresh Dev build proves compact, expanded, pinned, moved, and recovered
  states on Windows.

### Phase 4: Quality, accessibility, and proof

- [ ] Task 8: Add canonical-theme interaction, reduced-motion, bounds, and
  visual-regression tests.
- [ ] Task 9: Capture native Windows evidence and measure settled resource use.
- [ ] Task 10: Enable one token-only theme variant only after the foundation
  passes the native proof gate.

### Checkpoint: Review candidate

- [ ] Local test/build gates pass.
- [ ] Fresh native captures match the tested commit.
- [ ] Independent Sol review is complete before declaring the foundation ready.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legacy catalog imports are widespread | High | Inventory imports before changing exports; retain archive adapters temporarily. |
| Surface-specific layout logic bypasses Rust DTOs | High | Add tests that require resolved layout consumption and inspect native windows. |
| Theme removal loses future creative work | Medium | Preserve inactive registry and assets in an explicit archive, without deleting history. |
| Large transparent WebViews remain expensive | Medium | Measure settled process tree after consolidating compositions and remove idle animation. |

## Open Questions

- None blocking: Obsidian Orbit is selected as the canonical starting theme because it is the existing default dark theme and provides the strongest readability baseline.
