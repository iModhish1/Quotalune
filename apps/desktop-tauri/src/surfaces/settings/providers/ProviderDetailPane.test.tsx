import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ConnectionVerification } from "../../../lib/providerConnection";

const api = vi.hoisted(() => ({
  getProviderDetail: vi.fn(), getProviderCookieSourceOptions: vi.fn(), getProviderRegionOptions: vi.fn(),
  getCredentialStorageStatus: vi.fn(), getTokenAccountProviders: vi.fn(), refreshProviders: vi.fn(),
  getProviderConnectionCapabilities: vi.fn(), simulated: true,
}));
vi.mock("../../../lib/tauri", async (original) => ({ ...(await original<object>()), ...api }));
vi.mock("../../../lib/providerConnection", async (original) => ({ ...(await original<object>()), getProviderConnectionCapabilities: api.getProviderConnectionCapabilities }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("./providerDetailFormat", () => ({ buildSubtitle: () => "" }));
vi.mock("./sections/IdentitySection", () => ({ IdentitySection: ({ onConnect }: { onConnect?: () => void }) => <div data-testid="identity-section">{onConnect && <button onClick={onConnect}>Connect</button>}</div> }));
vi.mock("./ProviderConnectionSummary", () => ({ ProviderConnectionSummary: () => null }));
vi.mock("./connect/ConnectionStatusLine", () => ({ ConnectionStatusLine: () => null }));
vi.mock("./ProviderDetailWorkspace", () => ({ ProviderDetailWorkspace: () => null }));
vi.mock("./sections/QuickActionsSection", () => ({ QuickActionsSection: () => null }));
vi.mock("./connect/ProviderConnectFlow", () => ({ ProviderConnectFlow: ({ onConnected }: { onConnected: (value: ConnectionVerification) => void }) =>
  <button onClick={() => onConnected({ providerId: "copilot", simulated: api.simulated, state: "connected", method: "deviceFlow", issue: null, verifiedAt: null, plan: null, windowCount: 0, resetsKnown: false, durationMs: 0 })}>Complete</button> }));

import { ProviderDetailPane } from "./ProviderDetailPane";

beforeEach(() => {
  vi.clearAllMocks();
  api.getProviderDetail.mockResolvedValue({ id: "copilot", name: "Copilot", errorState: "ready", primary: {}, usageWindows: [] });
  api.getProviderCookieSourceOptions.mockResolvedValue([]);
  api.getProviderRegionOptions.mockResolvedValue([]);
  api.getCredentialStorageStatus.mockResolvedValue(null);
  api.getTokenAccountProviders.mockResolvedValue([]);
  api.getProviderConnectionCapabilities.mockResolvedValue([{ provider: "copilot", methods: [{ method: "deviceFlow" }] }]);
  api.refreshProviders.mockResolvedValue(undefined);
});

it.each([true, false])("isolates simulated=%s verification completion from global refresh", async (simulated) => {
  api.simulated = simulated;
  render(<ProviderDetailPane providerId="copilot" resetTimeRelative providerMetrics={{}} providerAccentColors={{}} wayfinderGatewayUrl="" settingsDisabled={false} onSettingsChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
  fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
  await waitFor(() => expect(api.refreshProviders).toHaveBeenCalledTimes(simulated ? 0 : 1));
  expect(api.getProviderDetail).toHaveBeenCalledTimes(1);
});

it("does not show a dead Connect action when a provider has no verifiable method", async () => {
  api.getProviderDetail.mockResolvedValue({ id: "vertexai", displayName: "Vertex AI", canConnect: true, errorState: "unavailable", primary: {}, usageWindows: [] });
  api.getProviderConnectionCapabilities.mockResolvedValue([{ provider: "vertexai", status: "unsupported", methods: [] }]);
  render(<ProviderDetailPane providerId="vertexai" resetTimeRelative providerMetrics={{}} providerAccentColors={{}} wayfinderGatewayUrl="" settingsDisabled={false} onSettingsChange={vi.fn()} />);
  await screen.findByTestId("identity-section");
  expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();
});
