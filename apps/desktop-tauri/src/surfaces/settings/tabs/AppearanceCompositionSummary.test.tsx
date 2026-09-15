import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppearanceCompositionSummary from "./AppearanceCompositionSummary";

const api = vi.hoisted(() => ({ getSettingsSnapshot: vi.fn(), setAppearanceScope: vi.fn() }));
vi.mock("../../../lib/tauri", () => api);
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

// Mirrors the real en-US.ftl content for the keys this component uses.
const EN_STRINGS: Record<string, string> = {
  AppearanceCompositionTitle: "Appearance Composition",
  AppearanceCompositionDescription: "What owns each part of Quotalis's appearance right now.",
  AppearanceCompositionMainApplication: "Main Application",
  AppearanceCompositionColorMode: "Color Mode",
  AppearanceCompositionFloatingStructures: "Floating Structures",
  AppearanceCompositionQuotalisLogo: "Quotalis Logo",
  AppearanceCompositionProviderIdentity: "Provider Identity",
  AppearanceCompositionTray: "Tray",
  AppearanceCompositionBackground: "Background",
  AppearanceCompositionFollowingMain: "Following Main Application",
  AppearanceCompositionOverrideAction: "Override",
  AppearanceCompositionFollowAction: "Follow Main Application",
  AppearanceCompositionOverrideAriaLabel: "Override {} instead of following Main Application",
  AppearanceCompositionFollowAriaLabel: "Follow Main Application for {}",
  ThemeAutoOption: "Auto (system)",
  ThemeLightOption: "Light",
  ThemeDarkOption: "Dark",
};
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => EN_STRINGS[key] ?? key, language: "english", direction: "ltr" }),
  useOptionalLocale: () => null,
}));

describe("AppearanceCompositionSummary", () => {
  it("shows the resolved main application theme and color mode from real settings", async () => {
    api.getSettingsSnapshot.mockResolvedValue({
      catalogTheme: "smoked-silver",
      theme: "dark",
    });
    render(<AppearanceCompositionSummary />);
    expect(await screen.findByText("Smoked Silver")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("shows 'Following Main Application' for a scope on Global, not a resolved-value placeholder", async () => {
    api.getSettingsSnapshot.mockResolvedValue({
      catalogTheme: "01-obsidian-orbit",
      theme: "auto",
      appearanceComposition: {
        quotalisLogo: "global",
        providerIdentity: "override",
        tray: "override",
        workspaceBackground: "override",
      },
    });
    render(<AppearanceCompositionSummary />);
    await waitFor(() => expect(screen.getAllByText("Following Main Application").length).toBeGreaterThanOrEqual(1));
  });

  it("shows the real explicit value (not a placeholder) for a scope on Override", async () => {
    api.getSettingsSnapshot.mockResolvedValue({
      catalogTheme: "01-obsidian-orbit",
      theme: "auto",
      logoVariant: "aurora",
      appearanceComposition: {
        quotalisLogo: "override",
        providerIdentity: "override",
        tray: "override",
        workspaceBackground: "override",
      },
    });
    render(<AppearanceCompositionSummary />);
    expect(await screen.findByText("Aurora")).toBeInTheDocument();
  });

  it("toggling a scope's Follow/Override button calls setAppearanceScope with the opposite source, and defaults every scope to Override when appearanceComposition is entirely absent (legacy snapshot)", async () => {
    api.getSettingsSnapshot.mockResolvedValue({ catalogTheme: "01-obsidian-orbit", theme: "auto" });
    api.setAppearanceScope.mockResolvedValue(undefined);
    render(<AppearanceCompositionSummary />);
    const trayButton = await screen.findByRole("button", {
      name: "Follow Main Application for Tray",
    });
    fireEvent.click(trayButton);
    await waitFor(() => expect(api.setAppearanceScope).toHaveBeenCalledWith("tray", "global"));
  });
});
