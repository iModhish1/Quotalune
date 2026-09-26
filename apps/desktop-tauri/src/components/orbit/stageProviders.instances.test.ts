import { describe, expect, it } from "vitest";
import { composeProviderInstances } from "../../lib/providerInstances";
import type { ProviderInstanceSnapshot, ProviderUsageSnapshot } from "../../types/bridge";
import { toStageProviderInstances, toStageProviders } from "./stageProviders";

const ambient = {
  providerId: "codex", displayName: "Codex", planName: "Pro",
  primary: { usedPercent: 40, remainingPercent: 60, windowMinutes: 300 },
  error: null,
} as ProviderUsageSnapshot;
const managed: ProviderInstanceSnapshot = {
  instanceId: "codex:managed", providerId: "codex", accountId: "managed",
  accountOrdinal: 2, accountLabel: "Work", snapshot: null,
};

describe("Structure account lanes", () => {
  it("shows a second Codex account immediately without borrowing ambient quota", () => {
    const instances = composeProviderInstances([ambient], [managed], ["codex"]);
    const stage = toStageProviderInstances(instances, undefined);
    expect(stage.map(row => row.id)).toEqual(["codex", "codex:managed"]);
    expect(stage.map(row => row.iconId)).toEqual(["codex", "codex"]);
    expect(stage[0].primaryValue).toBe(60);
    expect(stage[1]).toMatchObject({
      accountId: "managed", name: "Codex · 2 · Work", accountLabel: "Work",
      primaryValue: null, arcFraction: null, status: "offline",
    });
  });

  it("keeps later accounts and providers past the old seven-row cap", () => {
    const rows = Array.from({ length: 70 }, (_, i) => ({
      ...ambient, providerId: `provider-${i}`, displayName: `Provider ${i}`,
    }));
    expect(toStageProviders(rows, undefined)).toHaveLength(70);
  });

  it("does not expose account labels when personal information is hidden", () => {
    const [stage] = toStageProviderInstances([managed], undefined, undefined, true);
    expect(stage.name).toBe("Codex · 2");
    expect(stage.accountLabel).toBeNull();
  });
});
