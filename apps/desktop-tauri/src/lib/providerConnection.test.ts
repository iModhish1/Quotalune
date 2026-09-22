import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_LOCALE_KEYS } from "../i18n/keys";
import { cliRequirementSatisfied, connectionStatusKey, safeExternalUrl, singleMethod, stepsFor, type ProviderConnectionCapabilities } from "./providerConnection";

const here = import.meta.dirname!;
const matrix = JSON.parse(readFileSync(`${here}/../../../../docs/validation/PROVIDER_CONNECTION_CAPABILITY_MATRIX.json`, "utf8")) as { providerCount: number; providers: ProviderConnectionCapabilities[] };

describe("connection status wording", () => {
  it("names the issue when there is one, the state otherwise, and stale separately", () => {
    expect(connectionStatusKey("connected", null)).toBe("ConnectStateConnected");
    expect(connectionStatusKey("connected", null, true)).toBe("ConnectStateStale");
    expect(connectionStatusKey("actionRequired", "sessionExpired")).toBe("ConnectIssueSessionExpired");
    expect(connectionStatusKey("rateLimited", "rateLimited")).toBe("ConnectIssueRateLimited");
    expect(connectionStatusKey("timedOut", "timedOut")).not.toBe("ConnectIssueCredentialsRejected");
    expect(connectionStatusKey("idle", null)).toBe("ConnectStateIdle");
  });
  it("only shows steps a method needs", () => {
    expect(stepsFor("apiKey", null)).toEqual(["configure", "verify", "success"]);
    expect(stepsFor("localScanner", null)).toEqual(["verify", "success"]);
    expect(stepsFor("cliSession", { tool: "x", executables: ["x"], install: { kind: "manualOnly" }, installRequiresAdmin: false, docsUrl: "https://x", sessionDetection: "authFile", minVersion: null })).toEqual(["requirements", "configure", "verify", "success"]);
    expect(stepsFor("deviceFlow", null)).toEqual(["configure", "verify", "success"]);
  });
  it("opens only https curated links", () => {
    expect(safeExternalUrl("https://cli.github.com/")).toBe("https://cli.github.com/");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("file:///C:/x")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
  it("treats only an installed or version-unknown CLI as satisfied", () => {
    const base = { providerId: "codex", tool: "x", path: null, version: null, session: "unknown" as const, installAvailable: true, docsUrl: "https://x", signInHint: "x" };
    expect(cliRequirementSatisfied({ ...base, status: { kind: "installed" } })).toBe(true);
    expect(cliRequirementSatisfied({ ...base, status: { kind: "versionUnknown" } })).toBe(true);
    expect(cliRequirementSatisfied({ ...base, status: { kind: "missing" } })).toBe(false);
    expect(cliRequirementSatisfied({ ...base, status: { kind: "tooOld", installed: "0.1", required: "1.0" } })).toBe(false);
    expect(cliRequirementSatisfied(null)).toBe(false);
  });
});

describe("committed capability matrix", () => {
  it("has one row per registry provider with a single recommendation each", () => {
    expect(matrix.providers.length).toBe(matrix.providerCount);
    expect(new Set(matrix.providers.map((p) => p.provider)).size).toBe(matrix.providerCount);
    for (const row of matrix.providers) {
      if (row.status === "unsupported") continue;
      expect(row.methods.filter((m) => m.rank === "recommended"), row.provider).toHaveLength(1);
      expect(singleMethod(row) === null || row.methods.length === 1).toBe(true);
    }
  });
  it("every Connect string exists in Arabic with Arabic script", () => {
    const ar = readFileSync(`${here}/../../../../rust/src/locale/ar-SA.ftl`, "utf8");
    const keys = ALL_LOCALE_KEYS.filter((k) => k.startsWith("Connect") || k.startsWith("ProviderQa"));
    expect(keys.length).toBeGreaterThan(100);
    for (const key of keys) {
      const line = ar.split("\n").find((l) => l.startsWith(`${key} = `));
      expect(line, key).toBeDefined();
      expect(/[\u0600-\u06FF]/.test(line!), key).toBe(true);
    }
  });
});
