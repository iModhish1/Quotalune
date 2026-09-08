import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  getLocaleStrings: vi.fn(),
  setUiLanguage: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import DataStatusPanel from "./DataStatusPanel";
import { LocaleProvider } from "../../../i18n/LocaleProvider";
import type { CostContract, DashboardSnapshot } from "../../../types/bridge";

function snapshot(
  availabilityOverrides: Partial<DashboardSnapshot["availability"]> = {},
  costContractOverrides: Partial<CostContract> = {},
): DashboardSnapshot {
  return {
    generatedAt: 0,
    rangeSince: 0,
    rangeUntil: 0,
    grain: "daily",
    timezone: "UTC",
    availability: {
      firstSampleAt: null,
      lastSampleAt: null,
      sampleCount: 0,
      hasCostData: false,
      hasTokenData: false,
      hasRequestData: false,
      hasModelData: false,
      ...availabilityOverrides,
    },
    providers: [],
    usageTrend: [],
    spendTrend: [],
    costContract: {
      origin: "unavailable",
      measurementKind: "unknown",
      currencyCode: null,
      period: "unknown",
      availability: "unavailable",
      pricingStatus: "notRequired",
      ...costContractOverrides,
    },
  };
}

function renderPanel(snap: DashboardSnapshot | null) {
  tauriMocks.getLocaleStrings.mockResolvedValue({
    language: "english",
    entries: {
      DashboardDataStatusTitle: "Data Status",
      DashboardDataStatusHistoryActive: "Local history: active",
      DashboardDataStatusHistoryCollecting: "Local history: collecting",
      DashboardDataStatusCostProviderReported: "Cost: provider-reported",
      DashboardDataStatusCostLegacyAmbiguous: "Cost: legacy data, semantics unknown",
      DashboardDataStatusCostUnavailable: "Cost data unavailable",
      DashboardDataStatusPricingNotVerified: "Pricing: not yet verified",
      DashboardDataStatusPricingNotRequired: "Pricing: not required for provider-reported cost",
      DashboardDataAvailableSince: "Data available since {}",
      DashboardDataSamples: "{} samples",
    },
  });
  return render(
    <LocaleProvider>
      <DataStatusPanel snapshot={snap} />
    </LocaleProvider>,
  );
}

describe("DataStatusPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports collecting history and unavailable cost with no real data yet", async () => {
    renderPanel(snapshot());
    // Two compact lines now (owner section 11), each merging what used to
    // be separate <dl> rows into one text node -- match on substring/
    // textContent rather than an exact standalone string.
    expect(await screen.findByText(/Local history: collecting/)).toBeInTheDocument();
    expect(screen.getByText(/Cost data unavailable/)).toBeInTheDocument();
  });

  it("PHASE 4A: real provider-reported cost never says 'estimated' or implies Quotalis pricing was needed", async () => {
    renderPanel(
      snapshot(
        { sampleCount: 500, hasCostData: true },
        { origin: "providerReported", availability: "available", pricingStatus: "notRequired" },
      ),
    );
    expect(await screen.findByText(/Cost: provider-reported/)).toBeInTheDocument();
    expect(
      screen.getByText(/Pricing: not required for provider-reported cost/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/estimated/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pricing verified/i)).not.toBeInTheDocument();
  });

  it("PHASE 4A: legacy (pre-Phase-4A) cost rows are labeled ambiguous, never shown as trustworthy provider-reported data", async () => {
    renderPanel(
      snapshot(
        { sampleCount: 20, hasCostData: true },
        { origin: "unavailable", availability: "legacyAmbiguous", pricingStatus: "notRequired" },
      ),
    );
    expect(await screen.findByText(/Cost: legacy data, semantics unknown/)).toBeInTheDocument();
    expect(screen.queryByText(/Cost: provider-reported/)).not.toBeInTheDocument();
  });

  it("never claims pricing is verified for provider-reported cost", async () => {
    renderPanel(
      snapshot(
        { sampleCount: 500, hasCostData: true },
        { origin: "providerReported", availability: "available" },
      ),
    );
    expect(await screen.findByText(/Pricing: not required for provider-reported cost/)).toBeInTheDocument();
    expect(screen.queryByText(/Pricing: not yet verified/)).not.toBeInTheDocument();
  });

  it("renders the real sample count, not a fabricated number", async () => {
    renderPanel(snapshot({ sampleCount: 64 }));
    expect(await screen.findByText(/64 samples/)).toBeInTheDocument();
  });
});
