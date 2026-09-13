import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {SidebarResizeHandle, clampSidebarWidth} from "../SidebarControls";
import type {
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  SettingsUpdate,
} from "../../../types/bridge";
import type { BootstrapState } from "../../../types/bridge";
import { useLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";
import {
  ProvidersSidebar,
  type ProviderSidebarRow,
} from "../providers/ProvidersSidebar";
import { ProviderDetailPane } from "../providers/ProviderDetailPane";
import { reorderProviders } from "../../../lib/tauri";
import { selectSingleMetricUsageWindow } from "../../../lib/usageWindows";
import { useEffectiveProviders } from "../../../hooks/useEffectiveProviders";
import { providerOperationalState } from "../providers/providerOperationalState";
import CurrentLimits from "../../dashboard/analytics/CurrentLimits";
import DemoIndicator from "../../../demoMode/DemoIndicator";
import "../providers/ProviderWorkspace.css";

interface ProvidersTabProps {
  settings: BootstrapState["settings"];
  providers: ProviderCatalogEntry[];
  set: (patch: SettingsUpdate) => void;
  saving: boolean;
  initialProvider?: string|null;
  onAnalytics?: (id:string)=>void;
}

export default function ProvidersTab({
  settings,
  providers,
  set,
  saving, initialProvider, onAnalytics,
}: ProvidersTabProps) {
  const { t } = useLocale();
  const { providers: snapshots, provenance } = useEffectiveProviders(settings, providers);
  const isDemo = provenance === "demo";
  const splitRef = useRef<HTMLDivElement>(null);
  const [panePreview, setPanePreview] = useState<number|null>(null);
  const [splitWidth, setSplitWidth] = useState(900);
  useEffect(() => {
    const element = splitRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setSplitWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const paneMax = Math.max(184, Math.min(360, splitWidth - 380));
  const paneWidth = clampSidebarWidth(panePreview ?? settings.workspacePreferences?.providerSidebarWidth ?? 256, paneMax);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialProvider ?? providers.find(p => settings.enabledProviders.includes(p.id))?.id ?? providers[0]?.id ?? null,
  );
  // Locally-owned catalog order so drag-reorder feels instant before the
  // backend `reorder_providers` round-trip settles.
  const [orderedProviders, setOrderedProviders] =
    useState<ProviderCatalogEntry[]>(providers);
  const [prevProviders, setPrevProviders] = useState(providers);
  const [searchText, setSearchText] = useState("");
  if (providers !== prevProviders) {
    setPrevProviders(providers);
    setOrderedProviders(providers);
  }

  const enabled = useMemo(
    () => new Set(isDemo ? snapshots.map(p => p.providerId) : settings.enabledProviders),
    [settings.enabledProviders, isDemo, snapshots],
  );

  const toggle = (id: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(id);
    else next.delete(id);
    set({
      enabledProviders: orderedProviders.reduce<string[]>((ids, provider) => {
        if (next.has(provider.id)) ids.push(provider.id);
        return ids;
      }, []),
    });
  };

  const rows: ProviderSidebarRow[] = useMemo(() => {
    const snapshotMap = new Map(snapshots.map((s) => [s.providerId, s]));
    return orderedProviders.filter(p => !isDemo || snapshotMap.has(p.id)).map((p) => {
      const isOn = enabled.has(p.id);
      const snap = snapshotMap.get(p.id) ?? null;
      return {
        id: p.id,
        displayName: p.displayName,
        enabled: isOn,
        status: providerOperationalState(isOn, snap, Date.now(), settings.effectiveRefreshIntervalSecs),
        subtitlePrimary: providerSidebarSubtitle(p.id, isOn, snap, t),
        subtitleSecondary: isOn ? providerSidebarMetric(snap) : undefined,
      };
    });
  }, [enabled, orderedProviders, snapshots, t, isDemo, settings.effectiveRefreshIntervalSecs]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleRows = useMemo(() => rows.filter(row =>
    (!normalizedSearch || row.displayName.toLowerCase().includes(normalizedSearch) || row.id.toLowerCase().includes(normalizedSearch)) &&
    (statusFilter === "all" || (statusFilter === "enabled" ? row.enabled : statusFilter === "ready" ? row.enabled && row.status === "ok" : statusFilter === "attention" ? row.enabled && row.status !== "ok" : !row.enabled))),
    [rows, normalizedSearch, statusFilter]);

  // Derive selection from visible rows — no effect to mirror/adjust state.
  const resolvedSelectedId =
    visibleRows.length === 0
      ? null
      : selectedId && visibleRows.some((row) => row.id === selectedId)
        ? selectedId
        : visibleRows[0].id;

  const handleReorder = (ids: string[]) => {
    const byId = new Map(orderedProviders.map((p) => [p.id, p]));
    const nextIds = normalizedSearch || statusFilter !== "all"
      ? mergeFilteredOrder(
          orderedProviders.map((p) => p.id),
          new Set(visibleRows.map((row) => row.id)),
          ids,
        )
      : ids;
    const next = nextIds
      .map((id) => byId.get(id))
      .filter((p): p is ProviderCatalogEntry => Boolean(p));
    setOrderedProviders(next);
    void reorderProviders(nextIds).catch(() => {
      setOrderedProviders(providers);
    });
  };

  const selectedEntry =
    orderedProviders.find((p) => p.id === resolvedSelectedId) ?? null;

  return (
    <div className="provider-workspace">
      <header className="provider-workspace__header"><div><h2>{t("TabProviders")}</h2><p>{t("ProviderWorkspaceHelp")}</p></div>
        {resolvedSelectedId && onAnalytics && <button type="button" className="provider-analytics-link" onClick={()=>onAnalytics(resolvedSelectedId)}>{t("V3ViewAnalytics")} → <bdi>{selectedEntry?.displayName}</bdi></button>}
      </header>
      {isDemo && <DemoIndicator providerCount={snapshots.length} onExit={() => set({demoModeEnabled: false})} />}
      <div className="provider-workspace__toolbar" role="group" aria-label={t("ProviderWorkspaceFilter")}>
        {([{id:"all",label:"PanelAllProviders",count:rows.length},{id:"enabled",label:"ProviderEnabled",count:rows.filter(p=>p.enabled).length},
          {id:"ready",label:"V2ProviderReady",count:rows.filter(p=>p.enabled && p.status === "ok").length},
          {id:"attention",label:"DashboardNeedsAttention",count:rows.filter(p=>p.enabled && p.status !== "ok").length},
          {id:"disabled",label:"ProviderDisabled",count:rows.filter(p=>!p.enabled).length}] as const).map(filter =>
          <button key={filter.id} type="button" aria-pressed={statusFilter === filter.id} onClick={()=>setStatusFilter(filter.id)}>{t(filter.label)} <strong>{filter.count}</strong></button>)}
      </div>
      <div className="provider-split" ref={splitRef} data-narrow={splitWidth < 620} style={{"--provider-pane-width": `${paneWidth}px`} as CSSProperties}>
      <ProvidersSidebar
        providers={visibleRows}
        selectedId={resolvedSelectedId}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onSelect={setSelectedId}
        onReorder={handleReorder}
        onToggleEnabled={toggle}
        disabled={saving || isDemo}
      />
      <SidebarResizeHandle className="provider-pane-resizer" controls="provider-navigation" width={paneWidth} maxWidth={paneMax}
        disabled={saving} onPreview={setPanePreview} onCommit={width => {
          set({workspacePreferences: {density:"comfortable",navigation:"side",...settings.workspacePreferences,providerSidebarWidth:width}});
          setPanePreview(null);
        }}/>
      {isDemo ? <div className="provider-detail provider-detail--demo"><p role="note">{t("ProviderDemoReadOnly")}</p><CurrentLimits providers={snapshots.filter(p => p.providerId === resolvedSelectedId)} settings={settings} expanded /></div> : <ProviderDetailPane
        onAnalytics={onAnalytics} providerId={resolvedSelectedId}
        cookieDomain={selectedEntry?.cookieDomain ?? null}
        resetTimeRelative={settings.resetTimeRelative}
        providerMetrics={settings.providerMetrics}
        providerAccentColors={settings.providerAccentColors}
        wayfinderGatewayUrl={settings.wayfinderGatewayUrl ?? "http://127.0.0.1:8088"}
        settingsDisabled={saving}
        onSettingsChange={set}
      />}
      </div>
    </div>
  );
}

function mergeFilteredOrder(
  fullOrder: string[],
  visibleIds: Set<string>,
  reorderedVisibleIds: string[],
): string[] {
  const nextVisible = [...reorderedVisibleIds];
  return fullOrder.map((id) =>
    visibleIds.has(id) ? (nextVisible.shift() ?? id) : id,
  );
}

// ── Provider sidebar subtitle helpers (port of
//    rust/src/native_ui/preferences.rs::provider_sidebar_subtitle). ─────

/**
 * Minimal port of `provider_sidebar_source_hint`
 * (rust/src/native_ui/preferences.rs:3753). When we have a live snapshot the
 * backend-supplied `sourceLabel` wins; otherwise we fall back to the neutral
 * "Not detected" / "Disabled" copy.
 */
function providerSidebarSubtitle(
  providerId: string,
  isEnabled: boolean,
  snap: ProviderUsageSnapshot | null,
  t: (key: LocaleKey) => string,
): string {
  if (!isEnabled) {
    return `${t("ProviderDisabled")} — ${providerSourceHintShort(providerId, t)}`;
  }
  if (!snap) {
    return t("WaitingForUsage");
  }
  if (snap.errorState === "needsAuthentication" && /\boauth\b/i.test(snap.sourceLabel ?? "")) {
    return t("ProviderNoOAuthYet");
  }
  const source = snap.sourceLabel || providerSourceHintShort(providerId, t);
  return source;
}

function providerSourceHintShort(
  providerId: string,
  t: (key: LocaleKey) => string,
): string {
  const id = providerId.toLowerCase();
  switch (id) {
    case "cursor":
    case "factory":
    case "droid":
    case "kimi":
    case "kimik2":
    case "augment":
    case "opencode":
    case "amp":
    case "ollama":
    case "alibaba":
    case "infini":
    case "manus":
    case "mimo":
    case "zoommate":
    case "notion":
    case "t3chat":
    case "commandcode":
      return t("ProviderSourceWebShort");
    case "gemini":
    case "antigravity":
    case "jetbrains":
      return t("ProviderSourceCliShort");
    case "copilot":
      return t("ProviderSourceOauthShort");
    case "zai":
    case "vertexai":
    case "openrouter":
    case "bedrock":
    case "nanogpt":
    case "warp":
    case "deepinfra":
    case "aiand":
    case "zenmux":
    case "clinepass":
    case "neuralwatt":
    case "doubao":
    case "crof":
    case "stepfun":
    case "venice":
    case "openaiapi":
    case "elevenlabs":
    case "deepgram":
    case "groq":
    case "llmproxy":
    case "xai":
    case "fireworks":
      return t("ProviderSourceApiShort");
    case "kiro":
      return t("ProviderSourceKiroEnvShort");
    case "claude":
    case "codex":
    case "minimax":
    default:
      return t("ProviderSourceAutoShort");
  }
}

function providerSidebarMetric(
  snap: ProviderUsageSnapshot | null,
): string | undefined {
  if (!snap || snap.errorState !== "ready") return undefined;
  const rate = selectSingleMetricUsageWindow(snap);
  if (Number.isFinite(rate.usedPercent)) {
    return `${Math.round(Math.max(0, rate.usedPercent))}%`;
  }
  return undefined;
}
