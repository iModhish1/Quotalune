# Claude native control QA + RTL validation — 2026-09-10

Historical evidence note (2026-09-27): the 12 screenshots from this
Quotalis-era pass were withdrawn from the current public image tree. They
show the former brand, and the local-activity capture includes observed
owner readings. Audit copies are retained only in ignored
`.local/historical-claude-continuation-2026-09-27/`. The observations below
describe the earlier test and are not current Quotalune release proof.

Wave C §3-5. Real native evidence against a freshly rebuilt,
`dev-preflight`-verified `QuotalisDev.exe` (rebuilt twice this pass —
once after the controls migration, again after the theme-propagation fix
below), driven via the CDP harness (`.local/proof/claude-audit/
60-control-qa.mjs` and inline follow-up scripts). Screenshots under
the local historical audit directory noted above.

## Control states (QuotalisSelect, Reset Display's Preset field)

| State | Evidence | Result |
|---|---|---|
| Closed | `CLAUDE_CONTROLS_closed.png` | Trigger shows the current value, page renders correctly |
| Open | `CLAUDE_CONTROLS_open.png` | Panel opens anchored under the trigger, checkmark on the selected option, clean contrast |
| Keyboard focus | `CLAUDE_CONTROLS_keyboard_focus.png` | Two real `ArrowDown` `KeyboardEvent`s dispatched at the panel; focus-highlight box moved to "Date & Time" (2nd item) while the checkmark correctly stayed on the actually-selected "Custom" — focus and selection are visually distinct, not conflated |
| Selected → closed | `CLAUDE_CONTROLS_selected_closed.png` | Real `Enter` keypress chose the focused option; trigger text updated to "Date & Time", panel closed, and the live English+Arabic preview below it updated to match — proves the control's own selection drives real downstream UI, not just its own label |
| Disabled | scanned via `document.querySelectorAll('button.quotalis-select[disabled]')` on this tab — 0 present (Reset Display's Preset field has no disabled variant); disabled-state rendering for other fields (e.g. Fill Direction when Content="value") was already visually confirmed in this session's control-migration screenshots and covered by `LimitPresentationEditor.test.tsx`'s `toBeDisabled()`/`toBeEnabled()` assertions | Not independently re-screenshotted this pass — not a new claim, already tested |
| Long list | `CLAUDE_CONTROLS_open.png` shows a 6-option list rendering cleanly with no clipping or overflow | OK |
| Searchable (9+ options) | Not exercised natively this pass — covered by `QuotalisSelect.tsx`'s own `searchable={options.length>9}` logic and existing unit tests; no control in this session's migrated set crosses that threshold | Not re-verified natively |

## Accessibility (keyboard-only)

Driven via real `KeyboardEvent`s dispatched at the actual DOM (not
simulated at the React level):

- **ArrowDown** (×2): moves `data-active` correctly, one item at a time, wrapping logic untested this pass (not needed — didn't reach either end)
- **Enter**: commits the focused option, closes the panel, moves focus back to the trigger (per `QuotalisSelect.tsx`'s `close(true)` behavior, already covered by its own unit tests)
- **ARIA**: trigger carries `aria-label`/`aria-haspopup="listbox"`/`aria-expanded`; panel carries `role="listbox"`, each option `role="option"` with `aria-selected`; confirmed present in the rendered DOM via the same `evaluate()` calls used to locate elements for this test (not merely assumed from source)
- No keyboard trap observed: after Enter, focus is restorable to the trigger button (existing `QuotalisSelect` behavior, exercised here, not newly built)

Escape and Home/End were not separately re-exercised natively this pass
(already covered by `QuotalisSelect`'s own existing unit test suite);
this pass's native contribution is proving the **migrated call sites**
(Reset Display, and by extension the other 12 migrated files sharing the
same `Select`/`QuotalisSelect` component) genuinely render and behave
like the primitive's own tests say it should — not re-testing the
primitive's internals from scratch.

## RTL

Switched `uiLanguage` to Arabic live (via `set_ui_language`, the real
command) with no restart:

- `CLAUDE_RTL.png`: full settings page correctly mirrors — sidebar/nav
  moved to the right, headings/body text right-aligned, `dir="ltr"` on
  the isolated English/timestamp preview line inside an otherwise-RTL
  page (bidi-isolated as designed, matching the existing
  `ResetDisplaySection.test.tsx` bidi assertions), Latin numerals
  preserved per the `numberingSystem: "latn"` setting (not a bug —
  consistent with that explicit setting)
- `CLAUDE_RTL_control_open.png`: opened the Preset `QuotalisSelect` while
  in RTL — panel correctly anchors on the **right** side of its trigger
  (mirrored from LTR's left-anchoring), the selected option's checkmark
  correctly renders on the **left** of its label (mirrored from LTR's
  right-side checkmark) — confirmed via `getComputedStyle(document.
  documentElement).direction === "rtl"` read at the same moment, not
  inferred from the screenshot alone

This is genuine anchor/checkmark mirroring, not just translated strings
— the control's RTL support was already built correctly in an earlier
wave (`QuotalisSelect.tsx`'s `style.direction==="rtl"` positioning
logic); this pass is native proof it actually renders that way for a
freshly migrated call site, not source-code inspection.

## Real defect found and fixed during this pass

While capturing a light-theme screenshot for this section, `theme:
"light"` was written and persisted correctly per `get_settings_snapshot`,
but the window never visually re-rendered light — a genuine live-
propagation bug, not a controls bug. Root-caused, fixed, and verified;
full detail and native before/after proof in the `App.tsx` fix commit
(`fix: live-propagate theme/logo across windows on any settings
change`) and `CLAUDE_LIGHT_THEME.png` (captured after the fix, showing a
correctly light-themed window).

## Real finding NOT fixed this pass (flagged for Wave D)

`CLAUDE_LIGHT_THEME.png` shows the light theme itself has a genuine
**contrast defect**: several sidebar nav labels ("Overview", "Analytics",
"Profiles", "Collections", etc.) and the top-left page title render in a
very light gray that is difficult to read against the light background.
This is a light-theme color-token issue, not a controls-migration
regression (the same elements are fully legible in dark theme, per every
other screenshot in this document) — recorded here as a concrete,
evidence-backed defect for Wave D's visual-quality pass rather than
silently noted or fixed as a rushed one-off color tweak outside that
pass's proper design-first process.

## Verdict

**CONTROLS: PASS** (closed/open/keyboard-focus/selected/RTL states
natively proven for a real migrated call site; disabled/searchable
states not independently re-screenshotted this pass but already
covered by existing unit tests, not a new unverified claim).
**RTL: PASS** (live language switch, correct mirroring of both page
layout and control anchoring/checkmark position, proven via computed
style + screenshot, not assumed).
**ACCESSIBILITY (controls scope only): PASS** for the states exercised
(keyboard nav, ARIA roles/attributes, no trap); Escape/Home/End/
typeahead not independently re-exercised this pass.
