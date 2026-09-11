import { useEffect, useState } from "react";
import { getAnalyticsSourceRegistry } from "../lib/tauri";
import type { AnalyticsCapabilities, AnalyticsSourceDescriptor } from "../types/bridge";

export interface UseAnalyticsSourcesResult {
  sources: AnalyticsSourceDescriptor[];
  loading: boolean;
  error: string | null;
  /** True when at least one `available` source (not merely a defined
   *  capability on a source with no data yet) supports the given
   *  capability. This is the single check every capability-driven nav
   *  item/tab/filter in Analytics must use -- never re-derive capability
   *  from a provider id string, and never show a section backed only by
   *  a source that is `noDataYet`/`unsupported`. */
  hasCapability: (capability: keyof AnalyticsCapabilities) => boolean;
}

/**
 * The real analytics source registry (`rust/src/analytics_sources.rs`,
 * `get_analytics_source_registry`), fetched once per mount. This is the
 * single source of truth for what the Analytics UI may show -- no
 * capability rule is duplicated here; every check just reads the
 * already-computed `capabilities`/`availability` fields the backend
 * returned.
 */
export function useAnalyticsSources(): UseAnalyticsSourcesResult {
  const [sources, setSources] = useState<AnalyticsSourceDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalyticsSourceRegistry()
      .then((registry) => {
        if (!cancelled) setSources(registry);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCapability = (capability: keyof AnalyticsCapabilities) =>
    sources.some((source) => source.availability === "available" && source.capabilities[capability]);

  return { sources, loading, error, hasCapability };
}
