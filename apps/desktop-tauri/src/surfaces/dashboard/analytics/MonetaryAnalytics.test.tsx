import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardSnapshot, SpendTrendPoint } from "../../../types/bridge";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        V3Monetary: "Monetary",
        V3MonetaryHelp: "help",
        V3ActivityDemo: "Demo mode",
        MonetaryRibbonProvidersReporting: "Providers reporting",
        MonetaryRibbonSpendProviders: "Spend",
        MonetaryRibbonBalanceProviders: "Balances",
        MonetaryRibbonCreditsProviders: "Credits",
        MonetaryRibbonCurrencies: "Currencies",
        MonetaryNoTotalNote: "Never summed",
        MonetaryUnavailableNote: "No provider currently reports usable monetary data for this scope.",
        MonetarySpendHeading: "Spend",
        MonetarySpendHelp: "spend help",
        MonetaryBalanceHeading: "Balance",
        MonetaryBalanceHelp: "balance help",
        MonetaryCreditsHeading: "Credits",
        MonetaryCreditsHelp: "credits help",
        MonetaryColumnProvider: "Provider",
        MonetaryColumnAmount: "Amount",
        MonetaryColumnMeasurement: "Measurement",
        MonetaryColumnPeriod: "Currency / Unit",
        MonetaryColumnFreshness: "Freshness",
        MonetaryMeasurementCumulative: "Current period total",
        MonetaryMeasurementPointInTime: "Current snapshot",
        MonetaryMeasurementDelta: "Period amount",
        MonetaryMeasurementUnknown: "Unknown",
        MonetaryCreditsUnit: "Credits",
        MonetaryOriginProviderReported: "Provider-reported",
        NeverUpdated: "Never",
        UpdatedJustNow: "Updated just now",
      })[key] ?? key,
  }),
}));

import MonetaryAnalytics from "./MonetaryAnalytics";

function point(overrides: Partial<SpendTrendPoint> = {}): SpendTrendPoint {
  return {
    provider: "openai",
    accountId: "acct-1",
    bucketStart: Math.floor(Date.now() / 1000),
    costUsed: 42,
    currencyCode: "USD",
    measurementKind: "cumulative",
    quantityKind: "spend",
    ...overrides,
  };
}

function snapshot(spendTrend: SpendTrendPoint[]): DashboardSnapshot {
  return { spendTrend } as unknown as DashboardSnapshot;
}

describe("MonetaryAnalytics", () => {
  it("shows Spend and Balance in separate sections, never merged into one total", async () => {
    render(
      <MonetaryAnalytics
        snapshot={snapshot([
          point({ provider: "openai", quantityKind: "spend", measurementKind: "cumulative", costUsed: 42, currencyCode: "USD" }),
          point({ provider: "anthropic", quantityKind: "balance", measurementKind: "pointInTime", costUsed: 15, currencyCode: "USD" }),
        ])}
        providerId={null}
        isDemo={false}
      />,
    );
    expect(await screen.findByText("$42.00")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    // No naked "$57" (spend+balance) or similar combined figure anywhere,
    // and no "Total"/"Grand total" heading anywhere in the page.
    expect(screen.queryByText(/\$\s*57/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /total/i })).not.toBeInTheDocument();
  });

  it("never labels Credits as currency, and never converts them to a $ figure", async () => {
    render(
      <MonetaryAnalytics
        snapshot={snapshot([point({ provider: "chatgpt", quantityKind: "credits", measurementKind: "pointInTime", costUsed: 500, currencyCode: null })])}
        providerId={null}
        isDemo={false}
      />,
    );
    expect(await screen.findByText("500 Credits")).toBeInTheDocument();
    expect(screen.queryByText("$500.00")).not.toBeInTheDocument();
  });

  it("never sums mixed currencies -- each currency is its own row", async () => {
    render(
      <MonetaryAnalytics
        snapshot={snapshot([
          point({ provider: "openai", quantityKind: "spend", currencyCode: "USD", costUsed: 10 }),
          point({ provider: "mistral", quantityKind: "spend", currencyCode: "EUR", costUsed: 20 }),
        ])}
        providerId={null}
        isDemo={false}
      />,
    );
    expect(await screen.findByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("€20.00")).toBeInTheDocument();
    const currenciesCell = screen.getByText("Currencies").closest(".analytics-comparison-stat");
    expect(currenciesCell).toHaveTextContent("2");
  });

  it("excludes quantityKind 'unknown' rows entirely -- never shown as Spend/Balance/Credits", async () => {
    render(
      <MonetaryAnalytics
        snapshot={snapshot([point({ provider: "legacy-provider", quantityKind: "unknown", costUsed: 999, currencyCode: null })])}
        providerId={null}
        isDemo={false}
      />,
    );
    expect(await screen.findByText("No provider currently reports usable monetary data for this scope.")).toBeInTheDocument();
    expect(screen.queryByText("legacy-provider")).not.toBeInTheDocument();
  });

  it("shows an explicit Unavailable state, never $0.00, when no real monetary data exists", async () => {
    render(<MonetaryAnalytics snapshot={snapshot([])} providerId={null} isDemo={false} />);
    expect(await screen.findByText("No provider currently reports usable monetary data for this scope.")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("skips real data and shows the demo notice in Demo Mode", () => {
    render(<MonetaryAnalytics snapshot={null} providerId={null} isDemo={true} />);
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
  });
});
