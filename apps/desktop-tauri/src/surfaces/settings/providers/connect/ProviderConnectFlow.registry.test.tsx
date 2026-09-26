import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { METHOD_LABEL, type ConnectionMethod, type ConnectionVerification, type ProviderConnectionCapabilities } from "../../../../lib/providerConnection";

const here = import.meta.dirname!;
const matrix = JSON.parse(readFileSync(`${here}/../../../../../../../docs/validation/PROVIDER_CONNECTION_CAPABILITY_MATRIX.json`, "utf8")) as { providerCount: number; providers: ProviderConnectionCapabilities[] };

const ipc = vi.hoisted(() => ({
  detectCliDependency: vi.fn(), verifyProviderConnection: vi.fn(), saveProviderConnectionKey: vi.fn(),
  cancelProviderConnectionOperation: vi.fn(), getProviderConnectionQaFixture: vi.fn(),
}));
const tauri = vi.hoisted(() => ({ importBrowserCookies: vi.fn(), listDetectedBrowsers: vi.fn() }));

vi.mock("../../../../lib/providerConnection", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../lib/providerConnection")>()), ...ipc }));
vi.mock("../../../../lib/tauri", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../lib/tauri")>()), ...tauri }));
vi.mock("../../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key, language: "english" }) }));

import { ProviderConnectFlow } from "./ProviderConnectFlow";

const activeProviders = matrix.providers.filter((provider) => provider.status === "supported" || provider.status === "autoDetected");
const deprecatedProviders = matrix.providers.filter((provider) => provider.status === "deprecated");
const unsupportedProviders = matrix.providers.filter((provider) => provider.status === "unsupported");

const verificationFixture = (
  providerId: string,
  method: ConnectionMethod,
  state: ConnectionVerification["state"],
  issue: ConnectionVerification["issue"],
): ConnectionVerification => ({
  providerId,
  state,
  issue,
  method,
  verifiedAt: state === "connected" ? "2026-09-16T10:00:00Z" : null,
  plan: state === "connected" ? "Registry fixture" : null,
  windowCount: state === "connected" ? 2 : 0,
  resetsKnown: state === "connected",
  durationMs: 40,
});

const recommendedMethod = (provider: ProviderConnectionCapabilities): ConnectionMethod => {
  const method = provider.methods.find((offer) => offer.rank === "recommended")?.method;
  if (!method) throw new Error(`${provider.provider} has no recommended connection method`);
  return method;
};

const configuredCli = (provider: ProviderConnectionCapabilities) => ({
  providerId: provider.provider,
  tool: provider.cli!.tool,
  status: { kind: "installed" as const },
  path: null,
  version: "fixture",
  session: "authenticated" as const,
  installAvailable: false,
  docsUrl: provider.cli!.docsUrl,
  signInHint: `${provider.cli!.executables[0]} login`,
});

async function advanceToVerification(provider: ProviderConnectionCapabilities, method: ConnectionMethod) {
  if (provider.methods.length > 1) {
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(METHOD_LABEL[method]) }));
  }

  switch (method) {
    case "cliSession":
      expect(provider.cli).not.toBeNull();
      await waitFor(() => expect(ipc.detectCliDependency).toHaveBeenCalledWith(provider.provider));
      expect(screen.getByText(provider.cli!.tool)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
      fireEvent.click(await screen.findByRole("button", { name: "ConnectNext" }));
      break;
    case "browserSession": {
      const offer = provider.methods.find((candidate) => candidate.method === method)!;
      expect(offer.browserDomain).not.toBeNull();
      expect(await screen.findByText(offer.browserDomain!)).toBeInTheDocument();
      await waitFor(() => expect(tauri.listDetectedBrowsers).toHaveBeenCalledWith(provider.provider));
      fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
      await screen.findByLabelText("ConnectBrowserChoose");
      fireEvent.click(screen.getByRole("button", { name: "ConnectBrowserImport" }));
      await waitFor(() => expect(tauri.importBrowserCookies).toHaveBeenCalledWith(provider.provider, "edge", undefined));
      fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
      break;
    }
    case "apiKey": {
      const input = await screen.findByLabelText("ConnectApiKeyLabel");
      fireEvent.change(input, { target: { value: `registry-fixture-${provider.provider}` } });
      fireEvent.click(screen.getByRole("button", { name: "ConnectApiKeySave" }));
      await waitFor(() => expect(ipc.saveProviderConnectionKey).toHaveBeenCalledWith(provider.provider, `registry-fixture-${provider.provider}`));
      fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
      break;
    }
    case "deviceFlow":
      expect(await screen.findByText("ConnectDeviceIntro")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
      break;
    case "localScanner":
      expect(await screen.findByText("ConnectScannerIntro")).toBeInTheDocument();
      break;
    case "localGateway":
      expect(await screen.findByText("ConnectGatewayIntro")).toBeInTheDocument();
      break;
  }

  await screen.findByRole("button", { name: "ConnectVerifyAction" });
}

beforeEach(() => {
  Object.values(ipc).forEach((mock) => mock.mockReset());
  Object.values(tauri).forEach((mock) => mock.mockReset());
  ipc.getProviderConnectionQaFixture.mockResolvedValue(null);
  ipc.saveProviderConnectionKey.mockResolvedValue(undefined);
  ipc.cancelProviderConnectionOperation.mockResolvedValue(true);
  tauri.listDetectedBrowsers.mockResolvedValue([{ browserType: "edge", displayName: "Edge", profileCount: 1 }]);
  tauri.importBrowserCookies.mockResolvedValue([]);
});

describe("ProviderConnectFlow registry lifecycle fixtures", () => {
  it("covers the derived provider inventory and makes unsupported exceptions explicit", () => {
    expect(matrix.providers).toHaveLength(matrix.providerCount);
    expect(activeProviders.length + deprecatedProviders.length + unsupportedProviders.length).toBe(matrix.providerCount);
    expect(deprecatedProviders).toHaveLength(2);
    expect(unsupportedProviders.map((provider) => provider.provider)).toEqual(["gemini", "vertexai"]);
  });

  it.each(activeProviders.map((provider) => [provider.provider, provider, recommendedMethod(provider)] as const))(
    "%s sends its recommended method through failure, timeout, and a successful retry",
    async (_id, provider, method) => {
      if (method === "cliSession") ipc.detectCliDependency.mockResolvedValue(configuredCli(provider));

      const rejected = verificationFixture(provider.provider, method, "actionRequired", "credentialsRejected");
      const timedOut = verificationFixture(provider.provider, method, "timedOut", "timedOut");
      const connected = verificationFixture(provider.provider, method, "connected", null);
      let resolveTimeout!: (value: ConnectionVerification) => void;
      ipc.verifyProviderConnection
        .mockResolvedValueOnce(rejected)
        .mockImplementationOnce(() => new Promise<ConnectionVerification>((resolve) => { resolveTimeout = resolve; }))
        .mockResolvedValueOnce(connected);
      const onConnected = vi.fn();

      render(<ProviderConnectFlow capabilities={provider} onClose={vi.fn()} onConnected={onConnected} />);
      await advanceToVerification(provider, method);

      fireEvent.click(screen.getByRole("button", { name: "ConnectVerifyAction" }));
      await waitFor(() => expect(ipc.verifyProviderConnection).toHaveBeenNthCalledWith(1, provider.provider, method));
      expect(await screen.findByRole("alert")).toHaveTextContent("ConnectIssueCredentialsRejected");
      expect(onConnected).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "ConnectRetry" }));
      await waitFor(() => expect(ipc.verifyProviderConnection).toHaveBeenNthCalledWith(2, provider.provider, method));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("button", { name: "ConnectVerifyCancel" })).toBeInTheDocument();
      resolveTimeout(timedOut);
      expect(await screen.findByRole("alert")).toHaveTextContent("ConnectIssueTimedOut");
      expect(onConnected).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "ConnectRetry" }));
      await waitFor(() => expect(ipc.verifyProviderConnection).toHaveBeenNthCalledWith(3, provider.provider, method));
      await waitFor(() => expect(onConnected).toHaveBeenCalledExactlyOnceWith(connected));
      expect(ipc.verifyProviderConnection).toHaveBeenCalledTimes(3);
      expect(screen.getByText("ConnectStateConnected")).toBeInTheDocument();
    },
  );

  // The flow currently has no deprecated-provider gate. These fixtures record its
  // actual safe behavior: rendering and closing do not initiate authentication.
  it.each(deprecatedProviders.map((provider) => [provider.provider, provider] as const))(
    "%s renders and closes without forcing authentication",
    async (_id, provider) => {
      const onClose = vi.fn();
      render(<ProviderConnectFlow capabilities={provider} onClose={onClose} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "ConnectClose" }));
      expect(onClose).toHaveBeenCalledExactlyOnceWith();
      expect(ipc.verifyProviderConnection).not.toHaveBeenCalled();
      expect(ipc.saveProviderConnectionKey).not.toHaveBeenCalled();
      expect(tauri.importBrowserCookies).not.toHaveBeenCalled();
    },
  );
});
