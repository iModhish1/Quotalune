import {render} from "@testing-library/react";
import {describe,expect,it} from "vitest";

import {ALL_FLOW_SURFACE_ANCHORS,FLOW_SURFACE_FORM_CATALOG} from "../../design-system/flowSurface";
import {THEME_CATALOG} from "../../design-system/themeCatalog";
import {catalogMotion} from "../../design-system/themeMotion";
import StructurePreview from "./StructurePreview";

describe.each(THEME_CATALOG)("theme and structure compatibility: $slug",(theme)=>{
  // Keep the complete Cartesian matrix, but give each identity/view its own
  // failure location and time budget instead of timing the entire catalog.
  it.each([false,true])("renders every structure and anchor (expanded=%s)",(state)=>{
    for(const form of FLOW_SURFACE_FORM_CATALOG){
      for(const anchor of ALL_FLOW_SURFACE_ANCHORS){
        const key=`${theme.slug}/${form.id}/${anchor}/${state?"expanded":"compact"}`;
        const {container,unmount}=render(<StructurePreview form={form.id} anchor={anchor} catalog={theme.slug} expanded={state}/>);
        const preview=container.querySelector<HTMLElement>(".structure-preview");
        const surface=container.querySelector<HTMLElement>("[data-testid='flow-surface'],.notch-host,.reel-host");
        const anchored=container.querySelector<HTMLElement>("[data-anchor]");
        expect(preview,`${key} preview`).not.toBeNull();
        expect(surface,`${key} renderer`).not.toBeNull();
        expect(anchored,`${key} anchor`).toHaveAttribute("data-anchor",anchor);
        expect(preview).toHaveAttribute("data-expanded",String(state));
        expect(preview).toHaveAttribute("data-motion-character",catalogMotion(theme).character);
        expect(surface!.style.getPropertyValue("--surface-inlay")).toBe(theme.identity!.inlay);
        expect(surface!.style.getPropertyValue("--surface-meter-cap")).toBe(theme.identity!.meterCap);
        expect(surface!.style.getPropertyValue("--surface-connector")).toBe(theme.identity!.connector);
        unmount();
      }
    }
  },15_000);
});
