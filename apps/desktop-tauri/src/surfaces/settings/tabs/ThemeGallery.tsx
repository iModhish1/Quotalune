/**
 * Theme Gallery — production Settings surface for the 15-theme catalog.
 *
 * Every tile renders the real production runtime (CatalogSurface over the
 * radial instruments) — not a static mock. Click applies the theme through
 * the backend (persisted, validated, broadcast); the active theme is
 * checked; Reset restores the Obsidian Orbit default.
 */
import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import CatalogSurface from "../../../demo/CatalogSurface";
import { getSettingsSnapshot } from "../../../lib/tauri";

const CATALOG: { slug: string; name: string }[] = [
  { slug: "01-obsidian-orbit", name: "Obsidian Orbit" },
  { slug: "02-aurora-bloom", name: "Aurora Bloom" },
  { slug: "03-solar-ember", name: "Solar Ember" },
  { slug: "04-porcelain-halo", name: "Porcelain Halo" },
  { slug: "05-noir-constellation", name: "Noir Constellation" },
  { slug: "06-halo-spine", name: "Halo Spine" },
  { slug: "07-eclipse-dial", name: "Eclipse Dial" },
  { slug: "08-prism-zenith", name: "Prism Zenith" },
  { slug: "09-quantum-orchid", name: "Quantum Orchid" },
  { slug: "10-celestial-ice", name: "Celestial Ice" },
  { slug: "11-emerald-singularity", name: "Emerald Singularity" },
  { slug: "12-crimson-nova", name: "Crimson Nova" },
  { slug: "13-lunar-titanium", name: "Lunar Titanium" },
  { slug: "14-sapphire-observatory", name: "Sapphire Observatory" },
  { slug: "15-astral-dune", name: "Astral Dune" },
];

const DEFAULT_THEME = "01-obsidian-orbit";

export default function ThemeGallery() {
  const [active, setActive] = useState<string>(DEFAULT_THEME);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = () =>
      getSettingsSnapshot()
        .then((s: { catalogTheme?: string }) => setActive((s as { catalogTheme?: string }).catalogTheme ?? DEFAULT_THEME))
        .catch(() => {});
    load();
    const unlistenPromise = listen("codexbar:settings-updated", load);
    const unlisten = unlistenPromise.catch(() => () => {});
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const apply = useCallback((slug: string) => {
    setSaving(true);
    invoke("set_catalog_theme", { slug })
      .then(() => setActive(slug))
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  const shown = preview ?? active;

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">Theme Gallery</h3>
      <p className="settings-section__description" style={{ marginBottom: 12 }}>
        Live previews of the orbital theme catalog. Click a theme to apply it
        everywhere; Reset restores the default.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {CATALOG.map(({ slug, name }) => (
          <button
            key={slug}
            type="button"
            disabled={saving}
            onClick={() => apply(slug)}
            onMouseEnter={() => setPreview(slug)}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview(slug)}
            style={{
              background: "none",
              border: `1px solid ${shown === slug ? "var(--qa-accent)" : "var(--qa-hairline)"}`,
              borderRadius: 10,
              padding: 0,
              cursor: "pointer",
              overflow: "hidden",
              textAlign: "left",
              color: "inherit",
            }}
            aria-pressed={active === slug}
            aria-label={`Apply theme ${name}`}
          >
            <div style={{ height: 110, pointerEvents: "none" }}>
              <CatalogSurface catalog={slug} surface="taskbar" state="expanded" />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 9px",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span>{name}</span>
              {active === slug && (
                <span style={{ color: "var(--qa-accent)", fontSize: 10, fontWeight: 700 }}>
                  ACTIVE
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="qa-icon-btn"
          style={{ width: "auto", padding: "6px 12px", fontSize: 12 }}
          disabled={saving || active === DEFAULT_THEME}
          onClick={() => apply(DEFAULT_THEME)}
        >
          Reset to default
        </button>
      </div>
    </section>
  );
}
