/**
 * Deterministic provider selection for Demo Mode's "Curated" provider
 * set (owner Phase 5.2 sections 5/7). Never invents a `ProviderId` --
 * every id returned here is verified present in the real registry
 * catalog (`BootstrapState.providers`, the same list Settings > Providers
 * uses) before it is ever selected.
 */
import type { ProviderCatalogEntry } from "../types/bridge";
import { DEFAULT_CURATED_PROVIDER_IDS } from "./constants";

/** Curated ids, deterministically extended past the default six for a
 *  larger requested count: the default six first (in their fixed order,
 *  filtered to whichever are actually present in `catalog` -- see owner
 *  section 5, "If one is absent: choose the closest suitable real
 *  registered provider"), then the remaining catalog entries in stable
 *  alphabetical id order, excluding anything already chosen. */
export function selectCuratedProviderIds(
  count: number,
  catalog: readonly ProviderCatalogEntry[],
): string[] {
  const catalogIds = new Set(catalog.map((p) => p.id));
  const selected: string[] = [];

  for (const id of DEFAULT_CURATED_PROVIDER_IDS) {
    if (selected.length >= count) break;
    if (catalogIds.has(id)) selected.push(id);
  }

  if (selected.length < count) {
    const remaining = catalog
      .map((p) => p.id)
      .filter((id) => !selected.includes(id))
      .sort((a, b) => a.localeCompare(b));
    for (const id of remaining) {
      if (selected.length >= count) break;
      selected.push(id);
    }
  }

  return selected.slice(0, Math.min(count, catalog.length || count));
}

/** Real display name for a provider id from the catalog, falling back to
 *  a capitalized version of the id if the catalog lookup somehow misses
 *  (never a fabricated brand name). */
export function displayNameFor(providerId: string, catalog: readonly ProviderCatalogEntry[]): string {
  const entry = catalog.find((p) => p.id === providerId);
  if (entry) return entry.displayName;
  return providerId.length > 0 ? providerId[0].toUpperCase() + providerId.slice(1) : providerId;
}
