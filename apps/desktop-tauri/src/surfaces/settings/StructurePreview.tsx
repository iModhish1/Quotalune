import FlowSurface from "../flow-surface/FlowSurface";
import {flowSurfaceEnvelope,flowSurfaceDefaultAnchor,type FlowSurfaceAnchor,type FlowSurfaceForm} from "../../design-system/flowSurface";
import {CATALOG_STAGE_FIXTURE} from "../../components/orbit/stageFixture";
import {CANONICAL_THEME} from "../../design-system/themeCatalog";
import {catalogBySlug} from "../../design-system/themeCatalog";
import {catalogMotion,catalogMotionStyle} from "../../design-system/themeMotion";
import "./StructurePreview.css";
import type {StageProvider} from '../../components/orbit/stageTypes';

/** Real renderer, isolated from option selection. No timer-driven preview loop. */
export default function StructurePreview({form,anchor=flowSurfaceDefaultAnchor(form),catalog=CANONICAL_THEME.slug,expanded=false,maxWidth=168,maxHeight=112,providers=CATALOG_STAGE_FIXTURE.slice(0,3),showDimensions=false}:{form:FlowSurfaceForm;anchor?:FlowSurfaceAnchor;catalog?:string;expanded?:boolean;maxWidth?:number;maxHeight?:number;providers?:StageProvider[];showDimensions?:boolean}) {
  const state=expanded?"expanded":"compact";
  const size=flowSurfaceEnvelope(form,state,100,3,anchor);
  const fit=Math.min(1,maxWidth/size.width,maxHeight/size.height);
  const theme=catalogBySlug(catalog)??CANONICAL_THEME;
  const motion=catalogMotion(theme);
  return <div className="structure-preview" data-expanded={expanded} data-motion-character={motion.character}
    style={{...(expanded?{height:Math.max(128,size.height*fit+24)}:{}),...catalogMotionStyle(theme)}} ref={element=>element?.setAttribute("inert","")}>
    {showDimensions&&<span className="structure-preview__dimensions">{size.width} × {size.height} px</span>}
    <div className="structure-preview__viewport" style={{width:size.width*fit,height:size.height*fit}}>
      <div className="structure-preview__stage" data-expanded={expanded} style={{width:size.width,height:size.height,transform:`scale(${fit})`}}>
        {/* demoMode supplies synthetic fixture data (no real accounts needed
            for a Settings preview); showDemoBadge=false suppresses the
            "DEMO" watermark each structure renders when demoMode is on —
            redundant here (the surrounding preview-card copy already says
            this doesn't affect the real desktop) and, at this card's small
            scale, it overlapped the structure's own content (Wave 6 Phase 4,
            reported directly by the owner). */}
        <FlowSurface catalog={catalog} state={state} settings={{form,anchor,scale:100,autoHide:false,autoHideDelayMs:500,
          interactions:{hoverDetails:false,wheelCycle:false,autoFold:false,foldDelayMs:500}}} providers={providers} demoMode showDemoBadge={false}/>
      </div>
    </div>
  </div>;
}
