# Claude controls inventory — 2026-09-10

Real grep-based inventory of every dropdown/select/combobox/multiselect
implementation in the frontend, before any redesign work — per the
request's own explicit ordering ("do not keep three implementations of
the same control").

## Finding: a shared control system already exists, adoption is the gap

`src/components/analytics/QuotalisSelect.tsx` and
`QuotalisMultiSelect.tsx` were already built in an earlier wave ("feat:
add accessible themed analytics pickers"). Inspected directly rather than
assumed working:

| Requirement | Status |
|---|---|
| Arrow Up/Down, Home/End | ✅ (`key` handler, `["ArrowDown","ArrowUp","Home","End"]`) |
| Escape | ✅ (`close(true)`) |
| Typeahead/search | ✅ (`searchable` prop, `role="combobox"` input) |
| Focus/ARIA | ✅ `aria-haspopup`, `aria-expanded`, `aria-controls`, `role="listbox"`/`"option"`, `aria-selected`, `aria-activedescendant` |
| RTL | ✅ (`style.direction==="rtl"` flips panel positioning) |
| Multi-select (checkbox, count) | ✅ (`multiple` prop, ✓/□ markers, `${label} · ${count}`) |
| Provider icon/grouping | ✅ (`ProviderIcon`, `option.group`) |
| Theme integration | Uses `quotalis-select`/`quotalis-select-panel` CSS classes (not independently re-verified against Structure Theme tokens this pass) |

**This is not a "build a Select system" gap.** It's an **adoption** gap:
only 6 files import `QuotalisSelect`, while raw native `<select>` still
appears in 20 files.

## Raw `<select>` usage — real count, classified

Excluding `src/demo/*` (internal DEV-only proof/lab tooling, not
production user-facing surfaces — `CollectionsStudio.tsx`,
`MaterialProof.tsx`, `NotificationProof.tsx`, `ProviderWorkspaceProof.tsx`,
`ReelPreview.tsx`, `SurfaceGalleryProof.tsx`, `UsageSpendProof.tsx`):

| File | Raw `<select>` count | Surface |
|---|---:|---|
| `demoMode/DemoSettingsSection.tsx` | 1 | Demo Mode settings (user-facing) |
| `surfaces/dashboard/analytics/QuotaInsights.tsx` | 1 | Analytics (user-facing) |
| `surfaces/settings/providers/sections/MenuBarMetricSection.tsx` | 1 | Settings → Menu Bar |
| `surfaces/settings/providers/sections/RegionSection.tsx` | 1 | Settings → Provider Display |
| `surfaces/settings/tabs/LimitPresentationEditor.tsx` | 2 | Settings → Provider Display |
| `surfaces/settings/tabs/ProfilesTab.tsx` | 2 | Settings → Profiles |
| `surfaces/settings/tabs/ProviderIdentityGallery.tsx` | 4 | Settings → Provider Display |
| `surfaces/settings/tabs/ResetDisplaySection.tsx` | 3 | Settings → Reset Display |

**8 production files, 15 raw `<select>` elements** remain unmigrated to
the existing `QuotalisSelect`. None of these were changed this pass —
migrating each requires checking its specific data shape (some use
`disabled`, some are per-provider with dynamic `aria-label`s, some are
inside dense multi-field rows) individually rather than a single
mechanical find-replace, which is real, bounded, but not-yet-started work.

## Other control families (not separately audited this pass)

- **Popover/menu**: `CodexAccountsMenu.tsx`, `MenuCard.tsx`,
  `MenuCardDetails.tsx`, `MenuSurface.tsx` — not inspected for
  duplication against a `QuotalisPopover`/`QuotalisMenu` primitive (no
  such primitive currently exists in the codebase; only `QuotalisSelect`/
  `QuotalisMultiSelect` do).
- **Column picker** (owner section 20/26 in prior requests): not located
  or audited this pass — the exact "Columns ▾" the request references
  was not found by this pass's searches; may be inside a table component
  not yet inventoried.
- **Tooltip**: ECharts' own tooltip system was previously audited
  (`docs/validation/ANALYTICS_V3_VALIDATION.md` from an earlier wave);
  not re-verified this pass for a unified non-chart `QuotalisTooltip`.

## Resolution — 2026-09-10, this pass

All 8 files migrated to the shared `Select` (`FormControls.tsx` wrapping
`QuotalisSelect`), not merely re-inventoried:

| File | Selects migrated |
|---|---:|
| `surfaces/settings/tabs/ResetDisplaySection.tsx` | 9 (Preset, Timezone mode, Regional Format, Clock Format, Meridiem, Month, Weekday, Year, Countdown Detail — global editor + per-surface override editor) |
| `demoMode/DemoSettingsSection.tsx` | 1 (Scenario) |
| `surfaces/dashboard/analytics/QuotaInsights.tsx` | 1 (History series) |
| `surfaces/settings/providers/sections/MenuBarMetricSection.tsx` | 1 |
| `surfaces/settings/providers/sections/RegionSection.tsx` | 1 |
| `surfaces/settings/tabs/LimitPresentationEditor.tsx` | 2 (Content, Fill direction — shared by the global editor and `ProviderIdentityGallery`'s preview controls) |
| `surfaces/settings/tabs/ProfilesTab.tsx` | 2 (Theme, Structure Theme) |
| `surfaces/settings/tabs/ProviderIdentityGallery.tsx` | 4 (Preview shape, Indicator content, Fill direction, Preview state) |

A repo-wide re-scan after these 8 files turned up **5 more production
files the original inventory's search missed**
(`surfaces/settings/tabs/SurfacesTab.tsx`,
`surfaces/settings/tabs/ThemeGallery.tsx` (2),
`surfaces/settings/tabs/UsageDisplaySection.tsx`,
`surfaces/settings/tabs/UsageSpendTab.tsx`,
`surfaces/settings/WorkspacePreferencesControl.tsx`) — 6 further raw
`<select>` elements. All 6 are now migrated too (same `Select`/
`QuotalisSelect` pattern; each paired test file updated the same way);
the original inventory undercounted rather than the codebase changing
between passes. A final repo-wide `grep -rln "<select" --include="*.tsx"
. | grep -v "\.test\.tsx$" | grep -v "^./demo/"` after this second sweep
returns **no matches** — genuinely zero raw `<select>` elements remain
in production code. Each migration's paired test file was
updated to drive the real `QuotalisSelect` interaction (open the trigger
via its accessible name, click the target `role="option"`) instead of
`fireEvent.change` against a DOM node that no longer exists; two test
files (`LimitPresentationEditor.test.tsx`, `ProfilesTab.test.tsx`) were
missing a `useOptionalLocale` mock that `QuotalisSelect` calls internally
and would otherwise throw — added.

Verified after each file and again at the end: `tsc --noEmit` clean;
full frontend suite 173 files / 1048 tests passing; `cargo test
--workspace` 1650 passed; `cargo clippy --workspace --all-targets` and
`cargo fmt --check` both clean.

**Column picker** (owner section 20/26, "not located" in the original
pass): found on closer inspection — it's the "Columns" toolbar control in
`AnalyticsTable` (`components/analytics/AnalyticsPrimitives.tsx`), and it
**already uses `QuotalisMultiSelect`**, not a raw `<select>`. No
migration was needed; the original inventory pass's search terms simply
didn't match its implementation.

**Popover/menu family** (`MenuSurface.tsx`, `MenuCard.tsx`,
`MenuCardDetails.tsx`, `CodexAccountsMenu.tsx`): inspected directly this
pass, not assumed. These are fixed tray/popout panel layouts and an
inline multi-account switch list — none of them are a floating
trigger+dropdown control in the shape `QuotalisSelect` addresses. **Not
duplicative** of `QuotalisSelect`; no `QuotalisPopover`/`QuotalisMenu`
primitive is warranted from this inspection.
