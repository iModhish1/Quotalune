import {describe, expect, it} from "vitest";
import {composeProviderInstances, moveProviderInstance, moveCircularProviderInstance, DEFAULT_INSTANCE_PRESENTATION} from "./providerInstances";
import type {ProviderInstanceSnapshot, ProviderUsageSnapshot} from "../types/bridge";

const snapshot = {providerId: "codex", primary: {usedPercent: 62}, cost: {amount: 900}} as unknown as ProviderUsageSnapshot;
const second: ProviderInstanceSnapshot = {instanceId: "codex:account-two", providerId: "codex", accountId: "account-two", accountOrdinal: 2, accountLabel: "Work", snapshot: null};

describe("account instance composition", () => {
  it('reorders across the circular seam without changing other slots or identities', () => {
    const ids = ['codex', second.instanceId, 'claude', 'gemini'];
    const left = moveCircularProviderInstance(ids, 'codex', -1);
    expect(left).toEqual(['gemini', second.instanceId, 'claude', 'codex']);
    expect(moveCircularProviderInstance(left, 'codex', 1)).toEqual(ids);
    expect(moveCircularProviderInstance(ids, second.instanceId, 1)).toEqual(['codex', 'claude', second.instanceId, 'gemini']);
    expect(moveCircularProviderInstance(ids, 'absent', 1)).toEqual(ids);
    expect(moveCircularProviderInstance(['codex'], 'codex', -1)).toEqual(['codex']);
  });
  it("retains a missing account observation without borrowing ambient quota or money", () => {
    const result = composeProviderInstances([snapshot], [second], ["codex"]);
    expect(result).toHaveLength(2);
    expect(result[0].snapshot).toBe(snapshot);
    expect(result[1].snapshot).toBeNull();
    expect(result[1].accountOrdinal).toBe(2);
  });
  it("excludes disabled account families and rejects mismatched brand snapshots", () => {
    expect(composeProviderInstances([], [second], [])).toEqual([]);
    const result = composeProviderInstances([], [{...second, snapshot: {...snapshot, providerId:"claude"}}], ["codex"]);
    expect(result[0].snapshot).toBeNull();
  });
  it("moves instances across brands while preserving ordinal and observation identity", () => {
    const own = {...second, snapshot: {...snapshot, primary: {...snapshot.primary, usedPercent:17}, cost:null}};
    const order = moveProviderInstance(["codex", own.instanceId, "claude"], own.instanceId, -1);
    const result = composeProviderInstances([snapshot], [own, own], ["codex"], {...DEFAULT_INSTANCE_PRESENTATION, order});
    expect(result.map(i=>i.instanceId)).toEqual([own.instanceId, "codex"]);
    expect(result[0].accountOrdinal).toBe(2);
    expect(result[0].snapshot?.primary.usedPercent).toBe(17);
    expect(result[0].snapshot?.cost).toBeNull();
  });
});
