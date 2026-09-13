import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsSnapshot } from "../types/bridge";
import FloatBarSettingsSection from "./SettingsSection";

vi.mock("../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
  useOptionalLocale: () => null,
}));

const settings = {
  floatBarEnabled: true,
  floatBarOpacity: 90,
  floatBarScale: 100,
  floatBarOrientation: "horizontal",
  floatBarStyle: "floating",
  floatBarShowCost: false,
  claudeDailyRoutinesUsageVisible: true,
  claudeAllowReadingClaudeCodeCredentials: false,
  alibabaTokenPlanRegion: "cn",
  weeklyProgressWorkDays: null,
  floatBarShowResetInline: false,
  floatBarDarkText: false,
  floatBarClickThrough: false,
} as unknown as SettingsSnapshot;

describe("FloatBar settings", () => {
  it("offers the catalog-driven orbital HUD style", () => {
    render(
      <FloatBarSettingsSection settings={settings} saving={false} set={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "FloatBarStyle" }));
    expect(screen.getByRole("option", { name: "FloatBarStyleHud" })).toBeTruthy();
  });

  it("renders one cost toggle", () => {
    render(
      <FloatBarSettingsSection settings={settings} saving={false} set={vi.fn()} />,
    );

    expect(screen.getAllByText("FloatBarShowCost")).toHaveLength(1);
  });
});
