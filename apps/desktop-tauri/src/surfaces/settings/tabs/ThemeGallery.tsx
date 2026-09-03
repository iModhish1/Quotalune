import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import CatalogUsageHero from "../../../components/CatalogUsageHero";
import { CATALOG_STAGE_FIXTURE } from "../../../components/orbit/stageFixture";
import { THEME_CATALOG, catalogBySlug } from "../../../design-system/themeCatalog";
import {
  DEFAULT_CATALOG_THEME,
  resolveCatalogTheme,
  type CatalogSurfaceId,
} from "../../../design-system/themeResolution";
import { getProfileStore, type ProfileStoreDto } from "../../../lib/profileBridge";
import {
  getSettingsSnapshot,
  setCatalogTheme,
  type CatalogThemeScope,
} from "../../../lib/tauri";
import type { SettingsSnapshot } from "../../../types/bridge";
import "./ThemeGallery.css";

type GalleryScope = CatalogThemeScope;

const SCOPE_OPTIONS: Array<{ id: GalleryScope; label: string }> = [
  { id: "global", label: "Global" },
  { id: "profile", label: "Current profile" },
  { id: "surface:taskbar", label: "Taskbar" },
  { id: "surface:top", label: "Top" },
  { id: "surface:edge", label: "Edge" },
  { id: "surface:hud", label: "HUD" },
  { id: "surface:quick", label: "Quick panel" },
  { id: "surface:dashboard", label: "Dashboard" },
];

const SURFACE_LABELS: Record<CatalogSurfaceId, string> = {
  taskbar: "Taskbar",
  top: "Top",
  edge: "Edge",
  hud: "HUD",
  quick: "Quick panel",
  dashboard: "Dashboard",
};

function surfaceFromScope(scope: GalleryScope): CatalogSurfaceId | null {
  return scope.startsWith("surface:")
    ? (scope.slice("surface:".length) as CatalogSurfaceId)
    : null;
}

export default function ThemeGallery() {
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [profiles, setProfiles] = useState<ProfileStoreDto | null>(null);
  const [scope, setScope] = useState<GalleryScope>("global");
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextSettings, nextProfiles] = await Promise.all([
        getSettingsSnapshot(),
        getProfileStore(),
      ]);
      setSettings(nextSettings);
      setProfiles(nextProfiles);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void load();
    const settingsListener = listen("codexbar:settings-updated", load);
    const profilesListener = listen("profiles-changed", load);
    return () => {
      void settingsListener.then((unlisten) => unlisten()).catch(() => {});
      void profilesListener.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [load]);

  const activeProfile = profiles?.profiles.find(
    (profile) => profile.id === profiles.activeProfileId,
  );
  const resolution = useMemo(() => {
    if (!settings) return { slug: DEFAULT_CATALOG_THEME, source: "default" as const };
    if (scope === "global") {
      const slug = catalogBySlug(settings.catalogTheme ?? "")?.slug;
      return slug
        ? { slug, source: "global" as const }
        : { slug: DEFAULT_CATALOG_THEME, source: "default" as const };
    }
    if (scope === "profile") {
      const slug = catalogBySlug(activeProfile?.catalogTheme ?? "")?.slug;
      if (slug) return { slug, source: "profile" as const };
      const global = catalogBySlug(settings.catalogTheme ?? "")?.slug;
      return global
        ? { slug: global, source: "global" as const }
        : { slug: DEFAULT_CATALOG_THEME, source: "default" as const };
    }
    const surface = surfaceFromScope(scope) as CatalogSurfaceId;
    return resolveCatalogTheme(
      { ...settings, activeProfileCatalogTheme: activeProfile?.catalogTheme ?? null },
      surface,
    );
  }, [activeProfile?.catalogTheme, scope, settings]);

  const scopeSurface = surfaceFromScope(scope);
  const hasExplicitOverride =
    scope === "global"
      ? resolution.slug !== DEFAULT_CATALOG_THEME
      : scope === "profile"
        ? Boolean(activeProfile?.catalogTheme)
        : Boolean(scopeSurface && settings?.surfaceCatalogThemes?.[scopeSurface]);

  const provenance = (() => {
    if (scope === "global") return resolution.source === "default" ? "Default theme" : "Global theme";
    if (scope === "profile") {
      return resolution.source === "profile"
        ? `Profile override · ${activeProfile?.name ?? "Current profile"}`
        : resolution.source === "global"
          ? "Inherited from global"
          : "Inherited from default";
    }
    const label = SURFACE_LABELS[scopeSurface as CatalogSurfaceId];
    if (resolution.source === "surface") return `Surface override · ${label}`;
    if (resolution.source === "profile") {
      return `Inherited from profile · ${activeProfile?.name ?? "Current profile"}`;
    }
    return resolution.source === "global" ? "Inherited from global" : "Inherited from default";
  })();

  const apply = useCallback(
    async (slug: string) => {
      setSaving(true);
      setError(null);
      try {
        await setCatalogTheme(slug, scope);
        setPreview(null);
        await load();
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setSaving(false);
      }
    },
    [load, scope],
  );

  const shown = preview ?? resolution.slug;

  return (
    <section className="settings-section theme-gallery">
      <div className="theme-gallery__heading">
        <div>
          <h3 className="settings-section__title">Theme Gallery</h3>
          <p className="settings-section__description">
            Assign one of the 15 orbital worlds globally, to this profile, or to a single surface.
          </p>
        </div>
        <div className="theme-gallery__provenance" data-source={resolution.source}>
          <span>{provenance}</span>
          <strong>{catalogBySlug(shown)?.name ?? "Obsidian Orbit"}</strong>
        </div>
      </div>

      <div className="theme-gallery__scopes" role="tablist" aria-label="Theme assignment scope">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={scope === option.id}
            className="theme-gallery__scope"
            onClick={() => {
              setScope(option.id);
              setPreview(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <div className="theme-gallery__error" role="alert">{error}</div>}

      <div className="theme-gallery__grid">
        {THEME_CATALOG.map((theme) => (
          <button
            key={theme.slug}
            type="button"
            disabled={saving}
            className="theme-gallery__tile"
            data-active={resolution.slug === theme.slug}
            onClick={() => void apply(theme.slug)}
            onMouseEnter={() => setPreview(theme.slug)}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview(theme.slug)}
            onBlur={() => setPreview(null)}
            aria-pressed={resolution.slug === theme.slug}
            aria-label={`Apply theme ${theme.name}`}
          >
            <div className="theme-gallery__preview" aria-hidden="true">
              <CatalogUsageHero
                variant="quick"
                catalog={theme.slug}
                providers={CATALOG_STAGE_FIXTURE}
                selectedProviderId="openai"
              />
            </div>
            <div className="theme-gallery__tile-label">
              <span>
                <strong>{theme.name}</strong>
                <small>{theme.geometry}</small>
              </span>
              {resolution.slug === theme.slug && <b>ACTIVE</b>}
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="theme-gallery__inherit"
        disabled={saving || !hasExplicitOverride}
        onClick={() => void apply("")}
        aria-label={scope === "global" ? "Reset to default theme" : "Use inherited theme"}
      >
        {scope === "global" ? "Reset to default" : "Use inherited theme"}
      </button>
    </section>
  );
}
