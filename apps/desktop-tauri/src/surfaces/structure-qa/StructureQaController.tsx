import { useEffect, useState } from "react";
import { getProviderCatalog, isDevChannel } from "../../lib/tauri";
import { TrayNotificationQaPanel } from "./TrayNotificationQaPanel";
import { updateSettings } from "../../lib/tauri";
import { showTopArc, updateSurfaceSettings } from "../../lib/surfaceBridge";
import { useStructureQaFixture } from "../../hooks/useStructureQaFixture";
import { useLocale } from "../../hooks/useLocale";
import { FLOW_SURFACE_FORM_CATALOG, type FlowSurfaceForm } from "../../design-system/flowSurface";
import type { StructureQaFixture } from "../../lib/structureQaFixture";
import "./StructureQaController.css";

const ANCHORS = ["center", "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"] as const;
// "center" has no real native-window meaning (no such topArcAnchor value)
// -- offered in the control list per §25's exact wording, mapped to the
// closest real anchor ("free") rather than silently dropped or faked.
const ANCHOR_TO_REAL: Record<(typeof ANCHORS)[number], string> = {
  center: "free", left: "left", right: "right", top: "top", bottom: "bottom",
  "top-left": "top-left", "top-right": "top-right", "bottom-left": "bottom-left", "bottom-right": "bottom-right",
};

const DEFAULT_FIXTURE: StructureQaFixture = {
  providerCount: 6, nameLength: "normal", resetLength: "normal", windows: 1, dataState: "available", pinned: false,
};

/**
 * Wave 1F §22-30: the Dev-only in-app controller that drives the REAL
 * native Flow Surface window (`TopArc.tsx`) -- not a browser preview.
 * Reached only via the `?window=structure-qa` Dev-only query route
 * (App.tsx), never linked from any real navigation menu. The backend
 * itself refuses `set_structure_qa_fixture`/`reset_structure_qa_fixture`
 * outside the Dev channel (surfaces/qa_fixture.rs) -- the `isDevChannel()`
 * check here is a second, redundant layer for a clean message, not the
 * actual security boundary.
 *
 * Every control here writes through REAL production commands
 * (`update_surface_settings`, `set_structure_qa_fixture`, `update_settings`
 * for language/theme) -- there is no second, fake renderer. Structure/
 * anchor/scale changes are visible immediately in the real native window;
 * provider-fixture changes flow through TopArc.tsx's own real
 * buildStructureQaProviders() wiring.
 */
export default function StructureQaController() {
  const { t, language, setLanguage } = useLocale();
  const [devChannel, setDevChannel] = useState<boolean | null>(null);
  const qa = useStructureQaFixture();
  const [form, setForm] = useState<FlowSurfaceForm>("seam");
  const [anchor, setAnchor] = useState<(typeof ANCHORS)[number]>("right");
  const [scale, setScale] = useState(100);
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const draft = qa.fixture ?? DEFAULT_FIXTURE;

  useEffect(() => {
    let mounted = true;
    isDevChannel().then((value) => { if (mounted) setDevChannel(value === true); }).catch(() => { if (mounted) setDevChannel(false); });
    getProviderCatalog().then((catalog) => { if (mounted) setProviderIds(catalog.map((provider) => provider.id)); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (devChannel === null) return null;
  if (!devChannel) {
    return (
      <main className="structure-qa-controller structure-qa-controller--unavailable" role="alert">
        <p>{t("StructureQaUnavailable")}</p>
      </main>
    );
  }

  const applyPlacement = async (nextForm: FlowSurfaceForm, nextAnchor: (typeof ANCHORS)[number], nextScale: number) => {
    setForm(nextForm);
    setAnchor(nextAnchor);
    setScale(nextScale);
    await updateSurfaceSettings({
      topArcEnabled: true,
      topArcForm: nextForm,
      topArcAnchor: ANCHOR_TO_REAL[nextAnchor] as never,
      topArcScale: nextScale,
    });
    await showTopArc();
  };

  const applyFixture = (patch: Partial<StructureQaFixture>) => qa.set({ ...draft, ...patch });

  const resetAll = async () => {
    await qa.reset();
    await applyPlacement("seam", "right", 100);
  };

  return (
    <main className="structure-qa-controller" aria-label={t("StructureQaTitle")}>
      <h1>{t("StructureQaTitle")}</h1>
      <p className="structure-qa-controller__hint">{t("StructureQaHint")}</p>

      <fieldset>
        <legend>{t("StructureQaStructure")}</legend>
        <label>
          {t("StructureQaStructure")}
          <select aria-label={t("StructureQaStructure")} value={form} onChange={(e) => applyPlacement(e.target.value as FlowSurfaceForm, anchor, scale)}>
            {FLOW_SURFACE_FORM_CATALOG.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>
          {t("StructureQaAnchor")}
          <select aria-label={t("StructureQaAnchor")} value={anchor} onChange={(e) => applyPlacement(form, e.target.value as (typeof ANCHORS)[number], scale)}>
            {ANCHORS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          {t("StructureQaScale")}
          <input type="number" min={75} max={125} aria-label={t("StructureQaScale")} value={scale}
            onChange={(e) => applyPlacement(form, anchor, Number(e.target.value))} />
        </label>
      </fieldset>

      <fieldset>
        <legend>{t("StructureQaProviders")}</legend>
        <label>
          {t("StructureQaProviderCount")}
          <select aria-label={t("StructureQaProviderCount")} value={draft.providerCount} onChange={(e) => applyFixture({ providerCount: Number(e.target.value) })}>
            {[1, 3, 6, 12, 24, 70].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          {t("StructureQaName")}
          <select aria-label={t("StructureQaName")} value={draft.nameLength} onChange={(e) => applyFixture({ nameLength: e.target.value as StructureQaFixture["nameLength"] })}>
            <option value="normal">{t("StructureQaNormal")}</option>
            <option value="long">{t("StructureQaLong")}</option>
          </select>
        </label>
        <label>
          {t("StructureQaReset")}
          <select aria-label={t("StructureQaReset")} value={draft.resetLength} onChange={(e) => applyFixture({ resetLength: e.target.value as StructureQaFixture["resetLength"] })}>
            <option value="normal">{t("StructureQaNormal")}</option>
            <option value="long">{t("StructureQaLong")}</option>
            <option value="unavailable">{t("StructureQaUnavailableOption")}</option>
          </select>
        </label>
        <label>
          {t("StructureQaWindows")}
          <select aria-label={t("StructureQaWindows")} value={draft.windows} onChange={(e) => applyFixture({ windows: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label>
          {t("StructureQaData")}
          <select aria-label={t("StructureQaData")} value={draft.dataState} onChange={(e) => applyFixture({ dataState: e.target.value as StructureQaFixture["dataState"] })}>
            <option value="available">{t("StructureQaAvailable")}</option>
            <option value="loading">{t("StructureQaLoading")}</option>
            <option value="refreshing">{t("StructureQaRefreshing")}</option>
            <option value="unavailable">{t("StructureQaUnavailableOption")}</option>
            <option value="error">{t("StructureQaError")}</option>
            <option value="timeout">{t("StructureQaTimeout")}</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={draft.pinned} onChange={(e) => applyFixture({ pinned: e.target.checked })} />
          {t("StructureQaPinned")}
        </label>
      </fieldset>

      <fieldset>
        <legend>{t("StructureQaLocale")}</legend>
        <label>
          {t("StructureQaLanguage")}
          <select aria-label={t("StructureQaLanguage")} value={language} onChange={(e) => void setLanguage(e.target.value as "english" | "arabic")}>
            <option value="english">English</option>
            <option value="arabic">العربية</option>
          </select>
        </label>
        <label>
          {t("StructureQaMode")}
          <select aria-label={t("StructureQaMode")} onChange={(e) => void updateSettings({ theme: e.target.value as "light" | "dark" })}>
            <option value="dark">{t("StructureQaDark")}</option>
            <option value="light">{t("StructureQaLight")}</option>
          </select>
          <small>{t("StructureQaModeHint")}</small>
        </label>
      </fieldset>

      <TrayNotificationQaPanel providerIds={providerIds} />

      <button type="button" onClick={resetAll}>{t("StructureQaReset")}</button>
      {qa.error && <p role="alert">{qa.error}</p>}
    </main>
  );
}
