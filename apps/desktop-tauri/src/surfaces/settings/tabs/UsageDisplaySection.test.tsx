import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  SettingsSnapshot,
} from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getSettingsSnapshot: vi.fn(),
  setUsageSettings: vi.fn(),
  setProviderDetailWindow: vi.fn(),
  setProviderLimitOrder: vi.fn(),
  setProviderLimitPresentation: vi.fn(),
  setGlobalLimitPresentation: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const providerMocks = vi.hoisted(() => ({
  useProviders: vi.fn(),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);
vi.mock("../../../hooks/useProviders", () => providerMocks);
vi.mock("../../../hooks/useLocale", () => {
  const locale={t: (key: string) => ({
    UseProviderLimitDefaults: "Use provider defaults",
    UseDefaultIndicator: "Use default indicator",
    UseGlobalPresentation: "Use global presentation",
    ProviderPresentationIdentity: "Provider presentation identity",
    ProviderPresentationIdentityHelper: "Styles values and tracks.",
    ProviderPresentationGlobalTitle: "Provider identity and limit presentation",
    ProviderPresentationGlobalHelper: "Every provider inherits this complete visual identity unless customized.",
    GlobalDefault: "Global default",
    ShowLimit: "Show", MoveLimitEarlier: "Move earlier", MoveLimitLater: "Move later", ForProvider: "for",
    HorizontalBar: "Horizontal bar", VerticalBar: "Vertical bar", CircularRing: "Circular ring",
    IndicatorContent: "Content", LimitContentAria: "Limit content for", LimitDirectionAria: "Limit direction for",
    BarAndPercentage: "Bar and percentage", BarOnly: "Bar only", PercentageOnly: "Percentage only",
    LeftToRight: "Left to right", RightToLeft: "Right to left",
    LimitFiveHourLabel: "5-hour", LimitWeeklyLabel: "Weekly", ProviderSessionLabel: "Session",
    FloatBarRemainingSuffix: "remaining", PanelUsedSuffix: "used", ResetUnavailableShort: "Reset unavailable",
    ResetsInShort: "Resets in", ResetLabelPrefix: "Reset",
  }[key] ?? key)};
  return {useLocale:()=>locale,useOptionalLocale:()=>locale};
});

import UsageDisplaySection from "./UsageDisplaySection";

/** Usage display mode is a QuotalisSelect (trigger button + portal-
 *  rendered option list), not a native <select> -- open the trigger,
 *  then click the matching option. */
async function chooseQuotalisOption(triggerLabel: string, optionName: string) {
  fireEvent.click(await screen.findByLabelText(triggerLabel));
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
}

const catalog: ProviderCatalogEntry[] = [
  { id: "codex", displayName: "Codex", cookieDomain: null },
  { id: "claude", displayName: "Claude", cookieDomain: null },
  { id: "gemini", displayName: "Gemini", cookieDomain: null },
];

function usage(
  providerId: string,
  displayName: string,
  remainingPercent: number,
): ProviderUsageSnapshot {
  const window = {
    usedPercent: 100 - remainingPercent,
    remainingPercent,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
  };
  return {
    providerId,
    displayName,
    primary: window,
    selectedMetric: window,
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "test",
    updatedAt: "2026-09-04T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
  };
}

const settings = {
  usageDisplayMode: "remaining",
  providerUsageOverrides: {},
} as SettingsSnapshot;

describe("UsageDisplaySection", () => {
  it('persists a global provider identity and lets providers inherit or override it',async()=>{
    tauriMocks.getSettingsSnapshot.mockResolvedValue({...settings,globalLimitPresentation:{shape:'ring',content:'both',direction:'forward',identity:'pearl'}});
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    expect(await screen.findByRole('radio',{name:'Pearl identity for all providers'})).toBeChecked();
    expect(screen.getByRole('radio',{name:'Pearl identity for Codex'})).toBeChecked();
    fireEvent.click(screen.getByRole('radio',{name:'Signal identity for all providers'}));
    await waitFor(()=>expect(tauriMocks.setGlobalLimitPresentation).toHaveBeenCalledWith({shape:'ring',content:'both',direction:'forward',identity:'signal'}));
    expect(screen.getByRole('radio',{name:'Signal identity for Codex'})).toBeChecked();
    fireEvent.click(screen.getByRole('radio',{name:'Glass identity for Codex'}));
    await waitFor(()=>expect(tauriMocks.setProviderLimitPresentation).toHaveBeenCalledWith('codex',{shape:'ring',content:'both',direction:'forward',identity:'glass'}));
    fireEvent.click(screen.getByRole('radio',{name:'Prism identity for all providers'}));
    await waitFor(()=>expect(screen.getByRole('radio',{name:'Glass identity for Codex'})).toBeChecked());
  });
  it('keeps an offline provider with only presentation customization visible',async()=>{
    tauriMocks.getSettingsSnapshot.mockResolvedValue({...settings,providerLimitPresentation:{gemini:{shape:'ring',content:'value',direction:'reverse'}}});
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    expect(await screen.findByRole('radio',{name:'Circular ring for Gemini'})).toBeChecked();
  });
  it('collapses heavy per-provider editors when several providers are shown',async()=>{
    providerMocks.useProviders.mockReturnValue({providers:[usage('codex','Codex',34),usage('claude','Claude',61),usage('gemini','Gemini',48)],isRefreshing:false,refreshingProviderIds:new Set(),refresh:vi.fn(),lastRefresh:null,hasCachedData:true,hasLoadedCache:true});
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    const disclosure=screen.getByText('Customize Codex limits and identity').closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    expect(disclosure).toHaveTextContent('1 limit · adaptive');
  });
  it('saves presentation independently of selection and other providers',async()=>{
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    fireEvent.click(screen.getByRole('radio',{name:'Circular ring for Codex'}));
    await waitFor(()=>expect(tauriMocks.setProviderLimitPresentation).toHaveBeenCalledWith('codex',{shape:'ring',content:'both',direction:'forward',identity:'adaptive'}));
    expect(tauriMocks.setProviderLimitOrder).not.toHaveBeenCalled();
    expect(screen.getByRole('radio',{name:'Horizontal bar for Claude'})).toBeChecked();
  });
  it('persists source ordering and renders the same order in the live preview',async()=>{
    const provider=usage('codex','Codex',34);
    provider.primaryLabel='Session';
    provider.secondary=provider.primary;
    provider.secondaryLabel='5-hour';
    providerMocks.useProviders.mockReturnValue({providers:[provider]});
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    fireEvent.click(screen.getByRole('button',{name:'Move earlier 5-hour for Codex'}));
    await waitFor(()=>expect(tauriMocks.setProviderLimitOrder).toHaveBeenCalledWith('codex',['secondary','primary']));
    expect((await screen.findAllByRole('meter')).map(node=>node.getAttribute('aria-label'))).toEqual(['5-hour remaining','Session remaining']);
    expect(screen.queryByRole('combobox',{name:'Detail limits for Codex'})).not.toBeInTheDocument();
  });
  it('shows session and a named 5-hour limit independently in the live editor without opening a disclosure',async()=>{
    const provider=usage('codex','Codex',34);
    provider.primaryLabel='Session';
    provider.secondary={...provider.primary,windowMinutes:300};
    provider.secondaryLabel='5-hour';
    providerMocks.useProviders.mockReturnValue({providers:[provider]});
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    expect(await screen.findByRole('checkbox',{name:'Show Session for Codex'})).toBeChecked();
    expect(screen.getByRole('checkbox',{name:'Show 5-hour for Codex'})).toBeChecked();
    expect(screen.getByRole('meter',{name:'Session remaining'})).toBeInTheDocument();
    expect(screen.getByRole('meter',{name:'5-hour remaining'})).toBeInTheDocument();
  });
  it('toggles an actual source limit without changing another provider',async()=>{
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    const session=screen.getByRole('checkbox',{name:'Show Primary limit for Codex'});
    fireEvent.click(session);
    await waitFor(()=>expect(session).not.toBeDisabled());
    expect(tauriMocks.setProviderLimitOrder).toHaveBeenLastCalledWith('codex',[]);
    expect(session).not.toBeChecked();
    expect(screen.getByRole('checkbox',{name:'Show Primary limit for Claude'})).toBeChecked();
    fireEvent.click(session);
    await waitFor(()=>expect(session).not.toBeDisabled());
    expect(tauriMocks.setProviderLimitOrder).toHaveBeenLastCalledWith('codex',['primary']);
    expect(tauriMocks.setUsageSettings).not.toHaveBeenCalled();
  });
  it('restores inherited limit selection and indicator independently',async()=>{
    tauriMocks.getSettingsSnapshot.mockResolvedValue({...settings,
      providerLimitOrder:{codex:[]},
      providerLimitPresentation:{codex:{shape:'ring',content:'value',direction:'reverse'}},
    });
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    fireEvent.click(screen.getByRole('button',{name:'Use provider defaults'}));
    await waitFor(()=>expect(tauriMocks.setProviderLimitOrder).toHaveBeenCalledWith('codex',null));
    expect(tauriMocks.setProviderLimitPresentation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Use global presentation'}));
    await waitFor(()=>expect(tauriMocks.setProviderLimitPresentation).toHaveBeenCalledWith('codex',null));
  });
  it('renders the real filtered detail preview immediately',async()=>{
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    const preview=screen.getByText('Preview Codex details').closest('details')!;
    expect(within(preview).getByRole('meter',{name:'Primary limit remaining'})).toHaveAttribute('aria-valuenow','34');
    fireEvent.click(screen.getByRole('checkbox',{name:'Show Primary limit for Codex'}));
    expect(await within(preview).findByText('Limit details are hidden for this provider.')).toBeInTheDocument();
    expect(within(preview).queryByRole('meter')).not.toBeInTheDocument();
  });
  it('saves detail visibility independently and rolls back failures',async()=>{
    tauriMocks.setProviderLimitOrder.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Save denied'));
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await screen.findByText('34% remaining',{selector:'output'});
    const select=screen.getByRole('checkbox',{name:'Show Primary limit for Claude'});
    fireEvent.click(select);
    await waitFor(()=>expect(select).not.toBeDisabled());
    expect(tauriMocks.setProviderLimitOrder).toHaveBeenCalledWith('claude',[]);
    expect(tauriMocks.setUsageSettings).not.toHaveBeenCalled();
    fireEvent.click(select);
    expect(await screen.findByRole('alert')).toHaveTextContent('Save denied');
    expect(select).not.toBeChecked();
  });
  it("preserves the first provider override when a second provider is changed",async()=>{
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    await waitFor(()=>expect(screen.getByText("34% remaining",{selector:'output'})).toBeInTheDocument());
    await chooseQuotalisOption("Usage display mode for Codex","Used");
    await waitFor(()=>expect(screen.getByLabelText("Usage display mode for Codex")).not.toBeDisabled());
    await chooseQuotalisOption("Usage display mode for Claude","Hybrid");
    await waitFor(()=>expect(tauriMocks.setUsageSettings).toHaveBeenLastCalledWith("remaining",{codex:"used",claude:"hybrid"}));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listen.mockResolvedValue(() => {});
    tauriMocks.getSettingsSnapshot.mockResolvedValue(settings);
    tauriMocks.setUsageSettings.mockResolvedValue(undefined);
    tauriMocks.setProviderDetailWindow.mockReset().mockResolvedValue(undefined);
    tauriMocks.setProviderLimitOrder.mockReset().mockResolvedValue(undefined);
    tauriMocks.setProviderLimitPresentation.mockReset().mockResolvedValue(undefined);
    tauriMocks.setGlobalLimitPresentation.mockReset().mockResolvedValue(undefined);
    providerMocks.useProviders.mockReturnValue({
      providers: [usage("codex", "Codex", 34), usage("claude", "Claude", 61)],
      isRefreshing: false,
      refreshingProviderIds: new Set(),
      refresh: vi.fn(),
      lastRefresh: null,
      hasCachedData: true,
      hasLoadedCache: true,
    });
  });

  it("previews current provider data and never substitutes canonical fixture values", async () => {
    render(<UsageDisplaySection providerCatalog={catalog} />);

    await waitFor(() => expect(screen.getByText("34% remaining",{selector:'output'})).toBeInTheDocument());
    expect(screen.getByText("61% remaining",{selector:'output'})).toBeInTheDocument();
    expect(screen.queryByText("79% remaining",{selector:'output'})).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Usage display mode for Gemini")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox",{name:"Find provider usage settings"}),{target:{value:"gem"}});
    expect(screen.getByLabelText("Usage display mode for Gemini")).toBeInTheDocument();
    expect(screen.getByText("Unavailable", { selector: "output" })).toBeInTheDocument();
  });

  it("surfaces a settings-load failure instead of silently swallowing it", async () => {
    tauriMocks.getSettingsSnapshot.mockRejectedValue(new Error("settings unavailable"));

    render(<UsageDisplaySection providerCatalog={catalog} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("settings unavailable");
  });
  it("keeps customized offline providers reachable without enabling all rows",async()=>{
    tauriMocks.getSettingsSnapshot.mockResolvedValue({...settings,providerUsageOverrides:{gemini:"used"}});
    render(<UsageDisplaySection providerCatalog={catalog}/>);
    expect(await screen.findByLabelText("Usage display mode for Gemini")).toHaveTextContent("Used");
    expect(screen.getByRole("checkbox",{name:"Show all providers"})).not.toBeChecked();
  });

  it("persists a global mode through the typed bridge", async () => {
    render(<UsageDisplaySection providerCatalog={catalog} />);
    await screen.findByText("34% remaining",{selector:'output'});

    fireEvent.click(screen.getByRole("radio", { name: "Used" }));

    await waitFor(() => {
      expect(tauriMocks.setUsageSettings).toHaveBeenCalledWith("used", {});
    });
  });
});
