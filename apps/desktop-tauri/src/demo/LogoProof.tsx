import QuotaArcMark from "../components/QuotaArcMark";
import { LOGO_SIZES, LOGO_VARIANTS } from "../design-system/logoAppearance";
import "../surfaces/settings/tabs/LogoAppearance.css";
import "../surfaces/settings/SettingsStudio.css";

export default function LogoProof() {
  return <main className="settings settings-studio" data-navigation="side" style={{ minHeight: "100vh", padding: 28 }}>
    <section className="settings-section" style={{ maxWidth: 920, margin: "auto" }}>
      <h1>QuotaArc official mark system</h1>
      <p className="settings-section__description">One silhouette, five finishes and three bounded prominence levels.</p>
      <div className="logo-appearance__choices">
        {LOGO_VARIANTS.map((variant) => <article className="logo-appearance__choice" key={variant} aria-pressed={variant === "silver"}>
          <span className="logo-appearance__preview"><QuotaArcMark size={40} variant={variant} sizePreference="balanced" label={`${variant} QuotaArc logo`} /></span>
          <span>{variant[0].toUpperCase() + variant.slice(1)}</span>
        </article>)}
      </div>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "center", gap: 48, marginTop: 34 }}>
        {LOGO_SIZES.map((size) => <div key={size} style={{ display: "grid", placeItems: "center", gap: 12 }}>
          <span className="logo-appearance__preview" style={{ width: 82, height: 82 }}><QuotaArcMark size={56} sizePreference={size} label={`${size} official logo`} /></span>
          <span>{size}</span>
        </div>)}
      </div>
    </section>
  </main>;
}
