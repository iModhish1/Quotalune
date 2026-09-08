import { describe, expect, it } from "vitest";
import {
  buildProviderSceneNodes,
  providerMonetaryQuantityKind,
  type AlertThresholds,
} from "./sceneModel";
import type { ProviderUsageSnapshot } from "../../../types/bridge";

function rateWindow(overrides: Partial<ProviderUsageSnapshot["primary"]> = {}) {
  return {
    usedPercent: 20,
    remainingPercent: 80,
    windowMinutes: null,
    resetsAt: null,
    resetDescription: null,
    isExhausted: false,
    reservePercent: null,
    reserveDescription: null,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderUsageSnapshot> = {}): ProviderUsageSnapshot {
  return {
    providerId: "claude",
    displayName: "Claude",
    primary: rateWindow(),
    selectedMetric: rateWindow(),
    primaryLabel: "Monthly",
    secondary: null,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    cost: null,
    planName: null,
    accountEmail: null,
    sourceLabel: "auto",
    updatedAt: "2026-09-08T00:00:00Z",
    error: null,
    errorState: "ready",
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
    ...overrides,
  };
}

const thresholds: AlertThresholds = { highUsageThreshold: 70, criticalUsageThreshold: 90 };
const identityColor = () => "#2dd4bf";

describe("providerMonetaryQuantityKind", () => {
  it("classifies a known Spend provider", () => {
    expect(providerMonetaryQuantityKind("claude")).toBe("spend");
  });

  it("classifies a known Balance provider", () => {
    expect(providerMonetaryQuantityKind("zenmux")).toBe("balance");
  });

  it("classifies a known Credits provider", () => {
    expect(providerMonetaryQuantityKind("codex")).toBe("credits");
  });

  it("fails closed to unknown for an unclassified provider", () => {
    expect(providerMonetaryQuantityKind("some-future-provider")).toBe("unknown");
  });
});

describe("buildProviderSceneNodes", () => {
  it("returns one node per live provider, no fabrication", () => {
    const nodes = buildProviderSceneNodes(
      [provider({ providerId: "claude" }), provider({ providerId: "codex" })],
      thresholds,
      identityColor,
    );
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id)).toEqual(["claude", "codex"]);
  });

  it("returns an empty scene for an empty provider list -- never a fake body", () => {
    expect(buildProviderSceneNodes([], thresholds, identityColor)).toEqual([]);
  });

  it("maps a real ProviderReported Spend figure honestly", () => {
    const [node] = buildProviderSceneNodes(
      [
        provider({
          providerId: "claude",
          cost: {
            used: 12.5,
            limit: null,
            remaining: null,
            currencyCode: "USD",
            period: "Monthly",
            resetsAt: null,
            formattedUsed: "$12.50",
            formattedLimit: null,
          },
        }),
      ],
      thresholds,
      identityColor,
    );
    expect(node.monetary).toEqual({ kind: "spend", amount: 12.5, currencyCode: "USD" });
  });

  it("labels a Balance provider's figure as Balance, never Spend", () => {
    const [node] = buildProviderSceneNodes(
      [
        provider({
          providerId: "zenmux",
          cost: {
            used: 30,
            limit: null,
            remaining: null,
            currencyCode: "USD",
            period: "balance",
            resetsAt: null,
            formattedUsed: "$30.00",
            formattedLimit: null,
          },
        }),
      ],
      thresholds,
      identityColor,
    );
    expect(node.monetary.kind).toBe("balance");
    expect(node.monetary.kind).not.toBe("spend");
  });

  it("reports monetary amount as null (unavailable) when no cost snapshot exists -- never a fabricated 0", () => {
    const [node] = buildProviderSceneNodes([provider({ cost: null })], thresholds, identityColor);
    expect(node.monetary).toEqual({ kind: "unknown", amount: null, currencyCode: null });
  });

  it("reports monetary amount as null for an unclassified provider even with a real cost snapshot", () => {
    const [node] = buildProviderSceneNodes(
      [
        provider({
          providerId: "some-future-provider",
          cost: {
            used: 5,
            limit: null,
            remaining: null,
            currencyCode: "USD",
            period: "unknown",
            resetsAt: null,
            formattedUsed: "$5.00",
            formattedLimit: null,
          },
        }),
      ],
      thresholds,
      identityColor,
    );
    expect(node.monetary).toEqual({ kind: "unknown", amount: null, currencyCode: null });
  });

  it("maps auth-required providers to needsAuth, never a decorative failure state", () => {
    const [node] = buildProviderSceneNodes(
      [provider({ errorState: "needsAuthentication" })],
      thresholds,
      identityColor,
    );
    expect(node.authState).toBe("needsAuth");
  });

  it("maps localRuntimeOffline/unknown error states to unavailable", () => {
    const [node] = buildProviderSceneNodes(
      [provider({ errorState: "localRuntimeOffline" })],
      thresholds,
      identityColor,
    );
    expect(node.authState).toBe("unavailable");
  });

  it("computes alert level from the user's real configured thresholds, not a hardcoded number", () => {
    const [warning] = buildProviderSceneNodes(
      [provider({ primary: rateWindow({ usedPercent: 75 }) })],
      thresholds,
      identityColor,
    );
    expect(warning.alertLevel).toBe("warning");

    const [critical] = buildProviderSceneNodes(
      [provider({ primary: rateWindow({ usedPercent: 95 }) })],
      thresholds,
      identityColor,
    );
    expect(critical.alertLevel).toBe("critical");

    const [none] = buildProviderSceneNodes(
      [provider({ primary: rateWindow({ usedPercent: 10 }) })],
      thresholds,
      identityColor,
    );
    expect(none.alertLevel).toBe("none");
  });

  it("passes the resolved identity color through unchanged", () => {
    const [node] = buildProviderSceneNodes(
      [provider({ providerId: "codex" })],
      thresholds,
      (id) => `color-for-${id}`,
    );
    expect(node.identityColorHex).toBe("color-for-codex");
  });
});
