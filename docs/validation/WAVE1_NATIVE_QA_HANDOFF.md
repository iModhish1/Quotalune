# Wave 1 Native QA Handoff

Historical path note: the V9 native image output described below was withdrawn
from the current public tree on 2026-09-27. Current native QA uses the guarded
desktop-visual-qa adapter and private local captures pending image review.

This document tells a session that HAS working native pixel-screenshot
capability everything it needs to close Wave 1. It does not require
reading the chat history that produced it. **Start at §2a below** — it
names the exact two commands to run first; everything after that is
detail/context for when something doesn't match what the commands
report.

**Wave 1F §32: two explicit lanes, matching `WAVE1_NATIVE_QA_MATRIX.json`'s
`lane` field.** Every acceptance criterion that involves monitor-edge
placement, real DPI/scale-factor behavior, native window chrome, or real
Arabic string rendering requires **Lane B**; anything else can usually be
closed faster in **Lane A**:
- **Lane A — browser/component visual iteration**: `demo/ReelPreview.tsx`
  (`?window=demo&gen=reel`) in any CDP-capable Chromium against
  `npm run dev` — no hardened-launcher dependency, `capture-native-structure-qa-matrix.mjs --lane fixture`.
  Evidence from this lane is **BROWSER FIXTURE**, never **NATIVE WINDOW
  PROOF** — see `STRUCTURE_VISUAL_QA_MATRIX.md`'s Wave 1F clarification.
- **Lane B — real QuotalisDev native-window closure**: the real top-arc
  WebView2, driven by `surfaces/structure-qa/StructureQaController.tsx`
  (`?window=structure-qa`, a human-drivable UI) or directly via
  `set_structure_qa_fixture`/`update_surface_settings` IPC (for
  automation), `capture-native-structure-qa-matrix.mjs --lane native`.
  Requires the verified Dev build + CDP connection this document's own
  "Why this handoff exists" section below explains is blocked for THIS
  session specifically (re-verify for yours, don't assume).

## Why this handoff exists

Waves 1B-1E completed every code-buildable Wave 1 requirement they could
verify without native pixel capture: theme composition (data model,
migration, Apply sheet, real previews, atomicity, Recommended semantics,
Light/Dark independence), Floating Structures' loading-state AND
refreshing-state distinction, the real native edge-placement/DPI
coordinate model (traced and closed in `surfaces.rs`, not a parallel
resolver), a connector decision model, accessible keyboard movement,
structure state-machine tests, provider-count fixtures, and a Dev-only
structure QA fixture panel driving the real production components
through the full fixture matrix. All of it is real, automated, and
gate-clean (jsdom/vitest + cargo test) — see §1a for exactly which
document proves which claim.

No session in Wave 1 has been able to perform native visual
verification. The exact, confirmed reason (re-confirmed each wave, not
just assumed from a stale note): `mcp__windows-exe-automation__take_screenshot`
and `take_control_screenshot` both return `BACKGROUND_ONLY` (foreground-
input-capable tools are disabled by session policy), and the CDP-based
screenshot technique this project used earlier (`.local/proof/claude-audit/`,
`cdp-lib.mjs` connecting to `127.0.0.1:9333`) requires WebView2's
`--remote-debugging-port` flag, which the hardened, args-free
`desktop_qa_launch_quotalis_dev` launcher does not accept by design (it
explicitly documents "No caller path, arguments, working directory...
accepted"). A background UIA `desktop_qa_background_control` call also
failed and the launched process was reclaimed by its kill-on-close job.
This was confirmed by actually launching `QuotalisDev.exe` through the
sanctioned tool and observing the correct verified Dev identity before
hitting the screenshot wall — not assumed from documentation alone.

**Wave 1 native-closure session re-confirmed this fresh** (built a new
verified Dev candidate from `29447752a165`, launched it twice through
`desktop_qa_launch_quotalis_dev` with the real SHA-256, confirmed correct
identity both times): `take_screenshot` returned `BACKGROUND_ONLY` from
BOTH `windows-exe-automation` and `helix-pilot` (two independently
implemented MCP servers hitting the identical session-level guard — this
is a categorical policy, not a per-tool quirk worth trying a third
server against). **New finding beyond prior waves**: a passive
`desktop_qa_background_control` "inspect" call on the real launched
window DOES work (no `BACKGROUND_ONLY` block on read-only inspection)
and returns real window geometry (confirmed: 630×1020 at
`(1282,100)-(1912,1120)` on this session's 1920-wide display, consistent
with a right-edge dock), but the returned control tree bottoms out at
generic unnamed `Pane` nodes for the entire `WRY_WEBVIEW`/`Chrome_WidgetWin`
content area — the real React UI's buttons/selects/ARIA labels are NOT
bridged into Win32 UIA at all in this environment, so there is no
addressable control for `desktop_qa_background_control`'s `invoke`/
`set_value` actions to target either. Practical implication for the next
session: don't plan on driving the app via named-control UIA invocation
(e.g. clicking a Settings tab or typing a URL) — if your environment has
this same limitation, real interaction requires either a working
CDP connection or restored `take_screenshot`+input capability, not a
UIA workaround. The window disappeared from `list_windows_tool` after
the first launch's screenshot attempt (kill-on-close job reclaim, same
behavior Wave 1D first observed) — relaunching produced a fresh window
each time, so this is not a one-off flake.

If your session has working `take_screenshot`/CDP/DOM-inspection
capability for a launched `QuotalisDev.exe` window, you can close
everything below.

## 1a. What's already proven in code (read these instead of re-deriving)

- `docs/validation/STRUCTURE_COORDINATE_MODEL.md` — the real two-layer
  native-window-position vs. detail-panel-CSS-position split, and why
  `structurePlacement.ts`'s resolver deliberately is NOT wired into
  native window positioning (it solves a different, currently
  hypothetical problem).
- `docs/validation/STRUCTURE_ICON_RING_SAFE_BOX.md` — the icon/ring
  clipping candidate flagged in Wave 1D is hand-computed CLOSED, not a
  real defect (≥14.5px clearance in the tightest case), with one
  disclosed unchecked case (75% minimum structure scale) worth a native
  spot-check, not a full re-investigation.
- `apps/desktop-tauri/src-tauri/src/surfaces.rs`'s `mod tests` — DPI/
  logical-to-physical conversion is closed with exact-value tests at
  1.0/1.25/1.5/2.0 scale factors (`logical_to_physical_position_scales_correctly_at_representative_dpi_factors`).
  This is a real, non-DPI-scaled screenshot check now: capture at
  whatever scale factor the native machine is actually running and
  confirm the window's on-screen position matches what these tests say
  it should be — don't re-derive the arithmetic by eye.
- `apps/desktop-tauri/src/design-system/structureConnector.ts` — the
  connector/attachment decision model (attached?/connector-required?/
  orientation/length), tested, NOT yet wired into any of the 14 forms'
  visuals (deliberately — see the file header).
- `docs/validation/STRUCTURE_VISUAL_QA_MATRIX.md` — per-form CODE READY /
  NATIVE VISUAL STATUS / FIXTURE ID / EVIDENCE PATH. Every FIXTURE ID
  column value is a real entry in `WAVE1_NATIVE_QA_MATRIX.json` (§2a).

## 0. First, reconcile

```bash
git rev-parse HEAD
git status --short
git log -15 --oneline --decorate
```

Expect `HEAD` to be at or after `8c7974cd` (Wave 1F's last commit before
its final verified Dev build). If commits exist beyond what you can see
referenced here, that is fine — proceed from the actual current state,
not from an assumption frozen in this document.

## 1. Build a verified Dev binary

```bash
node scripts/build-dev-verified.mjs
```

Must report:
- `channel=dev`
- `exe=QuotalisDev.exe`
- `app_dir_name=QuotaArc-Dev`
- `tauri_identifier=app.quotalis.desktop.dev`
- embedded `git_head` == your current `git rev-parse HEAD`
- source/copy SHA-256 equality

**Never use Personal for any of this.** Personal must remain completely
untouched — no launch, no install, no settings write, no shortcut change.

## 2. Launch it

If you have the same `windows-exe-automation` toolset this session had:

```
mcp__windows-exe-automation__desktop_qa_launch_quotalis_dev
  expected_sha256: <the source sha256 build-dev-verified.mjs just printed>
```

This is the ONLY sanctioned way to launch it — it verifies the SHA-256
and the compiled Dev-channel identity before running anything. Do not
launch `QuotalisDev.exe` directly via a shell command; that bypasses the
identity/hash verification this whole safety model depends on.

If your session's screenshot tools are not `BACKGROUND_ONLY`-gated, or
you have a CDP-capable launch path, capture real pixels. If you have
`playwright-electron` or `helix-pilot` available and they are not
similarly restricted in your session, either may also work — check their
own tool descriptions for input-capability gates before relying on them.

## 2a. Run the prepared capture harness (the fast path)

Wave 1E prepared a deterministic manifest and a capture script so you do
not have to invent capture logic or filenames from scratch. Two
independent lanes — run whichever your environment actually supports;
you do not need both to make progress:

```bash
# Lane "fixture" -- the Dev-only demo/ReelPreview.tsx panel. Needs ONLY a
# normal CDP-capable browser (any Chromium with --remote-debugging-port)
# pointed at a running `npm run dev` server -- does NOT need the hardened
# Quotalis Dev launcher at all, so try this lane FIRST if the "native"
# lane's launcher restriction (§ "Why this handoff exists") still applies
# in your session.
cd apps/desktop-tauri && npm run dev &   # serves on http://localhost:5173/ by default
node scripts/capture-native-structure-qa-matrix.mjs --lane fixture --port 9333

# Lane "native" -- the real production top-arc WebView2, via
# scripts/build-dev-verified.mjs + desktop_qa_launch_quotalis_dev (§0-2
# above), then a CDP connection on whatever port your launch path exposes.
node scripts/capture-native-structure-qa-matrix.mjs --lane native --port 9223 --pid <launched pid>
```

Each run writes PNGs to `docs/images/v9/native/structures/<lane's files,
per WAVE1_NATIVE_QA_MATRIX.json's expectedFilename>` plus one
`evidence-<lane>.json` (sha256 + physical pixel dimensions + captured
runtime text per entry — the same shape `capture-native-surface-proof.mjs`/
`capture-native-theme-matrix.mjs` already produce, so any existing
tooling that consumes those evidence files works unchanged here). Check
each capture's PNG against its manifest entry's `passCriteria` by eye (or
programmatically, e.g. diffing `runtime.text` against expected strings)
before marking anything PASS — the script proves a screenshot was taken,
not that it looks correct.

If you add or change entries, edit
`docs/validation/WAVE1_NATIVE_QA_MATRIX.json` directly (it's a plain
array under `entries`) rather than hand-writing new capture calls; the
script reads it as the single source of truth for what to capture.

## 3. Load fixture data

`apps/desktop-tauri/src/lib/structureFixtures.ts` (this session's new
module) exports deterministic, clearly-synthetic provider fixtures:

- `syntheticProviderCount(n)` — exactly `n` providers, `n` in
  `{1, 3, 6, 12, 24, 70}` per §23/§37/§41 of the prompts that drove this
  work.
- `syntheticLongProviderName()` — one provider with a long display name.
- `syntheticLongReset()` — one provider with a long reset string.
- `syntheticTwoUsageWindows()` — one provider with 2 usage windows.
- `syntheticUnavailableProvider()` — one provider with `status: "offline"`,
  null values.

These reuse the EXISTING demo-mode mechanism (`getSurfaceDemoMode`/
`setSurfaceDemoMode` in `lib/surfaceDemo.ts`, already wired through every
form's `demoMode`/`showDemoBadge` props) rather than a second fixture
store.

**Wave 1E built the live UI this section previously said did not exist**:
`apps/desktop-tauri/src/demo/ReelPreview.tsx`, reached via
`?window=demo&gen=reel` (no Dev build or Tauri IPC required at all — it
runs in a plain browser, which is also why it can never touch Personal or
any real settings/history store, see that file's own header comment and
`demo/devSafety.test.ts`). It has live `<select>`/checkbox controls for:
structure (all 14 forms), anchor/position, provider count (1/3/6/12/24/70),
provider name length, reset length/availability, quota-window count
(1/2), data state (available/loading/refreshing/unavailable), an RTL
layout-direction toggle, and Pin/Unpin — driving the REAL
`FlowSurface`/`ReelSurface`/`NotchSurface` components, not a mock. This is
the "fixture" lane in §2a's capture script. Two things it deliberately
does NOT do, disclosed rather than faked: it cannot show real Arabic
text (its `PreviewLocaleProvider` is a stub, fixed to English, no live
Tauri IPC to fetch `ar-SA.ftl` strings — the RTL toggle only proves
layout mirroring), and it has no Light/Dark control (Structures have no
distinct light-mode CSS palette today, confirmed by reading
`FlowSurface.css`).

**Wave 1F closed the gap this paragraph used to describe.** The REAL
native production window (the "native" lane) is no longer limited to the
fixed 6-provider demo-mode dataset: `apps/desktop-tauri/src/surfaces/structure-qa/StructureQaController.tsx`,
reached via `?window=structure-qa` (a Dev-only query route registered in
`App.tsx`, never linked from any menu — see that file's own doc comment
and `structure-qa/devSafety.test.ts`), drives the REAL native top-arc
window through the same full fixture matrix `ReelPreview.tsx` offers
(provider count/name/reset/windows/data-state/pinned), plus structure/
anchor/scale (via the existing real `update_surface_settings` +
`show_top_arc_surface` commands) and — unlike `ReelPreview.tsx` — REAL
language switching (this route runs inside the real `LocaleProvider`,
not the stub), so it is now the only route that can natively verify
actual Arabic string rendering, not just RTL layout mirroring. Backed by
a new Dev-only, in-memory-only IPC command
(`set_structure_qa_fixture`/`reset_structure_qa_fixture`, in
`surfaces/qa_fixture.rs`) that the backend itself refuses outside the
Dev channel — verify this by running `cargo test qa_fixture` and
confirming `dev_channel_active_reads_the_same_build_info_channel_constant_every_other_gate_uses`
passes. The old "temporarily edit `lib/surfaceDemo.ts`" workaround this
paragraph used to recommend is no longer necessary and should not be
used — it bypasses the new controller's Dev-only gate entirely.

`StageProvider.status` gained real `"error"`/`"timeout"` values this
wave too (derived from `ProviderUsageSnapshot.error`, the same field
Dashboard already reads — see `LOADING_STATE_MATRIX.md`), so the
Structure QA controller's Data state control includes both.

## 4. The 14 structure IDs (exact registry)

From `apps/desktop-tauri/src/design-system/flowSurface.ts`'s
`FLOW_SURFACE_FORM_CATALOG`:

**Notch family** (`surfaces/notch/`): `crescent`, `pebble`, `fan`, `seam`,
`ribbon`, `cradle`, `deck`, `satellite` (8 forms)
**FlowSurface family** (`surfaces/flow-surface/`): `flowline`, `horizon`,
`petal`, `orbital`, `lens` (5 forms)
**Reel** (`surfaces/reel/`): `reel` (1 form)

All 14 render through the ONE shared native Flow Surface window
(`TopArc.tsx`) — there is no second native window to find. Switch forms
via Settings → Appearance/Surfaces (the structure picker) or by editing
`flowSettings.form` state directly if driving the app programmatically.

## 5. What to capture, per form

For **every one of the 14 forms**, minimum:
- collapsed (compact) state
- expanded state
- pinned state (where the form supports it — all 14 do via the shared
  `StructurePinButton`)
- with `syntheticLongProviderName()` and `syntheticLongReset()` fixtures
  active, to prove no clipping in the actual rendered fonts (this
  session's clipping fixes — content-height floor for FlowSurface,
  truncation for Reel/Notch — are jsdom-tested but never pixel-verified)
- at least one provider-count fixture beyond the default 6 (try 24 and
  70 — Reel's known DOM-node-count-scales-with-N gap, see
  `STRUCTURE_VISUAL_QA_MATRIX.md`, is worth a specific look at n=70)

Per **each render-path family** (Flow/Reel/Notch), minimum 2 full
iteration cycles (screenshot → critique → fix → re-screenshot) — 3 for
any form a screenshot reveals as visibly broken.

## 6. Evidence filenames

**`WAVE1_NATIVE_QA_MATRIX.json` is authoritative for exact filenames** —
use `expectedFilename` per entry (relative to
`docs/images/v9/native/structures/`) when running via §2a's script; it
writes there automatically. The list below is Wave 1D's original,
broader checklist, kept for cases the manifest doesn't yet have a
dedicated entry for (extend the manifest with a new entry rather than
inventing an ad-hoc filename, so `STRUCTURE_VISUAL_QA_MATRIX.md`'s
FIXTURE ID/EVIDENCE PATH columns stay accurate). Store any of these
under `docs/images/structures/final/`:

```
<form-id>-collapsed.png
<form-id>-expanded.png
<form-id>-pinned.png
<form-id>-long-content.png        (long name + long reset fixture)
<form-id>-provider-count-70.png   (where meaningfully different from the default)
```

Plus:
```
STRUCTURE_BEFORE_AFTER.png
theme-composition-mixed-a.png     (Obsidian + Dark + Ceramic Pearl floating + Lunar Silver logo + Original identity + Provider Accent tray + Galaxy Rise background)
theme-composition-mixed-b.png     (Ceramic Pearl + Dark + Smoked Silver floating — app MUST stay Dark, not flip Light)
theme-composition-light.png
theme-composition-rtl.png
loading-initial.png
loading-refreshing-cached.png
loading-structure-refreshing.png
```

## 7. Theme composition native cases

The UI to drive these already exists and is localized
(`AppearanceCompositionSummary.tsx` in Settings → Appearance,
`ApplyThemeSheet.tsx` opened from ThemeGallery's "Apply theme" on global
scope). Settings → Appearance → Language switches English/Arabic;
Settings → Appearance's own Light/Dark/System control
(`ThemeAutoOption`/`ThemeLightOption`/`ThemeDarkOption`, already
independent of Structure Theme — see `THEME_COMPOSITION_AUDIT.md`) is a
plain `Select`, not a new control this wave built.

Cases to prove natively (jsdom already proves these architecturally, not
visually):
1. **Follow Global live update**: set Floating Structures/Logo/Tray/
   Background to "Follow Main Application" via
   `AppearanceCompositionSummary`'s per-scope toggle, change the Main
   Application theme, confirm resolved values update without restart.
   Then set one scope to Override, change the main theme again, confirm
   that scope stays fixed.
2. **Mixed composition A/B** (exact values above) — apply via
   `ApplyThemeSheet`, close the app fully, relaunch, confirm every source
   AND resolved value survived exactly.
3. **Cross-window propagation**: with the main window and a floating
   structure both open, change a scope from either window, confirm both
   update live (reuses `quotalis:settings-updated`, unchanged this wave —
   should already work, needs a real two-window check).
4. **RTL/Light of the Apply sheet and summary**: no clipped text, no
   English fallback, previews still legible, toggle/button alignment
   correct for RTL.

## 8. Loading UX native cases

`design-system/QuotalisLoadingStates.tsx` exists and is localized but is
**not wired into any production surface except Floating Structures'
first-load state** (`initialLoading` prop, threaded through all 14 forms,
wired from `TopArc.tsx` via `useStageRuntime`). To see it: launch Dev,
watch the structure during the very first provider fetch before any
cache exists (may need to clear `%APPDATA%\QuotaArc-Dev`'s cached
provider data first — do NOT touch the Personal equivalent). Capture
`loading-structure-refreshing.png` during an actual background refresh
with cached data still visible (§6's "never blank the card" — currently
correct at the data-hook level per `LOADING_STATE_MATRIX.md`, not yet
re-verified natively this wave).

Dashboard/provider/reset/Analytics/connection-action surfaces still use
their own pre-existing (not `QuotalisAsyncState`-based) loading
treatment — wiring those is real, unstarted follow-up work, not
something to native-QA as if it were this component.

## 9. Edge placement / DPI

Wave 1E traced the REAL native edge-placement/DPI pipeline (it already
existed, tested, and correct — see `docs/validation/STRUCTURE_COORDINATE_MODEL.md`)
rather than wiring in a parallel system. The two coordinate layers:

- **Layer A — native window position on the monitor**: Rust-owned,
  `apps/desktop-tauri/src-tauri/src/surfaces.rs`
  (`anchored_top_arc_position`, `clamp_top_arc_position_to_work_area`,
  `resolve_flow_surface_dock`, `logical_to_physical_position`). Already
  unit-tested for edges/corners/negative monitor origins/DPI scale
  factors (1.0/1.25/1.5/2.0, exact expected values). Native-testing this
  layer means: set a real Windows display-scale factor, dock a Structure
  to each of the 9 anchors, and confirm the on-screen physical pixel
  position matches `logical_to_physical_position`'s tested arithmetic —
  not eyeballing "does it look roughly right."
- **Layer B — detail-panel CSS position inside that one window**:
  per-form-tuned CSS, not a shared resolver. This is what a screenshot
  actually shows when you look at "is the content correctly placed
  inside the structure" — it is a different concern from Layer A and
  should be evaluated separately (a defect here is a CSS bug in that
  specific form's `.css` file, not a coordinate-model bug).
- `design-system/structurePlacement.ts`'s `resolveStructurePlacement()`
  is real and unit-tested (13 cases) but is DELIBERATELY not wired into
  either layer — it solves a still-hypothetical third problem (auto-
  flipping tooltip/popover attachment against an anchor point) that no
  current production caller needs. Do not wire it in "to close this
  section" without confirming a real defect exists that only it would
  fix — see the coordinate-model doc's own reasoning.

DPI: no session in Wave 1 has been able to test a real scale factor
against actual pixels yet — the arithmetic is now closed and tested in
isolation (`surfaces.rs`), but never cross-checked against a real
Windows display-scale setting and a real screenshot. Record the actual
tested scale (100%/125%/150%/200%) or `ENVIRONMENT_BLOCKED` with the
specific reason if the native session's environment also cannot switch
DPI. `NATIVE-FORM-ANCHOR-03` in `WAVE1_NATIVE_QA_MATRIX.json` is the
prepared entry for this.

## 10. Accessible movement

Keyboard nudge is real and wired: Tab to the structure's drag-grip button
(class `.flow-surface__drag` / `.reel-drag` / `.notch-grip` depending on
form), arrow keys move one step through the existing 9-position anchor
grid (`design-system/structureAnchorNudge.ts`, unit-tested), Home resets
to top-center via the pre-existing `resetQuotaIslandPosition()` command.
Native-verify: the button is actually reachable by Tab, arrow keys
visibly move the window, Home visibly resets it, and none of this
requires pointer drag.

## 11. Icon/ring safe box

Wave 1E hand-computed this: `.flow-surface__core`'s `overflow: hidden`
(`FlowSurface.css`) wraps the brand mark's decorative halo (`box-shadow`
glow on `.flow-surface__brand`), and the clearance in the tightest case
is ≥14.5px — **closed as not a real defect**, see
`docs/validation/STRUCTURE_ICON_RING_SAFE_BOX.md` for the full
calculation and a forward safe-box contract for future icon/ring
additions. One disclosed gap that IS still worth a quick native spot-
check: the 75% minimum structure-scale case was not hand-verified (only
100% was). If a native screenshot at 75% scale shows any clipping, that
is a real finding this wave's math missed, not a regression.

## 12. Structure lifecycle/performance

Not measured this wave (needs a live window). Stress per §45 of the wave
that produced this document: hover open/close ×20, pin/unpin ×20, theme-
scope switching, provider switching, structure switching — watch
`ResizeObserver`/listener/timer counts for monotonic growth via DevTools
or the CDP technique if a working connection can be established.

## 13. Pass/fail criteria

Mark a form/case PASS only with an actual saved screenshot or equivalent
captured evidence reviewed against the specific claim (no clipping, no
duplicate panel, correct Light/Dark rendering, etc.) — not from reading
this document or the jsdom test names. Update
`docs/validation/STRUCTURE_VISUAL_QA_MATRIX.md`'s "Native evidence"
column with the actual file path once captured; do not just flip a
column to PASS with nothing to point at.

## 14. When you're done

Update, with real evidence, not just verdicts:
- `docs/validation/STRUCTURE_VISUAL_QA_MATRIX.md`
- `docs/validation/THEME_COMPOSITION_AUDIT.md`
- `docs/validation/LOADING_STATE_MATRIX.md`
- `docs/validation/CLAUDE_EXECUTION_SEQUENCE.md` — ONLY if Wave 1
  genuinely passes in full (every dimension, not just native QA).

Then, and only then, mark Wave 1 PASS and hand off to Wave 2 (Tray
Studio + Notifications). Do not start Wave 2 work in the same pass that
closes Wave 1's native QA — confirm closure first.
