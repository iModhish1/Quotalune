import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderConnectionStatus } from "../../../../lib/providerConnection";
const mocks = vi.hoisted(() => ({ load: vi.fn(), disconnect: vi.fn(), listen: vi.fn(), stop: vi.fn() }));
vi.mock("../../../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key, language: "english"})}));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("../../../../lib/providerConnection", async (original) => ({...(await original<typeof import("../../../../lib/providerConnection")>()), getProviderConnectionStatus: mocks.load, disconnectProviderConnection: mocks.disconnect}));
import { ConnectionStatusLine } from "./ConnectionStatusLine";
const status = (id: string): ProviderConnectionStatus => ({providerId: id, enabled: true, state: "connected", issue: null, method: "apiKey", lastVerified: null, stale: false});
beforeEach(() => { vi.clearAllMocks(); mocks.listen.mockResolvedValue(mocks.stop); mocks.load.mockResolvedValue([status("openrouter"), status("deepseek")]); mocks.disconnect.mockResolvedValue(undefined); });
describe("connection status lifecycle", () => {
  it("cleans listeners through 100 provider switches", async () => {
    const ui = render(<ConnectionStatusLine providerId="openrouter" />);
    for (let i = 0; i < 100; i++) {
      await act(async () => { ui.rerender(<ConnectionStatusLine providerId={i % 2 ? "openrouter" : "deepseek"} />); });
      expect(screen.getByRole("status")).toHaveTextContent("ConnectStateConnected");
    }
    ui.unmount(); await act(async () => {});
    expect(mocks.listen).toHaveBeenCalledTimes(101);
    expect(mocks.stop).toHaveBeenCalledTimes(101);
  });
  it("ignores a previous provider's late response", async () => {
    let resolve!: (all: ProviderConnectionStatus[]) => void;
    mocks.load.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const ui = render(<ConnectionStatusLine providerId="openrouter" />);
    ui.rerender(<ConnectionStatusLine providerId="deepseek" />);
    await screen.findByRole("status");
    await act(async () => { resolve([{...status("openrouter"), state: "offline", issue: "offline"}]); });
    expect(screen.getByRole("status")).toHaveTextContent("ConnectStateConnected");
  });
  it("supports 50 fixture-connected/disconnect cycles with explicit confirmation", async () => {
    for (let i = 0; i < 50; i++) {
      const ui = render(<ConnectionStatusLine providerId="openrouter" />);
      fireEvent.click(await screen.findByRole("button", {name: "ConnectDisconnect"}));
      const choices = screen.getAllByRole("button", {name: "ConnectDisconnect"});
      expect(mocks.disconnect).toHaveBeenCalledTimes(i);
      fireEvent.click(choices[choices.length - 1]);
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ConnectStateIdle"));
      expect(mocks.disconnect).toHaveBeenLastCalledWith("openrouter", "apiKey");
      ui.unmount();
    }
    expect(mocks.disconnect).toHaveBeenCalledTimes(50);
  });
});
