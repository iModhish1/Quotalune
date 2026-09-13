import { useLocale } from "../../../hooks/useLocale";
import ownerAvatar from "../../../assets/imodhish1-avatar.png";
import tawajudMark from "../../../assets/tawajud-mark.png";

const CONTACTS = [
  { key: "AboutContactWhatsApp", url: "https://wa.me/966570966094", path: "M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.7A9 9 0 1 1 21 11.5ZM8 7.5c-.8 1.2.4 3.8 2 5.3s4 2.7 5.3 1.8l.7-1.7-2.2-1-1 1c-1.5-.6-2.6-1.7-3.2-3.1l.9-1-1-2.1Z" },
  { key: "AboutContactTelegram", url: "https://t.me/iModhish_1", path: "m21 3-4 18-6-5-4 3v-6L21 3ZM21 3 3 10l4 3m0 0 10-6-6 9" },
  { key: "AboutGitHubProject", url: "https://github.com/iModhish1/Quotalis", path: "M9 22v-4c-4 1-4-2-6-2m12 6v-4.5c0-1-.4-1.6-.8-2 3-.3 6-1.5 6-6.5 0-1.5-.5-2.5-1.4-3.5.2-.8.2-2.1-.2-3.5-1.3 0-2.9.8-3.6 1.3a12 12 0 0 0-6 0C7.2 2.3 5.8 2 5.4 2 5 3.4 5 4.7 5.2 5.5 4.3 6.5 3.8 7.5 3.8 9c0 5 3 6.2 6 6.5-.4.4-.8 1-.8 2" },
] as const;

/** Bundled assets: viewing About never requests the owner's avatar remotely. */
export default function AboutCreatorFooter({ openLink, enableAnimations }: {
  openLink: (url: string) => void;
  enableAnimations: boolean;
}) {
  const { t } = useLocale();
  return <footer className="about-creator" data-motion={enableAnimations ? "on" : "off"} aria-labelledby="about-creator-heading">
    <div className="about-creator__signature">
      <button type="button" className="about-creator__avatar" aria-label={t("AboutCreatorProfile")} onClick={() => openLink("https://github.com/iModhish1")}>
        <span className="about-creator__flame" aria-hidden="true" />
        <img src={ownerAvatar} width="80" height="80" alt="Mohammed Modhish" />
      </button>
      <div className="about-creator__credit">
        <p id="about-creator-heading" className="about-creator__label">{t("AboutMadeBy")}</p>
        <bdi className="about-creator__name">Mohammed Modhish <span>(iModhish1)</span></bdi>
        <div className="about-creator__employer">
          <span>{t("AboutWorksAt")}</span>
          <button type="button" className="about-creator__company" onClick={() => openLink("https://tawajud.net")}>
            <img src={tawajudMark} width="32" height="32" alt="" />
            <bdi>TAWAJUD AI</bdi><span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </div>
    <div className="about-creator__contacts" role="group" aria-label={t("AboutContactUs")}>
      <p className="about-creator__label">{t("AboutContactUs")}</p>
      <div className="about-creator__links">
        {CONTACTS.map(contact => <button key={contact.key} type="button" className="about-link" onClick={() => openLink(contact.url)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={contact.path} /></svg>
          {t(contact.key)}
        </button>)}
      </div>
    </div>
  </footer>;
}
