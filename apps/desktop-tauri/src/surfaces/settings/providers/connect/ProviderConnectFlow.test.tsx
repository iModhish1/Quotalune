import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionVerification, ProviderConnectionCapabilities } from "../../../../lib/providerConnection";

const here = import.meta.dirname!;
const matrix = JSON.parse(readFileSync(`${here}/../../../../../../../docs/validation/PROVIDER_CONNECTION_CAPABILITY_MATRIX.json`, "utf8")) as { providers: ProviderConnectionCapabilities[] };

const ipc = vi.hoisted(() => ({
  detectCliDependency: vi.fn(), getCliInstallPlan: vi.fn(), installCliDependency: vi.fn(), cancelCliInstall: vi.fn(),
  verifyProviderConnection: vi.fn(), cancelProviderVerification: vi.fn(), saveProviderConnectionKey: vi.fn(), cancelProviderConnectionOperation: vi.fn(), getProviderConnectionQaFixture: vi.fn(),
}));
const tauri = vi.hoisted(() => ({
  importBrowserCookies: vi.fn(), listDetectedBrowsers: vi.fn(), openExternalUrl: vi.fn(), setApiKey: vi.fn(),
  startProviderLogin: vi.fn(),
}));
vi.mock("../../../../lib/providerConnection", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../lib/providerConnection")>()), ...ipc }));
vi.mock("../../../../lib/tauri", () => tauri);
vi.mock("../../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key, language: "english" }) }));

import { ProviderConnectFlow } from "./ProviderConnectFlow";

const connected = (providerId: string, method: ConnectionVerification["method"]): ConnectionVerification => ({ providerId, state: "connected", issue: null, method, verifiedAt: "2026-09-16T10:00:00Z", plan: "Pro", windowCount: 2, resetsKnown: true, durationMs: 40 });
const row = (id: string) => matrix.providers.find((p) => p.provider === id)!;

beforeEach(() => {
  Object.values(ipc).forEach((f) => f.mockReset());
  Object.values(tauri).forEach((f) => f.mockReset());
  ipc.detectCliDependency.mockResolvedValue(null);
  ipc.getProviderConnectionQaFixture.mockResolvedValue(null);
  tauri.listDetectedBrowsers.mockResolvedValue([{ browserType: "edge", displayName: "Edge", profileCount: 1 }]);
  ipc.saveProviderConnectionKey.mockResolvedValue(undefined);
  ipc.cancelProviderConnectionOperation.mockResolvedValue(true);
  tauri.importBrowserCookies.mockResolvedValue([]);
  ipc.cancelProviderVerification.mockResolvedValue(true);
});

describe("every registry provider", () => {
  it.each(matrix.providers.filter((p) => p.status !== "unsupported").map((p) => [p.provider, p] as const))("%s renders only its real methods", (_id, caps) => {
    const { unmount } = render(<ProviderConnectFlow capabilities={caps} onClose={vi.fn()} />);
    if (caps.methods.length > 1) {
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(caps.methods.length);
      const labels = radios.map((r) => r.textContent ?? "");
      for (const method of ["apiKey", "browserSession", "cliSession", "deviceFlow", "localScanner", "localGateway"] as const) {
        const offered = caps.methods.some((m) => m.method === method);
        const key = `ConnectMethod${method[0].toUpperCase()}${method.slice(1)}`;
        expect(labels.some((l) => l.includes(key)), `${caps.provider} ${method}`).toBe(offered);
      }
      expect(labels.filter((l) => l.includes("ConnectRecommended"))).toHaveLength(1);
    } else {
      expect(screen.queryByRole("radio")).toBeNull();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    }
    unmount();
  });
});

describe("CLI requirements", () => {
  it("shows a real detection, gates Next on it, and confirms before installing", async () => {
    ipc.detectCliDependency.mockResolvedValue({ providerId: "codex", tool: "OpenAI Codex CLI", status: { kind: "missing" }, path: null, version: null, session: "unknown", installAvailable: true, docsUrl: "https://github.com/openai/codex", signInHint: "codex login" });
    ipc.getCliInstallPlan.mockResolvedValue({ program: "npm", args: ["install", "-g", "@openai/codex"], requiresAdmin: false, packageManager: "npm", package: "@openai/codex" });
    ipc.installCliDependency.mockResolvedValue({ outcome: { kind: "succeeded" }, detection: { providerId: "codex", tool: "OpenAI Codex CLI", status: { kind: "installed" }, path: null, version: "1.2.3", session: "notSignedIn", installAvailable: true, docsUrl: "https://github.com/openai/codex", signInHint: "codex login" } });
    render(<ProviderConnectFlow capabilities={row("codex")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /ConnectMethodCliSession/ }));
    expect(await screen.findByText("ConnectCliMissing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ConnectNext" })).toBeDisabled();
    expect(ipc.installCliDependency).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ConnectCliInstallAction" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("npm install -g @openai/codex")).toBeInTheDocument();
    expect(within(confirm).getByText("ConnectCliInstallNoAdmin")).toBeInTheDocument();
    expect(document.activeElement).toBe(within(confirm).getByRole("button", { name: "ConnectCancel" }));
    fireEvent.click(within(confirm).getByRole("button", { name: "ConnectCliInstallConfirm" }));
    await waitFor(() => expect(ipc.installCliDependency).toHaveBeenCalledWith("codex", true));
    expect(await screen.findByText("ConnectInstallSucceeded")).toBeInTheDocument();
    expect(screen.getByText("ConnectCliNotSignedIn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ConnectNext" })).toBeEnabled();
  });

  it("distinguishes an old CLI and never offers install without a curated source", async () => {
    ipc.detectCliDependency.mockResolvedValue({ providerId: "kiro", tool: "Kiro CLI", status: { kind: "tooOld", installed: "0.1.0", required: "1.0.0" }, path: null, version: "0.1.0", session: "unknown", installAvailable: false, docsUrl: "https://kiro.dev/", signInHint: "kiro-cli login" });
    const kiro = row("kiro");
    expect(kiro.methods.map((m) => m.method)).toContain("cliSession");
    render(<ProviderConnectFlow capabilities={kiro} onClose={vi.fn()} />);
    if (kiro.methods.length > 1) fireEvent.click(screen.getByRole("radio", { name: /ConnectMethodCliSession/ }));
    expect(await screen.findByText(/ConnectCliTooOld/)).toBeInTheDocument();
    expect(screen.getByText("0.1.0 → 1.0.0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ConnectCliInstallAction" })).toBeNull();
    expect(screen.getByRole("button", { name: "ConnectCliOpenDocs" })).toBeInTheDocument();
  });
});

describe("API key and verification", () => {
  it("masks the key, reveals on demand, saves through protected storage and never echoes it", async () => {
    ipc.verifyProviderConnection.mockResolvedValue(connected("openrouter", "apiKey"));
    const onConnected = vi.fn();
    render(<ProviderConnectFlow capabilities={row("openrouter")} onClose={vi.fn()} onConnected={onConnected} />);
    const input = screen.getByLabelText("ConnectApiKeyLabel") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.change(input, { target: { value: "sk-or-test-1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "ConnectApiKeyReveal" }));
    expect(input.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "ConnectApiKeySave" }));
    await waitFor(() => expect(ipc.saveProviderConnectionKey).toHaveBeenCalledWith("openrouter", "sk-or-test-1234567890"));
    expect(input.value).toBe("");
    expect(input.type).toBe("password");
    expect(document.body.textContent).not.toContain("sk-or-test");
    fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
    fireEvent.click(await screen.findByRole("button", { name: "ConnectVerifyAction" }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(screen.getByText("ConnectMethodApiKey")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("ConnectSuccessResetsKnown")).toBeInTheDocument();
  });

  it.each([
    ["timedOut", "timedOut", "ConnectIssueTimedOut"],
    ["rateLimited", "rateLimited", "ConnectIssueRateLimited"],
    ["actionRequired", "credentialsRejected", "ConnectIssueCredentialsRejected"],
    ["actionRequired", "permissionDenied", "ConnectIssuePermissionDenied"],
    ["offline", "offline", "ConnectIssueOffline"],
    ["error", "error", "ConnectIssueError"],
  ] as const)("reports %s/%s without a generic failure and allows retry", async (state, issue, key) => {
    ipc.verifyProviderConnection.mockResolvedValue({ providerId: "deepseek", state, issue, method: "apiKey", verifiedAt: null, plan: null, windowCount: 0, resetsKnown: false, durationMs: 1 });
    render(<ProviderConnectFlow capabilities={row("deepseek")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
    fireEvent.click(await screen.findByRole("button", { name: "ConnectVerifyAction" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(key);
    expect(screen.getByRole("button", { name: "ConnectRetry" })).toBeInTheDocument();
    expect(screen.queryByText("ConnectStateConnected")).toBeNull();
  });

  it("can cancel an in-flight verification", async () => {
    let resolve!: (v: ConnectionVerification) => void;
    ipc.verifyProviderConnection.mockReturnValue(new Promise<ConnectionVerification>((r) => { resolve = r; }));
    render(<ProviderConnectFlow capabilities={row("windsurf")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "ConnectVerifyAction" }));
    fireEvent.click(await screen.findByRole("button", { name: "ConnectVerifyCancel" }));
    expect(ipc.cancelProviderConnectionOperation).toHaveBeenCalledWith("windsurf");
    resolve({ providerId: "windsurf", state: "idle", issue: null, method: null, verifiedAt: null, plan: null, windowCount: 0, resetsKnown: false, durationMs: null });
  });
});

describe("browser session and device flow", () => {
  it("explains the exact domain, imports from a chosen profile and never shows cookie values", async () => {
    render(<ProviderConnectFlow capabilities={row("perplexity")} onClose={vi.fn()} />);
    expect(await screen.findByText("perplexity.ai")).toBeInTheDocument();
    expect(screen.getByText("ConnectBrowserReads")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ConnectNext" }));
    const select = await screen.findByLabelText("ConnectBrowserChoose");
    expect(select).toHaveValue("edge");
    fireEvent.click(screen.getByRole("button", { name: "ConnectBrowserImport" }));
    await waitFor(() => expect(tauri.importBrowserCookies).toHaveBeenCalledWith("perplexity", "edge", undefined));
    expect(await screen.findByText("ConnectBrowserImported")).toBeInTheDocument();
  });

  it("starts the provider sign-in and can cancel it", async () => {
    const cancel = vi.fn().mockResolvedValue(true);
    tauri.startProviderLogin.mockImplementation((_id: string, opts: { onPhase?: (p: { phase: string }) => void }) => {
      opts.onPhase?.({ phase: "waiting" });
      return { requestId: "r", completion: new Promise(() => {}), cancel };
    });
    ipc.detectCliDependency.mockResolvedValue({ providerId: "copilot", tool: "GitHub CLI", status: { kind: "installed" }, path: null, version: "2.0.0", session: "notSignedIn", installAvailable: true, docsUrl: "https://cli.github.com/", signInHint: "gh auth login" });
    render(<ProviderConnectFlow capabilities={row("copilot")} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /ConnectMethodDeviceFlow/ }));
    expect(ipc.detectCliDependency).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "ConnectDeviceStart" }));
    expect(await screen.findByText("V2LoginWaiting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ConnectDeviceCancel" }));
    expect(cancel).toHaveBeenCalled();
  });
});

describe("dialog accessibility", () => {
  it("is a labelled modal, focuses inside, closes on Escape and restores focus", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    const onClose = vi.fn();
    render(<ProviderConnectFlow capabilities={row("claude")} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("ConnectTitle");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    outside.remove();
  });
});


describe("connection lifecycle regressions", () => {
  it("selects exactly one profile and sends no local path", async () => {
    tauri.listDetectedBrowsers.mockResolvedValue([{browserType: "edge", displayName: "Edge", profileCount: 2, profiles: [{id: "opaque-one", ordinal: 1}, {id: "opaque-two", ordinal: 2}]}]);
    render(<ProviderConnectFlow capabilities={row("perplexity")} onClose={vi.fn()} />);
    await screen.findByText("perplexity.ai");
    fireEvent.click(screen.getByRole("button", {name: "ConnectNext"}));
    const profile = await screen.findByLabelText("ConnectBrowserProfiles");
    const button = screen.getByRole("button", {name: "ConnectBrowserImport"});
    expect(button).toBeDisabled();
    fireEvent.change(profile, {target: {value: "opaque-two"}});
    fireEvent.click(button);
    await waitFor(() => expect(tauri.importBrowserCookies).toHaveBeenCalledWith("perplexity", "edge", "opaque-two"));
  });

  it("never displays a credential-bearing IPC error and clears the draft", async () => {
    ipc.saveProviderConnectionKey.mockRejectedValue(new Error("sk-secret-value user@example.com"));
    render(<ProviderConnectFlow capabilities={row("openrouter")} onClose={vi.fn()} />);
    const input = screen.getByLabelText("ConnectApiKeyLabel") as HTMLInputElement;
    fireEvent.change(input, {target: {value: "sk-secret-value"}});
    fireEvent.click(screen.getByRole("button", {name: "ConnectApiKeySave"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("ConnectIssueError");
    expect(input.value).toBe("");
    expect(document.body.textContent).not.toContain("sk-secret-value");
    expect(document.body.textContent).not.toContain("user@example.com");
  });

  it("cancels 50 closed verification attempts and ignores their late success", async () => {
    for (let i = 0; i < 50; i++) {
      let resolve!: (v: ConnectionVerification) => void;
      ipc.verifyProviderConnection.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
      const onConnected = vi.fn();
      const ui = render(<ProviderConnectFlow capabilities={row("windsurf")} onClose={vi.fn()} onConnected={onConnected} />);
      fireEvent.click(screen.getByRole("button", {name: "ConnectVerifyAction"}));
      ui.unmount();
      resolve(connected("windsurf", "localScanner"));
      await Promise.resolve();
      expect(onConnected).not.toHaveBeenCalled();
    }
    expect(ipc.cancelProviderConnectionOperation).toHaveBeenCalledTimes(50);
  });

  it("coalesces 100 rapid Verify clicks into one IPC request", async () => {
    let resolve!: (v: ConnectionVerification) => void;
    ipc.verifyProviderConnection.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const ui = render(<ProviderConnectFlow capabilities={row("windsurf")} onClose={vi.fn()} />);
    const button = screen.getByRole("button", {name: "ConnectVerifyAction"});
    for (let i = 0; i < 100; i++) fireEvent.click(button);
    expect(ipc.verifyProviderConnection).toHaveBeenCalledTimes(1);
    ui.unmount(); resolve(connected("windsurf", "localScanner"));
  });

  it("keeps focus inside the dialog in both directions", () => {
    render(<ProviderConnectFlow capabilities={row("openrouter")} onClose={vi.fn()} />);
    const first = screen.getByRole("button", {name: "ConnectClose"});
    const last = screen.getByRole("button", {name: "ConnectNext"});
    first.focus(); fireEvent.keyDown(window, {key: "Tab", shiftKey: true});
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, {key: "Tab"}); expect(document.activeElement).toBe(first);
  });
});
