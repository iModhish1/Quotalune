import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({ TabProfiles: "Profiles", ProfilesPageHelper: "Manage named contexts." })[key] ?? key,
  }),
}));

const bridge = vi.hoisted(() => ({
  createProfile: vi.fn(),
  deleteProfile: vi.fn().mockResolvedValue(undefined),
  duplicateProfile: vi.fn(),
  renameProfile: vi.fn().mockResolvedValue(undefined),
  setAccountProfileMembership: vi.fn().mockResolvedValue(undefined),
  switchProfile: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/profileBridge", () => bridge);

const profileStoreState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../../components/ProfileSwitcher", () => ({
  useProfileStore: () => profileStoreState.current,
}));

vi.mock("../../../lib/tauri", () => ({
  getProviderCatalog: vi.fn().mockResolvedValue([
    { id: "claude", displayName: "Claude", cookieDomain: null },
    { id: "codex", displayName: "Codex", cookieDomain: null },
  ]),
}));

import ProfilesTab from "./ProfilesTab";

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Default",
    description: null,
    enabled: true,
    theme: null,
    catalogTheme: null,
    accent: null,
    surfaces: { edgeArc: false, topArc: false, taskbarArc: false, floatBar: false },
    accountIds: [],
    highUsageThreshold: 80,
    criticalUsageThreshold: 95,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function storeWith(profiles: ReturnType<typeof profile>[], activeProfileId: string, accounts: unknown[] = []) {
  return { schemaVersion: 1, profiles, accounts, activeProfileId };
}

beforeEach(() => {
  vi.clearAllMocks();
  profileStoreState.current = null;
});

describe("ProfilesTab", () => {
  it("shows nothing but the title while the store is loading", () => {
    profileStoreState.current = null;
    render(<ProfilesTab />);
    expect(screen.getByText("Profiles")).toBeTruthy();
  });

  it("lists profiles, marks the active one, and switches on demand", async () => {
    profileStoreState.current = storeWith(
      [profile({ id: "p1", name: "Default" }), profile({ id: "p2", name: "Night" })],
      "p1",
    );
    render(<ProfilesTab />);
    expect(await screen.findByText("Default")).toBeTruthy();
    expect(screen.getByText("Night")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();

    const nightRow = screen.getByText("Night").closest(".profiles-page__row") as HTMLElement;
    fireEvent.click(within(nightRow).getByRole("button", { name: "Switch" }));
    expect(bridge.switchProfile).toHaveBeenCalledWith("p2");
  });

  it("creates a profile and selects it", async () => {
    profileStoreState.current = storeWith([profile()], "p1");
    bridge.createProfile.mockResolvedValue(profile({ id: "p2", name: "Work" }));
    render(<ProfilesTab />);
    fireEvent.click(await screen.findByText("+ New profile"));
    fireEvent.change(screen.getByPlaceholderText("Profile name"), { target: { value: "Work" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(bridge.createProfile).toHaveBeenCalledWith("Work"));
  });

  it("renames a profile inline", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    render(<ProfilesTab />);
    const row = (await screen.findByText("Default")).closest(".profiles-page__row") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Rename Default" }));
    const input = within(row).getByLabelText("New name for Default") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Coding" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(bridge.renameProfile).toHaveBeenCalledWith("p1", "Coding"));
  });

  it("duplicates a profile", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    bridge.duplicateProfile.mockResolvedValue(profile({ id: "p2", name: "Default copy" }));
    render(<ProfilesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Duplicate" }));
    expect(bridge.duplicateProfile).toHaveBeenCalledWith("p1", "Default copy");
  });

  it("disables delete for the last remaining profile (protects the default)", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    render(<ProfilesTab />);
    const deleteButton = await screen.findByRole("button", { name: "Delete" });
    expect(deleteButton).toBeDisabled();
    fireEvent.click(deleteButton);
    expect(bridge.deleteProfile).not.toHaveBeenCalled();
  });

  it("allows deleting a non-last profile", async () => {
    profileStoreState.current = storeWith(
      [profile({ id: "p1", name: "Default" }), profile({ id: "p2", name: "Night" })],
      "p1",
    );
    render(<ProfilesTab />);
    const nightRow = (await screen.findByText("Night")).closest(".profiles-page__row") as HTMLElement;
    fireEvent.click(within(nightRow).getByRole("button", { name: "Delete" }));
    expect(bridge.deleteProfile).toHaveBeenCalledWith("p2");
  });

  it("assigns a theme and catalog theme to the selected profile", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    render(<ProfilesTab />);
    await screen.findByText("Default");
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "dark" } });
    expect(bridge.updateProfile).toHaveBeenCalledWith({ profileId: "p1", theme: "dark" });

    fireEvent.change(screen.getByLabelText("Structure Theme"), {
      target: { value: "01-obsidian-orbit" },
    });
    expect(bridge.updateProfile).toHaveBeenCalledWith({
      profileId: "p1",
      catalogTheme: "01-obsidian-orbit",
    });
  });

  it("toggles a surface for the selected profile", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    render(<ProfilesTab />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Quota Island" }));
    expect(bridge.updateProfile).toHaveBeenCalledWith({ profileId: "p1", topArc: true });
  });

  it("toggles account membership for the selected profile", async () => {
    profileStoreState.current = storeWith(
      [profile({ id: "p1", name: "Default", accountIds: [] })],
      "p1",
      [{ id: "a1", provider: "claude", displayName: "Work", accountIds: [] }],
    );
    render(<ProfilesTab />);
    const accountRow = (await screen.findByText("Work")).closest(
      ".profiles-page__account-row",
    ) as HTMLElement;
    fireEvent.click(within(accountRow).getByRole("checkbox"));
    expect(bridge.setAccountProfileMembership).toHaveBeenCalledWith("a1", "p1", true);
  });

  it("reports errors from a failed action without crashing", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    bridge.updateProfile.mockRejectedValueOnce(new Error("boom"));
    render(<ProfilesTab />);
    fireEvent.change(await screen.findByLabelText("Theme"), { target: { value: "dark" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
