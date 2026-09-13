import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { locale } = vi.hoisted(() => ({
  locale: {
    t: (key: string) =>
      ({ TabProfiles: "Profiles", ProfilesPageHelper: "Manage named contexts.", ProfilesActive: "Active", ProfilesSwitch: "Switch", ProfilesRename: "Rename", ProfilesDuplicate: "Duplicate", ProfilesDelete: "Delete", ProfilesSave: "Save", ProfilesCancel: "Cancel", ProfilesAdd: "Add", ProfilesNew: "New profile", ProfilesName: "Profile name", ProfilesNewName: "New profile name", ProfilesEditName: "New name for {}", ProfilesCopySuffix: "copy", ProfilesOrder: "Profile order", ProfilesMoveEarlier: "Move earlier", ProfilesMoveLater: "Move later", ProfilesDeleteConfirm: "Confirm deletion", ProfilesDeleteHelp: "Removes this profile and its preferences. Provider accounts and credentials are kept.", ProfilesLastProtected: "The last profile cannot be deleted", ProfilesEditingHelp: "Edit this context, then activate it with Switch. Account sign-in stays in Providers.", ProfilesSearchAccounts: "Search accounts or providers", ProfilesNoMatches: "No matching accounts. Clear the search to see all accounts.", ProfilesNoAccounts: "No provider accounts yet.", ProfilesInheritTheme: "Inherit global theme", ProfilesStructureTheme: "Structure Theme", ProfilesSurfaces: "Surfaces active in this profile", ThemeLabel: "Theme", ThemeAutoOption: "Auto (system)", ThemeLightOption: "Light", ThemeDarkOption: "Dark" } as Record<string, string>)[key] ?? key,
  },
}));
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => locale,
  useOptionalLocale: () => locale,
}));

/** Structure Theme uses QuotalisSelect (trigger button + portal
 *  option list), not native <select>s -- open the trigger, then click the
 *  matching option. */
async function chooseQuotalisOption(triggerLabel: string, optionName: string) {
  fireEvent.click(await screen.findByLabelText(triggerLabel));
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
}

const bridge = vi.hoisted(() => ({
  createProfile: vi.fn(),
  deleteProfile: vi.fn().mockResolvedValue(undefined),
  duplicateProfile: vi.fn(),
  reorderProfiles: vi.fn().mockResolvedValue(undefined),
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
  it("exposes all appearance choices and clears only the selected profile override", async () => {
    profileStoreState.current = storeWith([profile({theme:"light"})],"p1");
    render(<ProfilesTab/>);
    const choices = await screen.findByRole("group", {name:"Theme"});
    expect(within(choices).getAllByRole("button")).toHaveLength(4);
    expect(within(choices).getByRole("button",{name:"Light"})).toHaveAttribute("aria-pressed","true");
    fireEvent.click(within(choices).getByRole("button",{name:"Inherit global theme"}));
    expect(bridge.updateProfile).toHaveBeenCalledWith({profileId:"p1",theme:null});
    expect(bridge.switchProfile).not.toHaveBeenCalled();
  });
  it("reorders by stable ids without activating a different profile", async()=>{
    profileStoreState.current=storeWith([profile(),profile({id:'p2',name:'Work'})],'p1');
    render(<ProfilesTab/>);
    fireEvent.click(await screen.findByRole('button',{name:'Move earlier Work'}));
    expect(bridge.reorderProfiles).toHaveBeenCalledWith(['p2','p1']);
    expect(bridge.switchProfile).not.toHaveBeenCalled();
  });

  it("cancels rename without saving on blur and has no nested input in a button",async()=>{
    profileStoreState.current=storeWith([profile()],'p1');
    render(<ProfilesTab/>);
    fireEvent.click(await screen.findByRole('button',{name:'Rename Default'}));
    const input=screen.getByLabelText('New name for Default');
    expect(input.closest('button')).toBeNull();
    fireEvent.change(input,{target:{value:'Discard me'}});fireEvent.blur(input);
    expect(bridge.renameProfile).not.toHaveBeenCalled();
    fireEvent.keyDown(input,{key:'Escape'});
    expect(screen.queryByLabelText('New name for Default')).toBeNull();
    expect(bridge.renameProfile).not.toHaveBeenCalled();
  });

  it("filters membership without changing hidden accounts",async()=>{
    profileStoreState.current=storeWith([profile()],'p1',[
      {id:'a1',provider:'claude',displayName:'Work'},{id:'a2',provider:'codex',displayName:'Home'}]);
    render(<ProfilesTab/>);
    fireEvent.change(await screen.findByLabelText('Search accounts or providers'),{target:{value:'claude'}});
    expect(screen.queryByText('Home')).toBeNull();expect(screen.getByText('Work')).toBeInTheDocument();
    expect(bridge.setAccountProfileMembership).not.toHaveBeenCalled();
  });

  it("blocks repeated submissions while a create is pending",async()=>{
    profileStoreState.current=storeWith([profile()],'p1');
    let finish!:(value:ReturnType<typeof profile>)=>void;
    bridge.createProfile.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    render(<ProfilesTab/>);
    fireEvent.click(await screen.findByText('+ New profile'));
    const input=screen.getByLabelText('New profile name');fireEvent.change(input,{target:{value:'Work'}});
    fireEvent.submit(input.closest('form')!);fireEvent.submit(input.closest('form')!);
    expect(bridge.createProfile).toHaveBeenCalledTimes(1);
    finish(profile({id:'p2',name:'Work'}));
    await waitFor(()=>expect(screen.queryByLabelText('New profile name')).toBeNull());
  });
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
    expect(await screen.findAllByText("Default").then(nodes=>nodes[0])).toBeTruthy();
    expect(screen.getByText("Night")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();

    const nightRow = screen.getByText("Night").closest(".profiles-page__row") as HTMLElement;
    fireEvent.click(within(nightRow).getByRole("button", { name: "Switch Night" }));
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
    const row = (await screen.findAllByText("Default").then(nodes=>nodes[0])).closest(".profiles-page__row") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Rename Default" }));
    const input = within(row).getByLabelText("New name for Default") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Coding" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(bridge.renameProfile).toHaveBeenCalledWith("p1", "Coding"));
  });

  it("duplicates a profile", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    bridge.duplicateProfile.mockResolvedValue(profile({ id: "p2", name: "Default copy" }));
    render(<ProfilesTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Duplicate Default" }));
    expect(bridge.duplicateProfile).toHaveBeenCalledWith("p1", "Default copy");
  });

  it("disables delete for the last remaining profile (protects the default)", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    render(<ProfilesTab />);
    const deleteButton = await screen.findByRole("button", { name: "Delete Default" });
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
    fireEvent.click(within(nightRow).getByRole("button", { name: "Delete Night" }));
    expect(bridge.deleteProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name:"Confirm deletion"}));
    expect(bridge.deleteProfile).toHaveBeenCalledWith("p2");
  });

  it("assigns a theme and catalog theme to the selected profile", async () => {
    profileStoreState.current = storeWith([profile({ id: "p1", name: "Default" })], "p1");
    render(<ProfilesTab />);
    await screen.findAllByText("Default").then(nodes=>nodes[0]);
    fireEvent.click(await screen.findByRole("button", {name:"Dark"}));
    expect(bridge.updateProfile).toHaveBeenCalledWith({ profileId: "p1", theme: "dark" });

    await chooseQuotalisOption("Structure Theme", "Obsidian Orbit");
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
    fireEvent.click(await screen.findByRole("button", {name:"Dark"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
