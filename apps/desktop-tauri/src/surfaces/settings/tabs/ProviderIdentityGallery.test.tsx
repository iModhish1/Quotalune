import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
import {PROVIDER_PRESENTATION_IDENTITIES} from "../../../design-system/limitPresentation";
import ProviderIdentityGallery from "./ProviderIdentityGallery";

const api=vi.hoisted(()=>({getSettingsSnapshot:vi.fn(),setGlobalLimitPresentation:vi.fn()}));
vi.mock("../../../lib/tauri",()=>api);
vi.mock("@tauri-apps/api/event",()=>({listen:vi.fn().mockResolvedValue(()=>{})}));
vi.mock("../../../hooks/useLocale",()=>{
  const locale={t:(key:string)=>({ProviderIdentityCountLabel:"identities",ProviderIdentityPreviewShape:"Preview shape",ProviderIdentityPreviewState:"Preview state",ProviderIdentityStateNormal:"Normal",HighUsageAlert:"Warning",CriticalUsageAlert:"Critical",NotificationSoundEventExhausted:"Exhausted",ProviderIdentitySearch:"Find identity",ProviderIdentitySearchPlaceholder:"Glass, light, royal…",ProviderIdentityAdaptiveHelper:"Uses the provider presentation recommended by the active Structure Theme.",ProviderIdentityLightHelper:"Light identity · protected contrast",ProviderIdentityDarkHelper:"Dark identity · protected contrast",ApplyProviderIdentity:"Apply identity",SelectedProviderIdentity:"Selected",CircularRing:"Circular",HorizontalBar:"Horizontal",VerticalBar:"Vertical",ProviderPresentationFollowStructureName:"Follow Structure",ProviderPresentationRecommendedBadge:"Recommended",ProviderPresentationSourceLabel:"Provider Presentation",ProviderPresentationFollowingPrefix:"Following",ProviderPresentationIndependentLabel:"Independent"}[key]??key)};
  return {useLocale:()=>locale,useOptionalLocale:()=>locale};
});

/** These controls are QuotalisSelects (trigger button + portal-rendered
 *  option list), not native <select>s -- open the trigger, then click the
 *  matching option. */
async function chooseQuotalisOption(triggerLabel:string,optionName:string){
  fireEvent.click(await screen.findByLabelText(triggerLabel));
  fireEvent.click(await screen.findByRole("option",{name:optionName}));
}

describe("ProviderIdentityGallery",()=>{
  it("shows every independent identity and preserves the indicator configuration when applying one",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({globalLimitPresentation:{shape:"vertical",content:"bar",direction:"reverse",identity:"graphite"}});
    api.setGlobalLimitPresentation.mockResolvedValue(undefined);
    render(<ProviderIdentityGallery/>);
    expect(screen.getByText(`${PROVIDER_PRESENTATION_IDENTITIES.length} identities`)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Usage limits")).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length);
    const apply=screen.getByRole("button",{name:"Apply identity Royal Amethyst"});
    await waitFor(()=>expect(apply).not.toBeDisabled());
    fireEvent.click(apply);
    await waitFor(()=>expect(api.setGlobalLimitPresentation).toHaveBeenCalledWith({shape:"vertical",content:"bar",direction:"reverse",identity:"royal"}));
  });
  it("filters without changing the persisted selection",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({});
    api.setGlobalLimitPresentation.mockClear();
    render(<ProviderIdentityGallery/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Apply identity Royal Amethyst"})).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("Find identity"),{target:{value:"porcelain"}});
    expect(screen.getAllByLabelText("Usage limits")).toHaveLength(1);
    expect(api.setGlobalLimitPresentation).not.toHaveBeenCalled();
  });
  it("persists shape, content and direction controls as one coherent presentation",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({globalLimitPresentation:{shape:"ring",content:"both",direction:"forward",identity:"pearl"}});
    api.setGlobalLimitPresentation.mockClear();
    api.setGlobalLimitPresentation.mockResolvedValue(undefined);
    render(<ProviderIdentityGallery/>);
    await waitFor(()=>expect(screen.getByLabelText("IndicatorContent")).not.toBeDisabled());
    await chooseQuotalisOption("IndicatorContent","BarOnly");
    await waitFor(()=>expect(api.setGlobalLimitPresentation).toHaveBeenCalledWith({shape:"ring",content:"bar",direction:"forward",identity:"pearl"}));
    expect(screen.queryByText("73% remaining")).not.toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length * 2);
    await chooseQuotalisOption("IndicatorContent","PercentageOnly");
    await waitFor(()=>expect(api.setGlobalLimitPresentation).toHaveBeenLastCalledWith({shape:"ring",content:"value",direction:"forward",identity:"pearl"}));
    expect(screen.getAllByText(/^73%/)).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it("previews semantic warning states without persisting synthetic data",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({});
    api.setGlobalLimitPresentation.mockClear();
    const {container}=render(<ProviderIdentityGallery/>);
    await waitFor(()=>expect(screen.getByLabelText("Preview state")).toHaveTextContent("Normal"));
    await chooseQuotalisOption("Preview state","Critical");
    expect(container.querySelectorAll('[data-usage-tone="critical"]')).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length);
    expect(api.setGlobalLimitPresentation).not.toHaveBeenCalled();
  });
  it("shows 'Follow Structure' (not 'Adaptive') with a Recommended badge, and reframes the provenance line when adaptive is active (Wave 6 Phase 4)",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({globalLimitPresentation:{shape:"ring",content:"both",direction:"forward",identity:"adaptive"},catalogTheme:"01-obsidian-orbit"});
    const {container}=render(<ProviderIdentityGallery/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Apply identity Follow Structure"})).toBeInTheDocument());
    // "Adaptive" no longer appears anywhere as a user-facing label.
    expect(screen.queryByText("Adaptive")).not.toBeInTheDocument();
    expect(screen.getByText("Follow Structure")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    const provenance=container.querySelector(".provider-identity-gallery__provenance");
    expect(provenance?.textContent).toMatch(/Following/);
    expect(provenance?.textContent).toMatch(/Provider Presentation/);
  });
  it("reports Independent provenance with the resolved identity's display name when a non-adaptive identity is active",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({globalLimitPresentation:{shape:"ring",content:"both",direction:"forward",identity:"precision"}});
    const {container}=render(<ProviderIdentityGallery/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Apply identity Precision"})).toBeInTheDocument());
    const provenance=container.querySelector(".provider-identity-gallery__provenance");
    expect(provenance?.textContent).toMatch(/Independent/);
    expect(provenance?.textContent).toMatch(/Precision/);
  });
});
