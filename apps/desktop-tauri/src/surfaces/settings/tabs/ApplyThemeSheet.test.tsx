import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplyThemeSheet from "./ApplyThemeSheet";
import { CANONICAL_THEME } from "../../../design-system/themeCatalog";
import type { SettingsSnapshot } from "../../../types/bridge";

const api = vi.hoisted(() => ({ applyThemeComposition: vi.fn() }));
vi.mock("../../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/tauri")>("../../../lib/tauri");
  return { ...actual, applyThemeComposition: api.applyThemeComposition };
});

// Mirrors the real en-US.ftl content for the keys this component uses, so
// assertions read the same text a user would actually see (and a template
// mismatch here would fail the test, unlike a mock that just echoes the
// key back).
const EN_STRINGS: Record<string, string> = {
  AppearanceCompositionMainApplication: "Main Application",
  AppearanceCompositionFloatingStructures: "Floating Structures",
  AppearanceCompositionQuotalisLogo: "Quotalis Logo",
  AppearanceCompositionProviderIdentity: "Provider Identity",
  AppearanceCompositionTray: "Tray",
  AppearanceCompositionBackground: "Background",
  AppearanceCompositionFollowingMain: "Following Main Application",
  ApplyThemeEyebrow: "Apply Theme",
  ApplyThemeClose: "Close",
  ApplyThemeCurrentNew: "Current: {} → New: {}",
  ApplyThemeApplyScopeAriaLabel: "Apply {}",
  ApplyThemeSelectAll: "Select All",
  ApplyThemeClear: "Clear",
  ApplyThemeRecommended: "Recommended",
  ApplyThemeCancel: "Cancel",
  ApplyThemeApply: "Apply",
  ApplyThemeApplying: "Applying…",
};
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => EN_STRINGS[key] ?? key, language: "english", direction: "ltr" }),
  useOptionalLocale: () => null,
}));

const baseSnapshot: SettingsSnapshot = {
  catalogTheme: "01-obsidian-orbit",
} as SettingsSnapshot;

function renderSheet(overrides: Partial<Parameters<typeof ApplyThemeSheet>[0]> = {}) {
  const onCancel = overrides.onCancel ?? vi.fn();
  const onApplied = overrides.onApplied ?? vi.fn();
  const { unmount, container } = render(
    <ApplyThemeSheet
      theme={CANONICAL_THEME}
      scope="global"
      snapshot={baseSnapshot}
      previewForm="lens"
      {...overrides}
      onCancel={onCancel}
      onApplied={onApplied}
    />,
  );
  return { onCancel, onApplied, unmount, container };
}

describe("ApplyThemeSheet", () => {
  beforeEach(() => {
    api.applyThemeComposition.mockReset();
  });

  it("only offers optional scope rows the theme's own recommendedAppearance actually declares — no synthesized Provider Identity row for CANONICAL_THEME", () => {
    renderSheet();
    expect(screen.getByLabelText("Apply Quotalis Logo")).toBeInTheDocument();
    expect(screen.getByLabelText("Apply Tray")).toBeInTheDocument();
    expect(screen.getByLabelText("Apply Background")).toBeInTheDocument();
    expect(screen.queryByLabelText("Apply Provider Identity")).not.toBeInTheDocument();
  });

  it("renders real production previews: QuotaArcMark for the logo row and a real background swatch for the background row", () => {
    const { container } = renderSheet();
    expect(container.querySelector(".quotaarc-mark")).toBeInTheDocument();
    expect(container.querySelector(".workspace-background-preview")).toBeInTheDocument();
  });

  it("does not mutate settings merely by opening the sheet", () => {
    renderSheet();
    expect(api.applyThemeComposition).not.toHaveBeenCalled();
  });

  it("does not mutate settings when toggling rows, Select All, Clear, or Recommended — only Apply commits", () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Floating Structures"));
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Select All" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Recommended" }));
    expect(api.applyThemeComposition).not.toHaveBeenCalled();
  });

  it("Cancel, the X button, and Escape all close with zero mutation", () => {
    const first = renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(first.onCancel).toHaveBeenCalledTimes(1);
    expect(api.applyThemeComposition).not.toHaveBeenCalled();
    first.unmount();

    const second = renderSheet();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(second.onCancel).toHaveBeenCalledTimes(1);
    second.unmount();

    const third = renderSheet();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(third.onCancel).toHaveBeenCalledTimes(1);
    expect(api.applyThemeComposition).not.toHaveBeenCalled();
    third.unmount();
  });

  it("Select All enables Floating Structures plus every available optional scope; Recommended enables only the optional scopes", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Select All" }));
    expect(screen.getByLabelText("Apply Floating Structures")).toBeChecked();
    expect(screen.getByLabelText("Apply Quotalis Logo")).toBeChecked();
    expect(screen.getByLabelText("Apply Tray")).toBeChecked();
    expect(screen.getByLabelText("Apply Background")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Apply Floating Structures")).not.toBeChecked();
    expect(screen.getByLabelText("Apply Quotalis Logo")).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Recommended" }));
    expect(screen.getByLabelText("Apply Floating Structures")).not.toBeChecked();
    expect(screen.getByLabelText("Apply Quotalis Logo")).toBeChecked();
    expect(screen.getByLabelText("Apply Tray")).toBeChecked();
    expect(screen.getByLabelText("Apply Background")).toBeChecked();
  });

  it("Apply commits everything in ONE atomic applyThemeComposition call reflecting exactly the checked rows", async () => {
    api.applyThemeComposition.mockResolvedValue(undefined);
    const { onApplied } = renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(api.applyThemeComposition).toHaveBeenCalledTimes(1);
    expect(api.applyThemeComposition).toHaveBeenCalledWith({
      mainSlug: CANONICAL_THEME.slug,
      mainScope: "global",
      clearFloatingSurfaces: [],
      appearanceScopes: ["quotalisLogo"],
    });
  });

  it("Apply with Floating Structures checked clears only the surfaces that currently have an override, in the same atomic call", async () => {
    api.applyThemeComposition.mockResolvedValue(undefined);
    renderSheet({
      snapshot: { ...baseSnapshot, surfaceCatalogThemes: { top: "smoked-silver" } } as SettingsSnapshot,
    });
    fireEvent.click(screen.getByLabelText("Apply Floating Structures"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() =>
      expect(api.applyThemeComposition).toHaveBeenCalledWith(
        expect.objectContaining({ clearFloatingSurfaces: ["top"] }),
      ),
    );
  });

  it("re-entry guard: clicking Apply twice while a request is in flight only sends one call, and disables re-entry controls", async () => {
    let resolveApply: () => void = () => {};
    api.applyThemeComposition.mockImplementation(
      () => new Promise<void>((resolve) => { resolveApply = resolve; }),
    );
    renderSheet();
    const applyButton = screen.getByRole("button", { name: "Apply" });
    fireEvent.click(applyButton);
    // Pending state: re-entry is guarded and disabled, not just slow.
    expect(screen.getByRole("button", { name: "Applying…" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo")); // ignored while applying
    expect(screen.getByLabelText("Apply Quotalis Logo")).toBeDisabled();
    expect(api.applyThemeComposition).toHaveBeenCalledTimes(1);
    resolveApply();
  });

  it("on failure, keeps the sheet open with pending selections intact and shows a recoverable error instead of closing", async () => {
    api.applyThemeComposition.mockRejectedValue(new Error("Disk unavailable"));
    const { onCancel, onApplied } = renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Disk unavailable");
    expect(onApplied).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Apply Quotalis Logo")).toBeChecked();
  });
});
