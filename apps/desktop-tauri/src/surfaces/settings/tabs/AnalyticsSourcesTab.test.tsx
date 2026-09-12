import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AnalyticsSourceDescriptor } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getAnalyticsSourceRegistry: vi.fn(),
}));
vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        TabAnalyticsSources: "Data Sources",
        AnalyticsSourcesHelp: "help",
        AnalyticsSourceStatusAvailable: "Available",
        AnalyticsSourceStatusNoDataYet: "No data yet",
        AnalyticsSourceStatusUnsupported: "Unsupported",
        AnalyticsScopeAccount: "Account",
        AnalyticsScopeProvider: "Provider",
        AnalyticsScopeDevice: "Device",
        AnalyticsCapabilityQuota: "Quota",
        AnalyticsCapabilityResets: "Resets",
        AnalyticsCapabilityMonetary: "Monetary",
        AnalyticsCapabilityTokens: "Tokens",
        AnalyticsCapabilityModels: "Models",
        AnalyticsCapabilitySessions: "Sessions",
        AnalyticsCapabilityDailyActivity: "Daily activity",
        AnalyticsSourceReadsLabel: "Reads",
        AnalyticsSourceDoesNotReadLabel: "Does not read",
        AnalyticsFactTimestamps: "Timestamps",
        AnalyticsFactTokenCounts: "Token counts",
        AnalyticsFactModelIdentifiers: "Model identifiers",
        AnalyticsFactPromptOrResponseContent: "Prompt or response content",
        AnalyticsFactSessionIdentity: "Session identity",
        AnalyticsFactDollarCost: "Dollar cost",
        AnalyticsFactProviderReportedMonetaryFigures: "Provider-reported Spend, Balance, or Credits figures",
        AnalyticsFactLocallyEstimatedCost: "Locally-estimated cost derived from token counts",
        AnalyticsSourceInspectorHeading: "Source details",
        AnalyticsSourceInspectorIdentity: "Source",
        AnalyticsSourceInspectorAvailability: "Availability",
        AnalyticsSourceInspectorScope: "Scope",
        AnalyticsSourceInspectorCapabilities: "Capabilities",
        AnalyticsSourceInspectorNoCapabilities: "None",
        AnalyticsSourceInspectorPathsNote: "Absolute file paths and raw cached records are never shown here.",
        AnalyticsSourceInspectorOpen: "Details",
        AnalyticsSourceInspectorClose: "Close",
      })[key] ?? key,
  }),
}));

import AnalyticsSourcesTab from "./AnalyticsSourcesTab";

function source(overrides: Partial<AnalyticsSourceDescriptor> = {}): AnalyticsSourceDescriptor {
  return {
    id: "claudeLocalActivity",
    label: "Claude local activity",
    scope: "device",
    capabilities: {
      quota: false,
      resets: false,
      monetary: false,
      tokens: true,
      models: true,
      sessionCount: false,
      dailyActivity: true,
    },
    availability: "available",
    reads: ["timestamps", "tokenCounts", "modelIdentifiers"],
    doesNotRead: ["promptOrResponseContent", "sessionIdentity", "dollarCost"],
    ...overrides,
  };
}

describe("AnalyticsSourcesTab", () => {
  it("renders the real registry verbatim -- label, scope, capability chips, and privacy lines", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    render(<AnalyticsSourcesTab />);
    await waitFor(() => expect(screen.getByText("Claude local activity")).toBeInTheDocument());
    expect(screen.getByText("Device")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Models")).toBeInTheDocument();
    expect(screen.getByText("Daily activity")).toBeInTheDocument();
    // Sessions is false on this source -- must not render a chip for it.
    expect(screen.queryByText("Sessions")).not.toBeInTheDocument();
    expect(screen.getByText("Timestamps · Token counts · Model identifiers")).toBeInTheDocument();
    expect(screen.getByText("Prompt or response content · Session identity · Dollar cost")).toBeInTheDocument();
  });

  it("opens a details inspector restating the same real fields, and Escape closes it and returns focus", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([source()]);
    render(<AnalyticsSourcesTab />);
    const toggle = await screen.findByRole("button", { name: "Details" });
    fireEvent.click(toggle);
    const panel = await screen.findByRole("region", { name: "Source details" });
    expect(panel).toBeInTheDocument();
    // The inspector restates identity/availability/scope/capabilities and
    // the same real reads/doesNotRead facts -- never a fabricated field.
    expect(screen.getAllByText("Claude local activity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Timestamps · Token counts · Model identifiers").length).toBeGreaterThan(0);
    expect(screen.getByText("Absolute file paths and raw cached records are never shown here.")).toBeInTheDocument();

    panel.focus();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Source details" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
  });

  it("never invents a chip for a capability the source does not have", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockResolvedValue([
      source({
        id: "providerReportedMonetary",
        label: "Provider-reported monetary data",
        scope: "account",
        capabilities: { quota: false, resets: false, monetary: true, tokens: false, models: false, sessionCount: false, dailyActivity: false },
      }),
    ]);
    render(<AnalyticsSourcesTab />);
    await waitFor(() => expect(screen.getByText("Provider-reported monetary data")).toBeInTheDocument());
    expect(screen.getByText("Monetary")).toBeInTheDocument();
    expect(screen.queryByText("Tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Models")).not.toBeInTheDocument();
  });

  it("surfaces a real fetch error instead of silently rendering nothing", async () => {
    tauriMocks.getAnalyticsSourceRegistry.mockRejectedValue(new Error("ipc failed"));
    render(<AnalyticsSourcesTab />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ipc failed"));
  });
});
