import { describe, expect, it } from "vitest";
import {
  dtoToResetSettings,
  resetSettingsToDto,
  resolveRegionalLocale,
  type ResetPresentationSettingsDto,
} from "./resetPresentationSettings";
import { defaultResetPresentationConfig } from "./resetPresentation";

function baseDto(): ResetPresentationSettingsDto {
  return {
    preset: "full",
    modules: ["countdown", "date", "weekday"],
    order: ["weekday", "countdown", "date"],
    timezoneMode: "custom",
    timezoneId: "Asia/Riyadh",
    regionalFormat: "custom",
    regionalLocale: "en-GB",
    clockFormat: "h24",
    meridiemStyle: "latin",
    monthStyle: "full",
    weekdayStyle: "short",
    yearStyle: "on",
    countdownDetail: "detailed",
    numberingSystem: "latn",
  };
}

describe("dtoToResetSettings", () => {
  it("returns the safe default when given no dto (fresh install / unmigrated settings)", () => {
    const { config, regionalFormat } = dtoToResetSettings(undefined);
    expect(config).toEqual(defaultResetPresentationConfig());
    expect(regionalFormat).toBe("system");
  });

  it("maps every field from a fully-populated dto", () => {
    const { config, regionalFormat, regionalLocale } = dtoToResetSettings(baseDto());
    expect(config.preset).toBe("full");
    expect(config.modules).toEqual(["countdown", "date", "weekday"]);
    expect(config.order).toEqual(["weekday", "countdown", "date"]);
    expect(config.timezoneMode).toBe("custom");
    expect(config.customTimeZone).toBe("Asia/Riyadh");
    expect(config.clockFormat).toBe("h24");
    expect(config.meridiemStyle).toBe("latin");
    expect(config.monthStyle).toBe("full");
    expect(config.weekdayStyle).toBe("short");
    expect(config.yearStyle).toBe("on");
    expect(config.countdownDetail).toBe("detailed");
    expect(regionalFormat).toBe("custom");
    expect(regionalLocale).toBe("en-GB");
  });

  it("sanitizes an unknown module id rather than crashing", () => {
    const dto = { ...baseDto(), modules: ["countdown", "made-up-module" as never] };
    const { config } = dtoToResetSettings(dto);
    expect(config.modules).toEqual(["countdown"]);
  });

  it("appends an enabled module missing from a corrupt order instead of dropping it", () => {
    const dto = { ...baseDto(), modules: ["countdown", "timezone"], order: ["countdown"] };
    const { config } = dtoToResetSettings(dto);
    expect(config.order).toContain("timezone");
  });

  it("falls back to custom preset for an unrecognized preset string", () => {
    const dto = { ...baseDto(), preset: "not-a-real-preset" };
    const { config } = dtoToResetSettings(dto);
    expect(config.preset).toBe("custom");
  });

  it("round-trips through resetSettingsToDto", () => {
    const dto = baseDto();
    const { config, regionalFormat, regionalLocale } = dtoToResetSettings(dto);
    const roundTripped = resetSettingsToDto(config, regionalFormat, regionalLocale);
    expect(roundTripped).toEqual(dto);
  });
});

describe("resolveRegionalLocale", () => {
  it("uses the custom locale when regionalFormat is custom", () => {
    expect(resolveRegionalLocale("custom", "en-US", "en-GB")).toBe("en-GB");
  });

  it("falls back to the UI locale when custom has no locale set", () => {
    expect(resolveRegionalLocale("custom", "en-US", null)).toBe("en-US");
  });

  it("always uses the UI locale for uiLanguage mode", () => {
    expect(resolveRegionalLocale("uiLanguage", "ar-SA", "en-GB")).toBe("ar-SA");
  });

  it("resolves a real locale tag for system mode", () => {
    const resolved = resolveRegionalLocale("system", "en-US", null);
    expect(resolved.length).toBeGreaterThan(0);
  });
});
