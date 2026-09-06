# Theme runtime recovery — 2026-09-06

The full product redesign goal remains active. This checkpoint is not a native
or product acceptance claim.

## Proven current change

- FlowSurface, ReelSurface and NotchSurface used three independent palettes.
  A new rendered-SVG regression failed for all three, then passed after routing
  provider colors through `providerColor(theme, id)` (including Codex/OpenAI alias).
- Flow materials now use catalog tokens. Notch and Reel body/details use inherited
  material variables; Notch detail meters receive the same resolved provider color.
- 480 frontend tests passed (89 files); production TypeScript/Vite build passed.
- Actual component browser capture inspected:
  `output/playwright/satellite-catalog-energy.png`. Synthetic data, not native proof.
- Previous window repair: 42 shell tests passed, including tab-only updates that
  must not reposition normal/maximized/fullscreen windows.

## Next coupled packet (do not substitute decorative-only theme cards)

Update: implemented Smoked Silver, Tidal Glass and Ember Alloy as token-only
materials beside the default. Rust validation accepts those exact slugs; the
frontend resolves surface > profile > global > default. ThemeGallery now reads
settings, listens for updates, persists explicit global selection and shows four
actual compact Satellite component previews with inert controls. Failed-save
test preserves the earlier active selection. Focused Rust normalization test
failed before the fix and passed afterwards. TypeScript/Vite build passed.
Native restart/live refresh and browser gallery visual inspection remain pending;
the list below records the original coupled defects, not the updated completion state.

Structure option update: `StructurePreview` now uses actual compact FlowSurface
renderers with catalog colors; SurfacesTab uses it for the selected preview and
all 13 choices, isolated from selection buttons. 483 frontend tests passed.
Browser proof route `?window=demo&gen=materials` renders these exact previews;
inspected `output/playwright/material-structures.png`. This exposes remaining
Petal/Orbital compact content clipping and very small Horizon presentation in
uniform cards. Fix the underlying geometry/preview fit; do not claim all layouts
passed. The browser reports a locale bootstrap error outside Tauri; not native proof.

Inset follow-up: measured five Flow-family core rectangles and gauges; rectangular
bounds were already inside their hosts. The visual issue was proximity to rounded
clipping contours. Petal now uses two intentional rows and Orbital reserves bottom
inset for its provider row without increasing the external envelope. Demo labels
move away from curved corners. Flow body gradients now consume the material tokens
instead of a leftover hard-coded silver gradient. Inspected before/after browser
captures; final artifact `output/playwright/material-insets-final.png`.
`scripts/check-material-bounds.cjs` passes rectangular checks, but does not prove
rounded-path clearance at all scales/anchors. Horizon preview readability and full
placement/scale matrix remain open, as does the full product goal.

Usage-window packet: StageProvider now carries independently resolved primary
and secondary windows (labels, values, arc fraction, reset description and reset
timestamp). Known 300/10080-minute windows get 5-hour/weekly names; otherwise
backend labels or neutral primary/secondary names are retained. The selected
metric remains independent. Added failing-then-passing session73/weekly7 test
with selected weekly metric. NotchDetails renders a bounded scrollable list;
legacy fixtures use "Selected limit", not a fabricated "Current session" label.
Per-provider window visibility settings, tertiary/additional limits, forecast/
banked resets, other renderers and native/browser window-detail proof remain open.

Follow-up: Reel and Flow details now consume UsageWindowList too. Rendered
integration checks for Flowline/Reel/Satellite assert session73 and weekly7 meters
and the weekly reset label; Flowline/Reel failed before integration, all three
pass afterwards. Production build passed. Native/browser small-detail height
and horizontal layout verification still required; do not equate DOM tests with
visual acceptance. Per-provider window selection remains outstanding.

Native refresh: built `dev-channel,tauri/custom-protocol`, replaced only verified
Dev PID31260, launched PID70176 at 2026-09-06 04:31 local from target/debug/QuotaArc.exe
with proof Settings Themes. Native UIA now confirms four material Apply controls,
all Settings tabs and native Maximize. Image capture remains black; clicking
Maximize still fails GetCursorPos Access denied 0x80070005. No bypass attempted.
Personal untouched. The native tree also exposes excessive unavailable-provider
rows in Usage Display; filtering/search remains a UX item.

Found and fixed stale callback state in UsageDisplaySection: setOverride omitted
overrides from dependencies, losing the first provider override on the next edit.
Added failing-then-passing sequential Codex/Claude regression. PID70176 predates
this last frontend repair; next native refresh must include it.

Usage Display usability: default rows now include snapshot-present providers and
saved overrides only. Search spans the full catalog; Show all exposes everything.
Filtering never edits overrides. Tests cover search access to unavailable Gemini
and retained customized offline providers, alongside sequential override saving.
Responsive toolbar and wrapping rows replace the unbounded undifferentiated list.
Native PID70176 predates this UI improvement. All-page visual acceptance remains open.

1. `themeCatalog.ts` still exports one theme; archived 14 remain archived.
2. `themeResolution.ts` ignores all settings and returns the default.
3. Rust `canonical_catalog_theme` accepts only that default.
4. `ThemeGallery.tsx` is static and does not persist selection.
5. Structure option silhouettes are not real colored component previews.

Re-enable these as one coherent selection/persistence/runtime packet with newly
designed token-only materials. Keep structures, modes and placements independent.
Test invalid fallback, global/profile/surface precedence, selection failure,
live event refresh, and unchanged geometry across palette changes. Use actual
component previews, not a mock image that may diverge from the live renderer.

The broader goal still includes every page, all placement adaptations, weekly/
session presentation, notification configuration, native verification and resource
and installer readiness. No credentials, Personal installation or notifications
were changed in this checkpoint.

## 2026-09-06 04:45 — explicit Settings maximize / restore

Added a native maximize/restore action beside fullscreen in Settings. Window
resize events synchronize both labels, including changes made through Windows
caption controls. Native errors remain visible; fullscreen and maximize remain
distinct. Test first failed for the absent action, then passed after implementation.
Frontend: 92 files / 491 tests passed; TypeScript/Vite build passed. Dev native
build with dev-channel,tauri/custom-protocol passed. Exact owned old Dev PID70176
was stopped and replaced by PID65712 at 04:45:39, opening Settings Themes.
Native mouse resize/maximize acceptance remains UNVERIFIED: previous official
input attempt failed with Access denied. This new button is not evidence that
edge dragging is fixed. No Personal install or account changes.

## 2026-09-06 04:48 — complete usage-window transport

Stage conversion previously discarded model-specific, tertiary and extra rate
windows. It now preserves these with their original titles and reset information;
extra identities are namespaced to avoid colliding with primary/secondary IDs.
All existing themed details consume the shared window list, which remains height
bounded rather than growing the native overlay with every limit.
Regression tests reproduced dropped windows and Infinity being clamped into
100%/0%; non-finite measurements now resolve to unavailable. Five stage-window
tests plus twelve semantics tests passed; TypeScript/Vite build passed.
Per-provider selection/persistence of which detail windows to show remains OPEN.
Native PID65712 predates this transport change; no native visual proof claimed.

## 2026-09-06 04:55 — persisted per-provider detail-limit selection

Added provider_detail_windows to Settings/RawSettings/bridge (missing maps default
empty), with validated set_provider_detail_window command. Each command updates
only its provider and retains other usage/display settings. All clears the entry;
unknown providers/selections are rejected, provider aliases canonicalized.
Snapshot-to-stage passes the choice into the shared runtime. Session/weekly/both
filter identified cadences; all preserves model/extra limits. Missing selected
limits explicitly say unavailable, never silently substitute the main metric.
Usage Settings has a separate Detail limits select per provider and a lazy real
UsageWindowList preview. Save failure restores previous selection. Customized
offline providers remain searchable/visible. No new animation or polling loop.
Validation: 498 frontend tests /92 files; TypeScript/Vite; focused Rust validation,
alias, reset, isolation and serialization round-trip test all passed. Native build
and relaunch in progress at this checkpoint; native mouse acceptance still open.

04:57 update: native custom-protocol Dev build passed and relaunched with Themes
open. Added invalid-choice snapshot fallback test; affected 14 tests passed and
frontend production build passed again. The last full run was 498 tests before
that additional fallback test. No native interaction PASS claimed.

## 2026-09-06 05:02 — notification controls visual pass

Separated provider/window overrides from sound controls into responsive cards.
Early/critical inputs have visible labels and inherited/effective used/remaining
equivalents. Sound action rows wrap; long filenames truncate safely. Existing 16
GeneralTab tests passed; frontend production build passed. No stored notification
settings changed; no notification or sound sent.
Browser gen=notifications mounts actual production controls with local fixture
state. Inspected 1280px and 420px screenshots and fixed inherited narrow inputs
and extra gaps. Artifacts output/playwright/notification-controls.png and
notification-controls-small-final.png. Browser console: favicon.ico 404.
Owned proof browser closed. Native PID10888 predates this visual pass. Full native
page proof and expanded notification event customization remain open.

## 2026-09-06 05:07 — Reel hidden material + horizontal detail fit

Removed fixed gray reveal gradient; hidden Reel now consumes selected material
tokens. Horizontal details use bounded flex space for scrollable window rows,
with denser header/padding so the first full limit is readable without expanding
the native envelope. Browser script scripts/check-reel-material-fit.cjs verifies
four distinct computed reveal gradients and child bounds across all four themes.
Inspected output/playwright/reel-material-details.png; additional limits scroll.
Two Reel interaction tests passed. Frontend build passed before final CSS spacing
tune, which was exercised in the browser. Native PID10888 predates this packet.
Owned browser closed. Not an all-form/all-placement or native visual PASS.

## 2026-09-06 05:10 — material assignment UI

Gallery now exposes global/current-profile/six-surface scopes, resolved provenance,
and clearing a profile/surface override to resume inheritance. Uses the existing
validated set_catalog_theme command and common precedence resolver. Apply failure
retains current selection. Test first failed on missing assignment control, then
passed for surface apply + clear + fallback to profile without touching global.
500 frontend tests /92 files passed; TypeScript/Vite build passed. Native Dev
rebuild in progress to include this and prior notification/Reel visual changes.
All native interaction, full page redesign, motion and placement gates remain open.
