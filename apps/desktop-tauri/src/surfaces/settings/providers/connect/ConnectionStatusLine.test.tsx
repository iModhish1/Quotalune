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
  it("keeps credential-removal retry available after monitoring is disabled", async () => {
    let refresh!: () => void;
    mocks.listen.mockImplementationOnce((_event: string, callback: () => void) => { refresh = callback; return Promise.resolve(mocks.stop); });
    mocks.disconnect.mockRejectedValueOnce(new Error("credential removal failed"));
    const ui = render(<ConnectionStatusLine providerId="openrouter" />);
    fireEvent.click(await screen.findByRole("button", {name: "ConnectDisconnect"}));
    let buttons = screen.getAllByRole("button", {name: "ConnectDisconnect"});
    fireEvent.click(buttons[buttons.length - 1]);
    await screen.findByRole("alert");
    mocks.load.mockResolvedValue([{...status("openrouter"), enabled: false, state: "idle", method: null}]);
    await act(async () => { refresh(); });
    // A status refresh can clear the method after settings were saved. The
    // in-progress confirmation must still retain the selected retry method.
    expect(screen.getByRole("group", {name: "ConnectDisconnect"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "ConnectRetryCredentialRemoval"}));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(2));
    expect(mocks.disconnect).toHaveBeenLastCalledWith("openrouter", "apiKey");
    ui.unmount();
  });
  it("does not reuse a failed API-key attempt after the method changes", async () => {
    let refresh!: () => void;
    mocks.listen.mockImplementationOnce((_event: string, callback: () => void) => { refresh = callback; return Promise.resolve(mocks.stop); });
    mocks.disconnect.mockRejectedValueOnce(new Error("credential removal failed"));
    render(<ConnectionStatusLine providerId="openrouter" />);
    fireEvent.click(await screen.findByRole("button", {name: "ConnectDisconnect"}));
    let buttons = screen.getAllByRole("button", {name: "ConnectDisconnect"});
    fireEvent.click(buttons[buttons.length - 1]);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", {name: "ConnectCancel"}));
    mocks.load.mockResolvedValue([{...status("openrouter"), method: "browserSession"}]);
    await act(async () => { refresh(); });
    fireEvent.click(screen.getByRole("button", {name: "ConnectDisconnect"}));
    buttons = screen.getAllByRole("button", {name: "ConnectDisconnect"});
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledTimes(2));
    expect(mocks.disconnect).toHaveBeenLastCalledWith("openrouter", "browserSession");
  });
});
