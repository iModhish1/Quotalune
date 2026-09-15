import { useEffect, useState } from "react";
import type { CatalogTheme } from "../../../design-system/themeCatalog";
import { catalogBySlug } from "../../../design-system/themeCatalog";
import type { CatalogSurfaceId, CatalogThemeSettings } from "../../../design-system/themeResolution";
import { resolveCatalogTheme } from "../../../design-system/themeResolution";
import { APPEARANCE_SCOPE_LABELS } from "../../../design-system/appearanceComposition";
import QuotaArcMark from "../../../components/QuotaArcMark";
import StructurePreview from "../StructurePreview";
import type { FlowSurfaceForm } from "../../../design-system/flowSurface";
import { setAppearanceScope, setCatalogTheme, type CatalogThemeScope } from "../../../lib/tauri";
import type { LogoVariant } from "../../../design-system/logoAppearance";
import type { SettingsSnapshot } from "../../../types/bridge";
import "./ApplyThemeSheet.css";

const FLOATING_SURFACES: CatalogSurfaceId[] = ["taskbar", "top", "edge", "hud", "quick", "dashboard"];

/** The optional AppearanceComposition-backed rows this sheet can offer —
 * only ever shown when the theme's own recommendedAppearance metadata
 * declares a real value, never synthesized (§9/§14/§16). */
type OptionalScopeId = "quotalisLogo" | "providerIdentity" | "tray" | "workspaceBackground";
const OPTIONAL_SCOPES: OptionalScopeId[] = ["quotalisLogo", "providerIdentity", "tray", "workspaceBackground"];

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export interface ApplyThemeSheetProps {
  theme: CatalogTheme;
  scope: CatalogThemeScope;
  snapshot: SettingsSnapshot;
  previewForm: FlowSurfaceForm;
  onCancel: () => void;
  onApplied: () => void;
}

/**
 * Wave 1B §10-18: opening this sheet, and toggling its rows, must never
 * mutate settings (§13) — every command call (`setCatalogTheme`,
 * `setAppearanceScope`) happens ONLY inside `handleApply`, never as a side
 * effect of rendering or toggling. Only rows the theme has real
 * `recommendedAppearance` metadata for are ever offered (§9/§14/§16) —
 * this sheet never invents a mapping a theme did not declare.
 */
export default function ApplyThemeSheet({
  theme,
  scope,
  snapshot,
  previewForm,
  onCancel,
  onApplied,
}: ApplyThemeSheetProps) {
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [optionalEnabled, setOptionalEnabled] = useState<Set<OptionalScopeId>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const themeSettings: CatalogThemeSettings = snapshot;
  const currentMain = catalogBySlug(snapshot.catalogTheme ?? "")?.name ?? "—";
  const currentFloating = resolveCatalogTheme(themeSettings, "top");
  const hasFloatingOverrides = FLOATING_SURFACES.some((id) => snapshot.surfaceCatalogThemes?.[id]);

  const availableOptionalScopes = OPTIONAL_SCOPES.filter((id) => recommendationFor(theme, id) != null);

  function toggleFloating() {
    setFloatingEnabled((v) => !v);
  }
  function toggleOptional(id: OptionalScopeId) {
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
    // Distinct from Select All: only the scopes the theme's own metadata
    // recommends, never the structural Floating Structures action (which
    // is not something recommendedAppearance expresses an opinion on).
    setFloatingEnabled(false);
    setOptionalEnabled(new Set(availableOptionalScopes));
  }

  async function handleApply() {
    setApplying(true);
    setError(undefined);
    try {
      await setCatalogTheme(theme.slug, scope);
      if (floatingEnabled) {
        for (const id of FLOATING_SURFACES) {
          if (snapshot.surfaceCatalogThemes?.[id]) {
            await setCatalogTheme("", `surface:${id}`);
          }
        }
      }
      for (const id of optionalEnabled) {
        await setAppearanceScope(id, "global");
      }
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="apply-theme-sheet__backdrop" onClick={onCancel}>
      <section
        className="apply-theme-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Apply ${theme.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="apply-theme-sheet__header">
          <div className="apply-theme-sheet__heading">
            <span className="apply-theme-sheet__eyebrow">Apply Theme</span>
            <h2>{theme.name}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onCancel} className="apply-theme-sheet__close">×</button>
        </header>

        {error && <p role="alert" className="apply-theme-sheet__error">{error}</p>}

        <ul className="apply-theme-sheet__rows">
          <li className="apply-theme-sheet__row apply-theme-sheet__row--fixed">
            <div className="apply-theme-sheet__row-preview">
              <StructurePreview form={previewForm} catalog={theme.slug} maxWidth={88} maxHeight={60} />
            </div>
            <div className="apply-theme-sheet__row-text">
              <strong>Main Application</strong>
              <span>Current: {currentMain} → New: {theme.name}</span>
            </div>
          </li>

          <li className="apply-theme-sheet__row">
            <label className="apply-theme-sheet__row-toggle">
              <input
                type="checkbox"
                checked={floatingEnabled}
                onChange={toggleFloating}
                aria-label="Apply Floating Structures"
              />
            </label>
            <div className="apply-theme-sheet__row-preview">
              <StructurePreview form={previewForm} catalog={theme.slug} maxWidth={88} maxHeight={60} />
            </div>
            <div className="apply-theme-sheet__row-text">
              <strong>Floating Structures</strong>
              <span>
                Current: {currentFloating.source === "global" || currentFloating.source === "default"
                  ? "Following Main Application"
                  : catalogBySlug(currentFloating.slug)?.name ?? currentFloating.slug}
                {" "}→ New: {hasFloatingOverrides ? theme.name : "Following Main Application"}
              </span>
            </div>
          </li>

          {availableOptionalScopes.map((id) => (
            <li className="apply-theme-sheet__row" key={id}>
              <label className="apply-theme-sheet__row-toggle">
                <input
                  type="checkbox"
                  checked={optionalEnabled.has(id)}
                  onChange={() => toggleOptional(id)}
                  aria-label={`Apply ${APPEARANCE_SCOPE_LABELS[id]}`}
                />
              </label>
              <div className="apply-theme-sheet__row-preview">
                <OptionalScopePreview id={id} theme={theme} />
              </div>
              <div className="apply-theme-sheet__row-text">
                <strong>{APPEARANCE_SCOPE_LABELS[id]}</strong>
                <span>New: {capitalize(String(recommendationFor(theme, id)))}</span>
              </div>
            </li>
          ))}
        </ul>

        <footer className="apply-theme-sheet__footer">
          <div className="apply-theme-sheet__bulk-actions">
            <button type="button" onClick={selectAll} disabled={applying}>Select All</button>
            <button type="button" onClick={clearAll} disabled={applying}>Clear</button>
            <button type="button" onClick={recommended} disabled={applying || availableOptionalScopes.length === 0}>
              Recommended
            </button>
          </div>
          <div className="apply-theme-sheet__commit-actions">
            <button type="button" onClick={onCancel} disabled={applying}>Cancel</button>
            <button type="button" className="apply-theme-sheet__apply" onClick={() => void handleApply()} disabled={applying}>
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
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

function OptionalScopePreview({ id, theme }: { id: OptionalScopeId; theme: CatalogTheme }) {
  if (id === "quotalisLogo") {
    const variant = theme.recommendedAppearance?.quotalisLogo as LogoVariant | undefined;
    return <QuotaArcMark size={28} variant={variant} sizePreference="balanced" label={`${variant} Quotalis logo preview`} />;
  }
  // Provider Identity/Tray/Background have no cheap standalone visual
  // renderer today (no per-skin LimitPresentation swatch, no tray-icon
  // renderer, no background thumbnail cache reachable from Settings) — a
  // real, disclosed gap (see THEME_COMPOSITION_AUDIT.md) rather than a
  // fabricated placeholder. The real string value is shown as text in the
  // row instead of a generic colored circle.
  return <span className="apply-theme-sheet__row-preview-text" aria-hidden="true">Aa</span>;
}
