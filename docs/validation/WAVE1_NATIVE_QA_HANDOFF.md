# Wave 1 Native QA Handoff

This document tells a session that HAS working native pixel-screenshot
capability everything it needs to close Wave 1. It does not require
reading the chat history that produced it.

## Why this handoff exists

This session (Wave 1D) completed every code-buildable Wave 1 requirement
it could verify without native pixel capture: theme composition (data
model, migration, Apply sheet, real previews, atomicity, Recommended
semantics, Light/Dark independence), Floating Structures' loading-state
distinction, an edge-placement resolver, accessible keyboard movement,
structure state-machine tests, and provider-count fixtures. All of it is
real, automated, and gate-clean (jsdom/vitest + cargo test).

It could NOT perform any native visual verification. The exact,
confirmed reason: `mcp__windows-exe-automation__take_screenshot` and
`take_control_screenshot` both return `BACKGROUND_ONLY` in this session
(foreground-input-capable tools are disabled by this session's own
policy), and the CDP-based screenshot technique this project used
earlier in this same overall effort (`.local/proof/claude-audit/`,
`cdp-lib.mjs` connecting to `127.0.0.1:9333`) requires WebView2's
`--remote-debugging-port` flag, which the hardened, args-free
`desktop_qa_launch_quotalis_dev` launcher does not accept by design (it
explicitly documents "No caller path, arguments, working directory...
accepted"). A background UIA `desktop_qa_background_control` call also
failed and the launched process was reclaimed by its kill-on-close job.
This was confirmed by actually launching `QuotalisDev.exe` through the
sanctioned tool and observing the correct verified Dev identity before
hitting the screenshot wall — not assumed from documentation alone.

If your session has working `take_screenshot`/CDP/DOM-inspection
capability for a launched `QuotalisDev.exe` window, you can close
everything below.

## 0. First, reconcile

```bash
git rev-parse HEAD
git status --short
git log -15 --oneline --decorate
```

Expect `HEAD` to be at or after `2c118905` (the last commit this session
made). If commits exist beyond what you can see referenced here, that is
fine — proceed from the actual current state, not from an assumption
frozen in this document.

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
store. **Not built this session**: a live in-app UI to swap these in at
runtime without a code change. The fastest path for a native session:
temporarily edit `lib/surfaceDemo.ts`'s `SURFACE_DEMO_PROVIDERS` export
to call one of the `structureFixtures.ts` functions, rebuild Dev, capture,
revert. This is DEV-only source code, never touches Personal, and is
trivial to revert before any Dev→Personal promotion (which this document
is explicitly not asking for).

A known, disclosed limitation while doing this: `StageProvider.status`
has no distinct "error" value (only `ok`/`attention`/`offline`) — a
Structure genuinely cannot represent "the last fetch errored" separately
from "no data" today. If the owner wants that distinction, it needs a
real product decision (a new status value threaded through
`toStageProviders()`), not something to fake in a fixture.

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

Store under `docs/images/structures/final/`:

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

`design-system/structurePlacement.ts`'s `resolveStructurePlacement()` is
fully unit-tested (13 cases: all 4 edges, all 4 corners, small work area,
RTL tie-break, safe inset, anchor gap) but **not wired into any native
window-positioning call** — no production caller passes it real monitor
work-area bounds yet. Before native-testing edge placement, either (a)
wire it into the actual Structure positioning path (Flow Surface's window
move/anchor-resolution code) and re-verify with unit tests unaffected,
or (b) native-test the CURRENT ad-hoc behavior and treat any defects
found as new findings, not regressions of something this wave claimed to
fix (it explicitly did not wire this in — see
`STRUCTURE_VISUAL_QA_MATRIX.md`'s "Edge" column: NOT NATIVE-TESTED
everywhere).

DPI: this session could not test any scale factor. Record the actual
tested scale (100%/125%/150%) or `ENVIRONMENT_BLOCKED` with the specific
reason if the native session's environment also cannot switch DPI.

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

One candidate spot flagged, not confirmed as a real defect and not fixed
blind: `.flow-surface__core`'s `overflow: hidden`
(`FlowSurface.css`) wraps the brand mark's decorative halo
(`box-shadow` glow on `.flow-surface__brand`). If a native screenshot
shows the halo visibly clipped at the core's edge, that is the fix
target; if not, this can be closed as a non-issue.

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
