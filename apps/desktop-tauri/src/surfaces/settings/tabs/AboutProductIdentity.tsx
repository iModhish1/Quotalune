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

export default function AboutProductIdentity({ appInfo }: {
  appInfo: AppInfoBridge;
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

  </>;
}

export function AboutEngineering({ openLink }: { openLink: (url: string) => void }) {
  const { t } = useLocale();
  return <>
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
