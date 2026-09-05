# Flow Surface Foundation Tasks

## Task 0: Freeze the approved surface family

**Description:** Use the approved Flowline, Horizon Fold and Corner Petal
references as the structural contract before changing runtime code.

**Acceptance criteria:**
- [x] The approved references show three compact forms and inward details.
- [x] The approved references contain no orbital, giant, or full-screen composition.
- [x] The approved interaction is hidden/hover/expand/pin rather than permanent UI.

**Verification:**
- [ ] Human visual approval of the generated boards and
  `docs/FOUNDATION_UI_BLUEPRINT.md`.

**Dependencies:** None

## Task 1: Presentation contract slice

**Description:** Add normalized form, anchor, scale and auto-hide settings plus
pure tested native envelope resolution.

**Acceptance criteria:**
- [ ] Invalid settings fall back to Flowline/right/100%/900 ms.
- [ ] Every compact and detail envelope is bounded within the work area.
- [ ] Only one native overlay is eligible to show.

**Verification:**
- [ ] Rust unit tests and TypeScript contract tests pass.
- [ ] Frontend type check and production build pass.

**Dependencies:** Task 0

## Task 2: Flowline vertical slice

**Description:** Render the compact Flowline and its inward detail bubble from
real provider data; add hide, peek, hover, expanded and pinned states.

**Acceptance criteria:**
- [ ] Compact Flowline is ≤56 logical px wide and auto-hides by default.
- [ ] Detail bubble opens into free work area and is keyboard reachable.
- [ ] Clicking/dragging never loses the surface outside the monitor work area.

**Verification:**
- [ ] Focused React and native coordinator tests pass.
- [ ] Fresh native Windows capture proves Flowline states and drag recovery.

**Dependencies:** Task 1

## Task 3: Form reflow and settings slice

**Description:** Add Horizon Fold and Corner Petal over the shared atom, then
expose form, position and auto-hide controls in Settings.

**Acceptance criteria:**
- [ ] Form change reuses one native window and immediately clamps bounds.
- [ ] Settings persist and live-update form, anchor, scale and delay.
- [ ] Reduced motion removes travel and hover never causes a resize.

**Verification:**
- [ ] Interaction tests pass.
- [ ] Native captures prove all three forms at 100% and 150% DPI.

**Dependencies:** Task 2

## Task 4: Final proof slice

**Description:** Verify that the overlay remains light, non-interruptive and
recoverable before enabling future themes.

**Acceptance criteria:**
- [ ] Hidden, compact, hover and expanded settled measurements are recorded.
- [ ] Full test/build gates and native captures are attached to the exact build.
- [ ] The first non-default theme remains blocked until this proof passes.

**Verification:**
- [ ] Full test/build gates pass.
- [ ] Human review accepts the native evidence.

**Dependencies:** Task 3
