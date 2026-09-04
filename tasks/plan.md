# Implementation Plan: Canonical Surface Foundation

## Overview

Replace the active multi-theme orbital runtime with one compact, Windows-first canonical surface foundation. Obsidian Orbit is the single active visual system. The existing catalog remains preserved as inactive source material so future themes can vary tokens and material without changing layout, interaction, or provider semantics.

## Architecture Decisions

- Use the existing Rust-authoritative surface layout runtime as the sole owner of native bounds and frontend layout DTOs.
- Treat all third-party Notchy/Notchi repositories as reference material only. No source code will be copied: the MIT projects are macOS/Xcode apps, and Notchi is GPL-3.0-only.
- Make one top-center `QuotaIsland` overlay with compact, hover, expanded, and pinned states. Settings and Dashboard remain normal windows; legacy Taskbar, Edge, HUD, and Quick Panel overlays are retired from the production path.
- Archive inactive theme catalog entries without deleting assets or history. Only Obsidian Orbit remains selectable at runtime during the foundation phase.

## Task List

### Phase 1: Canonical runtime inventory and archival boundary

- [ ] Task 1: Map every active catalog/geometry/motion runtime import and define the archive boundary.
- [ ] Task 2: Preserve inactive catalog data under an explicit archive namespace and expose one canonical theme contract.

### Checkpoint: Runtime boundary

- [ ] Build and focused tests pass.
- [ ] Only the canonical theme is selectable in production Settings and live surfaces.

### Phase 2: Canonical composition

- [ ] Task 3: Build `QuotaIsland`: a compact top-center status pill that expands downward into provider details.
- [ ] Task 4: Retire legacy Taskbar, Edge, HUD, and Quick Panel overlays from the production path and preserve them only in Git history.
- [ ] Task 5: Keep Dashboard and Settings as normal windows; repair clipping and flex collapse.

### Checkpoint: Live Windows usability

- [ ] Fresh Dev binary shows compact overlays without desktop obstruction.
- [ ] One overlay expands at a time through the native coordinator.

### Phase 3: Quality, accessibility, and proof

- [ ] Task 6: Add canonical-theme interaction, reduced-motion, and bounds tests.
- [ ] Task 7: Capture native Windows evidence and measure settled resource use.
- [ ] Task 8: Archive audit and future-theme token contract documentation.

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
