import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ThemeGallery from "./ThemeGallery";
import { THEME_CATALOG } from "../../../design-system/themeCatalog";

const api=vi.hoisted(()=>({getSettingsSnapshot:vi.fn(),setCatalogTheme:vi.fn(),applyThemeComposition:vi.fn()}));
vi.mock("../../../lib/tauri",async()=>{
  const actual=await vi.importActual<typeof import("../../../lib/tauri")>("../../../lib/tauri");
  return {...actual,getSettingsSnapshot:api.getSettingsSnapshot,setCatalogTheme:api.setCatalogTheme,applyThemeComposition:api.applyThemeComposition};
});
vi.mock("@tauri-apps/api/event",()=>({listen:vi.fn().mockResolvedValue(()=>{})}));

// ApplyThemeSheet (rendered by ThemeGallery on global-scope Apply) uses the
// strict useLocale(), unlike ThemeGallery's own useOptionalLocale-backed
// useSettingsCopy() which already tolerates a missing provider — mirrors
// the real en-US.ftl content for the keys the sheet uses.
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

/** These fields are QuotalisSelects (trigger button + portal-rendered
 *  option list), not native <select>s -- open the trigger, then click the
 *  matching option. */
async function chooseQuotalisOption(triggerLabel:string,optionName:string){
  fireEvent.click(await screen.findByLabelText(triggerLabel));
  fireEvent.click(await screen.findByRole("option",{name:optionName}));
}

describe("ThemeGallery canonical foundation", () => {
  it('previews another structure and expands only the focused card without persisting',async()=>{
    api.getSettingsSnapshot.mockResolvedValue({catalogTheme:'smoked-silver'});
    api.setCatalogTheme.mockClear();
    const {container}=render(<ThemeGallery/>);
    const apply=screen.getByRole('button',{name:'Apply Aurora Bloom'});
    await waitFor(()=>expect(apply).not.toBeDisabled());
    await chooseQuotalisOption('Theme preview structure','Seam');
    expect(screen.getAllByLabelText('seam provider selector')).toHaveLength(THEME_CATALOG.length);
    fireEvent.focus(apply);
    expect(container.querySelectorAll('.structure-preview__stage[data-expanded=true]')).toHaveLength(1);
    fireEvent.blur(apply);
    expect(container.querySelectorAll('.structure-preview__stage[data-expanded=true]')).toHaveLength(0);
    expect(api.setCatalogTheme).not.toHaveBeenCalled();
  });
  it('applies to a surface and clears its override without changing global material',async()=>{
    api.getSettingsSnapshot.mockResolvedValue({catalogTheme:'smoked-silver',activeProfileCatalogTheme:'tidal-glass'});
    api.setCatalogTheme.mockResolvedValue(undefined);
    render(<ThemeGallery/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Apply Ember Alloy'})).not.toBeDisabled());
    await chooseQuotalisOption('Theme assignment','top surface');
    expect(screen.getByText('Effective source: Current profile')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Apply Ember Alloy'}));
    await waitFor(()=>expect(api.setCatalogTheme).toHaveBeenCalledWith('ember-alloy','surface:top'));
    await waitFor(()=>expect(screen.getByText('Effective source: surface')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button',{name:'Use inherited theme'}));
    await waitFor(()=>expect(api.setCatalogTheme).toHaveBeenCalledWith('','surface:top'));
    await waitFor(()=>expect(screen.getByText('Effective source: Current profile')).toBeInTheDocument());
  });
  it("keeps the previous selection when persistence fails (Wave 1B: failure now surfaces inside the Apply Theme sheet)", async()=>{
    api.getSettingsSnapshot.mockResolvedValue({catalogTheme:"01-obsidian-orbit"});
    api.applyThemeComposition.mockRejectedValue(new Error("Disk unavailable"));
    render(<ThemeGallery/>);
    const button=screen.getByRole("button",{name:"Apply Ember Alloy"});
    await waitFor(()=>expect(button).not.toBeDisabled());
    // Global-scope Apply now opens the scope sheet instead of mutating
    // immediately (§10) — commit from inside it.
    fireEvent.click(button);
    await screen.findByRole("dialog",{name:"Apply Ember Alloy"});
    fireEvent.click(screen.getByRole("button",{name:"Apply"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Disk unavailable");
    expect(button).toHaveAttribute("aria-pressed","false");
  });
  it("persists an explicit material selection with real component previews (Wave 1B: via the Apply Theme sheet)", async () => {
    api.getSettingsSnapshot.mockResolvedValue({catalogTheme:"01-obsidian-orbit"});
    api.applyThemeComposition.mockResolvedValue(undefined);
    render(<ThemeGallery />);

    const button=await screen.findByRole("button",{name:"Apply Sapphire Observatory"});
    await waitFor(()=>expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await screen.findByRole("dialog",{name:"Apply Sapphire Observatory"});
    fireEvent.click(screen.getByRole("button",{name:"Apply"}));
    await waitFor(()=>expect(api.applyThemeComposition).toHaveBeenCalledWith(expect.objectContaining({mainSlug:"sapphire-observatory",mainScope:"global"})));
    expect(screen.getAllByLabelText("lens provider selector")).toHaveLength(THEME_CATALOG.length);
    expect(screen.getByText("Observatory reticle · reticle motion")).toBeInTheDocument();
    expect(screen.getByText("Titanium shutter · shutter motion")).toBeInTheDocument();
    expect(screen.getAllByText("Frame")).toHaveLength(THEME_CATALOG.length);
    expect(screen.getAllByText("Meter")).toHaveLength(THEME_CATALOG.length);
    expect(screen.getAllByText("Motion")).toHaveLength(THEME_CATALOG.length);
    expect(screen.getAllByText("210ms").length).toBeGreaterThanOrEqual(1);
  });
  it("Global-scope Apply opens the scope sheet and does not mutate settings until the sheet's own Apply is clicked", async () => {
    api.getSettingsSnapshot.mockResolvedValue({catalogTheme:"01-obsidian-orbit"});
    api.applyThemeComposition.mockClear();
    render(<ThemeGallery/>);
    const button=await screen.findByRole("button",{name:"Apply Ember Alloy"});
    await waitFor(()=>expect(button).not.toBeDisabled());
    fireEvent.click(button);
    expect(await screen.findByRole("dialog",{name:"Apply Ember Alloy"})).toBeInTheDocument();
    expect(api.applyThemeComposition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    expect(screen.queryByRole("dialog",{name:"Apply Ember Alloy"})).not.toBeInTheDocument();
    expect(api.applyThemeComposition).not.toHaveBeenCalled();
  });
});
