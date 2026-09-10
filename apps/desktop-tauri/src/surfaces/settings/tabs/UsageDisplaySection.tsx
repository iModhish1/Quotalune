/**
 * Usage Display — production Settings section.
 *
 * Global mode (radio) + per-provider overrides with Follow-global /
 * Used / Remaining / Hybrid. Every row shows a live preview computed by
 * the same applyUsageSemantics resolver the Taskbar uses — no second
 * implementation. Persistence goes through set_usage_settings (real Rust
 * settings command) and broadcasts settings-updated, which re-themes the
 * live Taskbar without restart.
 *
 * Accessibility: radiogroup semantics for the global mode, labelled
 * selects per provider, disabled state explains inheritance, focus
 * visible via the design-system focus ring.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { listen } from "@tauri-apps/api/event";
import { Select } from "../../../components/FormControls";
import {
  applyUsageSemantics,
  resolveUsageMode,
  type UsageDisplayConfig,
  type UsageMode,
} from "../../../design-system/themes";
import { formatPercentage } from "../../../design-system/percent";
import { QaProviderIcon } from "../../../design-system";
import { useProviders } from "../../../hooks/useProviders";
import {useLocale} from "../../../hooks/useLocale";
import { getSettingsSnapshot, setUsageSettings, setProviderLimitOrder, setProviderLimitPresentation, setGlobalLimitPresentation } from "../../../lib/tauri";
import LimitPresentationEditor from './LimitPresentationEditor';
import {DEFAULT_LIMIT_PRESENTATION,type LimitPresentation} from '../../../design-system/limitPresentation';
import LimitChoiceEditor from './LimitChoiceEditor';
import "./UsageDisplaySection.css";
import {toStageProviders,usageConfigFromSnapshot} from "../../../components/orbit/stageProviders";
import UsageWindowList from "../../../components/orbit/UsageWindowList";
import type {
  ProviderCatalogEntry,
  ProviderUsageSnapshot,
  SettingsUpdate,
} from "../../../types/bridge";
import { AccentColorSection } from "../providers/sections/AccentColorSection";
import { getProviderIcon } from "../../../components/providers/providerIcons";
import { providerMeterFillColor } from "../../../design-system/meterFill";

type Mode = "global" | "used" | "remaining" | "hybrid";

interface ProviderRow {
  id: string;
  name: string;
  remainingPercent: number | null;
}

const USAGE_MODES: { value: UsageMode; label: string }[] = [
  { value: "remaining", label: "Remaining" },
  { value: "used", label: "Used" },
  { value: "hybrid", label: "Hybrid" },
];

function isUsageMode(v: string | null | undefined): v is UsageMode {
  return v === "used" || v === "remaining" || v === "hybrid";
}

function remainingPercent(snapshot: ProviderUsageSnapshot | undefined): number | null {
  if (!snapshot || snapshot.error != null) return null;
  const window = snapshot.selectedMetric ?? snapshot.primary;
  if (!window) return null;
  if (Number.isFinite(window.remainingPercent)) {
    return Math.max(0, Math.min(100, window.remainingPercent));
  }
  if (Number.isFinite(window.usedPercent)) {
    return Math.max(0, Math.min(100, 100 - window.usedPercent));
  }
  return null;
}

interface UsageDisplaySectionProps {
  providerCatalog: ProviderCatalogEntry[];
  providerAccentColors?: Record<string, string>;
  onSettingsChange?: (patch: SettingsUpdate) => void;
  externalSaving?: boolean;
}

export default function UsageDisplaySection({
  providerCatalog,
  providerAccentColors = {},
  onSettingsChange,
  externalSaving = false,
}: UsageDisplaySectionProps) {
  const [globalMode, setGlobalMode] = useState<UsageMode>("remaining");
  const [overrides, setOverrides] = useState<Record<string, UsageMode>>({});
  const [detailWindows, setDetailWindows] = useState<Record<string,string>>({});
  const [limitOrders,setLimitOrders]=useState<Record<string,readonly string[]>>({});
  const [presentations,setPresentations]=useState<Record<string,LimitPresentation>>({});
  const [globalPresentation,setGlobalPresentationState]=useState<LimitPresentation>(DEFAULT_LIMIT_PRESENTATION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [query,setQuery]=useState("");
  const [showAll,setShowAll]=useState(false);
  const live = useProviders({ refreshOnMount: false });
  const {t}=useLocale();

  useEffect(() => {
    const load = () =>
      getSettingsSnapshot()
        .then((s) => {
          setDetailWindows(usageConfigFromSnapshot(s)?.providerDetailWindows ?? {});
          setLimitOrders(usageConfigFromSnapshot(s)?.providerLimitOrder ?? {});
          setPresentations(usageConfigFromSnapshot(s)?.providerLimitPresentation ?? {});
          setGlobalPresentationState(usageConfigFromSnapshot(s)?.globalLimitPresentation ?? DEFAULT_LIMIT_PRESENTATION);
          const snap = s as {
            usageDisplayMode?: string | null;
            providerUsageOverrides?: Record<string, string>;
            enabledProviders?: string[];
          };
          if (isUsageMode(snap.usageDisplayMode)) {
            setGlobalMode(snap.usageDisplayMode);
          } else {
            setGlobalMode("remaining");
          }
          const ov: Record<string, UsageMode> = {};
          for (const [k, v] of Object.entries(snap.providerUsageOverrides ?? {})) {
            if (isUsageMode(v)) ov[k] = v;
          }
          setOverrides(ov);
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    load();
    const unlisten = listen("quotalis:settings-updated", load).catch(
      () => (() => {}) as () => void,
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const persist = useCallback(
    (global: UsageMode, ov: Record<string, UsageMode>) => {
      setSaving(true);
      setError(null);
      // Optimistic UI: state already updated by the caller; revert on failure.
      setUsageSettings(global, ov)
        .then(() => setDirty(false))
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
          // Revert to the persisted truth.
          getSettingsSnapshot()
            .then((s) => {
              const snap = s as {
                usageDisplayMode?: string | null;
                providerUsageOverrides?: Record<string, string>;
              };
              if (isUsageMode(snap.usageDisplayMode)) setGlobalMode(snap.usageDisplayMode);
              const ovRestored: Record<string, UsageMode> = {};
              for (const [k, v] of Object.entries(snap.providerUsageOverrides ?? {})) {
                if (isUsageMode(v)) ovRestored[k] = v;
              }
              setOverrides(ovRestored);
            })
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : String(reason));
            });
        })
        .finally(() => setSaving(false));
    },
    [],
  );

  const setGlobal = useCallback(
    (mode: UsageMode) => {
      setGlobalMode(mode);
      // Removing redundant overrides: Follow-new-global cleanup happens
      // server-side; keep explicit non-global overrides as chosen by user.
      persist(mode, overrides);
    },
    [persist, overrides],
  );

  const setOverride = useCallback(
    (providerId: string, mode: Mode) => {
      const next = { ...overrides };
      if (mode === "global") delete next[providerId];
      else next[providerId] = mode;
      setOverrides(next);
      persist(globalMode, next);
    },
    [globalMode, overrides, persist],
  );

  const saveLimitOrder = async (provider: string, selection: string[] | null) => {
    const previous = limitOrders;
    const next={...previous};
    if(selection===null)delete next[provider]; else next[provider]=selection;
    setLimitOrders(next);
    setSaving(true);
    setError(null);
    try { await setProviderLimitOrder(provider,selection); }
    catch (cause) {
      setLimitOrders(previous);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setSaving(false); }
  };

  const savePresentation=async(provider:string,value:LimitPresentation|null)=>{
    const previous=presentations;
    const next={...previous};
    if(value===null)delete next[provider]; else next[provider]=value;
    setPresentations(next);setSaving(true);setError(null);
    try{await setProviderLimitPresentation(provider,value);}
    catch(cause){setPresentations(previous);setError(cause instanceof Error?cause.message:String(cause));}
    finally{setSaving(false);}
  };

  const saveGlobalPresentation=async(value:LimitPresentation)=>{
    const previous=globalPresentation;
    setGlobalPresentationState(value);setSaving(true);setError(null);
    try{await setGlobalLimitPresentation(value);}
    catch(cause){setGlobalPresentationState(previous);setError(cause instanceof Error?cause.message:String(cause));}
    finally{setSaving(false);}
  };

  const resetOne = useCallback(
    (providerId: string) => setOverride(providerId, "global"),
    [setOverride],
  );

  const resetAll = useCallback(() => {
    setOverrides({});
    persist(globalMode, {});
  }, [globalMode, persist]);

  const effectiveMode = useCallback(
    (p: ProviderRow): { mode: UsageMode; inherited: boolean } => {
      const override = overrides[p.id];
      if (override) return { mode: override, inherited: false };
      return { mode: globalMode, inherited: true };
    },
    [globalMode, overrides],
  );

  const hasOverrides = Object.keys(overrides).length > 0;

  const providers = useMemo<ProviderRow[]>(() => {
    const snapshots = new Map(live.providers.map((provider) => [provider.providerId, provider]));
    return providerCatalog.map((provider) => ({
      id: provider.id,
      name: provider.displayName,
      remainingPercent: remainingPercent(snapshots.get(provider.id)),
    }));
  }, [live.providers, providerCatalog]);

  const rows = useMemo(
    () => providers.filter(p=>query.trim()?`${p.id} ${p.name}`.toLowerCase().includes(query.trim().toLowerCase()):showAll||overrides[p.id]!=null||detailWindows[p.id]!=null||limitOrders[p.id]!=null||presentations[p.id]!=null||live.providers.some(s=>s.providerId===p.id)).map((p) => ({ p, eff: effectiveMode(p) })),
    [providers, effectiveMode,query,showAll,overrides,detailWindows,limitOrders,presentations,live.providers],
  );

  return (
    <section className="settings-section usage-display" aria-label="Usage display">
      <h3 className="settings-section__title">Usage display</h3>
      <p className="settings-section__description">
        Controls whether arcs and values show used or remaining quota.
        Applies to all live surfaces immediately.
      </p>

      <fieldset className="usage-display__global">
        <legend className="usage-display__legend">
          Global display mode
        </legend>
        <div className="usage-display__mode-picker" role="radiogroup" aria-label="Global usage display mode">
          {USAGE_MODES.map((m) => (
            <label
              key={m.value}
              className="usage-display__mode"
              data-selected={globalMode === m.value}
            >
              <input
                type="radio"
                name="global-usage-mode"
                value={m.value}
                checked={globalMode === m.value}
                disabled={saving}
                onChange={() => setGlobal(m.value)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="usage-display__providers">
        <legend className="usage-display__legend">
          Per-provider overrides
          {hasOverrides && (
            <button
              type="button"
              onClick={resetAll}
              disabled={saving}
              className="usage-display__reset-all"
            >
              Reset all overrides
            </button>
          )}
        </legend>
        <section className="usage-display__global-presentation" aria-label="Global provider presentation">
          <header><div><strong>{t('ProviderPresentationGlobalTitle')}</strong><p>{t('ProviderPresentationGlobalHelper')}</p></div><span>{t('GlobalDefault')}</span></header>
          <LimitPresentationEditor provider="all providers" value={globalPresentation} disabled={saving} onChange={value=>void saveGlobalPresentation(value)}/>
        </section>
        <div className="usage-display__toolbar">
          <input type="search" aria-label="Find provider usage settings" placeholder="Find a provider…" value={query} onChange={e=>setQuery(e.target.value)}/>
          <label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>Show all providers</label>
        </div>
        <p className="usage-display__count" role="status">{rows.length} of {providers.length} providers · connected or customized shown first</p>
        {rows.length===0 && <p>No matching providers. Search by name or show all providers.</p>}
        <div className="usage-display__rows">
          {rows.map(({ p, eff }) => {
            const s = applyUsageSemantics(
              eff.mode,
              p.remainingPercent == null ? null : p.remainingPercent / 100,
            );
            const primary = formatPercentage(s.value);
            const overridden = overrides[p.id] != null;
            const snapshot=live.providers.find(provider=>provider.providerId===p.id);
            const available=snapshot?toStageProviders([snapshot],undefined)[0].windows ?? []:[];
            const inherited=snapshot?toStageProviders([snapshot],{global:globalMode,providerOverrides:overrides,
              providerDetailWindows:detailWindows as UsageDisplayConfig['providerDetailWindows']})[0].windows ?? []:[];
            const selected=limitOrders[p.id] ?? inherited.map(window=>window.id);
            const detailPreview=snapshot?toStageProviders([snapshot],{global:globalMode,providerOverrides:overrides,
              globalLimitPresentation:globalPresentation,
              providerLimitOrder:limitOrders,
              providerLimitPresentation:presentations,
              providerDetailWindows: detailWindows as UsageDisplayConfig["providerDetailWindows"]})[0]:undefined;
            return (
              <div
                key={p.id}
                className="usage-display__row"
              >
                <span
                  className="usage-display__provider"
                >
                  <QaProviderIcon providerId={p.id} size={15} />
                  {p.name}
                  {overridden && (
                    <span
                      className="usage-display__override"
                      title="This provider has its own usage mode override"
                    >
                      override
                    </span>
                  )}
                </span>
                <output
                  className="usage-display__value"
                >
                  {s.value == null
                    ? "Unavailable"
                    : `${primary} ${s.label}`}
                </output>
                <Select
                  ariaLabel={`Usage display mode for ${p.name}`}
                  value={overrides[p.id] ?? "global"}
                  disabled={saving}
                  onChange={(value) => setOverride(p.id, value as Mode)}
                  options={[
                    { value: "global", label: overridden ? "Use global" : "Follow global" },
                    ...USAGE_MODES.map((m) => ({ value: m.value, label: m.label })),
                  ]}
                />
                <details className="usage-display__provider-details" open={rows.length<=2 ? true : undefined}>
                  <summary><span>Customize {p.name} limits and identity</span><small>{selected.length} {selected.length===1?'limit':'limits'} · {(presentations[p.id]??globalPresentation).identity??'adaptive'}</small></summary>
                  <div className="usage-display__provider-details-content">
                    <div className="usage-display__detail-choice">
                       <LimitChoiceEditor provider={p.name} choices={available} selected={selected} disabled={saving||externalSaving}
                         customized={limitOrders[p.id]!==undefined}
                         onReset={()=>void saveLimitOrder(p.id,null)}
                         onChange={ids=>void saveLimitOrder(p.id,ids)}/>
                       <LimitPresentationEditor provider={p.name} value={presentations[p.id]??globalPresentation} disabled={saving||externalSaving}
                         customized={presentations[p.id]!==undefined}
                         onReset={()=>void savePresentation(p.id,null)}
                         onChange={value=>void savePresentation(p.id,value)}/>
                       {onSettingsChange&&<AccentColorSection providerId={p.id} accentColor={providerAccentColors[p.id]??null} t={t} onChange={onSettingsChange}/>}
                    </div>
                    <section className="usage-display__detail-preview" style={{"--provider-color":providerMeterFillColor(providerAccentColors[p.id]??getProviderIcon(p.id).brandColor,(presentations[p.id]??globalPresentation).identity)} as CSSProperties}>
                      <strong>Preview {p.name} details</strong>
                      {selected.length===0 && (limitOrders[p.id]!=null || detailWindows[p.id]==='none') ? <p>Limit details are hidden for this provider.</p> : detailPreview ? <UsageWindowList providerId={p.id} windows={detailPreview.windows ?? []} presentation={detailPreview.limitPresentation}/> : <p>No live usage data is available yet. Your selection will apply when this provider reports usage.</p>}
                    </section>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" style={{ color: "var(--qa-status-critical)", fontSize: "var(--qa-text-label)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
