import { describe, expect, it } from "vitest";
import {
  applyResetPreset,
  computeCountdownParts,
  countdownRefreshIntervalMs,
  defaultResetPresentationConfig,
  formatCountdown,
  formatResetPresentation,
  resolveResetTimeZone,
  type ResetLocaleKey,
  type ResetTranslate,
} from "./resetPresentation";

const EN: Record<ResetLocaleKey, string> = {
  ResetsInDaysHours: "Resets in {}d {}h",
  ResetsInHoursMinutes: "Resets in {}h {}m",
  ResetsInMinutes: "Resets in {}m",
  ResetLessThanMinuteShort: "< 1 min",
  ResetLessThanMinuteLong: "Resets in less than 1 minute",
  TrayResetsDueNow: "Resetting…",
};

const AR: Record<ResetLocaleKey, string> = {
  ResetsInDaysHours: "إعادة التعيين خلال {} يوم و{} ساعة",
  ResetsInHoursMinutes: "إعادة التعيين خلال {} ساعة و{} دقيقة",
  ResetsInMinutes: "إعادة التعيين خلال {} دقيقة",
  ResetLessThanMinuteShort: "أقل من 1 د",
  ResetLessThanMinuteLong: "إعادة التعيين خلال أقل من دقيقة واحدة",
  TrayResetsDueNow: "جارٍ إعادة التعيين…",
};

function makeTranslate(table: Record<ResetLocaleKey, string>): ResetTranslate {
  return (key, args) => {
    let out = table[key];
    for (const arg of args) out = out.replace("{}", arg);
    return out;
  };
}

const enTranslate = makeTranslate(EN);
const arTranslate = makeTranslate(AR);

describe("computeCountdownParts", () => {
  it("tiers >=1 day as days+hours", () => {
    const parts = computeCountdownParts((5 * 24 + 13) * 60 * 60_000, "adaptive");
    expect(parts).toEqual({ tier: "day", days: 5, hours: 13 });
  });

  it("tiers <1 day & >=1 hour as hours+minutes", () => {
    const parts = computeCountdownParts((23 * 60 + 59) * 60_000, "adaptive");
    expect(parts).toEqual({ tier: "hour", hours: 23, minutes: 59 });
  });

  it("tiers 4h27m", () => {
    expect(computeCountdownParts((4 * 60 + 27) * 60_000, "adaptive")).toEqual({
      tier: "hour",
      hours: 4,
      minutes: 27,
    });
  });

  it("tiers <1 hour as minutes-only", () => {
    expect(computeCountdownParts(59 * 60_000, "adaptive")).toEqual({ tier: "minute", minutes: 59 });
    expect(computeCountdownParts(51 * 60_000, "adaptive")).toEqual({ tier: "minute", minutes: 51 });
    expect(computeCountdownParts(1 * 60_000, "adaptive")).toEqual({ tier: "minute", minutes: 1 });
  });

  it("tiers <1 minute as lessThanMinute", () => {
    expect(computeCountdownParts(30_000, "adaptive")).toEqual({ tier: "lessThanMinute" });
    expect(computeCountdownParts(0, "adaptive")).toEqual({ tier: "expired" });
  });

  it("tiers <=0 as expired", () => {
    expect(computeCountdownParts(-1, "adaptive")).toEqual({ tier: "expired" });
  });

  it("compact detail collapses to a single largest unit", () => {
    expect(computeCountdownParts((5 * 24 + 13) * 60 * 60_000, "compact")).toEqual({
      tier: "day",
      days: 5,
    });
    expect(computeCountdownParts((4 * 60 + 27) * 60_000, "compact")).toEqual({
      tier: "hour",
      hours: 4,
    });
    expect(computeCountdownParts(51 * 60_000, "compact")).toEqual({ tier: "minute", minutes: 51 });
  });

  it("detailed matches adaptive (never more than two units by default)", () => {
    const diff = (5 * 24 + 13) * 60 * 60_000;
    expect(computeCountdownParts(diff, "detailed")).toEqual(computeCountdownParts(diff, "adaptive"));
  });
});

describe("countdownRefreshIntervalMs", () => {
  it("never implies a 1-second loop for any tier", () => {
    for (const tier of ["day", "hour", "minute", "lessThanMinute", "expired"] as const) {
      expect(countdownRefreshIntervalMs(tier)).toBeGreaterThanOrEqual(30_000);
    }
  });
});

describe("formatCountdown", () => {
  it("formats the day tier in English (compact + long + aria)", () => {
    const result = formatCountdown({ tier: "day", days: 5, hours: 13 }, "en-US", enTranslate);
    expect(result.short).toBe("5d 13h");
    expect(result.long).toBe("Resets in 5d 13h");
    expect(result.ariaLabel).toBe("Resets in 5d 13h");
  });

  it("formats the day tier in Arabic with narrow Latin-digit units", () => {
    const result = formatCountdown({ tier: "day", days: 5, hours: 13 }, "ar-SA", arTranslate);
    expect(result.short).toBe("5 ي 13 س");
    expect(result.long).toContain("5");
    expect(result.long).toContain("13");
    // Latin digits even in Arabic (section 8).
    expect(result.short).not.toMatch(/[٠-٩]/);
  });

  it("formats the hour tier (4h27m)", () => {
    const result = formatCountdown({ tier: "hour", hours: 4, minutes: 27 }, "en-US", enTranslate);
    expect(result.short).toBe("4h 27m");
    expect(result.long).toBe("Resets in 4h 27m");
  });

  it("formats the minute-only tier", () => {
    const result = formatCountdown({ tier: "minute", minutes: 51 }, "en-US", enTranslate);
    expect(result.short).toBe("51m");
    expect(result.long).toBe("Resets in 51m");
  });

  it("formats sub-minute with the dedicated short label, not a stale unit", () => {
    const result = formatCountdown({ tier: "lessThanMinute" }, "en-US", enTranslate);
    expect(result.short).toBe("< 1 min");
    const arResult = formatCountdown({ tier: "lessThanMinute" }, "ar-SA", arTranslate);
    expect(arResult.short).toBe("أقل من 1 د");
  });

  it("formats expired without a stale negative countdown", () => {
    const result = formatCountdown({ tier: "expired" }, "en-US", enTranslate);
    expect(result.short).toBe("Resetting…");
    expect(result.short).not.toMatch(/-\d/);
  });

  it("falls back to a locale-neutral English template when no translate is supplied", () => {
    const result = formatCountdown({ tier: "minute", minutes: 10 }, "en-US");
    expect(result.long).toBe("Resets in 10m");
  });
});

describe("resolveResetTimeZone", () => {
  it("uses the custom zone in custom mode", () => {
    expect(resolveResetTimeZone({ timezoneMode: "custom", customTimeZone: "Asia/Riyadh" })).toBe(
      "Asia/Riyadh",
    );
  });

  it("resolves a real IANA zone in system mode (not a raw UTC offset)", () => {
    const zone = resolveResetTimeZone({ timezoneMode: "system", customTimeZone: null });
    expect(zone.length).toBeGreaterThan(0);
    expect(zone).not.toMatch(/^UTC[+-]/);
  });

  it("falls back to system resolution when custom mode has no zone set", () => {
    const zone = resolveResetTimeZone({ timezoneMode: "custom", customTimeZone: null });
    expect(zone.length).toBeGreaterThan(0);
  });
});

describe("applyResetPreset", () => {
  it("maps countdownOnly to just the countdown module", () => {
    const config = applyResetPreset(defaultResetPresentationConfig(), "countdownOnly");
    expect(config.modules).toEqual(["countdown"]);
  });

  it("maps full to every module", () => {
    const config = applyResetPreset(defaultResetPresentationConfig(), "full");
    expect(config.modules).toEqual(["countdown", "weekday", "date", "time", "timezone"]);
  });

  it("leaves modules untouched for the custom preset", () => {
    const base = { ...defaultResetPresentationConfig(), modules: ["date", "timezone"] as const };
    const config = applyResetPreset({ ...base, modules: [...base.modules] }, "custom");
    expect(config.modules).toEqual(["date", "timezone"]);
  });
});

describe("formatResetPresentation", () => {
  const REF_NOW = Date.UTC(2026, 8, 7, 12, 0, 0); // 2026-09-07T12:00:00Z

  it("never alters the authoritative instant regardless of display config", () => {
    const resetAt = new Date(REF_NOW + 3 * 60 * 60_000).toISOString();
    const a = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "en-US",
      config: { modules: ["date", "time"], timezoneMode: "custom", customTimeZone: "Asia/Tokyo" },
    });
    const b = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "ar-SA",
      config: { modules: ["countdown"], timezoneMode: "custom", customTimeZone: "America/New_York" },
    });
    // Different display configs, same underlying instant -- both must agree
    // on expiry state for the same `now`.
    expect(a.isExpired).toBe(b.isExpired);
    expect(a.isValid).toBe(true);
    expect(b.isValid).toBe(true);
  });

  it("returns structured pieces, not one string", () => {
    const resetAt = new Date(REF_NOW + 90 * 60_000).toISOString();
    const result = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "en-US",
      config: { modules: ["countdown", "date", "time", "weekday", "timezone"], weekdayStyle: "full", timezoneMode: "custom", customTimeZone: "Europe/London" },
      translate: enTranslate,
    });
    expect(result.countdown).not.toBeNull();
    expect(result.date).not.toBeNull();
    expect(result.time).not.toBeNull();
    expect(result.weekday).not.toBeNull();
    expect(result.timezone).toBe("Europe/London");
    expect(result.orderedParts).toEqual(["countdown", "weekday", "date", "time", "timezone"]);
  });

  it("respects a custom module order", () => {
    const resetAt = new Date(REF_NOW + 90 * 60_000).toISOString();
    const result = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "en-US",
      config: { modules: ["date", "countdown"], order: ["date", "countdown"] },
    });
    expect(result.orderedParts).toEqual(["date", "countdown"]);
  });

  it("only includes enabled modules in the result", () => {
    const resetAt = new Date(REF_NOW + 90 * 60_000).toISOString();
    const result = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "en-US",
      config: { modules: ["countdown"] },
    });
    expect(result.countdown).not.toBeNull();
    expect(result.date).toBeNull();
    expect(result.time).toBeNull();
    expect(result.weekday).toBeNull();
    expect(result.timezone).toBeNull();
  });

  it("gracefully handles an unparseable resetAt without throwing", () => {
    const result = formatResetPresentation({ resetAt: "not-a-date", locale: "en-US" });
    expect(result.isValid).toBe(false);
    expect(result.countdown).toBeNull();
  });

  it("uses Latin digits in the date/time output even for Arabic locale", () => {
    const resetAt = new Date(REF_NOW + 90 * 60_000).toISOString();
    const result = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "ar-SA",
      config: { modules: ["date", "time"], timezoneMode: "custom", customTimeZone: "Asia/Riyadh" },
    });
    expect(result.date?.long).not.toMatch(/[٠-٩]/);
    expect(result.time?.short).not.toMatch(/[٠-٩]/);
  });

  it("builds a full non-abbreviated ariaLabel for compact visible text", () => {
    const resetAt = new Date(REF_NOW + (5 * 24 + 13) * 60 * 60_000).toISOString();
    const result = formatResetPresentation({
      resetAt,
      now: REF_NOW,
      locale: "ar-SA",
      config: { modules: ["countdown"] },
      translate: arTranslate,
    });
    expect(result.countdown?.short).toBe("5 ي 13 س");
    expect(result.fullAriaLabel).toBe("إعادة التعيين خلال 5 يوم و13 ساعة");
  });

  it("produces the same absolute instant across DST-observing zones (Europe/London)", () => {
    // A reset at a fixed UTC instant must represent as a different local
    // clock time depending on whether British Summer Time is in effect --
    // the instant itself never moves.
    const summerReset = "2026-07-15T12:00:00.000Z"; // BST (UTC+1)
    const winterReset = "2026-01-15T12:00:00.000Z"; // GMT (UTC+0)
    const summer = formatResetPresentation({
      resetAt: summerReset,
      now: Date.parse(summerReset) - 60_000,
      locale: "en-US",
      config: { modules: ["time"], timezoneMode: "custom", customTimeZone: "Europe/London", clockFormat: "h24" },
    });
    const winter = formatResetPresentation({
      resetAt: winterReset,
      now: Date.parse(winterReset) - 60_000,
      locale: "en-US",
      config: { modules: ["time"], timezoneMode: "custom", customTimeZone: "Europe/London", clockFormat: "h24" },
    });
    expect(summer.time?.short).toBe("13:00");
    expect(winter.time?.short).toBe("12:00");
  });

  it("keeps the reset instant identical across a day rollover in different zones", () => {
    const resetAt = "2026-01-01T00:30:00.000Z";
    const tokyo = formatResetPresentation({
      resetAt,
      now: Date.parse(resetAt) - 60_000,
      locale: "en-US",
      config: { modules: ["date"], timezoneMode: "custom", customTimeZone: "Asia/Tokyo" },
    });
    const nyc = formatResetPresentation({
      resetAt,
      now: Date.parse(resetAt) - 60_000,
      locale: "en-US",
      config: { modules: ["date"], timezoneMode: "custom", customTimeZone: "America/New_York" },
    });
    // Same instant, different local calendar day either side of midnight UTC.
    expect(tokyo.date?.short).toBe("1");
    expect(nyc.date?.short).toBe("31");
  });

  it("supports 12-hour and 24-hour clock format explicitly", () => {
    const resetAt = "2026-09-12T19:00:00.000Z";
    const h24 = formatResetPresentation({
      resetAt,
      now: Date.parse(resetAt) - 60_000,
      locale: "en-US",
      config: { modules: ["time"], timezoneMode: "custom", customTimeZone: "UTC", clockFormat: "h24" },
    });
    const h12 = formatResetPresentation({
      resetAt,
      now: Date.parse(resetAt) - 60_000,
      locale: "en-US",
      config: { modules: ["time"], timezoneMode: "custom", customTimeZone: "UTC", clockFormat: "h12" },
    });
    expect(h24.time?.short).toBe("19:00");
    expect(h12.time?.short).toContain("7:00");
    expect(h12.time?.meridiem).toBe("PM");
  });

  it("forces Latin AM/PM as one token even for a localized-meridiem locale", () => {
    const resetAt = "2026-09-12T19:00:00.000Z";
    const result = formatResetPresentation({
      resetAt,
      now: Date.parse(resetAt) - 60_000,
      locale: "ar-SA",
      config: {
        modules: ["time"],
        timezoneMode: "custom",
        customTimeZone: "UTC",
        clockFormat: "h12",
        meridiemStyle: "latin",
      },
    });
    expect(result.time?.meridiem).toBe("PM");
  });

  it("shows the year only when auto-detected as needed", () => {
    const nextYearReset = "2027-01-15T00:00:00.000Z";
    const sameYearReset = "2026-09-20T00:00:00.000Z";
    const now = Date.UTC(2026, 8, 7);
    const withYear = formatResetPresentation({
      resetAt: nextYearReset,
      now,
      locale: "en-US",
      config: { modules: ["date"], timezoneMode: "custom", customTimeZone: "UTC", yearStyle: "auto" },
    });
    const withoutYear = formatResetPresentation({
      resetAt: sameYearReset,
      now,
      locale: "en-US",
      config: { modules: ["date"], timezoneMode: "custom", customTimeZone: "UTC", yearStyle: "auto" },
    });
    expect(withYear.date?.long).toContain("2027");
    expect(withoutYear.date?.long).not.toContain("2026");
  });
});
