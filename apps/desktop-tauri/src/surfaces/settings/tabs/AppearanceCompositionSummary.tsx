import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  APPEARANCE_SCOPE_IDS,
  APPEARANCE_SCOPE_LOCALE_KEYS,
  DEFAULT_APPEARANCE_COMPOSITION,
  appearanceScopeSummaryLabel,
  type AppearanceScopeId,
} from "../../../design-system/appearanceComposition";
import { CANONICAL_THEME, catalogBySlug } from "../../../design-system/themeCatalog";
import { resolveCatalogTheme, type CatalogThemeSettings } from "../../../design-system/themeResolution";
import { getSettingsSnapshot, setAppearanceScope } from "../../../lib/tauri";
import { useLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";
import type { SettingsSnapshot } from "../../../types/bridge";
import { trayAppearanceValueKey } from "../trayStudioModel";
import "./AppearanceCompositionSummary.css";

/** Real current explicit value for a scope, read straight off the settings
 * snapshot — never a placeholder. `logoVariant`/`identity`/tray-mode/
 * background id are data values (like a catalog theme's own `.name`,
 * already shown untranslated everywhere in ThemeGallery) rather than UI
 * copy, so they are not routed through the locale system — only the
 * defaults below (used when a field is entirely absent, e.g. a
 * pre-Wave-1B settings.json) are literal English and match the Rust
 * `default_*` fallback values exactly. */
function explicitDisplayValue(scope: AppearanceScopeId, snapshot: SettingsSnapshot, t: (key: LocaleKey) => string): string {
  switch (scope) {
    case "quotalisLogo":
      return snapshot.logoVariant ? capitalize(snapshot.logoVariant) : "Silver";
    case "providerIdentity":
      return snapshot.globalLimitPresentation?.identity
        ? capitalize(snapshot.globalLimitPresentation.identity)
        : "Adaptive";
    case "tray":
      return t(trayAppearanceValueKey(snapshot));
    case "workspaceBackground":
      return snapshot.workspacePreferences?.background
        ? capitalize(snapshot.workspacePreferences.background)
        : "Cosmic";
    default:
      return "";
  }
}

const COLOR_MODE_LOCALE_KEY: Record<string, LocaleKey> = {
  auto: "ThemeAutoOption",
  light: "ThemeLightOption",
  dark: "ThemeDarkOption",
};

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

/**
 * Wave 1B §7-9: one compact view resolving and displaying every appearance
 * scope, even though the scopes are backed by different existing
 * mechanisms internally (catalogTheme, surface_catalog_themes,
 * AppearanceComposition) — the UI presents one coherent system without
 * introducing a duplicate persisted source for anything that already has
 * one (§5, §6).
 */
export default function AppearanceCompositionSummary() {
  const { t } = useLocale();
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<AppearanceScopeId | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getSettingsSnapshot()
        .then((s) => {
          if (alive) setSnapshot(s);
        })
        .catch((e) => {
          if (alive) setError(e instanceof Error ? e.message : String(e));
        });
    void load();
    // Reuses the existing hardened cross-window settings event — no second
    // event bus (§23/§24). The same event ThemeGallery/useStageRuntime
    // already listen to, so this summary stays live when another window
    // (or this Apply Theme sheet) changes appearance state.
    const subscription = listen("quotalis:settings-updated", () => void load()).catch(() => () => {});
    return () => {
      alive = false;
      void subscription.then((stop) => stop());
    };
  }, []);

  if (!snapshot) return null;

  const mainTheme = catalogBySlug(snapshot.catalogTheme ?? "") ?? CANONICAL_THEME;
  const themeSettings: CatalogThemeSettings = snapshot;
  const floating = resolveCatalogTheme(themeSettings, "top");
  const composition = {
    quotalisLogo: snapshot.appearanceComposition?.quotalisLogo ?? DEFAULT_APPEARANCE_COMPOSITION.quotalisLogo,
    providerIdentity:
      snapshot.appearanceComposition?.providerIdentity ?? DEFAULT_APPEARANCE_COMPOSITION.providerIdentity,
    tray: snapshot.appearanceComposition?.tray ?? DEFAULT_APPEARANCE_COMPOSITION.tray,
    workspaceBackground:
      snapshot.appearanceComposition?.workspaceBackground ?? DEFAULT_APPEARANCE_COMPOSITION.workspaceBackground,
  };

  async function toggleScope(scope: AppearanceScopeId) {
    setPending(scope);
    setError(undefined);
    try {
      const next = composition[scope] === "global" ? "override" : "global";
      await setAppearanceScope(scope, next);
      // The settings-updated event this command emits refetches the
      // snapshot for us; no local optimistic write needed.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  }

  const followingMain = t("AppearanceCompositionFollowingMain");

  return (
    <section className="settings-section appearance-composition-summary" aria-label={t("AppearanceCompositionTitle")}>
      <h3 className="settings-section__title">{t("AppearanceCompositionTitle")}</h3>
      <p className="settings-section__description">{t("AppearanceCompositionDescription")}</p>
      {error && <p role="alert" className="appearance-composition-summary__error">{error}</p>}
      <dl className="appearance-composition-summary__rows">
        <div className="appearance-composition-summary__row">
          <dt>{t("AppearanceCompositionMainApplication")}</dt>
          <dd>{mainTheme.name}</dd>
        </div>
        <div className="appearance-composition-summary__row">
          <dt>{t("AppearanceCompositionColorMode")}</dt>
          <dd>{t(COLOR_MODE_LOCALE_KEY[snapshot.theme ?? "auto"] ?? "ThemeAutoOption")}</dd>
        </div>
        <div className="appearance-composition-summary__row">
          <dt>{t("AppearanceCompositionFloatingStructures")}</dt>
          <dd data-source={floating.source}>
            {floating.source === "global" || floating.source === "default"
              ? followingMain
              : catalogBySlug(floating.slug)?.name ?? floating.slug}
          </dd>
        </div>
        {APPEARANCE_SCOPE_IDS.map((scope) => {
          const scopeLabel = t(APPEARANCE_SCOPE_LOCALE_KEYS[scope]);
          return (
            <div className="appearance-composition-summary__row" key={scope}>
              <dt>{scopeLabel}</dt>
              <dd data-source={composition[scope]}>
                {appearanceScopeSummaryLabel(scope, composition, explicitDisplayValue(scope, snapshot, t), followingMain)}
                <button
                  type="button"
                  className="appearance-composition-summary__toggle"
                  disabled={pending === scope}
                  aria-label={
                    composition[scope] === "global"
                      ? t("AppearanceCompositionOverrideAriaLabel").replace("{}", scopeLabel)
                      : t("AppearanceCompositionFollowAriaLabel").replace("{}", scopeLabel)
                  }
                  onClick={() => void toggleScope(scope)}
                >
                  {composition[scope] === "global"
                    ? t("AppearanceCompositionOverrideAction")
                    : t("AppearanceCompositionFollowAction")}
                </button>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
