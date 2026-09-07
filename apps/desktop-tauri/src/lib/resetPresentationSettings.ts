/**
 * Bridge between the persisted Rust `ResetPresentationSettings` shape
 * (`rust/src/settings.rs`) and the pure frontend `ResetPresentationConfig`
 * (`lib/resetPresentation.ts`). Keeping this mapping in one place means the
 * two field-naming schemes (Rust: `timezoneMode`/`timezoneId`/
 * `regionalFormat`; frontend core: `timezoneMode`/`customTimeZone`, with
 * `regionalFormat` resolved separately into a locale string) never drift
 * out of sync silently.
 */

import type {
  ResetPresentationConfig,
  ResetClockFormat,
  ResetCountdownDetail,
  ResetMeridiemStyle,
  ResetModule,
  ResetMonthStyle,
  ResetPreset,
  ResetTimezoneMode,
  ResetWeekdayStyle,
  ResetYearStyle,
} from "./resetPresentation";
import { DEFAULT_RESET_MODULE_ORDER, defaultResetPresentationConfig } from "./resetPresentation";

export type ResetRegionalFormat = "system" | "uiLanguage" | "custom";

/** On-disk / bridge shape, mirroring `rust::settings::ResetPresentationSettings`. */
export interface ResetPresentationSettingsDto {
  preset: string;
  modules: string[];
  order: string[];
  timezoneMode: string;
  timezoneId: string | null;
  regionalFormat: string;
  regionalLocale: string | null;
  clockFormat: string;
  meridiemStyle: string;
  monthStyle: string;
  weekdayStyle: string;
  yearStyle: string;
  countdownDetail: string;
  numberingSystem: string;
}

const RESET_MODULES: readonly ResetModule[] = ["countdown", "date", "time", "weekday", "timezone"];
const isResetModule = (value: string): value is ResetModule => (RESET_MODULES as readonly string[]).includes(value);

function sanitizeModules(values: string[]): ResetModule[] {
  const seen = new Set<ResetModule>();
  for (const value of values) {
    if (isResetModule(value)) seen.add(value);
  }
  return seen.size > 0 ? [...seen] : ["countdown"];
}

function sanitizeOrder(values: string[], modules: ResetModule[]): ResetModule[] {
  const seen = new Set<ResetModule>();
  const cleaned: ResetModule[] = [];
  for (const value of values) {
    if (isResetModule(value) && !seen.has(value)) {
      cleaned.push(value);
      seen.add(value);
    }
  }
  for (const module of modules) {
    if (!seen.has(module)) {
      cleaned.push(module);
      seen.add(module);
    }
  }
  return cleaned.length > 0 ? cleaned : [...DEFAULT_RESET_MODULE_ORDER];
}

/** Full display config for the frontend formatter -- includes `regionalFormat`
 *  and `timezoneId`, which live outside `ResetPresentationConfig` proper
 *  (they resolve into `locale`/`customTimeZone` at the call site). */
export interface ResolvedResetSettings {
  config: ResetPresentationConfig;
  regionalFormat: ResetRegionalFormat;
  regionalLocale: string | null;
}

export function dtoToResetSettings(dto: ResetPresentationSettingsDto | null | undefined): ResolvedResetSettings {
  const fallback = defaultResetPresentationConfig();
  if (!dto) return { config: fallback, regionalFormat: "system", regionalLocale: null };

  const modules = sanitizeModules(dto.modules);
  const order = sanitizeOrder(dto.order, modules);

  const preset: ResetPreset = (
    ["countdownOnly", "dateAndTime", "countdownDateAndTime", "full", "compact", "custom"] as const
  ).includes(dto.preset as ResetPreset)
    ? (dto.preset as ResetPreset)
    : "custom";

  const config: ResetPresentationConfig = {
    preset,
    modules,
    order,
    timezoneMode: dto.timezoneMode === "custom" ? "custom" : ("system" as ResetTimezoneMode),
    customTimeZone: dto.timezoneId ?? null,
    clockFormat: (["system", "h12", "h24"] as const).includes(dto.clockFormat as ResetClockFormat)
      ? (dto.clockFormat as ResetClockFormat)
      : "system",
    meridiemStyle: (["auto", "latin", "localized"] as const).includes(dto.meridiemStyle as ResetMeridiemStyle)
      ? (dto.meridiemStyle as ResetMeridiemStyle)
      : "auto",
    digits: "latn",
    monthStyle: (["numeric", "short", "full"] as const).includes(dto.monthStyle as ResetMonthStyle)
      ? (dto.monthStyle as ResetMonthStyle)
      : "short",
    weekdayStyle: (["off", "short", "full"] as const).includes(dto.weekdayStyle as ResetWeekdayStyle)
      ? (dto.weekdayStyle as ResetWeekdayStyle)
      : "off",
    yearStyle: (["off", "on", "auto"] as const).includes(dto.yearStyle as ResetYearStyle)
      ? (dto.yearStyle as ResetYearStyle)
      : "auto",
    countdownDetail: (["adaptive", "compact", "detailed"] as const).includes(
      dto.countdownDetail as ResetCountdownDetail,
    )
      ? (dto.countdownDetail as ResetCountdownDetail)
      : "adaptive",
  };

  const regionalFormat: ResetRegionalFormat = (["system", "uiLanguage", "custom"] as const).includes(
    dto.regionalFormat as ResetRegionalFormat,
  )
    ? (dto.regionalFormat as ResetRegionalFormat)
    : "system";

  const regionalLocale = typeof dto.regionalLocale === "string" ? dto.regionalLocale : null;

  return { config, regionalFormat, regionalLocale };
}

export function resetSettingsToDto(
  config: ResetPresentationConfig,
  regionalFormat: ResetRegionalFormat,
  regionalLocale: string | null = null,
): ResetPresentationSettingsDto {
  return {
    preset: config.preset,
    modules: config.modules,
    order: config.order,
    timezoneMode: config.timezoneMode,
    timezoneId: config.customTimeZone,
    regionalFormat,
    regionalLocale,
    clockFormat: config.clockFormat,
    meridiemStyle: config.meridiemStyle,
    monthStyle: config.monthStyle,
    weekdayStyle: config.weekdayStyle,
    yearStyle: config.yearStyle,
    countdownDetail: config.countdownDetail,
    numberingSystem: config.digits,
  };
}

/** Resolve the actual `Intl` locale tag to format with, given the regional
 *  format preference. "system" prefers the OS/webview's own resolved
 *  locale (a signal genuinely independent of the UI language); falls back
 *  to the UI language's locale if that can't be read. "uiLanguage" always
 *  matches the app's UI language. "custom" uses an explicit BCP-47 tag. */
export function resolveRegionalLocale(
  regionalFormat: ResetRegionalFormat,
  uiLocale: string,
  customLocale: string | null,
): string {
  if (regionalFormat === "custom" && customLocale) return customLocale;
  if (regionalFormat === "uiLanguage") return uiLocale;
  try {
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (systemLocale) return systemLocale;
  } catch {
    // fall through to the UI language
  }
  return uiLocale;
}
