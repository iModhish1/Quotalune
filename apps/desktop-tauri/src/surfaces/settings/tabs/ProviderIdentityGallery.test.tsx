import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
import {PROVIDER_PRESENTATION_IDENTITIES} from "../../../design-system/limitPresentation";
import ProviderIdentityGallery from "./ProviderIdentityGallery";

const api=vi.hoisted(()=>({getSettingsSnapshot:vi.fn(),setGlobalLimitPresentation:vi.fn()}));
vi.mock("../../../lib/tauri",()=>api);
vi.mock("@tauri-apps/api/event",()=>({listen:vi.fn().mockResolvedValue(()=>{})}));
vi.mock("../../../hooks/useLocale",()=>{
  const locale={t:(key:string)=>({ProviderIdentityCountLabel:"identities",ProviderIdentityPreviewShape:"Preview shape",ProviderIdentityPreviewState:"Preview state",ProviderIdentityStateNormal:"Normal",HighUsageAlert:"Warning",CriticalUsageAlert:"Critical",NotificationSoundEventExhausted:"Exhausted",ProviderIdentitySearch:"Find identity",ProviderIdentitySearchPlaceholder:"Glass, light, royal…",ProviderIdentityAdaptiveHelper:"Inherits the active structure",ProviderIdentityLightHelper:"Light identity · protected contrast",ProviderIdentityDarkHelper:"Dark identity · protected contrast",ApplyProviderIdentity:"Apply identity",SelectedProviderIdentity:"Selected",CircularRing:"Circular",HorizontalBar:"Horizontal",VerticalBar:"Vertical"}[key]??key)};
  return {useLocale:()=>locale,useOptionalLocale:()=>locale};
});

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
    const content=screen.getByLabelText("IndicatorContent");
    await waitFor(()=>expect(content).not.toBeDisabled());
    fireEvent.change(content,{target:{value:"bar"}});
    await waitFor(()=>expect(api.setGlobalLimitPresentation).toHaveBeenCalledWith({shape:"ring",content:"bar",direction:"forward",identity:"pearl"}));
    expect(screen.queryByText("73% remaining")).not.toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length * 2);
    fireEvent.change(content,{target:{value:"value"}});
    await waitFor(()=>expect(api.setGlobalLimitPresentation).toHaveBeenLastCalledWith({shape:"ring",content:"value",direction:"forward",identity:"pearl"}));
    expect(screen.getAllByText(/^73%/)).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
  it("previews semantic warning states without persisting synthetic data",async()=>{
    api.getSettingsSnapshot.mockResolvedValue({});
    api.setGlobalLimitPresentation.mockClear();
    const {container}=render(<ProviderIdentityGallery/>);
    await waitFor(()=>expect(screen.getByLabelText("Preview state")).toHaveValue("normal"));
    fireEvent.change(screen.getByLabelText("Preview state"),{target:{value:"critical"}});
    expect(container.querySelectorAll('[data-usage-tone="critical"]')).toHaveLength(PROVIDER_PRESENTATION_IDENTITIES.length);
    expect(api.setGlobalLimitPresentation).not.toHaveBeenCalled();
  });
});
