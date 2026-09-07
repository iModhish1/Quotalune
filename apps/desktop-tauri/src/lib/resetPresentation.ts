/**
 * Reset Presentation System
 * =========================
 *
 * ONE authoritative formatting pipeline for provider quota reset display,
 * used by every surface (taskbar, top bar, edge, HUD, provider display,
 * dashboard, quick panel, tray, collections). See
 * `docs/validation/RESET_TIME_PRESENTATION_SYSTEM.md` for the full design
 * rationale and scope notes.
 *
 * Core principle (non-negotiable): `resetAt` is the ONE authoritative
 * instant. Every option below controls how that instant is *displayed* --
 * none of them may alter it, recompute it, or invent a different reset
 * policy. This module never mutates or reinterprets `resetAt`; it only
 * projects it through `Intl` into locale-correct, timezone-correct text.
 *
 * Only built-in `Intl` APIs are used (`Intl.DateTimeFormat`,
 * `Intl.NumberFormat` unit style) -- no date library dependency.
 *
 * The function is pure and synchronous: given the same `resetAt`, `now`,
 * `locale` and `config`, it always returns the same structured result. This
 * is what lets the Settings live-preview (section 42 of the spec) call the
 * exact same code path production surfaces use.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type ResetTimezoneMode = "system" | "custom";
export type ResetClockFormat = "system" | "h12" | "h24";
export type ResetMeridiemStyle = "auto" | "latin" | "localized";
export type ResetCountdownDetail = "adaptive" | "compact" | "detailed";
export type ResetWeekdayStyle = "off" | "short" | "full";
export type ResetMonthStyle = "numeric" | "short" | "full";
export type ResetYearStyle = "off" | "on" | "auto";
export type ResetDigits = "latn";

export type ResetModule = "countdown" | "date" | "time" | "weekday" | "timezone";

export type ResetPreset =
  | "countdownOnly"
  | "dateAndTime"
  | "countdownDateAndTime"
  | "full"
  | "compact"
  | "custom";

/** Canonical module order used whenever a config does not specify its own. */
export const DEFAULT_RESET_MODULE_ORDER: readonly ResetModule[] = [
  "countdown",
  "weekday",
  "date",
  "time",
  "timezone",
];

/** Modules enabled by each named preset. "custom" has no fixed mapping --
 *  it means "use `modules`/`order` as given". */
export const RESET_PRESET_MODULES: Record<Exclude<ResetPreset, "custom">, readonly ResetModule[]> = {
  countdownOnly: ["countdown"],
  dateAndTime: ["date", "time"],
  countdownDateAndTime: ["countdown", "date", "time"],
  full: ["countdown", "weekday", "date", "time", "timezone"],
  compact: ["countdown"],
};

export interface ResetPresentationConfig {
  preset: ResetPreset;
  /** "system" resolves via Intl at format time (never permanently cached);
   *  "custom" uses `customTimeZone`, which must be a valid IANA zone id. */
  timezoneMode: ResetTimezoneMode;
  customTimeZone: string | null;
  clockFormat: ResetClockFormat;
  meridiemStyle: ResetMeridiemStyle;
  /** Numbering system for all digits QuotaArc renders. Only "latn" exists
   *  today (the current, explicit product default even for Arabic) --
   *  the type is a union of one so a future numbering-system option is an
   *  additive type change, not a rewrite. */
  digits: ResetDigits;
  modules: ResetModule[];
  order: ResetModule[];
  countdownDetail: ResetCountdownDetail;
  weekdayStyle: ResetWeekdayStyle;
  monthStyle: ResetMonthStyle;
  yearStyle: ResetYearStyle;
}

export function defaultResetPresentationConfig(): ResetPresentationConfig {
  return {
    preset: "countdownOnly",
    timezoneMode: "system",
    customTimeZone: null,
    clockFormat: "system",
    meridiemStyle: "auto",
    digits: "latn",
    modules: ["countdown"],
    order: [...DEFAULT_RESET_MODULE_ORDER],
    countdownDetail: "adaptive",
    weekdayStyle: "off",
    monthStyle: "short",
    yearStyle: "auto",
  };
}

/** Apply a named preset's module set to a config, preserving every other
 *  (timezone/clock/detail/date-style) setting. "custom" is a no-op --
 *  the caller's own `modules`/`order` stand. */
export function applyResetPreset(
  config: ResetPresentationConfig,
  preset: ResetPreset,
): ResetPresentationConfig {
  if (preset === "custom") {
    return { ...config, preset };
  }
  const modules = RESET_PRESET_MODULES[preset];
  return { ...config, preset, modules: [...modules] };
}

// ---------------------------------------------------------------------------
// Locale-owned sentence templates
// ---------------------------------------------------------------------------
//
// Per the "localization strings own sentence grammar, formatting functions
// own date/time tokens" rule: this module never hardcodes a sentence. It
// asks a `translate` callback for one. Real callers (the React hook layer)
// pass a callback backed by the app's Fluent locale bundle; a locale-neutral
// English fallback keeps this module usable (and testable) standalone.

export type ResetLocaleKey =
  | "ResetsInDaysHours"
  | "ResetsInHoursMinutes"
  | "ResetsInMinutes"
  | "ResetLessThanMinuteShort"
  | "ResetLessThanMinuteLong"
  | "TrayResetsDueNow";

export type ResetTranslate = (key: ResetLocaleKey, args: string[]) => string;

const EN_FALLBACK_TEMPLATES: Record<ResetLocaleKey, string> = {
  ResetsInDaysHours: "Resets in {}d {}h",
  ResetsInHoursMinutes: "Resets in {}h {}m",
  ResetsInMinutes: "Resets in {}m",
  ResetLessThanMinuteShort: "< 1 min",
  ResetLessThanMinuteLong: "Resets in less than 1 minute",
  TrayResetsDueNow: "Resetting…",
};

function applyTemplate(template: string, args: string[]): string {
  let result = template;
  for (const arg of args) {
    result = result.replace("{}", arg);
  }
  return result;
}

const defaultTranslate: ResetTranslate = (key, args) =>
  applyTemplate(EN_FALLBACK_TEMPLATES[key], args);

// ---------------------------------------------------------------------------
// Timezone resolution
// ---------------------------------------------------------------------------

/** Resolve the effective IANA timezone for a config. Re-resolves the system
 *  zone from `Intl` every call -- never cache this result across a session,
 *  since the whole point of "system" mode is to track OS changes. */
export function resolveResetTimeZone(config: Pick<ResetPresentationConfig, "timezoneMode" | "customTimeZone">): string {
  if (config.timezoneMode === "custom" && config.customTimeZone) {
    return config.customTimeZone;
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

export type CountdownTier = "expired" | "lessThanMinute" | "day" | "hour" | "minute";

export interface CountdownParts {
  tier: CountdownTier;
  days?: number;
  hours?: number;
  minutes?: number;
}

/** Adaptive tiering (spec sections 13-17): >=1 day -> days+hours; <1 day &
 *  >=1 hour -> hours+minutes; <1 hour -> minutes only; <1 minute -> a safe
 *  sub-minute label. "compact" collapses to the single largest unit;
 *  "detailed" is the same two-unit tiers as "adaptive" (never more than two
 *  units by default, per spec). */
export function computeCountdownParts(diffMs: number, detail: ResetCountdownDetail): CountdownParts {
  if (diffMs <= 0) return { tier: "expired" };
  const totalMinutes = Math.floor(diffMs / 60_000);
  if (totalMinutes < 1) return { tier: "lessThanMinute" };

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (detail === "compact") {
    if (days > 0) return { tier: "day", days };
    if (hours > 0) return { tier: "hour", hours };
    return { tier: "minute", minutes };
  }

  if (days > 0) return { tier: "day", days, hours };
  if (hours > 0) return { tier: "hour", hours, minutes };
  return { tier: "minute", minutes };
}

/** Minimum re-render interval (ms) implied by a countdown tier -- how often
 *  the *visible text* can actually change, so callers can size their timer
 *  accordingly instead of defaulting to 1Hz. Day/hour tiers only need to
 *  refresh once an hour; the minute tier only needs to refresh once a
 *  minute; only the (opt-in, not implemented by default) seconds mode would
 *  need 1Hz. */
export function countdownRefreshIntervalMs(tier: CountdownTier): number {
  switch (tier) {
    case "day":
      return 60 * 60_000;
    case "hour":
    case "minute":
      return 60_000;
    case "lessThanMinute":
    case "expired":
      return 30_000;
  }
}

function narrowUnit(locale: string, unit: "day" | "hour" | "minute", value: number): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "narrow",
      numberingSystem: "latn",
    }).format(value);
  } catch {
    // Some engines lack unit-style support for a given locale; fall back to
    // a locale-neutral but still-correct rendering rather than throwing.
    const suffix = unit === "day" ? "d" : unit === "hour" ? "h" : "m";
    return `${value}${suffix}`;
  }
}

export interface CountdownResult {
  short: string;
  long: string;
  ariaLabel: string;
  tier: CountdownTier;
}

export function formatCountdown(
  parts: CountdownParts,
  locale: string,
  translate: ResetTranslate = defaultTranslate,
): CountdownResult {
  switch (parts.tier) {
    case "expired": {
      const text = translate("TrayResetsDueNow", []);
      return { short: text, long: text, ariaLabel: text, tier: "expired" };
    }
    case "lessThanMinute": {
      return {
        short: translate("ResetLessThanMinuteShort", []),
        long: translate("ResetLessThanMinuteLong", []),
        ariaLabel: translate("ResetLessThanMinuteLong", []),
        tier: "lessThanMinute",
      };
    }
    case "day": {
      const long = translate("ResetsInDaysHours", [String(parts.days), String(parts.hours)]);
      return {
        short: `${narrowUnit(locale, "day", parts.days!)} ${narrowUnit(locale, "hour", parts.hours!)}`,
        long,
        ariaLabel: long,
        tier: "day",
      };
    }
    case "hour": {
      const long = translate("ResetsInHoursMinutes", [String(parts.hours), String(parts.minutes)]);
      return {
        short: `${narrowUnit(locale, "hour", parts.hours!)} ${narrowUnit(locale, "minute", parts.minutes!)}`,
        long,
        ariaLabel: long,
        tier: "hour",
      };
    }
    case "minute": {
      const long = translate("ResetsInMinutes", [String(parts.minutes)]);
      return {
        short: narrowUnit(locale, "minute", parts.minutes!),
        long,
        ariaLabel: long,
        tier: "minute",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Absolute date / time / weekday / timezone
// ---------------------------------------------------------------------------

export interface ResetDateResult {
  short: string;
  long: string;
}

function yearIsNeeded(date: Date, timeZone: string, yearStyle: ResetYearStyle): boolean {
  if (yearStyle === "off") return false;
  if (yearStyle === "on") return true;
  // "auto": only show the year when the reset date falls outside the
  // current calendar year in the target timezone.
  const resetYear = Number(
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(date),
  );
  const currentYear = Number(
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(new Date()),
  );
  return resetYear !== currentYear;
}

function formatDate(
  date: Date,
  locale: string,
  timeZone: string,
  monthStyle: ResetMonthStyle,
  yearStyle: ResetYearStyle,
): ResetDateResult {
  const month: Intl.DateTimeFormatOptions["month"] =
    monthStyle === "numeric" ? "numeric" : monthStyle === "short" ? "short" : "long";
  const showYear = yearIsNeeded(date, timeZone, yearStyle);

  const shortOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    timeZone,
    numberingSystem: "latn",
  };
  const longOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month,
    timeZone,
    numberingSystem: "latn",
  };
  if (showYear) longOpts.year = "numeric";

  return {
    short: new Intl.DateTimeFormat(locale, shortOpts).format(date),
    long: new Intl.DateTimeFormat(locale, longOpts).format(date),
  };
}

export interface ResetTimeResult {
  short: string;
  long: string;
  /** The isolated meridiem token ("AM"/"PM" or a localized equivalent),
   *  null in 24-hour mode. Callers wrap this in `<bdi dir="ltr">` -- Latin
   *  AM/PM must render as one LTR-isolated token even inside RTL text. */
  meridiem: string | null;
}

function resolveHour12(clockFormat: ResetClockFormat): boolean | undefined {
  if (clockFormat === "h12") return true;
  if (clockFormat === "h24") return false;
  return undefined; // "system": let Intl pick the locale's natural default
}

function formatTime(
  date: Date,
  locale: string,
  timeZone: string,
  clockFormat: ResetClockFormat,
  meridiemStyle: ResetMeridiemStyle,
): ResetTimeResult {
  const hour12 = resolveHour12(clockFormat);
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    numberingSystem: "latn",
  };
  if (hour12 !== undefined) opts.hour12 = hour12;

  let parts = new Intl.DateTimeFormat(locale, opts).formatToParts(date);
  const usesMeridiem = parts.some((p) => p.type === "dayPeriod");

  if (usesMeridiem && meridiemStyle === "latin") {
    const latinParts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone,
    }).formatToParts(date);
    const latinDayPeriod = latinParts.find((p) => p.type === "dayPeriod")?.value ?? "";
    parts = parts.map((p) => (p.type === "dayPeriod" ? { ...p, value: latinDayPeriod } : p));
  }

  const text = parts.map((p) => p.value).join("");
  const meridiem = usesMeridiem ? (parts.find((p) => p.type === "dayPeriod")?.value ?? null) : null;

  return { short: text, long: text, meridiem };
}

function formatWeekday(date: Date, locale: string, timeZone: string, style: ResetWeekdayStyle): string | null {
  if (style === "off") return null;
  return new Intl.DateTimeFormat(locale, {
    weekday: style === "short" ? "short" : "long",
    timeZone,
  }).format(date);
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export interface ResetPresentationInput {
  /** The one authoritative reset instant -- ISO-8601 string, epoch ms, or a
   *  Date. Never recomputed or reinterpreted by this module. */
  resetAt: string | number | Date;
  /** Reference "now", for deterministic tests and previews. Defaults to
   *  `Date.now()`. */
  now?: number;
  /** BCP-47 UI locale (e.g. "ar-SA", "en-US"). */
  locale: string;
  config?: Partial<ResetPresentationConfig>;
  translate?: ResetTranslate;
}

export interface ResetPresentationResult {
  isValid: boolean;
  isExpired: boolean;
  resolvedTimeZone: string;
  countdown: CountdownResult | null;
  date: ResetDateResult | null;
  time: ResetTimeResult | null;
  weekday: string | null;
  timezone: string | null;
  /** Enabled modules, in the configured display order. */
  orderedParts: ResetModule[];
  /** Complete, non-abbreviated sentence for assistive tech (section 46) --
   *  built by joining each enabled module's own `long`/aria text, in
   *  configured order. Never a cryptic short-form-only string. */
  fullAriaLabel: string;
  /** How often (ms) the countdown module's *visible text* can change, for
   *  callers to size a refresh timer without polling faster than needed. */
  countdownRefreshMs: number | null;
}

function orderedEnabledModules(config: ResetPresentationConfig): ResetModule[] {
  const enabled = new Set(config.modules);
  const order = config.order.length > 0 ? config.order : DEFAULT_RESET_MODULE_ORDER;
  const seen = new Set<ResetModule>();
  const result: ResetModule[] = [];
  for (const module of order) {
    if (enabled.has(module) && !seen.has(module)) {
      result.push(module);
      seen.add(module);
    }
  }
  // Any enabled module missing from `order` (e.g. a stale persisted config
  // from before a module was added) still renders, appended at the end
  // rather than silently dropped.
  for (const module of config.modules) {
    if (!seen.has(module)) {
      result.push(module);
      seen.add(module);
    }
  }
  return result;
}

/**
 * The one authoritative reset-time formatter. Every surface should call
 * this instead of maintaining its own reset-string logic.
 */
export function formatResetPresentation(input: ResetPresentationInput): ResetPresentationResult {
  const config: ResetPresentationConfig = { ...defaultResetPresentationConfig(), ...input.config };
  const translate = input.translate ?? defaultTranslate;
  const locale = input.locale;

  const resolvedTargetMs =
    input.resetAt instanceof Date
      ? input.resetAt.getTime()
      : typeof input.resetAt === "number"
        ? input.resetAt
        : Date.parse(input.resetAt);

  const timeZone = resolveResetTimeZone(config);

  if (Number.isNaN(resolvedTargetMs)) {
    return {
      isValid: false,
      isExpired: false,
      resolvedTimeZone: timeZone,
      countdown: null,
      date: null,
      time: null,
      weekday: null,
      timezone: null,
      orderedParts: [],
      fullAriaLabel: "",
      countdownRefreshMs: null,
    };
  }

  const now = input.now ?? Date.now();
  const date = new Date(resolvedTargetMs);
  const diffMs = resolvedTargetMs - now;

  const orderedParts = orderedEnabledModules(config);

  const countdownParts = computeCountdownParts(diffMs, config.countdownDetail);
  const countdown = orderedParts.includes("countdown")
    ? formatCountdown(countdownParts, locale, translate)
    : null;
  const dateResult = orderedParts.includes("date")
    ? formatDate(date, locale, timeZone, config.monthStyle, config.yearStyle)
    : null;
  const timeResult = orderedParts.includes("time")
    ? formatTime(date, locale, timeZone, config.clockFormat, config.meridiemStyle)
    : null;
  const weekday = orderedParts.includes("weekday")
    ? formatWeekday(date, locale, timeZone, config.weekdayStyle)
    : null;
  const timezoneLabel = orderedParts.includes("timezone") ? timeZone : null;

  const ariaSegments: string[] = [];
  for (const part of orderedParts) {
    if (part === "countdown" && countdown) ariaSegments.push(countdown.ariaLabel);
    else if (part === "date" && dateResult) ariaSegments.push(dateResult.long);
    else if (part === "time" && timeResult) ariaSegments.push(timeResult.long);
    else if (part === "weekday" && weekday) ariaSegments.push(weekday);
    else if (part === "timezone" && timezoneLabel) ariaSegments.push(timezoneLabel);
  }

  return {
    isValid: true,
    isExpired: diffMs <= 0,
    resolvedTimeZone: timeZone,
    countdown,
    date: dateResult,
    time: timeResult,
    weekday,
    timezone: timezoneLabel,
    orderedParts,
    fullAriaLabel: ariaSegments.join(", "),
    countdownRefreshMs: countdown ? countdownRefreshIntervalMs(countdown.tier) : null,
  };
}
