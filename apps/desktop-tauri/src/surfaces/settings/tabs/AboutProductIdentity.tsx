import { useLocale } from "../../../hooks/useLocale";
import QuotaArcMark from "../../../components/QuotaArcMark";
import type { AppInfoBridge } from "../../../types/bridge";

const FOUNDATIONS = [
  { name: "Win-CodexBar", url: "https://github.com/nesszer/Win-CodexBar", key: "AboutWindowsFoundation" },
  { name: "CodexBar", url: "https://github.com/steipete/CodexBar", key: "AboutOriginalFoundation" },
  { name: "codexcontrol", url: "https://github.com/ademisler/codexcontrol", key: "AboutAccountsFoundation" },
] as const;

// Roles verified against active imports and manifests; not a full license inventory.
const TECHNOLOGIES = [
  { name: "Rust · SQLite", key: "AboutTechCore" },
  { name: "Tauri 2 · WebView2", key: "AboutTechDesktop" },
  { name: "React · TypeScript", key: "AboutTechInterface" },
  { name: "Apache ECharts · Motion", key: "AboutTechVisuals" },
] as const;

const CONTRIBUTIONS = [
  { title: "AboutDirectionTitle", body: "AboutDirectionBody" },
  { title: "AboutDesignTitle", body: "AboutDesignBody" },
  { title: "AboutWorkflowsTitle", body: "AboutWorkflowsBody" },
] as const;

export default function AboutProductIdentity({ appInfo, openLink }: {
  appInfo: AppInfoBridge;
  openLink: (url: string) => void;
}) {
  const { t } = useLocale();
  return <>
    <header className="about-product__identity">
      <div className="about-product__brand">
        <QuotaArcMark className="about-product__mark" size={100} label={t("AppName")} />
        <div>
          <p className="about-product__eyebrow">{t("AboutIdentityEyebrow")}</p>
          <h2>{appInfo.name}</h2>
          <p className="about-product__promise">{t("AboutProductPromise")}</p>
        </div>
      </div>
      <div className="about-product__build" aria-label={t("Version")}>
        <span>{t("Version")} <bdi>{appInfo.version}</bdi></span>
        <span>Windows</span>
        <span>MIT</span>
        {appInfo.buildNumber !== "dev" && <span><bdi>{appInfo.buildNumber}</bdi></span>}
      </div>
    </header>

    <section className="about-product__author" aria-labelledby="about-owner">
      <div className="about-product__author-name">
        <p className="about-product__eyebrow">{t("AboutProductDevelopment")}</p>
        <h3 id="about-owner"><bdi>Mohammed Modhish</bdi></h3>
        <p>{t("AboutOwnerRole")}</p>
        <button type="button" className="about-link about-product__contact" onClick={() => openLink("https://wa.me/966570966094")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z" />
            <path d="M8 7.5c-.8 1.2.4 3.8 2 5.3s4 2.7 5.3 1.8l.7-1.7-2.2-1-1 1c-1.5-.6-2.6-1.7-3.2-3.1l.9-1-1-2.1Z" />
          </svg>
          {t("AboutContactWhatsApp")}
        </button>
      </div>
      <div className="about-product__author-story">
        <p>{t("AboutOwnerContribution")}</p>
        <ul className="about-product__contributions">
          {CONTRIBUTIONS.map(item => <li key={item.title}>
            <strong>{t(item.title)}</strong><span>{t(item.body)}</span>
          </li>)}
        </ul>
      </div>
    </section>

    <div className="about-product__engineering">
      <section aria-labelledby="about-tools">
        <h3 id="about-tools">{t("AboutBuiltWith")}</h3>
        <p>{t("AboutBuiltWithBody")}</p>
        <dl className="about-product__technology-list">
          {TECHNOLOGIES.map(tool => <div key={tool.name}>
            <dt><bdi>{tool.name}</bdi></dt><dd>{t(tool.key)}</dd>
          </div>)}
        </dl>
      </section>
      <section aria-labelledby="about-credits">
        <h3 id="about-credits">{t("AboutOpenSourceCredits")}</h3>
        <p>{t("AboutCreditIntro")}</p>
        <ul className="about-product__foundations">
          {FOUNDATIONS.map(project => <li key={project.name}>
            <button type="button" className="about-link" onClick={() => openLink(project.url)}>
              <bdi>{project.name}</bdi><span aria-hidden="true">↗</span>
            </button>
            <p>{t(project.key)}</p>
          </li>)}
        </ul>
      </section>
    </div>
    <p className="about-product__license">{t("AboutLicenseBody")}</p>
  </>;
}
