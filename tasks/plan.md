# Implementation Plan: Flow Surface Foundation

## Overview

Build the approved Flowline, Horizon Fold and Corner Petal forms through one
native Windows overlay and one shared provider renderer. This plan is
subordinate to `docs/FLOW_SURFACE_SPEC.md`. The existing catalog remains
archived; future themes vary material tokens only.

## Architecture Decisions

- Use one selectable Flow Surface form at a time: Flowline, Horizon Fold or
  Corner Petal. Never create multiple overlay windows.
- Use Rust as the sole owner of native bounds, monitor recovery, placement,
  resize acknowledgement and one-expanded-window coordination.
- Treat all third-party Notchy/Notchi repositories as reference material only. No source code will be copied: the MIT projects are macOS/Xcode apps, and Notchi is GPL-3.0-only.
- Use `hidden → peek → compact → hover → expanded ↔ pinned` states. Settings
  and Dashboard remain normal windows; all legacy orbital overlays stay retired.
- Archive inactive theme catalog entries without deleting assets or history. Only Obsidian Orbit remains selectable at runtime during the foundation phase.

## Task List

### Phase 1: Contract and native layout

- [ ] Task 1: Add normalized presentation settings and pure compact/expanded
  envelope resolution with tests.
- [ ] Task 2: Wire one native surface window to form/anchor settings and remove
  dependence on retired Edge/Taskbar overlays.

### Checkpoint: Native boundary

- [ ] Build and focused tests pass.
- [ ] Exactly one overlay can be opened and all bounds are work-area safe.

### Phase 2: Shared composition

- [ ] Task 3: Build a shared Flow Surface provider atom and the Flowline form.
- [ ] Task 4: Add Horizon Fold and Corner Petal as form-only reflows.
- [ ] Task 5: Implement hidden/peek/auto-hide/pin motion and accessible focus.

### Checkpoint: Live Windows usability

- [ ] Fresh Dev binary shows all forms without desktop obstruction.
- [ ] Compact, detail, pin and auto-hide state changes stay responsive.

### Phase 3: Presentation controls and proof

- [ ] Task 6: Add Settings controls for form, anchor, scale, auto-hide, delay,
  opacity/fullscreen and restore.
- [ ] Task 7: Capture live Windows evidence and test 100%/150% DPI bounds.

### Checkpoint: Interaction candidate

- [ ] Fresh Dev build proves compact, expanded, pinned, moved, and recovered
  states on Windows.

### Phase 4: Theme protocol

- [ ] Task 8: Add the first additional material-only theme only after the
  default Obsidian Pulse forms have passed native proof.

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
