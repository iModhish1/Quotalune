import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardSnapshot, SpendTrendPoint } from "../../../types/bridge";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({
    language: "en-US",
    t: (key: string) => ({
      DashboardUsageTrendTitle: "Usage trend",
      DashboardMetricUsage: "Usage",
      DashboardMetricSpend: "Reported spend",
      DashboardTrendEmptyForRange: "No data",
      DashboardCollectingHistory: "Collecting",
      ChartMaxValueLabel: "Max",
    })[key] ?? key,
  }),
}));

vi.mock("../../../components/charts/LineChart", () => ({
  LineChart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}));

import UsageTrendSection from "./UsageTrendSection";

function point(overrides: Partial<SpendTrendPoint> = {}): SpendTrendPoint {
  return {
    provider: "mistral",
    accountId: "same-account-key",
    accountScope: "observed",
    bucketStart: 100,
    costUsed: 2,
    currencyCode: "EUR",
    measurementKind: "cumulative",
    quantityKind: "spend",
    ...overrides,
  };
}

function snapshot(spendTrend: SpendTrendPoint[]): DashboardSnapshot {
  return {
    spendTrend,
    usageTrend: [],
    costContract: { origin: "providerReported" },
    grain: "daily",
    timezone: "UTC",
    availability: { sampleCount: 1 },
  } as unknown as DashboardSnapshot;
}

describe("UsageTrendSection", () => {
  it("renders legacy usage history by default and keeps it working when toggling spend", () => {
    const data = snapshot([point()]);
    data.usageTrend = [{
      provider: "codex", accountId: "provider:codex", bucketStart: 100,
      usedPercent: 25, remainingPercent: 75, sampleCount: 1,
    }];
    render(<UsageTrendSection snapshot={data} />);
    expect(screen.getByRole("img", { name: "codex Usage" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Reported spend" }));
    expect(screen.getByRole("img", { name: "mistral Reported spend" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Usage" }));
    expect(screen.getByRole("img", { name: "codex Usage" })).toBeInTheDocument();
  });

  it("keeps observed, unresolved, and legacy spend observations with the same account key as separate chart series", () => {
    render(
      <UsageTrendSection
        snapshot={snapshot([
          point({ accountScope: "observed", costUsed: 2 }),
          point({ accountScope: "unresolved", costUsed: 3 }),
          point({ accountScope: "legacy", costUsed: 4 }),
        ])}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Reported spend" }));
    expect(screen.getAllByRole("img", { name: "mistral Reported spend" })).toHaveLength(3);
  });
});
