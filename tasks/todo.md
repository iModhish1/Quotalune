# Quota Island Foundation Reset Tasks

## Task 0: Approve the visual foundation

**Description:** Freeze one compact/expanded island design and its motion rules
before changing application code again.

**Acceptance criteria:**
- [ ] The approved board shows compact, expanded, and moved states at restrained scale.
- [ ] The approved board contains no orbital, giant, or full-screen composition.
- [ ] The approved motion storyboard uses only bounded state transitions.

**Verification:**
- [ ] Human visual approval of the generated boards and
  `docs/FOUNDATION_UI_BLUEPRINT.md`.

**Dependencies:** None

## Task 1: Canonical composition slice

**Description:** Replace the current island renderer with the approved semantic
compact/expanded composition and token-only theme contract.

**Acceptance criteria:**
- [ ] Compact defaults to 264 × 44 logical px and expanded to 368 × 300.
- [ ] Provider data is rendered as a concise vertical list with linear progress.
- [ ] No legacy orbital renderer is reachable from the production surface.

**Verification:**
- [ ] Focused component and bounds tests pass.
- [ ] Frontend type check and production build pass.
- [ ] Capture fixture matches the approved board at 1366×768 and 1920×1080.

**Dependencies:** Task 0

## Task 2: Native placement slice

**Description:** Make the single canonical island movable, monitor-safe,
recoverable, and exclusive when expanded.

**Acceptance criteria:**
- [ ] Dragging and anchor placement persist across restart and DPI changes.
- [ ] An island cannot be saved off-screen or become unreachable.
- [ ] Only one expanded island state exists.

**Verification:**
- [ ] Rust placement and coordinator tests pass.
- [ ] Fresh native Windows capture proves drag, clamp, pin, and recovery.

**Dependencies:** Task 1

## Task 3: Motion and accessibility slice

**Description:** Add the approved transition, focus, keyboard, and
reduced-motion behaviours without a continuous animation loop.

**Acceptance criteria:**
- [ ] Open/close is 120–160 ms and hover never resizes the native window.
- [ ] Keyboard and focus restoration work in compact and expanded states.
- [ ] Reduced motion removes travel.

**Verification:**
- [ ] Interaction tests pass.
- [ ] Native six-frame capture matches the approved storyboard.

**Dependencies:** Task 2

## Task 4: Performance and visual proof slice

**Description:** Produce release-build evidence for the completed canonical
surface before any additional theme work.

**Acceptance criteria:**
- [ ] Hidden, compact, and expanded settled measurements are recorded.
- [ ] Native captures cover 1080p and scaled-DPI contexts.
- [ ] A token-only theme fixture proves the structure cannot diverge.

**Verification:**
- [ ] Full test/build gates pass.
- [ ] Human review accepts the native evidence.

**Dependencies:** Task 3
