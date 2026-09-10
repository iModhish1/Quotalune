import {useSettingsCopy} from "../useSettingsCopy";
/**
 * Reset Display — production Settings section.
 *
 * Configures the global Reset Time / Presentation preference (preset,
 * modules, order, timezone, regional format, clock format, date/weekday/
 * month/year style, countdown detail), plus optional per-surface
 * overrides. Persists through `set_reset_presentation` /
 * `set_reset_presentation_surface_override` (real Rust settings commands,
 * validated server-side) and broadcasts settings-updated, so every live
 * surface (taskbar, top, edge, HUD, quick panel, dashboard, provider
 * display, tray) picks up the change without a restart.
 *
 * Precedence: surface override -> global -> product default. The live
 * preview below each editor is rendered by the exact same production
 * formatter (`formatResetPresentation`) every real surface uses -- never
 * a separate hardcoded preview string.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Select } from "../../../components/FormControls";
import {
  getSettingsSnapshot,
  setResetPresentation,
  setResetPresentationSurfaceOverride,
} from "../../../lib/tauri";
import {
  RESET_PRESET_MODULES,
  applyResetPreset,
  formatResetPresentation,
  type ResetModule,
  type ResetPreset,
  type ResetPresentationConfig,
} from "../../../lib/resetPresentation";
import {
  dtoToResetSettings,
  resetSettingsToDto,
  resolveRegionalLocale,
  type ResetPresentationSettingsDto,
  type ResetRegionalFormat,
} from "../../../lib/resetPresentationSettings";
import "./ResetDisplaySection.css";

const PRESET_OPTIONS: { value: ResetPreset; label: string; hint: string }[] = [
  { value: "countdownOnly", label: "Countdown Only", hint: "e.g. \"51m\"" },
  { value: "dateAndTime", label: "Date & Time", hint: "e.g. \"Sep 12 · 19:00\"" },
  { value: "countdownDateAndTime", label: "Countdown + Date & Time", hint: "both together" },
  { value: "full", label: "Full", hint: "countdown, weekday, date, time, timezone" },
  { value: "compact", label: "Compact", hint: "largest countdown unit only" },
  { value: "custom", label: "Custom", hint: "choose modules and order yourself" },
];

const MODULE_LABELS: Record<ResetModule, string> = {
  countdown: "Countdown",
  date: "Date",
  time: "Time",
  weekday: "Weekday",
  timezone: "Timezone",
};

const ALL_MODULES: ResetModule[] = ["countdown", "date", "time", "weekday", "timezone"];

/** The real surface registry this Composer can target with an override --
 *  every id here is one a production `resetOptions`/`useResetStageOptions`
 *  call site actually reads (see stageProviders.ts / useResetStageOptions.ts
 *  / TrayPanel.tsx / FloatBar.tsx / PopOutPanel.tsx / useStageRuntime.ts).
 *  Surfaces that never render reset text (e.g. the pure settings shell)
 *  are intentionally absent. */
const RESET_OVERRIDE_SURFACES: { id: string; label: string }[] = [
  { id: "taskbar", label: "Taskbar" },
  { id: "top", label: "Top" },
  { id: "edge", label: "Edge" },
  { id: "hud", label: "HUD" },
  { id: "quick", label: "Quick Panel" },
  { id: "dashboard", label: "Dashboard" },
  { id: "providerDisplay", label: "Provider Display" },
  { id: "tray", label: "Tray" },
];

function defaultDto(): ResetPresentationSettingsDto {
  return resetSettingsToDto(dtoToResetSettings(undefined).config, "system", null);
}

interface ResolvedEditable {
  config: ResetPresentationConfig;
  regionalFormat: ResetRegionalFormat;
  regionalLocale: string | null;
}

/** Everything one editor instance needs -- reused for the global config and
 *  for whichever surface override is currently being edited. Each instance
 *  owns its own persist call, so editing a surface override never touches
 *  the global config and vice versa. */
function ResetConfigEditor({
  idPrefix,
  dto,
  onPersist,
  previewLabel,
}: {
  idPrefix: string;
  dto: ResetPresentationSettingsDto;
  onPersist: (next: ResetPresentationSettingsDto) => void;
  previewLabel: string;
}) {
  const tr = useSettingsCopy();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previewNow] = useState(() => Date.now());
  const { config, regionalFormat, regionalLocale }: ResolvedEditable = useMemo(
    () => dtoToResetSettings(dto),
    [dto],
  );

  const setPreset = (preset: ResetPreset) => {
    const nextConfig = applyResetPreset(config, preset);
    onPersist(resetSettingsToDto(nextConfig, regionalFormat, regionalLocale));
    if (preset === "custom") setAdvancedOpen(true);
  };

  const toggleModule = (module: ResetModule) => {
    const enabled = new Set(config.modules);
    if (enabled.has(module)) {
      if (enabled.size === 1) return; // never allow zero modules
      enabled.delete(module);
    } else {
      enabled.add(module);
    }
    const nextModules = ALL_MODULES.filter((m) => enabled.has(m));
    onPersist(resetSettingsToDto({ ...config, preset: "custom", modules: nextModules }, regionalFormat, regionalLocale));
  };

  const moveModule = (module: ResetModule, direction: -1 | 1) => {
    const visible = config.order.filter((m) => config.modules.includes(m));
    const from = visible.indexOf(module);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= visible.length) return;
    [visible[from], visible[to]] = [visible[to], visible[from]];
    const rest = config.order.filter((m) => !config.modules.includes(m));
    onPersist(resetSettingsToDto({ ...config, preset: "custom", order: [...visible, ...rest] }, regionalFormat, regionalLocale));
  };

  const patchConfig = (patch: Partial<typeof config>) => {
    onPersist(resetSettingsToDto({ ...config, ...patch }, regionalFormat, regionalLocale));
  };

  const setRegionalFormat = (nextFormat: ResetRegionalFormat) => {
    onPersist(resetSettingsToDto(config, nextFormat, regionalLocale));
  };

  const setRegionalLocale = (nextLocale: string) => {
    onPersist(resetSettingsToDto(config, regionalFormat, nextLocale || null));
  };

  const visibleOrder = config.order.filter((m) => config.modules.includes(m));

  // Live preview, powered by the exact production formatter -- a fixed
  // deterministic sample instant (5 days 13 hours from mount) so the
  // preview stays stable while the user edits.
  const sampleResetAt = useMemo(
    () => new Date(previewNow + (5 * 24 + 13) * 60 * 60_000).toISOString(),
    [previewNow],
  );
  const previewLocale = resolveRegionalLocale(regionalFormat, "en-US", regionalLocale);
  const previewEn = useMemo(
    () => formatResetPresentation({ resetAt: sampleResetAt, now: previewNow, locale: previewLocale, config }),
    [sampleResetAt, previewNow, config, previewLocale],
  );
  const previewAr = useMemo(
    () => formatResetPresentation({ resetAt: sampleResetAt, now: previewNow, locale: "ar-SA", config }),
    [sampleResetAt, previewNow, config],
  );

  const previewText = (result: typeof previewEn) =>
    result.orderedParts
      .map((part) => {
        if (part === "countdown") return result.countdown?.short;
        if (part === "date") return result.date?.short;
        if (part === "time") return result.time?.short;
        if (part === "weekday") return result.weekday;
        if (part === "timezone") return result.timezone;
        return undefined;
      })
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="reset-display__editor">
      <div className="reset-display__field">
        <label>{tr("Preset")}</label>
        <Select
          ariaLabel={tr("Preset")}
          value={config.preset}
          options={PRESET_OPTIONS.map((option) => ({ value: option.value, label: tr(option.label) }))}
          onChange={(v) => setPreset(v as ResetPreset)}
        />
      </div>

      {config.preset === "custom" && (
        <div className="reset-display__field reset-display__custom">
          <fieldset>
            <legend>{tr("Modules shown")}</legend>
            {ALL_MODULES.map((module) => (
              <label key={module} className="reset-display__checkbox">
                <input
                  type="checkbox"
                  checked={config.modules.includes(module)}
                  onChange={() => toggleModule(module)}
                />
                {tr(MODULE_LABELS[module])}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>{tr("Order")}</legend>
            <ol className="reset-display__order">
              {visibleOrder.map((module, index) => (
                <li key={module}>
                  <span>{index + 1}. {tr(MODULE_LABELS[module])}</span>
                  <span className="reset-display__order-controls">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`Move ${tr(MODULE_LABELS[module])} up`}
                      onClick={() => moveModule(module, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === visibleOrder.length - 1}
                      aria-label={`Move ${tr(MODULE_LABELS[module])} down`}
                      onClick={() => moveModule(module, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </fieldset>
        </div>
      )}

      <details
        className="reset-display__advanced"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>{tr("Advanced formatting")}</summary>
        <div className="reset-display__grid">
          <div className="reset-display__field">
            <label>{tr("Timezone")}</label>
            <Select
              ariaLabel={tr("Timezone")}
              value={config.timezoneMode}
              options={[
                { value: "system", label: tr("Follow System") },
                { value: "custom", label: tr("Custom") },
              ]}
              onChange={(v) => patchConfig({ timezoneMode: v as typeof config.timezoneMode })}
            />
            {config.timezoneMode === "system" ? (
              <small>Currently resolved: {config.customTimeZone || (() => {
                try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
              })()}</small>
            ) : (
              <input
                type="text"
                className="reset-display__text-input"
                placeholder="e.g. Asia/Riyadh"
                value={config.customTimeZone ?? ""}
                onChange={(e) => patchConfig({ customTimeZone: e.target.value || null })}
              />
            )}
          </div>

          <div className="reset-display__field">
            <label>{tr("Regional Format")}</label>
            <Select
              ariaLabel={tr("Regional Format")}
              value={regionalFormat}
              options={[
                { value: "system", label: tr("Follow System") },
                { value: "uiLanguage", label: tr("Follow UI Language") },
                { value: "custom", label: tr("Custom") },
              ]}
              onChange={(v) => setRegionalFormat(v as ResetRegionalFormat)}
            />
            {regionalFormat === "custom" && (
              <input
                type="text"
                className="reset-display__text-input"
                placeholder="e.g. en-GB"
                value={regionalLocale ?? ""}
                onChange={(e) => setRegionalLocale(e.target.value)}
              />
            )}
          </div>

          <div className="reset-display__field">
            <label>{tr("Clock Format")}</label>
            <Select
              ariaLabel={tr("Clock Format")}
              value={config.clockFormat}
              options={[
                { value: "system", label: tr("Follow System") },
                { value: "h12", label: "12-hour" },
                { value: "h24", label: "24-hour" },
              ]}
              onChange={(v) => patchConfig({ clockFormat: v as typeof config.clockFormat })}
            />
          </div>

          <div className="reset-display__field">
            <label>{tr("Meridiem")}</label>
            <Select
              ariaLabel={tr("Meridiem")}
              value={config.meridiemStyle}
              options={[
                { value: "auto", label: "Auto / Localized" },
                { value: "latin", label: "Latin AM/PM" },
                { value: "localized", label: tr("Localized") },
              ]}
              onChange={(v) => patchConfig({ meridiemStyle: v as typeof config.meridiemStyle })}
            />
          </div>

          <div className="reset-display__field">
            <label>{tr("Month")}</label>
            <Select
              ariaLabel={tr("Month")}
              value={config.monthStyle}
              options={[
                { value: "numeric", label: tr("Numeric") },
                { value: "short", label: tr("Short Name") },
                { value: "full", label: tr("Full Name") },
              ]}
              onChange={(v) => patchConfig({ monthStyle: v as typeof config.monthStyle })}
            />
          </div>

          <div className="reset-display__field">
            <label>{tr("Weekday")}</label>
            <Select
              ariaLabel={tr("Weekday")}
              value={config.weekdayStyle}
              options={[
                { value: "off", label: "Off" },
                { value: "short", label: tr("Short") },
                { value: "full", label: tr("Full") },
              ]}
              onChange={(v) => patchConfig({ weekdayStyle: v as typeof config.weekdayStyle })}
            />
          </div>

          <div className="reset-display__field">
            <label>Year</label>
            <Select
              ariaLabel="Year"
              value={config.yearStyle}
              options={[
                { value: "off", label: "Off" },
                { value: "on", label: "On" },
                { value: "auto", label: "Auto" },
              ]}
              onChange={(v) => patchConfig({ yearStyle: v as typeof config.yearStyle })}
            />
          </div>

          <div className="reset-display__field">
            <label>{tr("Countdown Detail")}</label>
            <Select
              ariaLabel={tr("Countdown Detail")}
              value={config.countdownDetail}
              options={[
                { value: "adaptive", label: tr("Adaptive") },
                { value: "compact", label: tr("Compact") },
                { value: "detailed", label: tr("Detailed") },
              ]}
              onChange={(v) => patchConfig({ countdownDetail: v as typeof config.countdownDetail })}
            />
          </div>
        </div>
      </details>

      <div className="reset-display__preview" aria-label={`${previewLabel} live preview`}>
        <strong>{previewLabel} Preview</strong>
        <div className="reset-display__preview-row">
          <span className="reset-display__preview-label">{tr("English")}</span>
          <span dir="ltr">{previewText(previewEn) || "—"}</span>
        </div>
        <div className="reset-display__preview-row">
          <span className="reset-display__preview-label">العربية</span>
          <span dir="rtl">
            <bdi dir="ltr">{previewText(previewAr) || "—"}</bdi>
          </span>
        </div>
        <p className="reset-display__preview-aria">
          Screen reader text: &ldquo;{previewEn.fullAriaLabel}&rdquo;
        </p>
      </div>
    </div>
  );
}

export default function ResetDisplaySection() {
  const tr = useSettingsCopy();
  const [dto, setDto] = useState<ResetPresentationSettingsDto>(defaultDto);
  const [overrides, setOverrides] = useState<Record<string, ResetPresentationSettingsDto>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customizeBySurface, setCustomizeBySurface] = useState(false);
  const [editingSurface, setEditingSurface] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      getSettingsSnapshot()
        .then((s) => {
          if (s.resetPresentation) setDto(s.resetPresentation);
          setOverrides(s.resetPresentationOverrides ?? {});
        })
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
    load();
    const unlisten = listen("quotalis:settings-updated", load).catch(() => (() => {}) as () => void);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const persistGlobal = useCallback((next: ResetPresentationSettingsDto) => {
    const previous = dto;
    setDto(next);
    setSaving(true);
    setError(null);
    setResetPresentation(next)
      .catch((cause: unknown) => {
        setDto(previous);
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setSaving(false));
  }, [dto]);

  const persistOverride = useCallback(
    (surface: string, next: ResetPresentationSettingsDto | null) => {
      const previous = overrides;
      setOverrides((current) => {
        const copy = { ...current };
        if (next) copy[surface] = next;
        else delete copy[surface];
        return copy;
      });
      setSaving(true);
      setError(null);
      setResetPresentationSurfaceOverride(surface, next)
        .catch((cause: unknown) => {
          setOverrides(previous);
          setError(cause instanceof Error ? cause.message : String(cause));
        })
        .finally(() => setSaving(false));
    },
    [overrides],
  );

  return (
    <section className="reset-display" aria-label={tr("Reset Display")}>
      <header className="reset-display__header">
        <div>
          <span className="reset-display__eyebrow">{tr("Reset Display")}</span>
          <h3>{tr("How reset times are shown")}</h3>
          <p>
            {tr("Reset presentation changes formatting only; the reported reset instant stays unchanged.")}
          </p>
        </div>
        {saving && <span className="reset-display__saving">{tr("Saving…")}</span>}
      </header>

      {error && <p className="reset-display__error" role="alert">{error}</p>}

      <div className="reset-display__scope">
        <span className="reset-display__scope-label">{tr("Apply to")}</span>
        <div className="reset-display__scope-toggle" role="radiogroup" aria-label={tr("Apply to")}>
          <button
            type="button"
            aria-pressed={!customizeBySurface}
            onClick={() => { setCustomizeBySurface(false); setEditingSurface(null); }}
          >
            {tr("Global")}
          </button>
          <button
            type="button"
            aria-pressed={customizeBySurface}
            onClick={() => setCustomizeBySurface(true)}
          >
            {tr("Customize by surface")}
          </button>
        </div>
      </div>

      {!customizeBySurface && (
        <ResetConfigEditor idPrefix="reset-display" dto={dto} onPersist={persistGlobal} previewLabel={tr("Global")} />
      )}

      {customizeBySurface && (
        <div className="reset-display__surfaces">
          {RESET_OVERRIDE_SURFACES.map(({ id, label }) => {
            const hasOverride = Boolean(overrides[id]);
            const isEditing = editingSurface === id;
            return (
              <div key={id} className="reset-display__surface-row">
                <div className="reset-display__surface-heading">
                  <span className="reset-display__surface-name">{tr(label)}</span>
                  <span
                    className={`reset-display__surface-status${hasOverride ? " reset-display__surface-status--custom" : ""}`}
                  >
                    {tr(hasOverride ? "Custom" : "Follow Global")}
                  </span>
                  <span className="reset-display__surface-actions">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSurface(id);
                          if (!overrides[id]) {
                            // "Customize" seeds the surface editor from the
                            // current global config -- a real starting
                            // point, not blank fields -- but persists
                            // nothing until the user actually changes it.
                            setOverrides((current) => ({ ...current, [id]: current[id] ?? dto }));
                          }
                        }}
                      >
                        {tr(hasOverride ? "Edit" : "Customize")}
                      </button>
                    )}
                    {isEditing && (
                      <button type="button" onClick={() => setEditingSurface(null)}>
                        {tr("Done")}
                      </button>
                    )}
                    {hasOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          persistOverride(id, null);
                          if (isEditing) setEditingSurface(null);
                        }}
                      >
                        {tr("Reset to Global")}
                      </button>
                    )}
                  </span>
                </div>
                {isEditing && (
                  <ResetConfigEditor
                    idPrefix={`reset-display-${id}`}
                    dto={overrides[id] ?? dto}
                    onPersist={(next) => persistOverride(id, next)}
                    previewLabel={label}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Re-exported for tests that want the preset->module mapping without
// duplicating it.
export { RESET_PRESET_MODULES };
