import type {LocaleKey} from "../../i18n/keys";
/** Translate only recognized canonical window labels; retain provider-defined names. */
export function physicalWindowLabel(label:string|null|undefined,t:(key:LocaleKey)=>string):string {
  const key=label?.trim().toLowerCase();
  return key==="monthly"?t("V24Monthly"):key==="weekly"?t("V24Weekly"):key==="session"?t("V24Session"):label || t("V2PhysicalWindow");
}


export function observedAccountLabel(row:{provider:string;accountId:string;accountScope:string},rows:readonly {provider:string;accountId:string;accountScope:string}[],t:(key:LocaleKey)=>string) {
  if(row.accountScope!=="observed") return t("V2IdentityUnknown");
  const accounts=[...new Set(rows.filter(item=>item.provider===row.provider&&item.accountScope==="observed").map(item=>item.accountId))].sort();
  return `${t("V24AccountScope")} ${accounts.indexOf(row.accountId)+1}`;
}
