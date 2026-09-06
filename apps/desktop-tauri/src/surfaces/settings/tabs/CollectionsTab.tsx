import { useLocale } from "../../../hooks/useLocale";
import CollectionSettings from "./CollectionSettings";
import "./CollectionsTab.css";

/**
 * Collections — a first-class Settings destination (tray/UX-reset wave).
 * Previously this editor was nested inside the Surfaces tab behind an extra
 * "Configure collections (experimental)" disclosure; that indirection is
 * removed from the primary path. Reuses the existing, already-live-tested
 * `CollectionSettings`/`CollectionsStudio` implementation unchanged — no
 * second Collections editor.
 */
export default function CollectionsTab() {
  const { t } = useLocale();
  return (
    <div className="collections-page">
      <header className="collections-page__header">
        <h2>{t("TabCollections")}</h2>
        <p>{t("CollectionsPageHelper")}</p>
      </header>
      <CollectionSettings />
    </div>
  );
}
