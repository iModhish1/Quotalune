import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ThemeGallery from "./ThemeGallery";

const mocks = vi.hoisted(() => ({
  settings: {
    catalogTheme: "03-solar-ember",
    activeProfileCatalogTheme: "02-aurora-bloom",
    surfaceCatalogThemes: { taskbar: "12-crimson-nova" } as Record<string, string>,
  },
  setCatalogTheme: vi.fn(),
  getProfileStore: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock("../../../lib/tauri", () => ({
  getSettingsSnapshot: vi.fn(() => Promise.resolve({ ...mocks.settings })),
  setCatalogTheme: mocks.setCatalogTheme,
}));
vi.mock("../../../lib/profileBridge", () => ({
  getProfileStore: mocks.getProfileStore,
}));
vi.mock("../../../components/CatalogUsageHero", () => ({
  default: ({ catalog }: { catalog: string }) => <div data-testid={`preview-${catalog}`} />,
}));

describe("ThemeGallery scope precedence", () => {
  beforeEach(() => {
    mocks.setCatalogTheme.mockReset().mockResolvedValue(undefined);
    mocks.getProfileStore.mockResolvedValue({
      activeProfileId: "profile-a",
      profiles: [{ id: "profile-a", name: "Coding", catalogTheme: "02-aurora-bloom" }],
      accounts: [],
      schemaVersion: 1,
    });
  });

  it("shows global, profile and surface provenance", async () => {
    render(<ThemeGallery />);

    expect(await screen.findByText("Global theme")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Current profile" }));
    expect(await screen.findByText("Profile override · Coding")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Taskbar" }));
    expect(await screen.findByText("Surface override · Taskbar")).toBeTruthy();
  });

  it("persists through the selected scope and can resume inheritance", async () => {
    render(<ThemeGallery />);
    await screen.findByText("Global theme");
    fireEvent.click(screen.getByRole("tab", { name: "Taskbar" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply theme Obsidian Orbit" }));
    await waitFor(() =>
      expect(mocks.setCatalogTheme).toHaveBeenCalledWith(
        "01-obsidian-orbit",
        "surface:taskbar",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Use inherited theme" }));
    await waitFor(() =>
      expect(mocks.setCatalogTheme).toHaveBeenCalledWith("", "surface:taskbar"),
    );
  });
});
