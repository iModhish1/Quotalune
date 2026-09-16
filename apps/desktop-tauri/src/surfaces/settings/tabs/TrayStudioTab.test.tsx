import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ProviderCatalogEntry, ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

const preview = vi.hoisted(() => ({ renderProviderTrayPreview: vi.fn(), getTrayTokenPeriods: vi.fn() }));
const providers = vi.hoisted(() => ({ list: [] as ProviderUsageSnapshot[], refreshing: false }));
vi.mock("../../../lib/trayQa", () => preview);
vi.mock("../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key, language: "english" }) }));
vi.mock("../../../hooks/useProviders", () => ({
  useProviders: () => ({ providers: providers.list, isRefreshing: providers.refreshing }),
}));
vi.mock("../../../components/analytics/QuotalisSelect", () => ({
  default: ({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) => (
    <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

import TrayStudioTab from "./TrayStudioTab";

const catalog = [
  { id: "claude", displayName: "Claude" },
  { id: "codex", displayName: "Codex" },
  ...Array.from({ length: 68 }, (_, index) => ({ id: `synthetic${index}`, displayName: `Synthetic ${index}` })),
] as ProviderCatalogEntry[];

const snapshot = {
  providerId: "claude", displayName: "Claude", errorState: "ready", sourceLabel: "oauth", updatedAt: "2026-09-16T10:00:00Z",
  primaryLabel: "Session", primary: { usedPercent: 40, remainingPercent: 60, windowMinutes: 300 },
} as ProviderUsageSnapshot;

function settings(extra: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return { trayIconMode: "single", enabledProviders: ["claude"], providerTrayConfigs: {}, logoVariant: "silver", ...extra } as SettingsSnapshot;
}

beforeEach(() => {
  providers.list = [snapshot];
  providers.refreshing = false;
  preview.renderProviderTrayPreview.mockReset();
  preview.getTrayTokenPeriods.mockReset();
  preview.getTrayTokenPeriods.mockImplementation(async (providerId: string) =>
    providerId === "claude"
      ? ["today", "week", "month", "year", "lifetime"].map((period) => ({ period, source: "claudeLocalTranscripts", bestBound: "lowerBound" }))
      : providerId === "codex"
        ? [
            ...["today", "week", "month", "year"].map((period) => ({ period, source: "codexLocalSessions", bestBound: "exact" })),
            { period: "lifetime", source: "codexLocalSessions", bestBound: "lowerBound" },
          ]
        : [],
  );
  preview.renderProviderTrayPreview.mockResolvedValue({ width: 64, height: 64, rgba: Array(64 * 64 * 4).fill(0), tooltip: "Claude\nSession 60.0% left" });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ putImageData: vi.fn() })) as never;
  globalThis.ImageData ??= class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} } as never;
});

it("previews through the production renderer with the exact selected config and shows its tooltip", async () => {
  render(<TrayStudioTab catalog={catalog} settings={settings()} set={vi.fn()} saving={false} />);
  expect(screen.getByRole("status", { name: "TrayStudioRendering" })).toBeInTheDocument();
  expect(await screen.findByTestId("tray-tooltip-preview")).toHaveTextContent("Session 60.0% left");
  expect(preview.renderProviderTrayPreview).toHaveBeenCalledWith("claude", expect.objectContaining({ style: "ring", identity: "provider", showAsUsed: false, limitId: "primary:Session:300" }));
  expect(screen.getByText("60.0% TrayStudioRemaining")).toBeInTheDocument();
});

it("writes identity and every native style into the same persisted tray config", async () => {
  const set = vi.fn();
  render(<TrayStudioTab catalog={catalog} settings={settings()} set={set} saving={false} />);
  fireEvent.click(screen.getByRole("button", { name: "TrayStudioOrbit" }));
  expect(set).toHaveBeenLastCalledWith({ providerTrayConfigs: { claude: expect.objectContaining({ style: "orbit" }) } });
  fireEvent.click(screen.getByRole("button", { name: "TrayStudioMark" }));
  expect(set).toHaveBeenLastCalledWith({ providerTrayConfigs: { claude: expect.objectContaining({ style: "mark" }) } });
  for (const name of ["TrayStudioRing", "TrayStudioArc", "TrayStudioBar", "TrayStudioBadge"]) {
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  }
  await screen.findByTestId("tray-tooltip-preview");
});

it("keeps unavailable readings as a dash, never zero", async () => {
  providers.list = [{ ...snapshot, sourceLabel: "unavailable" }];
  render(<TrayStudioTab catalog={catalog} settings={settings()} set={vi.fn()} saving={false} />);
  expect(screen.getByText("—")).toBeInTheDocument();
  expect(screen.queryByText(/0\.0%/)).toBeNull();
  await screen.findByTestId("tray-tooltip-preview");
});

it("filters a 70-provider registry and reports when nothing matches", async () => {
  render(<TrayStudioTab catalog={catalog} settings={settings()} set={vi.fn()} saving={false} />);
  const filter = screen.getByLabelText("TrayStudioFilterProviders");
  fireEvent.change(filter, { target: { value: "synthetic 6" } });
  expect(screen.queryByText("TrayStudioNoProviderMatch")).toBeNull();
  fireEvent.change(filter, { target: { value: "no such provider" } });
  expect(screen.getByText("TrayStudioNoProviderMatch")).toBeInTheDocument();
  await screen.findByTestId("tray-tooltip-preview");
});

it("locks the accent choice while the Tray appearance scope follows the main application", async () => {
  render(<TrayStudioTab catalog={catalog} settings={settings({ appearanceComposition: { quotalisLogo: "override", providerIdentity: "override", tray: "global", workspaceBackground: "override" } })} set={vi.fn()} saving={false} />);
  expect(screen.getByText("TrayStudioFollowsAppearance")).toBeInTheDocument();
  await screen.findByTestId("tray-tooltip-preview");
});

it("shows the shared unavailable state when the native renderer cannot be reached", async () => {
  preview.renderProviderTrayPreview.mockRejectedValue(new Error("no tauri"));
  render(<TrayStudioTab catalog={catalog} settings={settings()} set={vi.fn()} saving={false} />);
  await waitFor(() => expect(screen.getByText("QuotalisLoadingUnavailable")).toBeInTheDocument());
});

function tokenSelect() {
  return screen.getAllByRole("combobox").find((element) =>
    Array.from((element as HTMLSelectElement).options).some((option) => option.textContent === "TrayStudioOff"),
  ) as HTMLSelectElement;
}

it("offers only capability-backed token periods, marks lower bounds, and persists the choice", async () => {
  const set = vi.fn();
  render(<TrayStudioTab catalog={catalog} settings={settings()} set={set} saving={false} />);
  await waitFor(() => expect(tokenSelect().options.length).toBe(6));
  expect(Array.from(tokenSelect().options).map((option) => option.textContent)).toEqual([
    "TrayStudioOff",
    "TrayStudioToday · TrayStudioTokenLowerBound",
    "TrayStudioWeek · TrayStudioTokenLowerBound",
    "TrayStudioMonth · TrayStudioTokenLowerBound",
    "TrayStudioYear · TrayStudioTokenLowerBound",
    "TrayStudioLifetime · TrayStudioTokenLowerBound",
  ]);
  fireEvent.change(tokenSelect(), { target: { value: "month" } });
  expect(set).toHaveBeenLastCalledWith({ providerTrayConfigs: { claude: expect.objectContaining({ tokenRange: "month" }) } });
  await screen.findByTestId("tray-tooltip-preview");
});

it("marks only Codex lifetime as a lower bound", async () => {
  render(<TrayStudioTab catalog={[catalog[1]]} settings={settings({ enabledProviders: ["codex"] })} set={vi.fn()} saving={false} />);
  await waitFor(() => expect(tokenSelect().options.length).toBe(6));
  expect(Array.from(tokenSelect().options).map((option) => option.textContent)).toEqual([
    "TrayStudioOff",
    "TrayStudioToday",
    "TrayStudioWeek",
    "TrayStudioMonth",
    "TrayStudioYear",
    "TrayStudioLifetime · TrayStudioTokenLowerBound",
  ]);
  await screen.findByTestId("tray-tooltip-preview");
});

it("disables the token selector and shows Off for providers without a local token source", async () => {
  render(
    <TrayStudioTab
      catalog={[{ id: "synthetic1", displayName: "Synthetic 1" } as ProviderCatalogEntry]}
      settings={settings({ providerTrayConfigs: { synthetic1: { enabled: true, limitId: "", style: "ring", showAsUsed: false, tooltipLimitIds: [], showName: true, showPlan: true, tokenRange: "year", precision: 1, color: "provider", stroke: 2 } } })}
      set={vi.fn()}
      saving={false}
    />,
  );
  expect(await screen.findByText("TrayStudioTokenUnsupported")).toBeInTheDocument();
  expect(tokenSelect().disabled).toBe(true);
  expect(tokenSelect().value).toBe("none");
  expect(Array.from(tokenSelect().options).map((option) => option.value)).toEqual(["none"]);
  await screen.findByTestId("tray-tooltip-preview");
});
