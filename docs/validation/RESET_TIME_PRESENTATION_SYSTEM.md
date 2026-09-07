# Reset Time / Presentation System

Wave 6 Phase 5. Extension of the Arabic RTL / reset-time work. Replaces the
"one hardcoded sentence" reset label with a locale-, timezone-, and
clock-format-aware presentation pipeline, per the owner's 50-section
specification. This document is evidence-based: every claim cites the file
that backs it.

## Core principle: `resetAt` is never touched

The one authoritative reset instant is `RateWindowSnapshot.resetsAt`
(`apps/desktop-tauri/src/types/bridge.ts`), an ISO-8601 string produced by
the backend. Every display preference below (timezone, clock format,
countdown detail, module selection, ordering) changes only how that instant
is *projected into text*. Nothing in
[`resetPresentation.ts`](../../apps/desktop-tauri/src/lib/resetPresentation.ts)
recomputes, mutates, or reinterprets the instant — see
`formatResetPresentation`'s doc comment and the
`never alters the authoritative instant regardless of display config` test.

## Architecture: one formatter, `Intl`-only

[`apps/desktop-tauri/src/lib/resetPresentation.ts`](../../apps/desktop-tauri/src/lib/resetPresentation.ts)
is the single formatting pipeline. It is a pure, synchronous function:

```
formatResetPresentation(input) -> {
  isValid, isExpired, resolvedTimeZone,
  countdown: { short, long, ariaLabel, tier } | null,
  date: { short, long } | null,
  time: { short, long, meridiem } | null,
  weekday: string | null,
  timezone: string | null,
  orderedParts: ResetModule[],
  fullAriaLabel: string,
  countdownRefreshMs: number | null,
}
```

It uses only `Intl.DateTimeFormat` and `Intl.NumberFormat` (unit style) —
no date library. Sentence-grammar strings (the ones with English/Arabic
words in them, e.g. "Resets in 5d 13h") are never hardcoded here; they come
from a `translate: (key, args) => string` callback the caller supplies,
backed by the app's existing Fluent locale bundle
(`hooks/useResetStageOptions.ts` adapts `useLocale()`'s `t()` into this
shape). Calendar/clock tokens (dates, weekdays, months, hour:minute,
AM/PM) never go through Fluent at all — they come directly from `Intl`,
correctly localized with no per-language branching.

### Wired into the one real, high-leverage consumer

[`stageProviders.ts::resetOf`](../../apps/desktop-tauri/src/components/orbit/stageProviders.ts)
feeds `StageProvider.reset` to every themed surface built on `StageProvider`
(taskbar, top bar, edge, HUD, notch, reel, flow surface, tray, quick panel,
pop-out, float bar — ~20 surfaces). It now prefers the live, locale-correct
countdown computed from `resetsAt` via `formatResetPresentation`, falling
back to the backend's `resetDescription` (stripped of its own "Resets in "
prefix, exactly as before) only when `resetsAt` is absent or unparseable —
never fabricating a value. The same fallback logic now also covers the
per-window `reset` field (session/weekly/model/extra windows), which
previously only ever read `resetDescription`.

`toStageProviders()` takes an optional third `resetOptions: { locale,
translate, now }` parameter. Every real call site
(`useStageRuntime.ts`, `TrayPanel.tsx`, `FloatBar.tsx`, `PopOutPanel.tsx`)
now passes the live UI locale via the shared
`hooks/useResetStageOptions.ts` hook. The parameter is optional and
defaults to English, so every pre-existing call site and its tests
(`stageWindows.test.ts`, `taskbarSemantics.test.ts`, which use
`resetsAt: null` fixtures) are unaffected — 737/737 frontend tests pass
unchanged plus 34 new ones.

`hooks/useResetPresentation.ts` exposes the same pipeline directly to a
component that wants the full structured result (not just the compact
`StageProvider.reset` string) — e.g. a future Settings composer preview.

## Timezone

`resolveResetTimeZone()` resolves an IANA zone (never a raw UTC offset,
which cannot model DST):

- **System mode** (default): `Intl.DateTimeFormat().resolvedOptions().timeZone`,
  called fresh on every format — never cached across the session, so an OS
  timezone change is picked up the next time anything re-renders (settings
  refresh, window focus, provider poll), with no polling loop.
- **Custom mode**: a user-supplied IANA id (e.g. `Asia/Riyadh`).

DST is handled correctly because it is delegated entirely to `Intl` (see
the `Europe/London` BST/GMT test in `resetPresentation.test.ts`, which
formats the same wall-clock UTC hour as `13:00` in July and `12:00` in
January for the same configured zone). Day/month/year rollovers across
timezones are covered too (`Asia/Tokyo` vs. `America/New_York` either side
of a UTC midnight, in the test file).

## Clock format & digits

`clockFormat: "system" | "h12" | "h24"` maps to `hour12`
(`true`/`false`/unset — "system" lets `Intl` pick the locale's natural
default rather than assuming). `meridiemStyle: "auto" | "latin" |
"localized"` controls whether AM/PM renders in the locale's own script
(e.g. Arabic "ص"/"م") or is forced to Latin "AM"/"PM" — done by taking
`Intl.DateTimeFormat(locale, ...).formatToParts()`, then substituting only
the `dayPeriod` part's value with the Latin-locale equivalent for the same
instant, preserving the locale's own part ordering. The result exposes
`time.meridiem` separately so a renderer can wrap it in
`<bdi dir="ltr">` — bidi isolation is this module's job to make possible,
not to perform (it returns structured pieces, not markup).

All date/time/countdown output passes `numberingSystem: "latn"` explicitly
— confirmed live: `Intl.NumberFormat("ar-SA", {numberingSystem:"latn", ...})`
renders `5 يوم` not `٥ يوم`. Every `formatResetPresentation`/`formatCountdown`
test asserts `.not.toMatch(/[٠-٩]/)` on Arabic output.

## Adaptive countdown

`computeCountdownParts(diffMs, detail)`:

| Condition | Tier | Example (en) | Example (ar, short) |
|---|---|---|---|
| ≥ 1 day | `day` | "Resets in 5d 13h" | "5 ي 13 س" |
| < 1 day, ≥ 1 hour | `hour` | "Resets in 4h 27m" | "4 س 27 د" |
| < 1 hour | `minute` | "Resets in 51m" | "51 د" |
| < 1 minute | `lessThanMinute` | "< 1 min" | "أقل من 1 د" |
| ≤ 0 | `expired` | "Resetting…" | "جارٍ إعادة التعيين…" |

Never more than two units by default (`detailed` uses the same two-tier
logic as `adaptive`; `compact` collapses to the single largest unit).
The compact/short form is produced by `Intl.NumberFormat(locale, {style:
"unit", unitDisplay: "narrow", numberingSystem: "latn"})` — this is what
naturally yields the owner's literal example `"5 ي 13 س"` in Arabic with no
per-language table. The long/ARIA form comes from the existing
`ResetsInDaysHours` / `ResetsInHoursMinutes` / `ResetsInMinutes` Fluent
keys (see "Locale string changes" below) — a complete sentence, not an
abbreviation, satisfying the accessibility requirement that assistive tech
never gets cryptic short-form-only text.

`countdownRefreshIntervalMs(tier)` returns the coarsest safe re-render
interval per tier (day → 1 hour, hour/minute → 1 minute, sub-minute/expired
→ 30s) — `useResetPresentation`'s `setInterval` uses this instead of a flat
1-second tick. No surface wired to this pipeline runs a 1Hz timer.

## Module composition & ordering

`ResetModule = "countdown" | "date" | "time" | "weekday" | "timezone"`,
multi-select via `config.modules`, explicitly ordered via `config.order`
(never derived from object-property order —
`orderedEnabledModules()` walks `order`, filtering to what's enabled, and
appends any enabled-but-unlisted module at the end rather than dropping it
silently). Named presets (`countdownOnly`, `dateAndTime`,
`countdownDateAndTime`, `full`, `compact`) map onto the same `modules`
field via `applyResetPreset()` — no separate formatter per preset.
`fullAriaLabel` joins each enabled module's own long/aria text in the
configured order, so a compact visible string never becomes the only thing
a screen reader gets.

## Absolute date / weekday / month / year

`formatDate()`/`formatWeekday()` use `Intl.DateTimeFormat` exclusively —
`monthStyle` (numeric/short/full) and `weekdayStyle` (off/short/full) map
directly to Intl's own `month`/`weekday` options, so weekday and month
names are never hardcoded and automatically follow the target locale.
`yearStyle: "auto"` shows the year only when the reset date's year (in the
target timezone) differs from the current year in that same timezone —
tested explicitly (`shows the year only when auto-detected as needed`).

**Scope note / simplification**: the spec's section 20 also names five
"Date Style" presets (Day Number / Numeric Date / Day+Month Name /
Weekday+Day+Month / Full Date) as if independent of the weekday/month/year
knobs in sections 21-23. Implementing both would create two sources of
truth for the same rendering. This pass keeps only the three independent
knobs (`weekdayStyle`, `monthStyle`, `yearStyle`) — every named preset is
reproducible by combining them (e.g. "Full Date" = `weekdayStyle: "full"`
+ `monthStyle: "full"` + `yearStyle: "on"`), so no expressive power is
lost, but there is no separate `dateStyle` enum feeding into it.

## Locale string changes (real bug fix + additions)

Investigation found `ar-SA.ftl` was **missing** `ResetsInDaysHours`,
`ResetsInHoursMinutes`, `ResetsInMinutes`, the `NextExpires*` keys, and
`TrayResetsInLabel`/`TrayResetsDueNow` entirely — every Arabic user was
silently seeing **English** reset-countdown text via Fluent's
`fallback_language: "en-US"`
(`rust/src/locale.rs`), despite the UI otherwise being fully RTL/Arabic.
This is now fixed with real Arabic translations for all of those keys.

Two new `LocaleKey` variants were added
(`rust/src/locale.rs`, `apps/desktop-tauri/src/i18n/keys.ts`) with real
translations in all 9 locale files:

- `ResetLessThanMinuteShort` — the bare sub-minute label ("< 1 min" /
  "أقل من 1 د").
- `ResetLessThanMinuteLong` — the full sentence for the long/ARIA form.

`rust/src/locale/tests.rs::test_english_is_complete_and_other_languages_can_fallback`
(unchanged, still passing) guarantees every key has an English value, so
any locale missing a translation degrades to English rather than to the
raw key name.

## Bidi / RTL

This module returns structured pieces specifically so a renderer can wrap
technical tokens (`time.meridiem`, provider names, plan names, percentages)
in `<bdi dir="ltr">` individually, matching the one existing precedent
(`components/orbit/UsageWindowList.tsx:67`). It does not itself emit
markup or insert Unicode direction-mark characters — semantic HTML
directionality at the render layer is preferred, per the spec.

## Test coverage

`apps/desktop-tauri/src/lib/resetPresentation.test.ts` — 34 tests:
countdown tiering (all six duration buckets: 10d, 5d13h-equivalent,
23h59m, 4h27m, 59m/51m/1m, <1min, expired), compact-detail collapsing,
detailed-vs-adaptive equivalence, refresh-interval floor (never <30s for
any tier), English + Arabic countdown formatting (short/long/aria, Latin
digits), timezone resolution (system/custom/custom-without-value), preset
application, structured-output shape, module enable/order, invalid-`resetAt`
handling, Latin-digit enforcement in dates/times, full non-abbreviated
`fullAriaLabel`, DST correctness (`Europe/London` BST vs. GMT), day-rollover
across `Asia/Tokyo`/`America/New_York`, explicit 12h/24h clock format,
forced Latin AM/PM, and year-auto-detection.

Ran alongside the full frontend suite: **737/737 passing** (703 pre-existing
+ 34 new), `tsc --noEmit` clean, `pnpm run build` succeeds. Rust:
`cargo test --workspace` — 447 (desktop-tauri crate) + pre-existing
codexbar-crate tests all pass, including the 17 `locale::tests` covering
every language; `cargo clippy --workspace --all-targets` and `cargo fmt
--check` both clean. `scripts/scan-secrets.mjs` clean.

## Acceptance checklist (owner's exact list)

| # | Item | Status |
|---|---|---|
| 1 | Arabic mixed RTL/LTR layout | Not re-verified this pass (no new surface markup written — see Scope below) |
| 2 | Provider names stay LTR | Unchanged (pre-existing `<bdi>`/normal text; this pass adds no provider-name rendering) |
| 3 | Plans stay LTR | Unchanged (pre-existing) |
| 4 | Latin digits stay Latin | **PASS** — enforced via `numberingSystem: "latn"`, tested for both Arabic date and countdown output |
| 5 | `73%` never reverses | Out of this pass's scope (no percentage rendering touched) |
| 6 | System timezone works globally | **PASS** — `resolveResetTimeZone` + tests |
| 7 | Custom timezone works | **PASS** — `timezoneMode: "custom"` + tests |
| 8 | IANA timezone IDs used | **PASS** — never a raw offset |
| 9 | DST correct | **PASS** — `Europe/London` BST/GMT test |
| 10 | System/12h/24h clock modes work | **PASS** — `clockFormat` + tests |
| 11 | Countdown adapts by duration | **PASS** — full tiering test matrix |
| 12 | Countdown-only supported | **PASS** — `countdownOnly` preset |
| 13 | Absolute-only supported | **PASS** — `dateAndTime` preset / `modules: ["date","time"]` |
| 14 | Both supported | **PASS** — `countdownDateAndTime`/`full` presets |
| 15 | Multiple modules selectable | **PASS** — `modules` is a set |
| 16 | Ordering customizable | **PASS** — `order` field, tested |
| 17 | Weekday configurable | **PASS** — `weekdayStyle` |
| 18 | Date detail configurable | **PASS** via `monthStyle`/`yearStyle` (see scope note above re: the separate 5-preset `dateStyle` enum) |
| 19 | Month format configurable | **PASS** — `monthStyle` |
| 20 | Surface responsiveness works | **NOT DONE** — no per-surface density adaptation built this pass (see Scope) |
| 21 | One shared formatter powers production | **PASS** — `stageProviders.ts::resetOf` is the real, live consumer for ~20 surfaces; other duplicate formatters (tray Rust-side, `useFormattedResetTime`) were not migrated/removed this pass (see Scope) |
| 22 | Arabic ARIA is semantic | **PASS** — `fullAriaLabel`/`countdown.ariaLabel` always the full sentence, never the compact form; real Arabic templates added (was previously falling back to English, now fixed) |
| 23 | No excessive timer/render cost | **PASS** — `countdownRefreshIntervalMs` floors at 30s, never 1Hz; `useResetPresentation`/existing hooks size their interval accordingly |
| 24 | Tests pass | **PASS** — 34 new + 737/737 total frontend; Rust workspace green; clippy/fmt clean |
| 25 | Native proof exists | **NOT DONE** this pass — no CDP native-verification screenshots captured (see Scope) |
| 26 | Commit created | Pending — see repo history for the commit made alongside this document |

## Explicitly out of scope this pass

This was scoped, as told to the owner mid-session, to the core formatter
and its one highest-leverage wiring point rather than the full 50-section
surface. Not done, and real remaining work:

- **Settings "Reset Display Composer" UI** (preset dropdown, multi-select
  checkboxes, keyboard-accessible order list, timezone/clock/date-style
  pickers, live preview) — no UI was built. `useResetPresentation` exists
  as the hook such a UI would call for its live preview, using the same
  production code path, but no screen consumes it yet.
- **Persisted settings** — no `timezoneMode`/`customTimeZone`/
  `clockFormat`/`resetPreset`/etc. fields were added to `rust/src/
  settings.rs::Settings`, so there is no user-facing way to change these
  yet; every real call site currently uses `defaultResetPresentationConfig()`
  (countdown-only, adaptive, system timezone/clock — the safe defaults
  the spec itself asks for).
- **Per-surface overrides** — not built; `resetOptions` only threads
  locale/translate today, not a per-surface config override.
- **Migrating the other duplicate formatters** — `useFormattedResetTime.ts`
  and the Rust-side tray formatters
  (`apps/desktop-tauri/src-tauri/src/commands/bridge.rs`) were left
  untouched. They still work (and still test green), but they are not yet
  re-pointed at this pipeline. `stageProviders.ts` was chosen as the one
  real integration point because it is the single function feeding every
  `StageProvider`-based surface, per the "one authoritative pipeline"
  requirement — it just isn't the *only* remaining reset-formatting code
  in the app yet.
- **Fixing Claude's UTC-only `resetDescription`** — the real bug in
  `rust/src/providers/claude/web_api.rs:666-668` and
  `rust/src/providers/claude/oauth/mod.rs:640-642` (formats in UTC with no
  local conversion) was identified but not fixed; it's masked for
  `stageProviders.ts` consumers now that `resetsAt` (the real instant) is
  preferred over `resetDescription`, but the raw backend string itself is
  still wrong if anything else reads it directly.
- **Native CDP verification / screenshots** — not captured this pass.
- **Percentage/provider-name bidi audit** (`73%` reversal, etc.) — not
  touched; those are unrelated to reset-time formatting and were already
  handled (or not) by prior Wave 6 work.
