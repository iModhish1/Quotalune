import type { CSSProperties } from "react";
import type { CatalogTheme } from "./themeCatalog";
import "./surfaceMaterial.css";

/** One identity contract for every renderer. Native footprint and provider data stay independent. */
export function surfaceMaterialStyle(theme: CatalogTheme): CSSProperties {
  return {
    "--surface-core": theme.core,
    "--surface-detail-radius": `${theme.identity?.detailRadius??18}px`,
    "--surface-edge-style": theme.identity?.edgeStyle??'solid',
    "--surface-relief": theme.identity?.relief??'inset 0 1px 0 #ffffff28',
    "--surface-rim-size": String(theme.identity?.rimSize??1),
    "--surface-icon-radius": theme.identity?.iconRadius??'50%',
    "--surface-label-tracking": theme.identity?.labelTracking??'0',
    "--surface-ornament": theme.identity?.ornament??'none',
    "--surface-accent-halo": theme.identity?.accentHalo??'none',
    "--surface-inlay": theme.identity?.inlay??'1px solid transparent',
    "--surface-meter-cap": theme.identity?.meterCap??'round',
    "--surface-connector": theme.identity?.connector??theme.coreEdge,
    "--surface-mark-filter": theme.identity?.markFilter??'none',
    "--surface-mark-frame": theme.identity?.markFrame??'linear-gradient(145deg,#303640,#07090d)',
    "--surface-mark-border": theme.identity?.markBorder??'#dce4ee',
    "--surface-mark-blend": theme.identity?.markBlend??'screen',
    "--surface-label-font": theme.identity?.font==='mono'?'"Cascadia Mono",Consolas,monospace':'"Segoe UI Variable","Segoe UI",sans-serif',
    "--surface-raised": theme.bg[0],
    "--surface-edge": theme.coreEdge,
    "--surface-text": theme.material?.text ?? "#f0f3f7",
    "--surface-muted": theme.material?.muted ?? "#b1bcc7",
    "--surface-finish": theme.material?.finish ?? "linear-gradient(135deg, #ffffff0c, transparent 55%)",
    "--surface-sheen": theme.material?.sheen ?? "#ffffff28",
    "--surface-meter": theme.material?.light ? "#c0c9cf" : "#38424b",
  } as CSSProperties;
}
