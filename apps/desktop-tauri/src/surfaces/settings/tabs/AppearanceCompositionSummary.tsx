import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  APPEARANCE_SCOPE_IDS,
  APPEARANCE_SCOPE_LABELS,
  DEFAULT_APPEARANCE_COMPOSITION,
  appearanceScopeSummaryLabel,
  type AppearanceScopeId,
} from "../../../design-system/appearanceComposition";
import { CANONICAL_THEME, catalogBySlug } from "../../../design-system/themeCatalog";
import { resolveCatalogTheme, type CatalogThemeSettings } from "../../../design-system/themeResolution";
import { getSettingsSnapshot, setAppearanceScope } from "../../../lib/tauri";
import type { SettingsSnapshot } from "../../../types/bridge";
import "./AppearanceCompositionSummary.css";

/** Real current explicit value for a scope, read straight off the settings
 * snapshot — never a placeholder. No locale entries were added for these
 * plain-English labels this slice; that is a real, disclosed gap, not an
 * oversight (see docs/validation/THEME_COMPOSITION_AUDIT.md). */
function explicitDisplayValue(scope: AppearanceScopeId, snapshot: SettingsSnapshot): string {
  switch (scope) {
    case "quotalisLogo":
      return snapshot.logoVariant ? capitalize(snapshot.logoVariant) : "Silver";
    case "providerIdentity":
      return snapshot.globalLimitPresentation?.identity
        ? capitalize(snapshot.globalLimitPresentation.identity)
        : "Adaptive";
    case "tray":
      return snapshot.trayIconMode === "perProvider" ? "Per-Provider" : "Single Icon";
    case "workspaceBackground":
      return snapshot.workspacePreferences?.background
        ? capitalize(snapshot.workspacePreferences.background)
        : "Cosmic";
    default:
      return "";
  }
}

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

  return (
    <section className="settings-section appearance-composition-summary" aria-label="Appearance Composition">
      <h3 className="settings-section__title">Appearance Composition</h3>
      <p className="settings-section__description">
        What owns each part of Quotalis's appearance right now.
      </p>
      {error && <p role="alert" className="appearance-composition-summary__error">{error}</p>}
      <dl className="appearance-composition-summary__rows">
        <div className="appearance-composition-summary__row">
          <dt>Main Application</dt>
          <dd>{mainTheme.name}</dd>
        </div>
        <div className="appearance-composition-summary__row">
          <dt>Color Mode</dt>
          <dd>{capitalize(snapshot.theme ?? "auto")}</dd>
        </div>
        <div className="appearance-composition-summary__row">
          <dt>Floating Structures</dt>
          <dd data-source={floating.source}>
            {floating.source === "global" || floating.source === "default"
              ? "Following Main Application"
              : catalogBySlug(floating.slug)?.name ?? floating.slug}
          </dd>
        </div>
        {APPEARANCE_SCOPE_IDS.map((scope) => (
          <div className="appearance-composition-summary__row" key={scope}>
            <dt>{APPEARANCE_SCOPE_LABELS[scope]}</dt>
            <dd data-source={composition[scope]}>
              {appearanceScopeSummaryLabel(scope, composition, explicitDisplayValue(scope, snapshot))}
              <button
                type="button"
                className="appearance-composition-summary__toggle"
                disabled={pending === scope}
                aria-label={
                  composition[scope] === "global"
                    ? `Override ${APPEARANCE_SCOPE_LABELS[scope]} instead of following Main Application`
                    : `Follow Main Application for ${APPEARANCE_SCOPE_LABELS[scope]}`
                }
                onClick={() => void toggleScope(scope)}
              >
                {composition[scope] === "global" ? "Override" : "Follow Main Application"}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
