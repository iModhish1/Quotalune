import {useState} from "react";
import {Select,Toggle} from "../components/FormControls";
import "../surfaces/settings/SettingsStudio.css";
import NavigationPreference from "../surfaces/settings/NavigationPreference";
import LimitChoiceEditor from '../surfaces/settings/tabs/LimitChoiceEditor';
import LimitPresentationEditor from '../surfaces/settings/tabs/LimitPresentationEditor';
import StructurePreview from '../surfaces/settings/StructurePreview';
import UsageWindowList,{type LimitPresentation} from '../components/orbit/UsageWindowList';
import {CATALOG_STAGE_FIXTURE} from '../components/orbit/stageFixture';
import {THEME_CATALOG} from '../design-system/themeCatalog';
import SettingsShellHeader from '../surfaces/settings/SettingsShellHeader';
import NotificationPreview from '../surfaces/settings/NotificationPreview';

/** Production shell CSS and controls; local-only state, not native settings. */
export default function AppearanceProof(){
  const [theme,setTheme]=useState("light");
  const [direction,setDirection]=useState("ltr");
  const [previewSection,setPreviewSection]=useState("General");
  const [catalog,setCatalog]=useState(THEME_CATALOG[0].slug);
  const [navigation,setNavigation]=useState("sidebar");
  const [enabled,setEnabled]=useState(true);
  const [limits,setLimits]=useState(['session','five','weekly']);
  const [presentation,setPresentation]=useState<LimitPresentation>({shape:'ring',content:'both',direction:'forward'});
  const proofProviders=CATALOG_STAGE_FIXTURE.slice(0,3).map(provider=>({...provider,limitPresentation:presentation,windows:['Session','5-hour','Weekly','Monthly'].map((label,index)=>({id:label,label,primaryValue:20+index*15,primaryLabel:'remaining' as const,arcFraction:(20+index*15)/100,reset:'2h',resetsAt:null}))}));
  return <div data-theme={theme} dir={direction}>
    <main className="settings settings-studio" data-navigation={navigation}>
      <SettingsShellHeader section={previewSection}>
        <Select ariaLabel="Preview app appearance" value={theme} onChange={setTheme} options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"}]}/>
        <Select ariaLabel="Preview text direction" value={direction} onChange={setDirection} options={[{value:"ltr",label:"LTR"},{value:"rtl",label:"RTL"}]}/>
      </SettingsShellHeader>
      <nav className="settings-tabs" aria-label="Preview navigation">
        {["General","Providers","Notifications","Surfaces","Themes","About"].map(label=><button key={label} title={label} aria-current={previewSection===label?"page":undefined} onClick={()=>setPreviewSection(label)} className={`settings-tab ${previewSection===label?"settings-tab--active":""}`}><span className="settings-tab__icon" aria-hidden>{label[0]}</span><span className="settings-tab__label">{label}</span></button>)}
      </nav>
      <div className="settings-body">
        {previewSection === "Notifications" && <NotificationPreview high={70} critical={90} enabled={enabled}/>}
        <Select ariaLabel="Surface identity" value={catalog} onChange={setCatalog} options={THEME_CATALOG.map(t=>({value:t.slug,label:t.name}))}/>
        <section className="settings-section" aria-label="Expanded limit envelope proof">{(['satellite','reel','orbital'] as const).map(form=><StructurePreview key={form} form={form} catalog={catalog} expanded maxWidth={600} maxHeight={400} providers={proofProviders}/>)}</section>
        <section className="settings-section"><h2>Limit presentation · local demo</h2>
          <LimitPresentationEditor provider="Demo" value={presentation} disabled={false} onChange={setPresentation}/>
          <Select ariaLabel="Limit shape" value={presentation.shape} onChange={shape=>setPresentation({...presentation,shape:shape as LimitPresentation['shape']})} options={['ring','horizontal','vertical'].map(value=>({value,label:value}))}/>
          <Select ariaLabel="Limit content" value={presentation.content} onChange={content=>setPresentation({...presentation,content:content as LimitPresentation['content']})} options={['both','bar','value'].map(value=>({value,label:value}))}/>
          <Select ariaLabel="Limit direction" value={presentation.direction} onChange={direction=>setPresentation({...presentation,direction:direction as LimitPresentation['direction']})} options={['forward','reverse'].map(value=>({value,label:value}))}/>
          <UsageWindowList presentation={presentation} windows={['Session','5-hour','Weekly','Monthly'].map((label,index)=>({id:label,label,primaryValue:20+index*15,primaryLabel:'remaining',arcFraction:(20+index*15)/100,reset:'2h',resetsAt:null}))}/>
        </section>
        <section className="settings-section surface-settings"><header className="surface-settings__hero"><div><strong>Surface preview isolation</strong><p>App appearance must not repaint the selected widget material.</p></div></header>
          <div className="surface-settings__grid"><section className="surface-control"><div className="surface-control__copy"><strong>Readable control title</strong></div><button>Settings action</button></section>
            <div className="surface-settings__column surface-settings__column--catalog"><div className="surface-structure-picker__choices">{(['satellite','reel','orbital'] as const).map(form=><article className="surface-structure-choice" key={form}><StructurePreview form={form}/><span>{form}</span></article>)}</div></div>
          </div></section>
        <section className="settings-section"><LimitChoiceEditor provider="Demo" choices={[{id:'session',label:'Session'},{id:'five',label:'5-hour'},{id:'weekly',label:'Weekly'}]} selected={limits} disabled={false} onChange={setLimits}/></section>
        <NavigationPreference value={navigation==="sidebar"?"side":navigation as "top"|"bottom"} onChange={value=>setNavigation(value==="side"?"sidebar":value)}/>
        <section className="settings-section"><h2 className="settings-section__title">Appearance</h2>
          <p className="settings-section__description">Production shell styles and controls. This preview does not save settings or send notifications.</p>
          <div className="settings-field"><div className="settings-field__text"><strong>Navigation placement</strong><p className="settings-field__desc">Keep pages beside your content or in a horizontal menu.</p></div>
            <Select ariaLabel="Preview navigation placement" value={navigation} onChange={setNavigation} options={[{value:"sidebar",label:"Sidebar"},{value:"top",label:"Top"},{value:"bottom",label:"Bottom"}]}/></div>
          <div className="settings-field"><div className="settings-field__text"><strong>Show details</strong><p className="settings-field__desc">A local toggle to inspect active and inactive control contrast.</p></div><Toggle ariaLabel="Preview details enabled" checked={enabled} onChange={setEnabled}/></div>
          <button type="button">Preview action</button>
        </section>
      </div>
    </main>
  </div>;
}
