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
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  applyUsageSemantics,
  resolveUsageMode,
  type UsageDisplayConfig,
  type UsageMode,
} from "../../../design-system/themes";
import { formatPercentage } from "../../../design-system/percent";
import { QaProviderIcon } from "../../../design-system";
import { getSettingsSnapshot } from "../../../lib/tauri";

type Mode = "global" | "used" | "remaining" | "hybrid";

interface ProviderRow {
  id: string;
  name: string;
  remainingPercent: number | null;
  error: boolean;
}

const USAGE_MODES: { value: UsageMode; label: string }[] = [
  { value: "remaining", label: "Remaining" },
  { value: "used", label: "Used" },
  { value: "hybrid", label: "Hybrid" },
];

function isUsageMode(v: string | null | undefined): v is UsageMode {
  return v === "used" || v === "remaining" || v === "hybrid";
}

/** Canonical fixture values for the usage-semantics preview rows. */
const PREVIEW_PROVIDERS: ProviderRow[] = [
  { id: "codex", name: "Codex", remainingPercent: 79, error: false },
  { id: "claude", name: "Claude", remainingPercent: 27, error: false },
  { id: "gemini", name: "Gemini", remainingPercent: 42, error: false },
];

export default function UsageDisplaySection() {
  const [globalMode, setGlobalMode] = useState<UsageMode>("remaining");
  const [overrides, setOverrides] = useState<Record<string, UsageMode>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [providers, setProviders] = useState<ProviderRow[]>(PREVIEW_PROVIDERS);

  useEffect(() => {
    const load = () =>
      getSettingsSnapshot()
        .then((s) => {
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
          if (Array.isArray(snap.enabledProviders) && snap.enabledProviders.length > 0) {
            setProviders(
              PREVIEW_PROVIDERS.filter((p) => snap.enabledProviders!.includes(p.id)),
            );
          }
        })
        .catch(() => {});
    load();
    const unlisten = listen("codexbar:settings-updated", load).catch(
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
      invoke("set_usage_settings", { globalMode: global, providerOverrides: ov })
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
            .catch(() => {});
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
    [globalMode, persist],
  );

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

  const rows = useMemo(
    () => providers.map((p) => ({ p, eff: effectiveMode(p) })),
    [providers, effectiveMode],
  );

  return (
    <section className="settings-section" aria-label="Usage display">
      <h3 className="settings-section__title">Usage display</h3>
      <p className="settings-section__description">
        Controls whether arcs and values show used or remaining quota.
        Applies to all live surfaces immediately.
      </p>

      <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
        <legend
          style={{
            fontSize: "var(--qa-text-label)",
            fontWeight: 600,
            color: "var(--qa-ink-2)",
            padding: "var(--qa-space-2) 0",
          }}
        >
          Global display mode
        </legend>
        <div role="radiogroup" aria-label="Global usage display mode" style={{ display: "flex", gap: 10 }}>
          {USAGE_MODES.map((m) => (
            <label
              key={m.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border:
                  globalMode === m.value
                    ? "1px solid var(--qa-accent)"
                    : "1px solid var(--qa-hairline)",
                cursor: "pointer",
                fontSize: "var(--qa-text-label)",
              }}
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

      <fieldset style={{ border: "none", margin: "var(--qa-space-4) 0 0", padding: 0 }}>
        <legend
          style={{
            fontSize: "var(--qa-text-label)",
            fontWeight: 600,
            color: "var(--qa-ink-2)",
            padding: "var(--qa-space-2) 0",
          }}
        >
          Per-provider overrides
          {hasOverrides && (
            <button
              type="button"
              onClick={resetAll}
              disabled={saving}
              style={{
                marginLeft: 10,
                background: "none",
                border: "none",
                color: "var(--qa-ink-3)",
                fontSize: "var(--qa-text-micro)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Reset all overrides
            </button>
          )}
        </legend>
        <div>
          {rows.map(({ p, eff }) => {
            const s = applyUsageSemantics(
              eff.mode,
              p.error ? null : (p.remainingPercent ?? 0) / 100,
            );
            const primary = formatPercentage(s.value);
            const overridden = overrides[p.id] != null;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--qa-space-3)",
                  padding: "var(--qa-space-2) 0",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    width: 130,
                    fontSize: "var(--qa-text-label)",
                    fontWeight: 500,
                  }}
                >
                  <QaProviderIcon providerId={p.id} size={15} />
                  {p.name}
                  {overridden && (
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--qa-accent)",
                        border: "1px solid var(--qa-hairline)",
                        borderRadius: 4,
                        padding: "0 4px",
                      }}
                      title="This provider has its own usage mode override"
                    >
                      override
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: "var(--qa-text-micro)",
                    color: "var(--qa-ink-3)",
                    width: 110,
                  }}
                >
                  {s.value == null
                    ? "unavailable"
                    : `${Math.round(s.value)}% ${s.label} · arc ${Math.round((s.arc ?? 0) * 100)}%`}
                </span>
                <select
                  aria-label={`Usage display mode for ${p.name}`}
                  value={overrides[p.id] ?? "global"}
                  disabled={saving}
                  onChange={(e) =>
                    setOverride(p.id, e.target.value as Mode)
                  }
                  style={{
                    background: "var(--qa-material-raised)",
                    border: "1px solid var(--qa-hairline)",
                    borderRadius: 6,
                    color: "var(--qa-ink-1)",
                    fontSize: "var(--qa-text-label)",
                    padding: "3px 6px",
                  }}
                >
                  <option value="global">
                    {overridden ? "Use global" : "Follow global"}
                  </option>
                  {USAGE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
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
