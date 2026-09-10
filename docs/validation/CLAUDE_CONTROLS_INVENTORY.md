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

## Recommendation, not yet executed

Migrate the 8 files above to `QuotalisSelect` incrementally, one page at
a time (Reset Display's 3 selects are the most self-contained starting
point — one file, one page, no shared state with other settings tabs).
Design/implement a `QuotalisPopover`/`QuotalisMenu` only if the existing
`MenuSurface.tsx`/`MenuCard.tsx` family is found to be genuinely
duplicative on inspection — not assumed duplicative from the file list
alone.
