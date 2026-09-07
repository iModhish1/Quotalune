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

## Phase 6: Reset system end-to-end — Composer, persistence, overrides, Claude fix

Direct follow-up to Phase 5: the owner explicitly required the reset
system be fully user-configurable, persisted, migrated, wired into
production surfaces, and the Claude UTC bug fixed before resuming
Structure Theme/Fable work. Full detail and the final item-by-item
acceptance checklist are in
[`docs/validation/RESET_TIME_PRESENTATION_SYSTEM.md`](validation/RESET_TIME_PRESENTATION_SYSTEM.md)
(replaces the Phase 5 checklist there) — summary here:

**Built this pass**: `ResetPresentationSettings` persisted Rust struct
(`rust/src/settings.rs`) with full validation/repair/migration (15 tests);
two validated Tauri commands (`set_reset_presentation`,
`set_reset_presentation_surface_override`) wired into `SettingsSnapshot`;
a DTO↔config mapping module (`lib/resetPresentationSettings.ts`, 10
tests) including a real Regional-Format resolver kept independent of UI
language; a real production Settings section
(`surfaces/settings/tabs/ResetDisplaySection.tsx`, mounted as a third view
in the existing Provider Display tab) — preset selector, custom
module/order editor with accessible Move Up/Down, advanced
timezone/regional/clock/date controls, and a live dual-locale preview
powered by the exact production formatter (8 tests); every real
stage-driven surface (`TrayPanel`, `FloatBar`, `PopOutPanel`,
`useStageRuntime` — covering tray/hud/dashboard/taskbar/top/edge/quick)
now resolves surface-override → global → default precedence through
`useResetStageOptions`, and `StageProvider.reset` now reflects the user's
full module selection (joined with " · "), not just a hardcoded
countdown-only view. Fixed the previously-identified Claude UTC-only
`resetDescription` bug in both `web_api.rs` and `oauth/mod.rs`, reusing
the exact `chrono_tz` + `local_timezone_name()` pattern already
established in `cli_reset.rs`, with 2 new regression tests proving the
timezone conversion (not just "doesn't crash").

**Verified**: 755/755 frontend tests (703 baseline + 34 Phase 5 + 18 new),
`tsc --noEmit` clean, `pnpm run build` succeeds. `cargo test --workspace`:
1938 passing (1491 codexbar + 447 desktop-tauri). `cargo clippy
--workspace --all-targets -- -D warnings` clean. `cargo fmt --check`
clean. `scripts/scan-secrets.mjs` clean. `git diff --check` clean.

**NOT done this pass** (see the validation doc's final checklist for the
full item-by-item honesty pass):
- **Surface-override UI control** — the backend/precedence is real and
  wired everywhere; the Composer itself only edits the *global* config,
  no UI yet to set a per-surface override.
- **Tray/Rust-side formatter migration** — `commands/bridge.rs`'s own
  tray formatting functions and `useFormattedResetTime.ts` are still
  separate, unmigrated implementations. This is the largest remaining
  gap against "one authoritative pipeline" and "tray parity" — an Arabic
  tray tooltip is not guaranteed to say the same thing as the frontend
  surfaces yet.
- **Native CDP screenshots** — none of the 15 named files captured.
- **Fresh native RTL re-verification** — the Composer's bidi isolation is
  test-verified (JSDOM), not re-confirmed against the real Dev binary.

**Verdict**: NOT PASSED against the owner's full final checklist —
Settings Composer/persistence/migration/Claude-bug-fix are real and
verified; surface-override UI, tray/Rust formatter migration, and native
proof remain genuine, scoped-out gaps, reported honestly rather than
claimed complete.

## Phase 7: Dashboard Studio — a separate, new mega-request (not Wave 6)

The owner opened a distinct, large new initiative on top of a live UX
regression they reported (see below): "transform Dashboard into the true
QuotaArc command center" — 2D/3D/Hybrid dashboard modes, pricing accuracy,
refined theme families, dashboard customization. This is tracked
separately from the reset-time work above, with its own continuation
documents (this repo's Dashboard work is large enough to warrant that per
this file's own "create a Dashboard-specific continuation document if
cleaner" guidance):

- **In-shell Dashboard regression, fixed** (commits `93d367b9`, `0053e6dc`):
  the owner reported (annotated screenshot) that clicking "Dashboard" in
  the Settings sidebar opened a separate detached window instead of
  staying in-shell — a Wave 6 Phase 3 navigation-normalization decision the
  owner explicitly rejected. Root-caused to `shell::MainRoute::Dashboard`
  resolving to `None` (the one route that fell through to a separate-
  window branch); fixed to resolve like every other route
  (`Some("dashboard")`). `PopOutPanel.tsx` preserved unchanged as the
  explicit "Open Dashboard in Separate Window" secondary path. A related
  real bug was also found and fixed: the Rust-side settings-tab whitelist
  (`surface_target.rs`) was out of sync with the new `dashboard`/
  `resetDisplay` tabs, which would have silently broken "reopen to last
  tab" and native proof-harness verification for both.
- **Reset Display relocated** to its own first-class Settings tab (was a
  3rd switcher pill crammed into Provider Display — the owner rejected
  that placement too).
- **Dashboard Studio Phase 0 (audit)**: `docs/validation/DASHBOARD_MASTER_AUDIT.md`.
  Key findings: no chart library dependency (in-house SVG only); zero
  3D/WebGL anywhere (a from-scratch build, the single largest risk in the
  spec); Structure Theme (23 entries) and Provider Presentation
  Follow-Structure-vs-Independent already fully shipped; pricing has zero
  provenance metadata; raw provider errors render unclassified on the
  Dashboard exactly as flagged.
- **Dashboard Studio Phase 1 (live history + normalized data layer)**:
  `docs/validation/DASHBOARD_DATA_ARCHITECTURE.md`. Corrected a Phase 0
  audit error (history ingestion was NOT actually unwired — the audit's
  search missed the Tauri shell crate; real ingestion has been live since
  a pre-existing commit, confirmed via 3,048 real samples already in this
  machine's `history.db`). Built the missing piece: `rust/src/
  dashboard_data.rs` (timezone-aware range resolution with real DST
  handling, daily/hourly aggregation, `DataAvailability`, the
  `DashboardSnapshot` contract) + one bridge command
  (`get_dashboard_snapshot`). Verified against real on-machine history
  data via an explicitly `#[ignore]`d manual test. Also fixed a real
  latent dedup bug (cost samples could wrongly dedupe against each other)
  found while wiring cost recording into history for the first time.

**NOT done yet** (honestly scoped, not attempted this pass): frontend
consumption (no React hook calls the new bridge command yet); Phase 2
(dashboard mode registry + Settings UI) through Phase 13 (release) of the
owner's 13-phase plan; the 3D engine (correctly not started, per the
owner's own explicit ordering); pricing provenance/audit (Phase 4); native
screenshots. Given the true scope of the full Dashboard Studio spec (a
from-scratch 3D engine, pricing verification across every provider/model, a
widget/customization system, native proof across every mode × theme ×
performance combination), this remains multi-session work — reported
honestly rather than compressed into a false completion claim.

**Verdict**: Dashboard regression — PASS (fixed, tested, committed). Reset
Display relocation — PASS. Dashboard Studio Phase 0 — PASS (audit
complete, one correction made honestly). Phase 1 — PASS on its own scope
(real ingestion confirmed working, query/aggregation layer built and
verified against real data); Dashboard Studio as a whole — NOT PASSED,
correctly, this is Phase 1 of 13.

## Overall verdict so far

Wave 6 (Reset-Time Presentation System) — NOT PASSED against the owner's
full final checklist, real gaps reported honestly (see above). Dashboard
Studio Phase 0/1 — PASS on their own scope. Dashboard Studio Phase 2 — see
below; PASS on its own scope, native proof honestly not done.

## Phase 2: Dashboard Registry + Dashboard Studio Settings

Date: 2026-09-07. Branch `feature/v9-theme-runtime`. Starting HEAD:
`52991e4e` (Phase 1, accepted PASS, not revisited). Full detail:
[`docs/validation/DASHBOARD_STUDIO_ARCHITECTURE.md`](validation/DASHBOARD_STUDIO_ARCHITECTURE.md).

**Built**: a typed `DashboardModeId`/`DashboardPerformancePreset` registry
(`src/lib/dashboardRegistry.ts`) as the one authoritative source for the 3
Dashboard modes; two new local-only settings persisted through the
existing Rust settings system with lenient per-field migration (invalid
stored value never crashes settings load, never silently switches a user
into 3D); a new `dashboardStudio` Settings tab added to both the frontend
whitelist and `SETTINGS_TAB_IDS` in the same change (the `0053e6dc`
drift bug not repeated); `DashboardHost`, which mounts exactly one mode at
a time via `React.lazy` + a keyed `Suspense`/error-boundary pair (proven
by a real mount/unmount-tracking test, not just asserted); the existing
Dashboard content extracted unchanged into `AnalyticsDashboard.tsx` as the
2D baseline; two explicitly-labeled Dev-only placeholders for 3D/Hybrid
that show real local history counts via a new `useDashboardSnapshot()`
hook wrapping the Phase-1 `get_dashboard_snapshot` bridge command; a
Dashboard Studio Settings page with selectable mode/performance cards and
a read-only display (with "Change" links, not a rebuild) of the
already-shipped Structure Theme / Provider Presentation settings.

**Quality gates — all run fresh against this checkpoint, all green**:
- `npx vitest run` (frontend): **130 files / 791 tests passed, 0 failed**.
- `npx tsc --noEmit`: clean.
- `npm run build` (`vite build`): succeeded; confirmed via chunk output
  that `AnalyticsDashboard`, `Providers3DDashboard`, `HybridDashboard`
  each ship as separate lazy chunks, not inlined into the main bundle.
- `cargo test --workspace`: **454 passed, 0 failed, 1 ignored** (the
  pre-existing `#[ignore]`d manual real-history test from Phase 1).
- `cargo clippy --workspace --all-targets -- -D warnings`: clean.
- `cargo fmt --all -- --check`: found real drift in the new Rust test
  code (line-wrapping only), fixed with `cargo fmt --all`, re-verified
  clean, re-ran the 86 affected dashboard/settings tests to confirm no
  behavior change.
- `node scripts/scan-secrets.mjs`: clean (1300 files).
- `git diff --check`: no whitespace errors (only benign LF→CRLF
  normalization notices, a pre-existing repo/editor convention, not
  introduced by this phase).

**NOT done** (honestly scoped): native Dev screenshots — no native
Windows screenshot capability exists in this environment, so the 5
requested `.png` files were not captured; this is reported as a gap, not
fabricated. `dashboardPerformancePreset`'s effect on actual rendering
(chart animation level, glass/shadow quality) is a dormant contract only
— Phase 2 builds the enum and its persistence, not its consumption.
Bitmap preview thumbnails were substituted with CSS-gradient swatches (no
image-generation capability available).

**Verdict**: PASS on Phase 2's own scope (registry, persistence,
lazy-loaded single-mount host, error isolation, Dashboard Studio Settings
UI, snapshot bridge, routing convergence unchanged and reconfirmed) — see
[`docs/validation/DASHBOARD_STUDIO_ARCHITECTURE.md`](validation/DASHBOARD_STUDIO_ARCHITECTURE.md)
for the item-by-item mapping. Native screenshot proof is the one
explicitly NOT-satisfied item, reported honestly rather than claimed.

**Phase 3 starting point**: 2D Analytics visual redesign. `DashboardHost`,
the registry, and the settings persistence from this phase are stable
building blocks — Phase 3 should replace `AnalyticsDashboard.tsx`'s
internals (still the pre-`93d367b9` content, moved but not redesigned)
without touching the host/registry/settings contracts built here. Do
**not** start the 3D engine before Phase 3 and Phase 4 (pricing) are both
complete, per the owner's explicit ordering.
