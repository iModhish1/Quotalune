import {useEffect, useRef, useState, type CSSProperties} from "react";
import {listen} from "@tauri-apps/api/event";
import {useLocale} from "../../hooks/useLocale";
import {BACKGROUND_CATALOG, customBackgroundId} from "../../design-system/backgroundCatalog";
import {listWorkspaceBackgrounds, importWorkspaceBackground, removeWorkspaceBackground, type StoredBackground} from "../../lib/workspaceBackgrounds";
import {getSettingsSnapshot} from "../../lib/tauri";
import {useReducedMotion} from "../../design-system/motion";
import {backgroundInteractionAllowed} from "../../design-system/WorkspaceBackdrop";
import type {SettingsSnapshot, SettingsUpdate, WorkspacePreferences} from "../../types/bridge";
import "./WorkspaceBackgroundControl.css";

export default function WorkspaceBackgroundControl({settings, navigation, update, disabled}: {
  settings: SettingsSnapshot; navigation: WorkspacePreferences["navigation"];
  update: (patch: SettingsUpdate) => void | Promise<void>; disabled: boolean;
}) {
  const {t} = useLocale();
  const reducedMotion = useReducedMotion();
  const prefs = settings.workspacePreferences;
  const motion = prefs?.backgroundMotion ?? "static";
  const [filter,setFilter] = useState("all");
  const [custom,setCustom] = useState<StoredBackground[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const picker=useRef<HTMLInputElement>(null);
  const mounted=useRef(true);
  const operation=useRef(false);
  useEffect(() => {
    let active=true;
    mounted.current=true;
    const refresh=()=>{void listWorkspaceBackgrounds().then(items=>{if(active)setCustom(items);}).catch(()=>{if(active)setError(true);});};
    refresh();
    const subscription=listen("workspace-backgrounds-changed",refresh).catch(()=>()=>{});
    return ()=>{active=false;mounted.current=false;void subscription.then(unlisten=>unlisten());};
  },[]);
  const set = (patch: Partial<WorkspacePreferences>) => update({workspacePreferences:{density:"comfortable",...prefs,navigation,...patch}});
  const persistBackground=async(background:WorkspacePreferences["background"])=>{
    const current=await getSettingsSnapshot();
    if(!mounted.current)throw new Error("editor-closed");
    await update({workspacePreferences:{density:"comfortable",navigation:"side",...current.workspacePreferences,background}});
    // useSettings reports persistence failures in the shell without rejecting its promise.
    const saved=await getSettingsSnapshot();
    if(saved.workspacePreferences?.background!==background)throw new Error("background-not-saved");
  };
  const importImage=async(file:File)=>{
    if(operation.current)return;operation.current=true;
    setBusy(true);setError(false);
    try {
      const item=await importWorkspaceBackground(file);
      const items=await listWorkspaceBackgrounds();
      if(!mounted.current)return;
      setCustom(items);setFilter("custom");
      await persistBackground(`custom:${item.id}`);
    } catch {if(mounted.current)setError(true);} finally {operation.current=false;if(mounted.current)setBusy(false);}
  };
  const removeImage=async(id:string)=>{
    if(operation.current)return;operation.current=true;
    setBusy(true);setError(false);
    try {
      // Persist the replacement before deleting the selected asset.
      const current=await getSettingsSnapshot();
      if(customBackgroundId(current.workspacePreferences?.background)===id) await persistBackground("cosmic");
      if(!mounted.current)return;
      await removeWorkspaceBackground(id);
      const items=await listWorkspaceBackgrounds();
      if(mounted.current)setCustom(items);
    } catch {if(mounted.current)setError(true);} finally {operation.current=false;if(mounted.current)setBusy(false);}
  };
  const unavailable=disabled||busy;
  return <section className="settings-section workspace-background-control" aria-labelledby="workspace-background-title">
    <header><h3 id="workspace-background-title">{t("WorkspaceBackgroundTitle")}</h3><p>{t("WorkspaceBackgroundHelp")}</p></header>
    <div className="workspace-background-library-toolbar">
      <div className="workspace-background-segments" role="group" aria-label={t("WorkspaceBackgroundTitle")}>
        {([['all','WorkspaceBackgroundAll'],['static','WorkspaceBackgroundStaticOnly'],['animated','WorkspaceBackgroundAnimated'],['custom','WorkspaceBackgroundMine']] as const).map(([id,key])=>
          <button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{t(key)}</button>)}
      </div>
      <button type="button" disabled={unavailable||custom.length>=40} onClick={()=>picker.current?.click()}>{t("WorkspaceBackgroundImport")}</button>
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{
        const file=event.target.files?.[0];event.target.value="";if(file)void importImage(file);
      }}/>
    </div>
    <p className="workspace-background-hint">{t("WorkspaceBackgroundImportHelp")}</p>
    {busy&&<p role="status">{t("WorkspaceBackgroundWorking")}</p>}
    {error&&<p role="alert">{t("WorkspaceBackgroundFailure")}</p>}
    <div className="workspace-background-choices" role="group" aria-label={t("WorkspaceBackgroundTitle")}>
      {BACKGROUND_CATALOG.filter(item=>filter==="all"||filter===item.kind).map(item => <button type="button" key={item.id} disabled={unavailable}
        aria-pressed={(prefs?.background ?? "cosmic") === item.id} onClick={() => set({background:item.id as WorkspacePreferences["background"],...(item.kind==="animated"?{backgroundMotion:"interactive" as const}:{})})}>
        <span className="workspace-background-preview" data-background={item.id} style={item.art ? {"--workspace-art":item.art} as CSSProperties : undefined} aria-hidden="true"/>
        <strong>{t(item.title)}</strong><small>{t(item.kind==="animated"?"WorkspaceBackgroundAnimated":"WorkspaceBackgroundStaticOnly")}{item.batch>0&&` · ${t("WorkspaceBackgroundBatch")} ${item.batch}`}</small>
      </button>)}
      {(filter==="all"||filter==="custom")&&custom.map(item=><div className="workspace-background-custom" key={item.id}>
        <button type="button" disabled={unavailable} aria-pressed={customBackgroundId(prefs?.background)===item.id} onClick={()=>set({background:`custom:${item.id}`})}>
          <img className="workspace-background-preview" src={item.thumbnailDataUrl} alt="" loading="lazy"/><strong>{item.name}</strong>
        </button>
        <button type="button" className="workspace-background-delete" disabled={unavailable} aria-label={`${t("WorkspaceBackgroundRemove")} ${item.name}`} onClick={()=>void removeImage(item.id)}>{t("WorkspaceBackgroundRemove")}</button>
      </div>)}
    </div>
    {filter==="custom"&&custom.length===0&&<p>{t("WorkspaceBackgroundEmpty")}</p>}
    <div className="workspace-background-options">
      <fieldset disabled={unavailable}><legend>{t("WorkspaceBackgroundMotion")}</legend>
        <div className="workspace-background-segments">
          <button type="button" aria-pressed={motion === "static"} onClick={() => set({backgroundMotion:"static"})}>{t("WorkspaceBackgroundStatic")}</button>
          <button type="button" aria-pressed={motion === "interactive"} onClick={() => set({backgroundMotion:"interactive"})}>{t("WorkspaceBackgroundInteractive")}</button>
        </div>
      </fieldset>
      <fieldset disabled={unavailable}><legend>{t("WorkspaceBackgroundIntensity")}</legend>
        <div className="workspace-background-segments">
          {([['subtle','WorkspaceBackgroundSubtle'],['balanced','WorkspaceBackgroundBalanced'],['vivid','WorkspaceBackgroundVivid']] as const).map(([id,key]) =>
            <button type="button" key={id} aria-pressed={(prefs?.backgroundIntensity ?? "balanced") === id} onClick={() => set({backgroundIntensity:id})}>{t(key)}</button>)}
        </div>
      </fieldset>
    </div>
    <p className="workspace-background-hint">{t(motion === "interactive" && !backgroundInteractionAllowed(settings,reducedMotion) ? "WorkspaceBackgroundPaused" : "WorkspaceBackgroundMotionHelp")}</p>
    <p className="workspace-background-hint">{t("WorkspaceBackgroundMotionSafety")}</p>
  </section>;
}
