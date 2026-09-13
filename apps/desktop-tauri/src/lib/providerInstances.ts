import type {ProviderInstancePresentation, ProviderInstanceSnapshot, ProviderUsageSnapshot} from "../types/bridge";

export const DEFAULT_INSTANCE_PRESENTATION: ProviderInstancePresentation = {
  order: [], badgePosition: "end", showAccountNumbers: true,
  resetPosition: "bottom-center", showResetBadge: true, visibleCount: 4, anchorId: null,
};

/** Display-only composition. Account observations never enter provider-wide history. */
export function composeProviderInstances(
  providers: readonly ProviderUsageSnapshot[],
  instances: readonly ProviderInstanceSnapshot[],
  enabledIds: readonly string[],
  presentation = DEFAULT_INSTANCE_PRESENTATION,
): ProviderInstanceSnapshot[] {
  const enabled = new Set(enabledIds);
  const metadata = new Map(instances.filter(i => i.instanceId === i.providerId).map(i => [i.providerId, i]));
  const result: ProviderInstanceSnapshot[] = providers.map(snapshot => ({
    instanceId: snapshot.providerId, providerId: snapshot.providerId,
    accountId: null, accountOrdinal: snapshot.providerId === "codex" ? 1 : null,
    accountLabel: null, ...metadata.get(snapshot.providerId), snapshot, resetFacts:snapshot.resetFacts,
  }));
  const seen = new Set(result.map(i => i.instanceId));
  for (const instance of instances) {
    if (!enabled.has(instance.providerId) || seen.has(instance.instanceId)) continue;
    // Only the backend's explicitly supported Codex account namespace is admitted.
    if (instance.providerId !== "codex" || !instance.accountId || instance.instanceId !== `codex:${instance.accountId}`) continue;
    seen.add(instance.instanceId);
    const mismatch=instance.snapshot&&instance.snapshot.providerId!==instance.providerId;
    result.push({...instance, snapshot: mismatch?null:instance.snapshot,resetFacts:mismatch?null:instance.resetFacts});
  }
  const ranks = new Map(presentation.order.map((id, index) => [id, index]));
  return result.sort((a, b) => (ranks.get(a.instanceId) ?? Infinity) - (ranks.get(b.instanceId) ?? Infinity));
}

export function moveProviderInstance(ids: readonly string[], id: string, delta: number): string[] {
  const result = [...ids];
  const from = result.indexOf(id);
  if (from < 0) return result;
  const to = Math.max(0, Math.min(result.length - 1, from + delta));
  result.splice(to, 0, ...result.splice(from, 1));
  return result;
}

/** Swap adjacent physical slots, including the seam of the circular dashboard. */
export function moveCircularProviderInstance(ids: readonly string[], id: string, delta: number): string[] {
  const result = [...ids];
  const from = result.indexOf(id);
  if (from < 0 || result.length < 2 || delta === 0) return result;
  const to = (from + Math.sign(delta) + result.length) % result.length;
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

export function providerInstanceName(instance: ProviderInstanceSnapshot): string {
  const name = instance.snapshot?.displayName ?? (instance.providerId === "codex" ? "Codex" : instance.providerId);
  return instance.accountOrdinal ? `${name} · ${instance.accountOrdinal}` : name;
}
