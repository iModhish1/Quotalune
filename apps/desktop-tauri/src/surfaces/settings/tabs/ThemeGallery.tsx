import CatalogUsageHero from "../../../components/CatalogUsageHero";
import { CATALOG_STAGE_FIXTURE } from "../../../components/orbit/stageFixture";
import { CANONICAL_THEME } from "../../../design-system/themeCatalog";
import "./ThemeGallery.css";

export default function ThemeGallery() {
  return (
    <section className="settings-section theme-gallery">
      <div className="theme-gallery__heading">
        <div>
          <h3 className="settings-section__title">Canonical surface theme</h3>
          <p className="settings-section__description">
            QuotaArc is using one shared composition while its Windows surface foundation is refined.
          </p>
        </div>
        <div className="theme-gallery__provenance" data-source="default">
          <span>Canonical foundation</span>
          <strong>{CANONICAL_THEME.name}</strong>
        </div>
      </div>
      <div className="theme-gallery__canonical" data-theme={CANONICAL_THEME.slug}>
        <div className="theme-gallery__preview" aria-hidden="true">
          <CatalogUsageHero
            variant="quick"
            catalog={CANONICAL_THEME.slug}
            providers={CATALOG_STAGE_FIXTURE}
            selectedProviderId="openai"
          />
        </div>
        <div className="theme-gallery__tile-label">
          <span>
            <strong>{CANONICAL_THEME.name}</strong>
            <small>orbit · information-first</small>
          </span>
          <b>ACTIVE</b>
        </div>
      </div>
      <p className="theme-gallery__archive-note" role="status">
        Fourteen experimental themes are archived. Future themes will change tokens and materials only,
        never this composition or its interaction model.
      </p>
    </section>
  );
}
