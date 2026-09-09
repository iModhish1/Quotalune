import type {CSSProperties} from "react";
import {ProviderIcon} from "../../../components/providers/ProviderIcon";
import {providerCreditsColor} from "../../../components/charts/chartPalette";

/** Decorative globe; the only quantitative geometry is the physical used-% arc.
 * Original bundled provider artwork stays intact above the texture. */
export default function ProviderPlanet({providerId, used, small=false, color}: {
  providerId:string; used:number|null; small?:boolean;color?:string;
}) {
  return <span className={`provider-planet${small ? " provider-planet--small" : ""}`} data-provider={providerId}
    style={{"--planet-color":color??providerCreditsColor(providerId)} as CSSProperties} aria-hidden="true">
    <span className="provider-planet__surface"/>
    <svg className="provider-planet__orbit" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="56" className="provider-planet__track"/>
      {used!==null && <circle cx="60" cy="60" r="56" pathLength="100" strokeDasharray={`${used} 100`} className="provider-planet__arc"/>}
    </svg>
    <ProviderIcon providerId={providerId} size={small ? 30 : 46}/>
  </span>;
}
