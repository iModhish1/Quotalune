export interface ResetLabelCopy { unavailable:string; resetsIn:string; reset:string }
const ENGLISH_RESET_COPY:ResetLabelCopy={unavailable:'Reset unavailable',resetsIn:'Resets in',reset:'Reset'};

/** A provider status is not a countdown. Preserve honest backend descriptions. */
export function resetLabel(description: string,copy:ResetLabelCopy=ENGLISH_RESET_COPY): string {
  const text=description.trim();
  if(!text || text==='—')return copy.unavailable;
  if(/^(no active|unavailable|unknown|not available|resets?\b)/i.test(text))return text;
  if(/^\d/.test(text) && /\d\s*(?:[dhms]\b|days?\b|hours?\b|minutes?\b|weeks?\b|seconds?\b|min\b)/i.test(text))return `${copy.resetsIn} ${text}`;
  return `${copy.reset}: ${text}`;
}
