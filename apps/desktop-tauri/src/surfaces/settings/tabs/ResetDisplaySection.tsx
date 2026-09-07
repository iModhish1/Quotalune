/**
 * Reset Display — production Settings section.
 *
 * Configures the global Reset Time / Presentation preference (preset,
 * modules, order, timezone, regional format, clock format, date/weekday/
 * month/year style, countdown detail). Persists through
 * `set_reset_presentation` (real Rust settings command, validated
 * server-side) and broadcasts settings-updated, so every live surface
 * (taskbar, top, edge, HUD, quick panel, dashboard, provider display,
 * tray) picks up the change without a restart.
 *
 * The live preview below the controls is rendered by the exact same
 * production formatter (`formatResetPresentation`) every real surface
 * uses -- never a separate hardcoded preview string.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getSettingsSnapshot, setResetPresentation } from "../../../lib/tauri";
import {
  RESET_PRESET_MODULES,
  applyResetPreset,
  formatResetPresentation,
  type ResetModule,
  type ResetPreset,
} from "../../../lib/resetPresentation";
import {
  dtoToResetSettings,
  resetSettingsToDto,
  resolveRegionalLocale,
  type ResetPresentationSettingsDto,
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

function defaultDto(): ResetPresentationSettingsDto {
  return resetSettingsToDto(dtoToResetSettings(undefined).config, "system", null);
}

export default function ResetDisplaySection() {
  const [dto, setDto] = useState<ResetPresentationSettingsDto>(defaultDto);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previewNow] = useState(() => Date.now());

  useEffect(() => {
    const load = () =>
      getSettingsSnapshot()
        .then((s) => {
          if (s.resetPresentation) setDto(s.resetPresentation);
        })
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
    load();
    const unlisten = listen("codexbar:settings-updated", load).catch(() => (() => {}) as () => void);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const persist = useCallback((next: ResetPresentationSettingsDto) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dto]);

  const { config, regionalFormat, regionalLocale } = useMemo(() => dtoToResetSettings(dto), [dto]);

  const setPreset = (preset: ResetPreset) => {
    const nextConfig = applyResetPreset(config, preset);
    persist(resetSettingsToDto(nextConfig, regionalFormat, regionalLocale));
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
    persist(resetSettingsToDto({ ...config, preset: "custom", modules: nextModules }, regionalFormat, regionalLocale));
  };

  const moveModule = (module: ResetModule, direction: -1 | 1) => {
    const visible = config.order.filter((m) => config.modules.includes(m));
    const from = visible.indexOf(module);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= visible.length) return;
    [visible[from], visible[to]] = [visible[to], visible[from]];
    // Re-merge: keep every module (visible reorder plus any not currently
    // shown) so a later re-enabled module still has a sane position.
    const rest = config.order.filter((m) => !config.modules.includes(m));
    persist(resetSettingsToDto({ ...config, preset: "custom", order: [...visible, ...rest] }, regionalFormat, regionalLocale));
  };

  const patchConfig = (patch: Partial<typeof config>) => {
    persist(resetSettingsToDto({ ...config, ...patch }, regionalFormat, regionalLocale));
  };

  const setRegionalFormat = (nextFormat: typeof regionalFormat) => {
    persist(resetSettingsToDto(config, nextFormat, regionalLocale));
  };

  const setRegionalLocale = (nextLocale: string) => {
    persist(resetSettingsToDto(config, regionalFormat, nextLocale || null));
  };

  const visibleOrder = config.order.filter((m) => config.modules.includes(m));

  // Live preview, powered by the exact production formatter -- a fixed
  // deterministic sample instant (5 days 13 hours from the moment this
  // section mounted) so the preview stays stable while the user edits.
  const sampleResetAt = useMemo(
    () => new Date(previewNow + (5 * 24 + 13) * 60 * 60_000).toISOString(),
    [previewNow],
  );
  const previewLocale = resolveRegionalLocale(regionalFormat, "en-US", regionalLocale);
  const previewEn = useMemo(
    () =>
      formatResetPresentation({
        resetAt: sampleResetAt,
        now: previewNow,
        locale: previewLocale,
        config,
      }),
    [sampleResetAt, previewNow, config, previewLocale],
  );
  const previewAr = useMemo(
    () =>
      formatResetPresentation({
        resetAt: sampleResetAt,
        now: previewNow,
        locale: "ar-SA",
        config,
      }),
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
    <section className="reset-display" aria-label="Reset Display">
      <header className="reset-display__header">
        <div>
          <span className="reset-display__eyebrow">Reset Display</span>
          <h3>How reset times are shown</h3>
          <p>
            Controls when and how a provider&rsquo;s quota reset is displayed across every surface
            (taskbar, top, edge, HUD, quick panel, dashboard, provider display, tray). The exact
            reset instant is never changed by these preferences &mdash; only how it&rsquo;s presented.
          </p>
        </div>
        {saving && <span className="reset-display__saving">Saving…</span>}
      </header>

      {error && <p className="reset-display__error" role="alert">{error}</p>}

      <div className="reset-display__field">
        <label htmlFor="reset-display-preset">Preset</label>
        <select
          id="reset-display-preset"
          className="select"
          value={config.preset}
          onChange={(e) => setPreset(e.target.value as ResetPreset)}
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small>{PRESET_OPTIONS.find((o) => o.value === config.preset)?.hint}</small>
      </div>

      {config.preset === "custom" && (
        <div className="reset-display__field reset-display__custom">
          <fieldset>
            <legend>Modules shown</legend>
            {ALL_MODULES.map((module) => (
              <label key={module} className="reset-display__checkbox">
                <input
                  type="checkbox"
                  checked={config.modules.includes(module)}
                  onChange={() => toggleModule(module)}
                />
                {MODULE_LABELS[module]}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Order</legend>
            <ol className="reset-display__order">
              {visibleOrder.map((module, index) => (
                <li key={module}>
                  <span>{index + 1}. {MODULE_LABELS[module]}</span>
                  <span className="reset-display__order-controls">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`Move ${MODULE_LABELS[module]} up`}
                      onClick={() => moveModule(module, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === visibleOrder.length - 1}
                      aria-label={`Move ${MODULE_LABELS[module]} down`}
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
        <summary>Advanced formatting</summary>
        <div className="reset-display__grid">
          <div className="reset-display__field">
            <label htmlFor="reset-display-tz-mode">Timezone</label>
            <select
              id="reset-display-tz-mode"
              className="select"
              value={config.timezoneMode}
              onChange={(e) => patchConfig({ timezoneMode: e.target.value as typeof config.timezoneMode })}
            >
              <option value="system">Follow System</option>
              <option value="custom">Custom</option>
            </select>
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
            <label htmlFor="reset-display-regional">Regional Format</label>
            <select
              id="reset-display-regional"
              className="select"
              value={regionalFormat}
              onChange={(e) => setRegionalFormat(e.target.value as typeof regionalFormat)}
            >
              <option value="system">Follow System</option>
              <option value="uiLanguage">Follow UI Language</option>
              <option value="custom">Custom</option>
            </select>
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
            <label htmlFor="reset-display-clock">Clock Format</label>
            <select
              id="reset-display-clock"
              className="select"
              value={config.clockFormat}
              onChange={(e) => patchConfig({ clockFormat: e.target.value as typeof config.clockFormat })}
            >
              <option value="system">Follow System</option>
              <option value="h12">12-hour</option>
              <option value="h24">24-hour</option>
            </select>
          </div>

          <div className="reset-display__field">
            <label htmlFor="reset-display-meridiem">Meridiem</label>
            <select
              id="reset-display-meridiem"
              className="select"
              value={config.meridiemStyle}
              onChange={(e) => patchConfig({ meridiemStyle: e.target.value as typeof config.meridiemStyle })}
            >
              <option value="auto">Auto / Localized</option>
              <option value="latin">Latin AM/PM</option>
              <option value="localized">Localized</option>
            </select>
          </div>

          <div className="reset-display__field">
            <label htmlFor="reset-display-month">Month</label>
            <select
              id="reset-display-month"
              className="select"
              value={config.monthStyle}
              onChange={(e) => patchConfig({ monthStyle: e.target.value as typeof config.monthStyle })}
            >
              <option value="numeric">Numeric</option>
              <option value="short">Short Name</option>
              <option value="full">Full Name</option>
            </select>
          </div>

          <div className="reset-display__field">
            <label htmlFor="reset-display-weekday">Weekday</label>
            <select
              id="reset-display-weekday"
              className="select"
              value={config.weekdayStyle}
              onChange={(e) => patchConfig({ weekdayStyle: e.target.value as typeof config.weekdayStyle })}
            >
              <option value="off">Off</option>
              <option value="short">Short</option>
              <option value="full">Full</option>
            </select>
          </div>

          <div className="reset-display__field">
            <label htmlFor="reset-display-year">Year</label>
            <select
              id="reset-display-year"
              className="select"
              value={config.yearStyle}
              onChange={(e) => patchConfig({ yearStyle: e.target.value as typeof config.yearStyle })}
            >
              <option value="off">Off</option>
              <option value="on">On</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div className="reset-display__field">
            <label htmlFor="reset-display-countdown-detail">Countdown Detail</label>
            <select
              id="reset-display-countdown-detail"
              className="select"
              value={config.countdownDetail}
              onChange={(e) => patchConfig({ countdownDetail: e.target.value as typeof config.countdownDetail })}
            >
              <option value="adaptive">Adaptive</option>
              <option value="compact">Compact</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>
      </details>

      <div className="reset-display__preview" aria-label="Live preview">
        <strong>Preview</strong>
        <div className="reset-display__preview-row">
          <span className="reset-display__preview-label">English</span>
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
    </section>
  );
}

// Re-exported for tests that want the preset->module mapping without
// duplicating it.
export { RESET_PRESET_MODULES };
