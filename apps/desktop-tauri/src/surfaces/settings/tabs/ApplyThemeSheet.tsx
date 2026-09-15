import { useEffect, useState, type CSSProperties } from "react";
import type { CatalogTheme } from "../../../design-system/themeCatalog";
import { catalogBySlug } from "../../../design-system/themeCatalog";
import type { CatalogSurfaceId, CatalogThemeSettings } from "../../../design-system/themeResolution";
import { resolveCatalogTheme } from "../../../design-system/themeResolution";
import { APPEARANCE_SCOPE_LOCALE_KEYS } from "../../../design-system/appearanceComposition";
import QuotaArcMark from "../../../components/QuotaArcMark";
import { ProviderIcon } from "../../../components/providers/ProviderIcon";
import StructurePreview from "../StructurePreview";
import type { FlowSurfaceForm } from "../../../design-system/flowSurface";
import { applyThemeComposition, type CatalogThemeScope } from "../../../lib/tauri";
import type { LogoVariant } from "../../../design-system/logoAppearance";
import { backgroundById } from "../../../design-system/backgroundCatalog";
import { useLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";
import type { SettingsSnapshot } from "../../../types/bridge";
import "../../../design-system/WorkspaceBackdrop.css";
import "./ApplyThemeSheet.css";

const FLOATING_SURFACES: CatalogSurfaceId[] = ["taskbar", "top", "edge", "hud", "quick", "dashboard"];

/** A stable, always-enabled provider used only to render a REAL provider
 * mark in previews (§5) — no real account data, no fabricated identity. */
const PREVIEW_PROVIDER_ID = "claude";

/** The optional AppearanceComposition-backed rows this sheet can offer —
 * only ever shown when the theme's own recommendedAppearance metadata
 * declares a real value, never synthesized (§9/§14/§16). */
type OptionalScopeId = "quotalisLogo" | "providerIdentity" | "tray" | "workspaceBackground";
const OPTIONAL_SCOPES: OptionalScopeId[] = ["quotalisLogo", "providerIdentity", "tray", "workspaceBackground"];

export interface ApplyThemeSheetProps {
  theme: CatalogTheme;
  scope: CatalogThemeScope;
  snapshot: SettingsSnapshot;
  previewForm: FlowSurfaceForm;
  onCancel: () => void;
  onApplied: () => void;
}

/**
 * Wave 1B/1C §10-18: opening this sheet, and toggling its rows, must never
 * mutate settings (§13) — the ONLY command call (`applyThemeComposition`,
 * one atomic settings load/mutate/save cycle on the Rust side — see
 * `apply_theme_composition_to_settings` in command_profiles.rs) happens
 * inside `handleApply`, never as a side effect of rendering or toggling.
 * Only rows the theme has real `recommendedAppearance` metadata for are
 * ever offered (§9/§14/§16) — this sheet never invents a mapping a theme
 * did not declare.
 */
export default function ApplyThemeSheet({
  theme,
  scope,
  snapshot,
  previewForm,
  onCancel,
  onApplied,
}: ApplyThemeSheetProps) {
  const { t } = useLocale();
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [optionalEnabled, setOptionalEnabled] = useState<Set<OptionalScopeId>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // §11: pending state — Escape is ignored while an Apply is in
      // flight so a keystroke can't close the sheet out from under a
      // request that already committed part of its work in memory.
      if (event.key === "Escape" && !applying) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, applying]);

  const themeSettings: CatalogThemeSettings = snapshot;
  const currentMain = catalogBySlug(snapshot.catalogTheme ?? "")?.name ?? "—";
  const currentFloating = resolveCatalogTheme(themeSettings, "top");
  const hasFloatingOverrides = FLOATING_SURFACES.some((id) => snapshot.surfaceCatalogThemes?.[id]);
  const followingMain = t("AppearanceCompositionFollowingMain");

  const availableOptionalScopes = OPTIONAL_SCOPES.filter((id) => recommendationFor(theme, id) != null);

  function toggleFloating() {
    if (applying) return;
    setFloatingEnabled((v) => !v);
  }
  function toggleOptional(id: OptionalScopeId) {
    if (applying) return;
    setOptionalEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setFloatingEnabled(true);
    setOptionalEnabled(new Set(availableOptionalScopes));
  }
  function clearAll() {
    setFloatingEnabled(false);
    setOptionalEnabled(new Set());
  }
  function recommended() {
    // Wave 1D §2: Recommended selects exactly the scopes the theme's own
    // metadata declares an opinion on -- Floating Structures included,
    // when the theme recommends it, even though that scope persists
    // through a different mechanism (surface_catalog_themes) than the
    // other four (AppearanceComposition). Which storage mechanism a scope
    // uses is an implementation detail; it must not change what
    // "Recommended" means to the user. Select All stays broader (every
    // compatible scope, not just recommended ones), so the two actions
    // remain meaningfully distinct.
    setFloatingEnabled(theme.recommendedAppearance?.floatingStructures === true);
    setOptionalEnabled(new Set(availableOptionalScopes));
  }

  async function handleApply() {
    if (applying) return; // §11: re-entry guard
    setApplying(true);
    setError(undefined);
    try {
      await applyThemeComposition({
        mainSlug: theme.slug,
        mainScope: scope,
        clearFloatingSurfaces: floatingEnabled
          ? FLOATING_SURFACES.filter((id) => snapshot.surfaceCatalogThemes?.[id])
          : [],
        appearanceScopes: Array.from(optionalEnabled),
      });
      onApplied();
    } catch (e) {
      // §11: keep the sheet open with the user's pending selections intact
      // and show a recoverable error, rather than closing on failure.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="apply-theme-sheet__backdrop" onClick={() => !applying && onCancel()}>
      <section
        className="apply-theme-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("ApplyThemeApplyScopeAriaLabel").replace("{}", theme.name)}
        aria-busy={applying}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="apply-theme-sheet__header">
          <div className="apply-theme-sheet__heading">
            <span className="apply-theme-sheet__eyebrow">{t("ApplyThemeEyebrow")}</span>
            <h2>{theme.name}</h2>
          </div>
          <button type="button" aria-label={t("ApplyThemeClose")} onClick={onCancel} disabled={applying} className="apply-theme-sheet__close">×</button>
        </header>

        {error && <p role="alert" className="apply-theme-sheet__error">{error}</p>}

        <ul className="apply-theme-sheet__rows">
          <li className="apply-theme-sheet__row apply-theme-sheet__row--fixed">
            <div className="apply-theme-sheet__row-preview">
              <StructurePreview form={previewForm} catalog={theme.slug} maxWidth={88} maxHeight={60} />
            </div>
            <div className="apply-theme-sheet__row-text">
              <strong>{t("AppearanceCompositionMainApplication")}</strong>
              <span>{formatCurrentNew(t, currentMain, theme.name)}</span>
            </div>
          </li>

          <li className="apply-theme-sheet__row">
            <label className="apply-theme-sheet__row-toggle">
              <input
                type="checkbox"
                checked={floatingEnabled}
                disabled={applying}
                onChange={toggleFloating}
                aria-label={t("ApplyThemeApplyScopeAriaLabel").replace("{}", t("AppearanceCompositionFloatingStructures"))}
              />
            </label>
            <div className="apply-theme-sheet__row-preview">
              <StructurePreview form={previewForm} catalog={theme.slug} maxWidth={88} maxHeight={60} />
            </div>
            <div className="apply-theme-sheet__row-text">
              <strong>{t("AppearanceCompositionFloatingStructures")}</strong>
              <span>
                {formatCurrentNew(
                  t,
                  currentFloating.source === "global" || currentFloating.source === "default"
                    ? followingMain
                    : catalogBySlug(currentFloating.slug)?.name ?? currentFloating.slug,
                  hasFloatingOverrides ? theme.name : followingMain,
                )}
              </span>
            </div>
          </li>

          {availableOptionalScopes.map((id) => {
            const label = t(APPEARANCE_SCOPE_LOCALE_KEYS[id]);
            return (
              <li className="apply-theme-sheet__row" key={id}>
                <label className="apply-theme-sheet__row-toggle">
                  <input
                    type="checkbox"
                    checked={optionalEnabled.has(id)}
                    disabled={applying}
                    onChange={() => toggleOptional(id)}
                    aria-label={t("ApplyThemeApplyScopeAriaLabel").replace("{}", label)}
                  />
                </label>
                <div className="apply-theme-sheet__row-preview">
                  <OptionalScopePreview id={id} theme={theme} />
                </div>
                <div className="apply-theme-sheet__row-text">
                  <strong>{label}</strong>
                  <span>{recommendationFor(theme, id)}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="apply-theme-sheet__footer">
          <div className="apply-theme-sheet__bulk-actions">
            <button type="button" onClick={selectAll} disabled={applying}>{t("ApplyThemeSelectAll")}</button>
            <button type="button" onClick={clearAll} disabled={applying}>{t("ApplyThemeClear")}</button>
            <button type="button" onClick={recommended} disabled={applying || availableOptionalScopes.length === 0}>
              {t("ApplyThemeRecommended")}
            </button>
          </div>
          <div className="apply-theme-sheet__commit-actions">
            <button type="button" onClick={onCancel} disabled={applying}>{t("ApplyThemeCancel")}</button>
            <button type="button" className="apply-theme-sheet__apply" onClick={() => void handleApply()} disabled={applying}>
              {applying ? t("ApplyThemeApplying") : t("ApplyThemeApply")}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

/** `ApplyThemeCurrentNew` intentionally has a DIFFERENT connector per
 * locale (an arrow "→" in en-US, an em dash "—" in ar-SA — see the .ftl
 * files) rather than mechanically mirroring the same arrow glyph (§3):
 * an RTL arrow's visual direction does not unambiguously mean "becomes",
 * so Arabic uses a neutral separator instead of guessing a mirrored arrow
 * direction. Both locales replace the same two `{}` placeholders in
 * order — `.replace("{}", ...)` only replaces the first remaining
 * occurrence, so two sequential calls correctly fill both slots
 * regardless of which locale's template is active. */
function formatCurrentNew(t: (key: LocaleKey) => string, current: string, next: string): string {
  return t("ApplyThemeCurrentNew").replace("{}", current).replace("{}", next);
}

function recommendationFor(theme: CatalogTheme, id: OptionalScopeId): string | undefined {
  const rec = theme.recommendedAppearance;
  if (!rec) return undefined;
  switch (id) {
    case "quotalisLogo":
      return rec.quotalisLogo;
    case "providerIdentity":
      return rec.providerIdentity;
    case "tray":
      return rec.trayStyle;
    case "workspaceBackground":
      return rec.workspaceBackground;
    default:
      return undefined;
  }
}

/**
 * §4-7: every optional scope now has a REAL production-component preview,
 * not a generic placeholder:
 * - Quotalis Logo: the actual `QuotaArcMark` component (already existed).
 * - Provider Identity: the actual `ProviderIcon` production provider-mark
 *   renderer (same component `TrayStudioTab`/`CurrentLimits` use), not an
 *   invented logo — labeled with the theme's real recommended identity
 *   skin name as text alongside it (no per-skin visual swatch component
 *   exists yet to render the skin's own styling, a real, narrower,
 *   disclosed gap than before — see THEME_COMPOSITION_AUDIT.md).
 * - Tray: the same ring/provider-icon emblem technique `TrayStudioTab`
 *   itself renders (`.tray-studio__emblem`'s SVG ring + `ProviderIcon`),
 *   reduced to a small preview using the theme's recommended tray style.
 * - Background: `backgroundById()` from the real
 *   `design-system/backgroundCatalog.ts` catalog + the same
 *   `--workspace-art`/`workspace-background-preview` CSS mechanism
 *   `WorkspaceBackgroundControl.tsx` uses for its own swatches — an actual
 *   background thumbnail, not the id as bare text.
 */
function OptionalScopePreview({ id, theme }: { id: OptionalScopeId; theme: CatalogTheme }) {
  if (id === "quotalisLogo") {
    const variant = theme.recommendedAppearance?.quotalisLogo as LogoVariant | undefined;
    return <QuotaArcMark size={28} variant={variant} sizePreference="balanced" label={`${variant} Quotalis logo preview`} />;
  }
  if (id === "providerIdentity") {
    return (
      <span className="apply-theme-sheet__provider-preview">
        <ProviderIcon providerId={PREVIEW_PROVIDER_ID} size={28} />
      </span>
    );
  }
  if (id === "tray") {
    const style = theme.recommendedAppearance?.trayStyle ?? "ring";
    return (
      <span className="apply-theme-sheet__tray-preview" data-style={style} aria-hidden="true">
        <svg viewBox="0 0 100 100">
          {style === "bar" ? (
            <>
              <path d="M8 94H92" stroke="currentColor" opacity=".2" strokeWidth={3} />
              <path d="M8 94H70" stroke={theme.accent} strokeWidth={3} />
            </>
          ) : (
            <>
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                opacity=".2"
                strokeWidth={3}
                pathLength="100"
                strokeDasharray={style === "arc" ? "80 100" : undefined}
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={theme.accent}
                strokeWidth={3}
                pathLength="100"
                strokeDasharray={`${70 * (style === "arc" ? 0.8 : 1)} 100`}
                transform="rotate(-90 50 50)"
              />
            </>
          )}
        </svg>
        <ProviderIcon providerId={PREVIEW_PROVIDER_ID} size={20} />
      </span>
    );
  }
  // workspaceBackground
  const backgroundId = theme.recommendedAppearance?.workspaceBackground;
  const background = backgroundById(backgroundId);
  return (
    <span
      className="workspace-background-preview apply-theme-sheet__background-preview"
      data-background={background?.id ?? backgroundId ?? "cosmic"}
      style={background?.art ? ({ "--workspace-art": background.art } as CSSProperties) : undefined}
      aria-hidden="true"
    />
  );
}
