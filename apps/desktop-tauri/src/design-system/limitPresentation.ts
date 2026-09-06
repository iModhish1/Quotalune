export interface LimitPresentation {
  shape:'horizontal'|'vertical'|'ring';
  content:'bar'|'both'|'value';
  direction:'forward'|'reverse';
  identity?:ProviderPresentationIdentity;
}
export const PROVIDER_PRESENTATION_IDENTITIES=[
  'adaptive','precision','glass','pearl','prism','mono','signal','luxe',
  'frost','ember','jade','rose','cobalt','bronze','paper','ultraviolet',
  'midnight','aerogel','porcelain','champagne','terracotta','cyberlime','graphite','royal',
] as const;
export type ProviderPresentationIdentity=(typeof PROVIDER_PRESENTATION_IDENTITIES)[number];
export const DEFAULT_LIMIT_PRESENTATION:LimitPresentation={shape:'horizontal',content:'both',direction:'forward',identity:'adaptive'};

export function resolveLimitPresentation(
  globalPresentation:LimitPresentation|undefined,
  providerPresentation:LimitPresentation|undefined,
):LimitPresentation {
  return providerPresentation??globalPresentation??DEFAULT_LIMIT_PRESENTATION;
}
export function isLimitPresentation(value:unknown):value is LimitPresentation {
  if(!value||typeof value!=='object')return false;
  const v=value as Record<string,unknown>;
  return ['horizontal','vertical','ring'].includes(String(v.shape)) &&
    ['bar','both','value'].includes(String(v.content)) && ['forward','reverse'].includes(String(v.direction)) &&
    (v.identity==null || (PROVIDER_PRESENTATION_IDENTITIES as readonly string[]).includes(String(v.identity)));
}
