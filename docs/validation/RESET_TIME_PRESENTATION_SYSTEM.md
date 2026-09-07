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

## Phase 6: Settings Composer, persistence, overrides, Claude bug fix

The owner's follow-up instruction required the reset system to be fully
user-configurable, persisted, migrated, wired into production surfaces, and
the previously-identified Claude UTC bug fixed — not just a formatter API.
This phase built the missing product layers on top of the accepted Phase 5
core, without changing the core itself (no defect was found in it).

### Rust persistence (`rust/src/settings.rs`)

`ResetPresentationSettings` — a new persisted struct mirroring the frontend
`ResetPresentationConfig`, with `preset`, `modules`, `order`,
`timezoneMode`/`timezoneId`, `regionalFormat`/`regionalLocale`,
`clockFormat`, `meridiemStyle`, `monthStyle`, `weekdayStyle`, `yearStyle`,
`countdownDetail`, `numberingSystem`. Added to `Settings` as
`reset_presentation` (global) and `reset_presentation_overrides:
HashMap<String, ResetPresentationSettings>` (per-surface, keyed by surface
id — "taskbar"/"top"/"edge"/"hud"/"quick"/"dashboard"/"tray"/etc.).

- **Validation** (`is_valid()`): every enum field checked against its known
  set; `modules` must be non-empty with no duplicates and only known ids;
  `order` must have no duplicates and only known ids; `timezoneId`/
  `regionalLocale`, when set, must pass a structural IANA-timezone /
  BCP-47 check (`is_valid_iana_timezone`, `is_valid_bcp47_locale`) — real
  functions, not stubs, each with their own tests covering the 6 named
  timezones (Asia/Riyadh, Europe/London, America/New_York,
  America/Los_Angeles, Asia/Tokyo, Australia/Sydney) plus rejected garbage
  (`+03:00`, `GMT+3`, path-traversal strings, empty).
- **Repair, never reject** (`normalized()`): a settings file with one
  corrupt field is repaired field-by-field against the same defaults
  rather than the whole config (or the whole settings file) being
  discarded. Explicitly handles the case field-level validity doesn't
  catch: an `order` that omits an enabled `module` gets that module
  appended, never silently dropped.
- **Migration**: `Settings::load()` calls `.normalized()` on both the
  global config and every override, in-memory, the same way existing
  fields like `catalog_theme` are migrated — never persisted destructively
  until a normal save. A settings.json saved before this feature existed
  (no `reset_presentation` key at all) deserializes via `#[serde(default)]`
  straight into `ResetPresentationSettings::default()`, which is
  bit-for-bit the product's pre-existing countdown-only/adaptive/system
  behavior — no surprise change for existing users. 15 dedicated tests
  (`settings::reset_presentation_settings_tests`, plus 3 in
  `settings::tests`) cover default-equals-current-behavior, every named
  preset, empty/duplicate/unknown modules, duplicate/incomplete order,
  every named timezone, rejected garbage, corrupt-field repair,
  missing-field migration (direct JSON deserialize), full roundtrip
  (temp-file save/reload), and a hand-corrupted `reset_presentation`
  object in an otherwise-valid settings.json never panicking.

### Bridge + commands

`SettingsSnapshot` (`apps/desktop-tauri/src-tauri/src/commands/bridge.rs`)
now carries `resetPresentation`/`resetPresentationOverrides` (camelCase via
`#[serde(rename_all = "camelCase")]` on the nested struct, the same pattern
already used for `NotificationEventPreferences`/`NotificationQuietHours`).
Two new validated, persisted Tauri commands
(`apps/desktop-tauri/src-tauri/src/command_profiles.rs`,
registered in `main.rs`): `set_reset_presentation` (global) and
`set_reset_presentation_surface_override` (per-surface; `None` clears an
override). Both reject an invalid config outright rather than persisting a
corrupt one, and both emit `codexbar:settings-updated` so every live
surface picks up the change without a restart — the same broadcast
mechanism `set_global_limit_presentation` already uses.

### Settings → frontend config mapping

New `apps/desktop-tauri/src/lib/resetPresentationSettings.ts` is the one
place the persisted DTO shape and the pure `ResetPresentationConfig` shape
convert between each other (`dtoToResetSettings`/`resetSettingsToDto`),
plus `resolveRegionalLocale()` — the Regional Format resolver: "system"
tries `Intl.DateTimeFormat().resolvedOptions().locale` (a real signal
independent of the UI language, when the platform exposes one different
from it) before falling back to the UI language; "uiLanguage" always
matches the app's language; "custom" uses an explicit BCP-47 tag. This is
what keeps UI language, timezone, and regional formatting genuinely
separable, per the spec: Arabic UI + a British `en-GB` regional format +
`Asia/Riyadh` timezone is a representable, working combination. 10 tests
in `resetPresentationSettings.test.ts` cover default-when-unset, full
field mapping, sanitization of corrupt module/order/preset values, and a
round-trip identity.

### Reset Display Composer (`surfaces/settings/tabs/ResetDisplaySection.tsx`)

A real, third view inside the existing Provider Display tab (alongside
Provider Identities and Usage Display, the two closest existing
"how usage/reset gets shown" sections) — not a demo editor. Preset select
(the 6 named presets, `custom` reveals module checkboxes + an accessible
Move-Up/Move-Down order list, matching the exact reorder pattern
`ProvidersSidebar.tsx` already uses); an "Advanced formatting" `<details>`
(closed by default, opens automatically on `custom`) with Timezone
(Follow System — showing the currently-resolved zone — or Custom with a
validated IANA text input), Regional Format (System/UI Language/Custom
with a BCP-47 text input), Clock Format, Meridiem, Month/Weekday/Year
style, and Countdown Detail. A live preview renders both an English and an
Arabic example from a fixed deterministic sample instant, through the
exact same `formatResetPresentation` production function every real
surface calls — never a hardcoded preview string — with the Arabic value
wrapped in `<bdi dir="ltr">` and a visible "Screen reader text: …" line
showing the actual `fullAriaLabel`. Persistence is optimistic with
revert-on-failure, following the exact pattern `UsageDisplaySection.tsx`
already established. 8 component tests cover: loading a persisted config
and rendering a real preview value, the Arabic `<bdi>` isolation, preset
selection persisting the matching module set, revealing the custom
controls, module toggling (forcing preset to `custom`), refusing to drop
the last enabled module, Move-Up/Down persisting the expected order, and
save-failure revert with a visible error.

### Wired into every real stage-driven surface

`stageProviders.ts`'s `formatWindowReset()` now accepts the full resolved
`config` (not a hardcoded `countdownOnly` override) and joins every
enabled module's compact text with " · " (e.g. `"51m · Sep 12 · 19:00"`),
so the one string `StageProvider.reset` carries reflects the user's whole
module selection, not just a countdown. `useResetStageOptions.ts` now
takes the live `SettingsSnapshot` slice and a `surfaceId`, and resolves
precedence itself: surface override → global `resetPresentation` →
`formatResetPresentation`'s own built-in safe defaults. Every real call
site now passes both: `TrayPanel.tsx` ("tray"), `FloatBar.tsx` ("hud"),
`PopOutPanel.tsx` ("dashboard"), and `useStageRuntime.ts` (its own
`surface: CatalogSurfaceId` parameter — "taskbar"/"top"/"edge"/"quick",
used by every orbital surface built on that shared hook).

### Claude UTC-only `resetDescription` bug — fixed

`rust/src/providers/claude/web_api.rs::format_reset_time` and
`rust/src/providers/claude/oauth/mod.rs::format_reset_date` previously
formatted the reset instant with `%b %-d at %-I:%M%p` directly on the
`DateTime<Utc>` value — always UTC, regardless of the user's actual
timezone. Both now convert to the local system zone first, via the exact
same `chrono_tz::Tz::from_str(&crate::core::local_timezone_name())`
pattern `providers/claude/cli_reset.rs` already used elsewhere in the same
provider family (reused, not reinvented). The authoritative `resets_at`
instant itself was never wrong and is untouched — only this legacy
pre-formatted fallback string was. Both functions were split into a
zone-parameterized inner function so the conversion is directly testable
without depending on the test host's real system timezone; two regression
tests assert the same UTC instant renders a different local hour in
Asia/Riyadh vs. America/Los_Angeles vs. UTC itself.

### Verified (Phase 6)

755/755 frontend tests (703 baseline + 34 Phase 5 + 18 new this phase),
`tsc --noEmit` clean, `pnpm run build` succeeds. `cargo test --workspace`:
1491 (codexbar crate) + 447 (desktop-tauri crate) = 1938 passing, including
15 new `ResetPresentationSettings` tests and 2 new Claude-timezone
regression tests. `cargo clippy --workspace --all-targets -- -D warnings`
clean. `cargo fmt --check` clean. `scripts/scan-secrets.mjs` clean.
`git diff --check` clean (only pre-existing CRLF-normalization notices).

## Acceptance checklist (owner's exact final list)

| # | Item | Status |
|---|---|---|
| Settings Composer exists | **PASS** — `ResetDisplaySection.tsx`, a real production Settings section, not a demo |
| Settings persist | **PASS** — `rust/src/settings.rs::ResetPresentationSettings` + `set_reset_presentation` command, validated server-side |
| Migrations work | **PASS** — `#[serde(default)]` + `.normalized()` in `Settings::load()`; missing-field and corrupt-field migration tests |
| Timezone system works | **PASS** — Follow System (live-resolved, shown in the UI), tested |
| Custom timezone works | **PASS** — validated IANA input, tested against all 6 named zones |
| Regional format works | **PASS** — System/UI Language/Custom, kept independent of UI language and timezone |
| System/12h/24h works | **PASS** — unchanged from Phase 5, now user-configurable via the Composer |
| Countdown adaptive behavior works | **PASS** — unchanged core, now user-configurable |
| Countdown-only works | **PASS** — `countdownOnly` preset |
| Absolute-only works | **PASS** — `dateAndTime` preset |
| Both works | **PASS** — `countdownDateAndTime`/`full` presets |
| Order is user-controlled | **PASS** — accessible Move Up/Down list in the Composer, persisted `order` array |
| Day/month/weekday/year styles work | **PASS** — all four independently configurable in Advanced formatting |
| Surface overrides work where implemented | **PARTIAL** — the Rust persistence, validated command, and `useResetStageOptions` precedence resolution (surface → global → default) are real and wired into all 4 stage-driven call sites; the Composer UI itself only edits the *global* config — there is no UI control yet to set a surface-specific override (a user could not do this without calling the Tauri command directly) |
| All duplicate production formatters migrated | **PARTIAL** — `stageProviders.ts::resetOf` (the single highest-leverage integration point, ~20 surfaces) now uses the persisted config; `useFormattedResetTime.ts` and the Rust-side tray formatters in `commands/bridge.rs` (`format_compact_reset_countdown`, `normalize_reset_description`, `compact_tray_status_label`) were **not** migrated this pass — they still run their own separate formatting logic |
| Claude UTC-only bug fixed | **PASS** — both call sites fixed, with regression tests proving the timezone conversion |
| Tray parity exists | **NOT DONE** — the native tray still renders through its own unmigrated Rust formatter (see above); an Arabic tray tooltip and the frontend surfaces are not guaranteed to say the same thing yet |
| Arabic mixed RTL/LTR works | **PASS in the Composer's own preview** (bidi-isolated `<bdi>`, verified by test); **not freshly native-re-verified** on the live app surfaces this pass |
| Latin digits remain Latin | **PASS** — unchanged from Phase 5, still enforced and tested |
| Native screenshots exist | **NOT DONE** — no CDP native-verification screenshots captured this pass |
| Timer/render performance is acceptable | **PASS** — unchanged `countdownRefreshIntervalMs` floor (≥30s, no 1Hz loop); no new per-frame `Intl` construction introduced |
| All tests/builds pass | **PASS** — see Verified section above |
| Commits created | See repo history for the commit(s) made alongside this document |

## Explicitly out of scope / not done (honest, carried forward)

- **Surface-override UI control** — backend-complete, no Composer control to set one yet (see checklist row above).
- **Tray/Rust-side formatter migration** — `commands/bridge.rs`'s own tray
  formatting functions and `useFormattedResetTime.ts` remain separate,
  unmigrated implementations. This is the largest remaining piece of the
  "one authoritative pipeline" requirement — the frontend stage surfaces
  are unified; the tray (native, Rust-rendered) and the two hooks/composer
  code paths are not yet reconciled into one.
- **Native CDP screenshots** — none of the 15 named files from the spec
  (`RESET_SETTINGS_COMPOSER.png`, `AR_COUNTDOWN_ONLY.png`, etc.) were
  captured this pass.
- **Fresh native RTL re-verification** — the bidi-isolation claim for the
  Composer's own preview is test-verified (JSDOM), not re-confirmed via
  CDP against the real Dev binary this pass.
- **Percentage/provider-name bidi audit** (`73%` reversal, etc.) — still
  out of scope; unrelated to reset-time formatting, already covered (or
  not) by prior Wave 6 work.
