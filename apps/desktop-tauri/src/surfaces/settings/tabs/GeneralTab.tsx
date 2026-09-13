import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { playNotificationSound, quitApp } from "../../../lib/tauri";
import { Field, NumberInput, Select, Toggle } from "../../../components/FormControls";
import type {
  Language,
  LanguageOption,
  NotificationSoundEvent,
  NotificationEventPreferences,
  NotificationQuietHours,
  NotificationSoundPaths,
  NotificationSoundTheme,
  ProviderCatalogEntry,
  ThemePreference,
  UsageThresholdOverride,
} from "../../../types/bridge";
import type { LocaleKey } from "../../../i18n/keys";
import type { TabProps } from "../settingsTabs";
import NotificationPreview from "../NotificationPreview";
import NotificationTestControl from "../NotificationTestControl";
import QuotaArcMark from "../../../components/QuotaArcMark";
import {
  LOGO_SIZES,
  LOGO_VARIANTS,
  logoSizePercent,
  readLogoAppearance,
  writeLogoAppearance,
  type LogoSize,
  type LogoVariant,
} from "../../../design-system/logoAppearance";
import "./NotificationSettings.css";
import "./LogoAppearance.css";

const FALLBACK_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "english", display: "English" },
  { value: "chinese", display: "中文" },
  { value: "chinesetraditional", display: "繁體中文" },
  { value: "japanese", display: "日本語" },
  { value: "korean", display: "한국어" },
  { value: "spanish", display: "Español" },
  { value: "russian", display: "Русский" },
  { value: "turkish", display: "Türkçe" },
  { value: "arabic", display: "العربية" },
];

const REFRESH_CADENCE_OPTIONS: { value: string; labelKey: LocaleKey }[] = [
  { value: "0", labelKey: "RefreshIntervalManual" },
  { value: "adaptive", labelKey: "RefreshIntervalAdaptive" },
  { value: "60", labelKey: "RefreshInterval1Min" },
  { value: "300", labelKey: "RefreshInterval5Min" },
  { value: "900", labelKey: "RefreshInterval15Min" },
  { value: "1800", labelKey: "RefreshInterval30Min" },
  { value: "3600", labelKey: "RefreshInterval1Hour" },
];

const NOTIFICATION_SOUND_THEME_OPTIONS: {
  value: NotificationSoundTheme;
  labelKey: LocaleKey;
}[] = [
  { value: "windows", labelKey: "NotificationSoundThemeWindows" },
  { value: "codexBar", labelKey: "NotificationSoundThemeQuotaArc" },
];

type NotificationSoundPathKey = keyof NotificationSoundPaths;

const NOTIFICATION_SOUND_EVENTS: {
  event: NotificationSoundEvent;
  pathKey: NotificationSoundPathKey;
  labelKey: LocaleKey;
  helperKey: LocaleKey;
}[] = [
  {
    event: "predictiveWarning",
    pathKey: "predictiveWarning",
    labelKey: "NotificationSoundEventPredictiveWarning",
    helperKey: "NotificationSoundEventPredictiveWarningHelper",
  },
  {
    event: "highUsage",
    pathKey: "highUsage",
    labelKey: "NotificationSoundEventHighUsage",
    helperKey: "NotificationSoundEventHighUsageHelper",
  },
  {
    event: "criticalUsage",
    pathKey: "criticalUsage",
    labelKey: "NotificationSoundEventCriticalUsage",
    helperKey: "NotificationSoundEventCriticalUsageHelper",
  },
  {
    event: "exhausted",
    pathKey: "exhausted",
    labelKey: "NotificationSoundEventExhausted",
    helperKey: "NotificationSoundEventExhaustedHelper",
  },
  {
    event: "statusIssue",
    pathKey: "statusIssue",
    labelKey: "NotificationSoundEventStatusIssue",
    helperKey: "NotificationSoundEventStatusIssueHelper",
  },
  {
    event: "sessionDepleted",
    pathKey: "sessionDepleted",
    labelKey: "NotificationSoundEventSessionDepleted",
    helperKey: "NotificationSoundEventSessionDepletedHelper",
  },
  {
    event: "sessionRestored",
    pathKey: "sessionRestored",
    labelKey: "NotificationSoundEventSessionRestored",
    helperKey: "NotificationSoundEventSessionRestoredHelper",
  },
  {
    event: "expectedReset",
    pathKey: "expectedReset",
    labelKey: "NotificationSoundEventExpectedReset",
    helperKey: "NotificationSoundEventExpectedResetHelper",
  },
  {
    event: "unexpectedReset",
    pathKey: "unexpectedReset",
    labelKey: "NotificationSoundEventUnexpectedReset",
    helperKey: "NotificationSoundEventUnexpectedResetHelper",
  },
  {
    event: "bankedResetCredit",
    pathKey: "bankedResetCredit",
    labelKey: "NotificationSoundEventBankedResetCredit",
    helperKey: "NotificationSoundEventBankedResetCreditHelper",
  },
];

const NOTIFICATION_SOUND_THEME_SELECT_MIN_WIDTH = 180;
const NOTIFICATION_SOUND_PREVIEW_DURATION_MS = 1500;

const DEFAULT_NOTIFICATION_EVENTS: NotificationEventPreferences = {
  highUsage: true,
  criticalUsage: true,
  exhausted: true,
  statusIssue: true,
  sessionDepleted: true,
  sessionRestored: true,
  expectedReset: true,
  unexpectedReset: true,
  bankedResetCredit: true,
};

const DEFAULT_QUIET_HOURS: NotificationQuietHours = {
  enabled: false,
  startMinute: 22 * 60,
  endMinute: 7 * 60,
};

function minuteToTime(value: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function timeToMinute(value: string, fallback: number): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : fallback;
}

const NOTIFICATION_EVENT_OPTIONS: {
  key: keyof NotificationEventPreferences | "predictivePace";
  labelKey: LocaleKey;
  helperKey: LocaleKey;
  tone: "notice" | "warning" | "critical" | "positive";
}[] = [
  {key:"predictivePace",labelKey:"NotificationSoundEventPredictiveWarning",helperKey:"NotificationSoundEventPredictiveWarningHelper",tone:"notice"},
  {key:"highUsage",labelKey:"NotificationSoundEventHighUsage",helperKey:"NotificationSoundEventHighUsageHelper",tone:"warning"},
  {key:"criticalUsage",labelKey:"NotificationSoundEventCriticalUsage",helperKey:"NotificationSoundEventCriticalUsageHelper",tone:"critical"},
  {key:"exhausted",labelKey:"NotificationSoundEventExhausted",helperKey:"NotificationSoundEventExhaustedHelper",tone:"critical"},
  {key:"statusIssue",labelKey:"NotificationSoundEventStatusIssue",helperKey:"NotificationSoundEventStatusIssueHelper",tone:"warning"},
  {key:"sessionDepleted",labelKey:"NotificationSoundEventSessionDepleted",helperKey:"NotificationSoundEventSessionDepletedHelper",tone:"critical"},
  {key:"sessionRestored",labelKey:"NotificationSoundEventSessionRestored",helperKey:"NotificationSoundEventSessionRestoredHelper",tone:"positive"},
  {key:"expectedReset",labelKey:"ExpectedResetNotifications",helperKey:"ExpectedResetNotificationsHelper",tone:"positive"},
  {key:"unexpectedReset",labelKey:"UnexpectedResetNotifications",helperKey:"UnexpectedResetNotificationsHelper",tone:"warning"},
  {key:"bankedResetCredit",labelKey:"BankedResetCreditNotifications",helperKey:"BankedResetCreditNotificationsHelper",tone:"positive"},
];

const FALLBACK_PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { id: "codex", displayName: "Codex", cookieDomain: null },
  { id: "claude", displayName: "Claude", cookieDomain: null },
];


const THEME_OPTIONS: { value: ThemePreference; labelKey: LocaleKey }[] = [
  { value: "auto", labelKey: "ThemeAutoOption" },
  { value: "light", labelKey: "ThemeLightOption" },
  { value: "dark", labelKey: "ThemeDarkOption" },
]

const LOGO_VARIANT_LABELS: Record<LogoVariant, LocaleKey> = {
  silver: "LogoSilver",
  arctic: "LogoArctic",
  aurora: "LogoAurora",
  ember: "LogoEmber",
  violet: "LogoViolet",
};

const LOGO_SIZE_LABELS: Record<LogoSize, LocaleKey> = {
  compact: "LogoCompact",
  balanced: "LogoBalanced",
  prominent: "LogoProminent",
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function blurOnEnter(event: { key: string; currentTarget: { blur: () => void } }) {
  if (event.key === "Enter") event.currentTarget.blur();
}

function isNotificationSoundTheme(v: string): v is NotificationSoundTheme {
  return v === "windows" || v === "codexBar";
}

export function ThresholdOverrideInputs({
  label,
  value,
  inheritedHigh,
  inheritedCritical,
  highLabel,
  criticalLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: UsageThresholdOverride;
  inheritedHigh: number;
  inheritedCritical: number;
  highLabel: string;
  criticalLabel: string;
  disabled: boolean;
  onChange: (value: UsageThresholdOverride) => void;
}) {
  const [high, setHigh] = useState(() => value.high?.toString() ?? "");
  const [critical, setCritical] = useState(() => value.critical?.toString() ?? "");
  useEffect(() => setHigh(value.high?.toString() ?? ""), [value.high]);
  useEffect(() => setCritical(value.critical?.toString() ?? ""), [value.critical]);
  const commit = () =>
    onChange({
      high: high === "" ? undefined : Math.min(100, Math.max(0, Number(high))),
      critical:
        critical === "" ? undefined : Math.min(100, Math.max(0, Number(critical))),
    });
  return (
    <Field label={label}>
      <div className="notification-threshold-pair">
        <label>
          <span>{highLabel}</span>
        <input
          type="number"
          value={high}
          min={0}
          max={100}
          disabled={disabled}
          placeholder={String(inheritedHigh)}
          aria-label={`${label} ${highLabel}`}
          onChange={(event) => setHigh(event.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
          <small>{high === "" ? `Inherited · ${inheritedHigh}% used` : `${Math.min(100,Math.max(0,Number(high)))}% used`} · {100-(high===""?inheritedHigh:Math.min(100,Math.max(0,Number(high))))}% remaining</small>
        </label>
        <label>
          <span>{criticalLabel}</span>
        <input
          type="number"
          value={critical}
          min={0}
          max={100}
          disabled={disabled}
          placeholder={String(inheritedCritical)}
          aria-label={`${label} ${criticalLabel}`}
          onChange={(event) => setCritical(event.target.value)}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
          <small>{critical === "" ? `Inherited · ${inheritedCritical}% used` : `${Math.min(100,Math.max(0,Number(critical)))}% used`} · {100-(critical===""?inheritedCritical:Math.min(100,Math.max(0,Number(critical))))}% remaining</small>
        </label>
      </div>
    </Field>
  );
}

export default function GeneralTab({
  mode = "general",
  settings,
  set,
  saving,
  providerCatalog = FALLBACK_PROVIDER_CATALOG,
}: TabProps & {
  mode?: "general" | "notifications" | "appearance";
  providerCatalog?: ProviderCatalogEntry[];
}) {
  const { t } = useLocale();
  const [playingSound, setPlayingSound] = useState<NotificationSoundEvent | null>(null);
  const [logoAppearance, setLogoAppearance] = useState(readLogoAppearance);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(
    FALLBACK_LANGUAGE_OPTIONS,
  );
  const availableProviders = providerCatalog.length
    ? providerCatalog
    : FALLBACK_PROVIDER_CATALOG;
  const [notificationProvider, setNotificationProvider] = useState(
    () => availableProviders[0]?.id ?? "codex",
  );

  useEffect(() => {
    if (!availableProviders.some((provider) => provider.id === notificationProvider)) {
      setNotificationProvider(availableProviders[0]?.id ?? "codex");
    }
  }, [availableProviders, notificationProvider]);

  useEffect(() => {
    invoke<LanguageOption[]>("get_available_languages")
      .then(setLanguageOptions)
      .catch(() => {}); // graceful fallback to static default
  }, []);

  const handleTestSound = useCallback((event: NotificationSoundEvent) => {
    setSoundError(null);
    setPlayingSound(event);
    const timeoutId = window.setTimeout(
      () => setPlayingSound(null),
      NOTIFICATION_SOUND_PREVIEW_DURATION_MS,
    );
    void playNotificationSound(event).catch((error: unknown) => {
      window.clearTimeout(timeoutId);
      setPlayingSound(null);
      setSoundError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  const handleChooseSound = useCallback(
    async (pathKey: NotificationSoundPathKey) => {
      setSoundError(null);
      try {
        const selected = await open({
          multiple: false,
          directory: false,
          filters: [{ name: t("NotificationSoundWaveFile"), extensions: ["wav"] }],
        });
        if (typeof selected === "string") {
          set({
            notificationSoundPaths: {
              ...settings.notificationSoundPaths,
              [pathKey]: selected,
            },
          });
        }
      } catch (error: unknown) {
        setSoundError(error instanceof Error ? error.message : String(error));
      }
    },
    [set, settings.notificationSoundPaths, t],
  );

  const handleClearSound = useCallback(
    (pathKey: NotificationSoundPathKey) => {
      setSoundError(null);
      set({
        notificationSoundPaths: {
          ...settings.notificationSoundPaths,
          [pathKey]: null,
        },
      });
    },
    [set, settings.notificationSoundPaths],
  );

  return (
    <>
      {mode==="notifications" && <><NotificationPreview high={settings.highUsageThreshold} critical={settings.criticalUsageThreshold} enabled={settings.showNotifications}/><NotificationTestControl catalog={providerCatalog}/></>}
      {mode === "general" && <section className="settings-section general-settings-card general-settings-card--language">
        <h3 className="settings-section__title">{t("SectionLanguage")}</h3>
        <div className="settings-section__group">
          <Field label={t("InterfaceLanguage")}>
            <Select
              value={settings.uiLanguage}
              disabled={saving}
              options={languageOptions.map((opt) => ({
                value: opt.value,
                label: opt.display,
              }))}
              onChange={(v) => set({ uiLanguage: v as Language })}
            />
          </Field>
        </div>
      </section>}
      {mode === "appearance" && <section className="settings-section general-settings-card general-settings-card--identity">
        <h3 className="settings-section__title">{t("LogoIdentitySection")}</h3>
        <div className="settings-section__group">
          <Field label={t("LogoFinishLabel")} description={t("LogoFinishHelper")}>
            <div className="logo-appearance__choices" role="group" aria-label={t("LogoFinishLabel")}>
              {LOGO_VARIANTS.map((variant) => (
                <button key={variant} type="button" className="logo-appearance__choice" aria-label={t(LOGO_VARIANT_LABELS[variant])} aria-pressed={logoAppearance.variant === variant} disabled={saving}
                  onClick={() => {
                    const next = { ...logoAppearance, variant: variant as LogoVariant };
                    setLogoAppearance(next);
                    writeLogoAppearance(next);
                    set({ logoVariant: variant as LogoVariant });
                  }}>
                  <span className="logo-appearance__preview"><QuotaArcMark size={38} variant={variant} sizePreference="balanced" label={`${variant} QuotaArc logo`} /></span>
                  <span>{t(LOGO_VARIANT_LABELS[variant])}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("LogoProminenceLabel")} description={t("LogoProminenceHelper")}>
            <div className="logo-appearance__sizes" role="group" aria-label={t("LogoProminenceLabel")}>
              {LOGO_SIZES.map((size) => (
                <button key={size} type="button" className="settings-action" aria-pressed={logoAppearance.size === size} disabled={saving}
                  onClick={() => {
                    const next = { ...logoAppearance, size: size as LogoSize };
                    setLogoAppearance(next);
                    writeLogoAppearance(next);
                    set({ logoScalePercent: logoSizePercent(size as LogoSize) });
                  }}>{t(LOGO_SIZE_LABELS[size])}</button>
              ))}
            </div>
          </Field>
        </div>
      </section>}

      {mode === "appearance" && <section className="settings-section general-settings-card general-settings-card--theme">
        <h3 className="settings-section__title">{t("SectionTheme")}</h3>
        <div className="settings-section__group">
          <Field label={t("ThemeLabel")} description={settings.activeProfileTheme ? `${t("ThemeHelper")} ${t("ThemeProfileOverrideHelper")}` : t("ThemeHelper")}>
            <Select
              value={settings.theme}
              disabled={saving}
              ariaLabel={t("ThemeLabel")}
              options={THEME_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onChange={(value) => set({ theme: value as ThemePreference })}
            />
          </Field>
        </div>
      </section>}
      {mode === "general" && <section className="settings-section general-settings-card general-settings-card--startup">
        <h3 className="settings-section__title">{t("StartupSettings")}</h3>
        <div className="settings-section__group">
          <Field label={t("StartAtLogin")} description={t("StartAtLoginHelper")} leading>
            <Toggle
              checked={settings.startAtLogin}
              disabled={saving}
              onChange={(v) => set({ startAtLogin: v })}
            />
          </Field>
          <Field
            label={t("StartMinimized")}
            description={t("StartMinimizedHelper")}
            leading
          >
            <Toggle
              checked={settings.startMinimized}
              disabled={saving}
              onChange={(v) => set({ startMinimized: v })}
            />
          </Field>
          <Field label={t("StartupDestination")} description={t("StartupDestinationHelper")}>
            <Select
              value={settings.startupDestination ?? "providerDisplay"}
              disabled={saving}
              ariaLabel={t("StartupDestination")}
              options={[
                { value: "providerDisplay", label: t("StartupDestinationProviderDisplay") },
                { value: "lastOpened", label: t("StartupDestinationLastOpened") },
                { value: "dashboard", label: t("StartupDestinationDashboard") },
              ]}
              onChange={(value) =>
                set({ startupDestination: value as "dashboard" | "providerDisplay" | "lastOpened" })
              }
            />
          </Field>
        </div>
      </section>}

      {mode === "notifications" && <section className="settings-section">
        <h3 className="settings-section__title">
          {t("SectionNotifications")}
        </h3>
        <div className="settings-section__group">
          <Field
            label={t("ShowNotifications")}
            description={t("ShowNotificationsHelper")}
            leading
          >
            <Toggle
              checked={settings.showNotifications}
              disabled={saving}
              onChange={(v) => set({ showNotifications: v })}
            />
          </Field>
          <div className="notification-event-selector">
            <div className="notification-event-selector__heading">
              <strong>{t("NotificationCategories")}</strong>
              <small>{t("NotificationCategoriesHelper")}</small>
            </div>
            <div className="notification-event-grid">
              {NOTIFICATION_EVENT_OPTIONS.map((event) => {
                const isPredictive = event.key === "predictivePace";
                const notificationKey = isPredictive
                  ? null
                  : event.key as keyof NotificationEventPreferences;
                const preferences = settings.notificationEvents ?? DEFAULT_NOTIFICATION_EVENTS;
                const checked = notificationKey === null
                  ? settings.predictivePaceWarningEnabled
                  : preferences[notificationKey];
                return <article className="notification-event-card" data-tone={event.tone} data-enabled={checked} key={event.key}>
                  <span className="notification-event-card__signal" aria-hidden="true" />
                  <div>
                    <strong>{t(event.labelKey)}</strong>
                    <small>{t(event.helperKey)}</small>
                  </div>
                  <Toggle
                    checked={checked}
                    ariaLabel={isPredictive ? t("PredictivePaceWarnings") : t(event.labelKey)}
                    disabled={saving || !settings.showNotifications}
                    onChange={(value) => {
                      if (isPredictive) {
                        set({predictivePaceWarningEnabled:value});
                      } else if (notificationKey !== null) {
                        set({notificationEvents:{...preferences,[notificationKey]:value}});
                      }
                    }}
                  />
                </article>;
              })}
            </div>
          </div>
          {(() => {
            const quiet = settings.notificationQuietHours ?? DEFAULT_QUIET_HOURS;
            return <div className="notification-quiet-hours">
              <Field
                label={t("NotificationQuietHours")}
                description={t("NotificationQuietHoursHelper")}
                leading
              >
                <Toggle
                  checked={quiet.enabled}
                  ariaLabel={t("NotificationQuietHours")}
                  disabled={saving || !settings.showNotifications}
                  onChange={(enabled) => set({notificationQuietHours:{...quiet,enabled}})}
                />
              </Field>
              {quiet.enabled && <div className="notification-quiet-hours__range">
                <label>
                  <span>{t("NotificationQuietHoursStart")}</span>
                  <input
                    type="time"
                    value={minuteToTime(quiet.startMinute)}
                    disabled={saving}
                    onChange={(event) => set({notificationQuietHours:{...quiet,startMinute:timeToMinute(event.currentTarget.value,quiet.startMinute)}})}
                  />
                </label>
                <span aria-hidden="true">→</span>
                <label>
                  <span>{t("NotificationQuietHoursEnd")}</span>
                  <input
                    type="time"
                    value={minuteToTime(quiet.endMinute)}
                    disabled={saving}
                    onChange={(event) => set({notificationQuietHours:{...quiet,endMinute:timeToMinute(event.currentTarget.value,quiet.endMinute)}})}
                  />
                </label>
                <small>{t("NotificationQuietHoursLocalTime")}</small>
              </div>}
            </div>;
          })()}
          <Field label={t("SoundEnabled")} description={t("SoundEnabledHelper")} leading>
            <Toggle
              checked={settings.soundEnabled}
              disabled={saving}
              onChange={(v) => set({ soundEnabled: v })}
            />
          </Field>
          {settings.soundEnabled && (
            <>
              <Field
                label={t("NotificationSoundTheme")}
                description={t("NotificationSoundThemeHelper")}
              >
                <Select
                  value={settings.notificationSoundTheme}
                  disabled={saving}
                  ariaLabel={t("NotificationSoundTheme")}
                  minWidth={NOTIFICATION_SOUND_THEME_SELECT_MIN_WIDTH}
                  options={NOTIFICATION_SOUND_THEME_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  onChange={(value) => {
                    if (isNotificationSoundTheme(value)) {
                      set({ notificationSoundTheme: value });
                    }
                  }}
                />
              </Field>
              {NOTIFICATION_SOUND_EVENTS.map((sound) => {
                const path = settings.notificationSoundPaths[sound.pathKey];
                const label = t(sound.labelKey);
                return (
                  <Field
                    key={sound.event}
                    label={label}
                    description={t(sound.helperKey)}
                  >
                    <div className="notification-sound-row">
                      <button
                        type="button"
                        className="shortcut-capture__button shortcut-capture__button--ghost notification-sound-file"
                        aria-label={`${label}: ${path ? `${fileName(path)}, ` : ""}${t("NotificationSoundChooseFile")}`}
                        title={path ?? t("NotificationSoundUsesTheme")}
                        disabled={saving}
                        onClick={() => void handleChooseSound(sound.pathKey)}
                      >
                        {path ? fileName(path) : t("NotificationSoundChooseFile")}
                      </button>
                      <button
                        type="button"
                        className="shortcut-capture__button shortcut-capture__button--ghost"
                        aria-label={`${label}: ${t("NotificationTestSound")}`}
                        disabled={saving || playingSound !== null}
                        onClick={() => handleTestSound(sound.event)}
                      >
                        {playingSound === sound.event
                          ? t("NotificationTestSoundPlaying")
                          : t("NotificationTestSound")}
                      </button>
                      {path && (
                        <button
                          type="button"
                          className="shortcut-capture__button shortcut-capture__button--ghost"
                          aria-label={`${label}: ${t("NotificationSoundClearFile")}`}
                          disabled={saving}
                          onClick={() => handleClearSound(sound.pathKey)}
                        >
                          {t("NotificationSoundClearFile")}
                        </button>
                      )}
                    </div>
                  </Field>
                );
              })}
              {soundError && (
                <p className="settings-section__error" role="alert">
                  {soundError}
                </p>
              )}
            </>
          )}
        </div>
      </section>}
      {mode === "notifications" && <section className="settings-section notification-overrides">
        <h3 className="settings-section__title">{t("NotificationOverridesTitle")}</h3>
        <p className="settings-section__description">{t("NotificationOverridesHelper")}</p>
        <div className="notification-overrides__provider">
          <label htmlFor="notification-provider">{t("TabProviders")}</label>
          <Select
            value={notificationProvider}
            ariaLabel={t("TabProviders")}
            disabled={saving}
            options={availableProviders.map((provider) => ({
              value: provider.id,
              label: provider.displayName,
            }))}
            onChange={setNotificationProvider}
          />
        </div>
        <div className="notification-overrides__grid">
          {(["provider", "session", "fiveHour", "weekly"] as const).map((window) => {
              const provider = notificationProvider;
              const key = window === "provider" ? provider : `${provider}:${window}`;
              const values = settings.providerUsageThresholds ?? {};
              const providerLabel = provider === "codex"
                ? t("ProviderNameCodex")
                : provider === "claude"
                  ? t("ProviderNameClaude")
                  : availableProviders.find((entry) => entry.id === provider)?.displayName
                    ?? provider;
              const windowLabel = window === "session"
                ? t("ProviderSession")
                : window === "fiveHour"
                  ? t("PanelFiveHours")
                  : t("ProviderWeekly");
              return (
                <ThresholdOverrideInputs
                  key={key}
                  label={
                    window === "provider"
                      ? providerLabel
                      : `${providerLabel} · ${windowLabel}`
                  }
                  value={values[key] ?? {}}
                  inheritedHigh={
                    window === "provider"
                      ? settings.highUsageThreshold
                      : values[provider]?.high ?? settings.highUsageThreshold
                  }
                  inheritedCritical={
                    window === "provider"
                      ? settings.criticalUsageThreshold
                      : values[provider]?.critical ?? settings.criticalUsageThreshold
                  }
                  highLabel={t("HighUsageAlert")}
                  criticalLabel={t("CriticalUsageAlert")}
                  disabled={saving}
                  onChange={(value) => {
                    const next = { ...values };
                    if (value.high === undefined && value.critical === undefined) {
                      set({
                        providerUsageThresholds: Object.fromEntries(
                          Object.entries(next).filter(([entry]) => entry !== key),
                        ),
                      });
                    } else {
                      next[key] = value;
                      set({ providerUsageThresholds: next });
                    }
                  }}
                />
              );
            })}
        </div>
      </section>}

      {mode === "notifications" && <section className="settings-section">
        <h3 className="settings-section__title">
          {t("SectionUsageThresholds")}
        </h3>
        <div className="settings-section__group">
          <Field
            label={t("HighUsageAlert")}
            description={t("HighUsageWarningHelper")}
          >
            <NumberInput
              value={settings.highUsageThreshold}
              min={0}
              max={100}
              step={5}
              disabled={saving}
              onChange={(v) => set({ highUsageThreshold: v })}
            />
          </Field>
          <Field
            label={t("CriticalUsageAlert")}
            description={t("CriticalUsageWarningHelper")}
          >
            <NumberInput
              value={settings.criticalUsageThreshold}
              min={0}
              max={100}
              step={5}
              disabled={saving}
              onChange={(v) => set({ criticalUsageThreshold: v })}
            />
          </Field>
          <Field
            label={t("UsageStepNotifications")}
            description={t("UsageStepNotificationsHelper")}
            leading
          >
            <div className="notification-step-control">
              <Toggle
                checked={Boolean(settings.usageStepNotificationPercent)}
                ariaLabel={t("UsageStepNotifications")}
                disabled={saving || !settings.showNotifications}
                onChange={(enabled) => set({ usageStepNotificationPercent: enabled ? 10 : 0 })}
              />
              {Boolean(settings.usageStepNotificationPercent) && <NumberInput
                value={settings.usageStepNotificationPercent ?? 10}
                min={1}
                max={100}
                step={1}
                ariaLabel={t("UsageStepNotificationInterval")}
                disabled={saving || !settings.showNotifications}
                onChange={(value) => set({ usageStepNotificationPercent: value })}
              />}
            </div>
          </Field>
        </div>
      </section>}

      {/* ── Automation ───────────────────────────────────────────── */}
      {mode === "general" && <section className="settings-section general-settings-card general-settings-card--refresh">
        <h3 className="settings-section__title">{t("SectionRefresh")}</h3>
        <div className="settings-section__group">
          <Field
            label={t("RefreshIntervalLabel")}
            description={t("RefreshIntervalHelper")}
          >
            <Select
              value={
                settings.adaptiveRefresh
                  ? "adaptive"
                  : String(settings.refreshIntervalSecs)
              }
              disabled={saving}
              options={REFRESH_CADENCE_OPTIONS.map((o) => ({
                value: o.value,
                label: t(o.labelKey),
              }))}
              onChange={(v) => {
                if (v === "adaptive") {
                  set({ adaptiveRefresh: true });
                  return;
                }
                set({
                  adaptiveRefresh: false,
                  refreshIntervalSecs: Number(v),
                });
              }}
            />
          </Field>
          <Field
            label={t("RefreshAllProvidersOnMenuOpen")}
            description={t("RefreshAllProvidersOnMenuOpenHelper")}
            leading
          >
            <Toggle
              checked={settings.refreshAllProvidersOnMenuOpen}
              disabled={saving}
              onChange={(v) => set({ refreshAllProvidersOnMenuOpen: v })}
            />
          </Field>
          <Field
            label={t("LowPowerMode")}
            description={t("LowPowerModeHelper")}
          >
            <Select
              value={settings.lowPowerModePreference ?? (settings.lowPowerMode ? "on" : "off")}
              disabled={saving}
              options={[
                { value: "off", label: t("LowPowerModeOff") },
                { value: "on", label: t("LowPowerModeOn") },
                { value: "automatic", label: t("LowPowerModeAutomatic") },
              ]}
              onChange={(v) => set({
                lowPowerModePreference: v as "off" | "on" | "automatic",
              })}
            />
          </Field>
          <div className="general-settings__quit">
            <button
              type="button"
              className="credential-btn credential-btn--primary"
              onClick={() => void quitApp()}
            >
              {t("MenuQuit")}
            </button>
          </div>
        </div>
      </section>}
    </>
  );
}
