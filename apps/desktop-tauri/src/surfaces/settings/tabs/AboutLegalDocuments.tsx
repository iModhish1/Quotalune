import { useLocale } from "../../../hooks/useLocale";
import legalDocuments from "virtual:quotalis-legal-documents";

const documents = [
  { key: "AboutMITLicense", text: legalDocuments.license },
  { key: "AboutDerivedNotice", text: legalDocuments.notice },
  { key: "AboutThirdPartyNotices", text: legalDocuments.thirdPartyNotices },
] as const;

/** The same committed legal files shipped by the Inno and portable packages. */
export default function AboutLegalDocuments() {
  const { t } = useLocale();
  return <details className="about-product__legal-documents">
    <summary>{t("AboutLegalDocuments")}</summary>
    <div className="about-product__legal-list">
      {documents.map(({ key, text }) => <section key={key} aria-label={t(key)}>
        <h4>{t(key)}</h4>
        <pre dir="ltr">{text}</pre>
      </section>)}
    </div>
  </details>;
}
