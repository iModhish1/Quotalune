import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApplyThemeSheet from "./ApplyThemeSheet";
import { CANONICAL_THEME } from "../../../design-system/themeCatalog";
import type { SettingsSnapshot } from "../../../types/bridge";

const api = vi.hoisted(() => ({ setCatalogTheme: vi.fn(), setAppearanceScope: vi.fn() }));
vi.mock("../../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/tauri")>("../../../lib/tauri");
  return { ...actual, setCatalogTheme: api.setCatalogTheme, setAppearanceScope: api.setAppearanceScope };
});

const baseSnapshot: SettingsSnapshot = {
  catalogTheme: "01-obsidian-orbit",
} as SettingsSnapshot;

function renderSheet(overrides: Partial<Parameters<typeof ApplyThemeSheet>[0]> = {}) {
  const onCancel = overrides.onCancel ?? vi.fn();
  const onApplied = overrides.onApplied ?? vi.fn();
  const { unmount } = render(
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
  return { onCancel, onApplied, unmount };
}

describe("ApplyThemeSheet", () => {
  it("only offers optional scope rows the theme's own recommendedAppearance actually declares — no synthesized Provider Identity row for CANONICAL_THEME", () => {
    renderSheet();
    expect(screen.getByLabelText("Apply Quotalis Logo")).toBeInTheDocument();
    expect(screen.getByLabelText("Apply Tray")).toBeInTheDocument();
    expect(screen.getByLabelText("Apply Background")).toBeInTheDocument();
    expect(screen.queryByLabelText("Apply Provider Identity")).not.toBeInTheDocument();
  });

  it("does not mutate settings merely by opening the sheet", () => {
    renderSheet();
    expect(api.setCatalogTheme).not.toHaveBeenCalled();
    expect(api.setAppearanceScope).not.toHaveBeenCalled();
  });

  it("does not mutate settings when toggling rows, Select All, Clear, or Recommended — only Apply commits", () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Floating Structures"));
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Select All" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Recommended" }));
    expect(api.setCatalogTheme).not.toHaveBeenCalled();
    expect(api.setAppearanceScope).not.toHaveBeenCalled();
  });

  it("Cancel, the X button, and Escape all close with zero mutation", () => {
    const first = renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(first.onCancel).toHaveBeenCalledTimes(1);
    expect(api.setCatalogTheme).not.toHaveBeenCalled();
    expect(api.setAppearanceScope).not.toHaveBeenCalled();
    first.unmount();

    const second = renderSheet();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(second.onCancel).toHaveBeenCalledTimes(1);
    second.unmount();

    const third = renderSheet();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(third.onCancel).toHaveBeenCalledTimes(1);
    expect(api.setCatalogTheme).not.toHaveBeenCalled();
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

  it("Apply calls setCatalogTheme for the main scope and setAppearanceScope only for the checked optional rows, then reports success", async () => {
    api.setCatalogTheme.mockResolvedValue(undefined);
    api.setAppearanceScope.mockResolvedValue(undefined);
    const { onApplied } = renderSheet();
    fireEvent.click(screen.getByLabelText("Apply Quotalis Logo"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(api.setCatalogTheme).toHaveBeenCalledWith(CANONICAL_THEME.slug, "global");
    expect(api.setAppearanceScope).toHaveBeenCalledWith("quotalisLogo", "global");
    expect(api.setAppearanceScope).not.toHaveBeenCalledWith("tray", "global");
    expect(api.setAppearanceScope).not.toHaveBeenCalledWith("workspaceBackground", "global");
  });

  it("Apply with Floating Structures checked clears only the surfaces that currently have an override", async () => {
    api.setCatalogTheme.mockResolvedValue(undefined);
    renderSheet({
      snapshot: { ...baseSnapshot, surfaceCatalogThemes: { top: "smoked-silver" } } as SettingsSnapshot,
    });
    fireEvent.click(screen.getByLabelText("Apply Floating Structures"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() => expect(api.setCatalogTheme).toHaveBeenCalledWith("", "surface:top"));
    expect(api.setCatalogTheme).not.toHaveBeenCalledWith("", "surface:edge");
  });
});
