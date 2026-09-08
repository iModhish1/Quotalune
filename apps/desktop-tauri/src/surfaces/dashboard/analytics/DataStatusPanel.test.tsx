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
import type { DashboardSnapshot } from "../../../types/bridge";

function snapshot(overrides: Partial<DashboardSnapshot["availability"]> = {}): DashboardSnapshot {
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
      ...overrides,
    },
    providers: [],
    usageTrend: [],
    spendTrend: [],
  };
}

function renderPanel(snap: DashboardSnapshot | null) {
  tauriMocks.getLocaleStrings.mockResolvedValue({
    language: "english",
    entries: {
      DashboardDataStatusTitle: "Data Status",
      DashboardDataStatusHistoryActive: "Local history: active",
      DashboardDataStatusHistoryCollecting: "Local history: collecting",
      DashboardDataStatusCostEstimated: "Cost: estimated (provider-reported)",
      DashboardDataStatusCostUnavailable: "Cost data unavailable",
      DashboardDataStatusPricingNotVerified: "Pricing: not yet verified",
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

  it("never claims pricing is verified", async () => {
    renderPanel(snapshot({ sampleCount: 500, hasCostData: true }));
    expect(await screen.findByText(/Pricing: not yet verified/)).toBeInTheDocument();
    expect(screen.getByText(/Cost: estimated \(provider-reported\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Pricing verified/i)).not.toBeInTheDocument();
  });

  it("renders the real sample count, not a fabricated number", async () => {
    renderPanel(snapshot({ sampleCount: 64 }));
    expect(await screen.findByText(/64 samples/)).toBeInTheDocument();
  });
});
