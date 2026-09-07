# Wave 6 continuation checkpoint

Written per the owner's explicit context-limit protocol: finish a coherent
slice, test it, commit it, record exact state here, continue from this file
in the next session — do not ask the owner to re-scope.

## Branch / HEAD

- Branch: `feature/v9-theme-runtime`
- HEAD: `65fb400c` — "fix(ui): FlowSurface header follow-up - logo-only anchor, larger provider identity, real pin icon"
- This session's commits (in order): `c93c6df8` (ownership investigation
  doc), `6522e5b3` (structure→provider-icon bleed fix), `ab3be623` (DEMO
  watermark overlap fix), `41880bd2` (resolveVisualComposition resolver),
  `14a02659` (checkpoint doc), `c19dce45` (Follow Structure UI wiring),
  `e44c29f4` (flowline height/clipping fix), `78118900` (header identity
  ownership + drag-handle correction), `1b25a4b8` (checkpoint doc),
  `a91c8b48` (collision-safety fix + native RTL verification), `65fb400c`
  (header follow-up: logo-only title, larger provider row w/ plan label,
  real pin icon)

### Header correction status (three rounds, all owner-reviewed and accepted)

1. Provider icon shown where app logo was → corrected back (BLUE/RED/GREEN).
2. Collision safety (long names), native RTL, bounds tests → done (`a91c8b48`).
3. Text label removed, provider row enlarged + moved below header, plan
   label added, real pin icon → done (`65fb400c`), including a **fresh
   native RTL re-verification of this exact new 2-row layout** (not just
   carried over from round 2) — confirmed mirroring correctly, screenshot
   sent to owner.

## Execution order (owner's 21-phase spec, Phase 4 message numbering)

1. ~~Profiles page~~ — DONE
2. ~~Main navigation normalization~~ — DONE
3. **Structure Theme × Provider/Icon Presentation composition — IN PROGRESS (this checkpoint)**
4. Follow Structure / Independent mode — resolver built AND wired into the
   Provider Identity gallery UI this session; NOT yet wired anywhere else
   (Theme Composer doesn't exist yet)
5. Visual theme-bleed investigation — DONE, confirmed bleeds fixed
6. Theme Composer — NOT STARTED
7. Full UI density audit — NOT STARTED
8. Density/layout corrections — NOT STARTED (though several *ad hoc*,
   owner-reported layout defects were found and fixed this session — see
   below; these are not a substitute for the systemic Phase 7 audit)
9. Before/after proof — done ad hoc for each fix this session, not yet the
   dedicated proof-board deliverable
10. Bounded Fable concept pass — NOT STARTED (explicitly gated until
    Phase 4 passes)
11-21 (new themes, combination matrix, light-theme validation, motion,
    performance, native QA, version, Personal) — NOT STARTED

## What's actually done and verified this session (a second, large Phase 4 session)

This session had two distinct parts: (A) continuing the planned resolver
architecture work, and (B) three rounds of **owner-reported live visual
defects** found by the owner looking directly at the running Dev app,
which took priority per this project's established pattern (fix what's
actually reported, immediately, with native proof).

### A. Planned architecture work

1. **`resolveVisualComposition()` wired into the UI** (`c19dce45`) —
   `ProviderIdentityGallery.tsx` now displays "adaptive" as "Follow
   Structure" with a "Recommended" badge (dashed border, distinct from the
   other 23 identity cards), plus a provenance line ("Provider
   Presentation: Following <structure>" / "...Independent — <identity>")
   composed from the resolver's output. 5 new locale keys. 2 new tests (6
   total in that file).

### B. Owner-reported live visual defects (three rounds, all fixed and native-verified)

**Round 1 — the original bleed complaint's actual root cause** (`6522e5b3`,
predates this checkpoint's summary but re-confirmed): `surfaceMaterial.ts`
forced every provider icon to grayscale+overexposed inside Notch/Reel/
Flow-Surface hosts, contradicting the file's own "provider data stays
independent" comment. Removed. Native-verified: icons went from forced
white to real brand colors.

**Round 2 — "there is a demo word everywhere... overlap of layers"**
(`ab3be623`): the DEMO watermark every structure shows when using
synthetic fixture data was appearing on all 24 Theme Gallery preview cards
(and the Surfaces tab picker), colliding with each card's icon/menu row at
small scale. Added `showDemoBadge` (default true, preserves live-surface
behavior); preview contexts pass `showDemoBadge={false}`. Native-verified:
badge count 24+ → 0.

**Round 3 — the marked-screenshot header correction** (this is the bulk of
this session): the owner sent a screenshot with the app logo shown next to
a provider's name ("OpenAI") in the expanded detail panel, asked for the
*provider's* logo there instead. Implemented that
(`.flow-surface__detail-title`/`.flow-surface__brand` → provider icon).
**Then the owner sent a second, more precise screenshot** with three
marked regions (BLUE/RED/GREEN) clarifying the actual intent was the
opposite for those specific spots: the app logo should stay as the
anchor, and provider identity needed its **own distinct slot**, not to
replace the app logo. Corrected:

- `e44c29f4`: separately found and fixed a real, precisely-measured
  layout bug while reproducing the scenario — the expanded Flowline
  window (160px) was too short for its own `.flow-surface__quick-providers`
  vertical column (~200px real content height), clipping the third
  satellite gauge's percentage by ~32-40px. This is very likely what the
  owner separately described as "the Gemini... percent not shown clearly."
  Fixed by increasing the envelope height to 210px. New regression test
  pins a ≥200px floor.
- `78118900`: reorganized `.flow-surface__detail-header` into three zones
  — title (always QuotaArc's own mark, left), a new
  `.flow-surface__detail-provider` chip (focused provider's icon+name,
  center, only rendered when a provider is genuinely focused), and
  controls (right, unchanged). Reverted `.flow-surface__brand` (the
  compact/rail summary icon) to always show the QuotaArc mark. Also
  implemented the owner's drag-handle spec: `.flow-surface__drag` is
  `opacity:0` by default, fades to `1` on hover/focus/active (CSS-only,
  respects reduced-motion), keyboard-reachable via `:focus-visible`. 4 new
  tests. Native-verified via computed-style inspection (not just
  screenshots) against the exact reported scenario: title has the app
  mark and no provider icon; the new chip has the provider icon and
  "Claude" text; compact brand has the app mark; drag handle opacity 0→1
  idle→hover; provider order/positions unchanged.

## Deliberate scope decisions this session (not oversights)

- The header correction (`78118900`) was scoped to **FlowSurface only**
  (flowline/horizon/petal/orbital/lens), per the owner's own "reproduce
  the exact screenshot case first... do not move to a broad theme pass
  before this exact composition is correct" instruction. NotchSurface and
  ReelSurface were checked and confirmed to NOT have the icon-swap bug (an
  earlier round of investigation, still valid) — but they were not
  audited against the newer, more detailed BLUE/RED/GREEN header-ownership
  model (shared `QaApplicationMark`/provider-chip components, bounds
  tests, corner-geometry audit, RTL verification) the owner's most recent
  message also asked for. That is real, substantial remaining scope, not
  finished this session — see "Exact next step" below.
- No shared `QaApplicationMark`/provider-header component was extracted
  yet (owner's item 18-19) — the new markup lives directly in
  `FlowSurface.tsx`. Extracting a shared component makes most sense once
  the SAME correction has actually been verified/ported to Notch and Reel
  too (otherwise there's nothing yet to share).
- No bounds/collision tests were added (owner's item 8/23) — the new
  layout is presentational and known-safe by construction (title/chip/
  controls are simple flex siblings with `justify-content:space-between`,
  no absolute positioning that could overlap), but explicit tests proving
  no intersection across compact/normal/expanded widths and 1/3/7 provider
  counts, as specified, were not written.
- No corner-geometry audit was done (owner's items 9-11) — genuinely
  separate, large-scope visual work across all 14 structure forms and
  their animation states, not started.
- RTL was not natively verified for this specific header (owner's item
  24) — the CSS uses logical flexbox (`justify-content:space-between`,
  no hardcoded `left:`/`right:` pixel offsets for the header zones
  themselves), which should mirror correctly under `dir="rtl"` by
  construction, but this is an assertion from code reading, not a native
  RTL screenshot for this exact header.

## Tests (this session's Phase 4 work, cumulative)

- Frontend: `npx vitest run` → **693/693 passing** (672 at the Phase-3
  checkpoint → 673 → 686 → 688 → 689 → 693 across this session's fixes).
- Frontend typecheck: `npx tsc --noEmit` → clean (checked after every
  slice).
- Locale-drift check: **977/977 keys matched**.
- `cargo test locale::` (shared crate): 17/17 passing (English-completeness
  check covers the 5 new keys from the Follow Structure UI wiring).
- No other Rust changes this session (all fixes are frontend-only except
  the locale additions).

## Native proof this session (real Dev binary + WebView2 IPC via CDP throughout)

- Bleed fix, DEMO-badge fix: see prior checkpoint section (unchanged this
  entry, still valid).
- Flowline height fix: measured `windowInnerHeight`/quick-providers
  bounding-rect before (160/199.7, clipping) and after (210/199.7, safely
  contained) via `getBoundingClientRect()` reads, not just screenshots.
- Header correction: computed-style/DOM assertions for exactly which
  element (title vs. new provider chip vs. compact brand) contains
  `.flow-surface__mark` vs. `.provider-icon`, plus `getComputedStyle(...)
  .opacity` for the drag handle at idle and on a real `Input.dispatchMouseEvent`
  hover — not visual inspection alone. Screenshots sent to the owner at
  each round matched the computed-style evidence.
- Dev profile settings (`topArcForm`, `topArcAutoHide`, demo mode) were
  changed repeatedly for reproduction and restored to baseline
  (`topArcForm:"seam"`, `topArcAutoHide:true`, demo off) after every round
  — verified via `get_surface_settings` each time.

## Exact next step (continuing Phase 4)

Two legitimate directions, both real remaining scope from this session's
own work — pick based on what's more valuable to unblock next:

1. **Finish the header-ownership correction properly**: port the same
   BLUE/RED/GREEN model to NotchSurface/ReelSurface (even though they
   didn't have the specific icon-swap bug, they should be audited against
   the *fuller* header-ownership spec — shared components, bounds tests,
   corner-geometry, RTL). Extract `QaApplicationMark` (or agreed name) and
   a shared provider-identity-chip component per the owner's items 18-19
   once there's a second real consumer to share it with. Add the
   bounds/collision tests from item 23 (compact/normal/expanded ×
   1/3/7 providers, long names, RTL, DPI scaling).
2. **Continue the planned Phase 4 architecture**: Theme Composer UI
   (owner's original section 11 from the first Phase-4 message), the
   dual-provider-color-source defect flagged in
   `docs/validation/VISUAL_THEME_OWNERSHIP.md` (bleed #7, not yet fixed —
   `theme.providerColors` vs. `PROVIDER_ICON_REGISTRY.brandColor`
   disagreement), migration tests (owner's original section 16 — likely
   near-trivial since `presentationSource` stays purely derived, no new
   persisted field), visual proof boards.

Given the owner's most recent message was explicit that this correction
is "high-priority... inside the current visual pass" and should be
followed by continuing Phase 4 (not abandoning it), recommend: a quick,
bounded pass on direction 1 (shared component extraction + bounds tests
only — skip the full corner-geometry audit, which is Phase-7-sized scope
better done systematically later), then resume direction 2.

## Personal status (must not be touched until the version-decision/backup/promotion phases)

- Personal is on **0.10.1**. Not touched this session.
- Version bump to **0.11.0** remains the working assumption.

## Process notes for the next session

- Dev binary + vite dev server pattern unchanged. All fixes this session
  were frontend-only — no Rust rebuild needed except once, for the locale
  string changes (Rust embeds `.ftl` files at compile time; pure TS/CSS
  changes hot-reload via vite without a rebuild).
- The exact live-reproduction recipe for FlowSurface issues: `update_surface_settings`
  patch with `topArcForm` (a valid form id — check `footprints.json` for
  notch-family ids like "seam", or "flowline"/"horizon"/"petal"/"orbital"/
  "lens" for FlowSurface-family), `topArcAutoHide:false`, then
  `set_surface_demo_mode:true` for 6 varied synthetic providers, reload,
  click `.flow-surface__reveal` then `.flow-surface__summary` to reach the
  expanded detail panel. Always restore `topArcForm:"seam"`,
  `topArcAutoHide:true`, demo mode off afterward.
- A `git commit -m "..."` message containing backtick-quoted inline code
  (`` `focused` ``) gets shell-interpreted as command substitution in this
  Bash tool and silently corrupts that one line — happened once this
  session, caught and fixed via `git commit --amend -F <file>`. Prefer
  writing multi-line commit messages to a temp file and using `-F` when
  the message contains backticks.
- Scratch CDP verification scripts live in `.local/` (not committed).

## Overall verdict so far (pre-Reset-Presentation-System)

**NOT PASSED** — significant real, verified progress this session (one
planned architecture slice + three rounds of owner-reported live defects,
all root-caused and fixed with native evidence, not just asserted), but
the header-ownership correction's fuller scope (shared components, bounds
tests, corner geometry, RTL) and the entire rest of Phase 4 (Theme
Composer) through Phase 21 (Personal promotion) remain. Continuing per the
owner's explicit "do not stop, do not ask to re-scope" instruction.

## Phase 5: Reset Time / Presentation System (this checkpoint)

The owner sent a 50-section spec extending the Arabic RTL / reset-time
work into a full international, adaptive time-presentation system. Full
detail, test matrix, and the item-by-item acceptance checklist are in
[`docs/validation/RESET_TIME_PRESENTATION_SYSTEM.md`](validation/RESET_TIME_PRESENTATION_SYSTEM.md)
— summary here:

**Built this pass**: the one authoritative formatter
(`apps/desktop-tauri/src/lib/resetPresentation.ts`, `Intl`-only, pure,
structured output per the owner's section-31 shape), wired into the single
highest-leverage consumer (`stageProviders.ts::resetOf`, feeding ~20
surfaces), backward-compatible (existing call sites/tests untouched, new
`resetOptions` param optional). Fixed a real, previously-undiscovered bug
along the way: `ar-SA.ftl` was missing `ResetsInDaysHours` /
`ResetsInHoursMinutes` / `ResetsInMinutes` / `NextExpires*` /
`TrayResets*` entirely, so Arabic users were silently seeing **English**
reset-countdown text via Fluent's fallback — now has real Arabic
translations. Added two new locale keys
(`ResetLessThanMinuteShort/Long`) with translations in all 9 locale files.
34 new tests (countdown tiering, DST, day-rollover across timezones,
12h/24h, Latin-digit enforcement, structured output, ordering, ARIA).

**Verified**: 737/737 frontend tests (703 pre-existing + 34 new), `tsc
--noEmit` clean, `pnpm run build` succeeds, `cargo test --workspace` green
(447 desktop-tauri-crate tests including all 17 locale tests + full
codexbar crate), `cargo clippy --workspace --all-targets` clean, `cargo
fmt --check` clean, `scripts/scan-secrets.mjs` clean, `git diff --check`
clean.

**NOT done this pass** (explicitly scoped out, see the validation doc's
"Explicitly out of scope" section): the Settings "Reset Display Composer"
UI; persisted timezone/clock-format/reset-preset settings in
`rust/src/settings.rs` (no way for a user to change these yet — every real
surface uses the safe defaults: countdown-only, adaptive, system
timezone/clock); per-surface overrides; migrating the other duplicate
formatters (`useFormattedResetTime.ts`, the Rust-side tray formatters in
`apps/desktop-tauri/src-tauri/src/commands/bridge.rs`) onto this pipeline;
fixing Claude's UTC-only `resetDescription` bug
(`rust/src/providers/claude/web_api.rs:666-668`,
`rust/src/providers/claude/oauth/mod.rs:640-642`); native CDP screenshots.

**Verdict**: PASS on the core formatter/pipeline/locale-bug-fix slice this
pass covers (item-by-item in the validation doc); NOT PASSED against the
owner's full 50-section spec — the Settings UI, persistence, and
full-surface migration are real, larger, separate work.

## Overall verdict so far
