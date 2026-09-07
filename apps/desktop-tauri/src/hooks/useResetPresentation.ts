import { useEffect, useMemo, useState } from "react";
import { useResetStageOptions } from "./useResetStageOptions";
import {
  formatResetPresentation,
  type ResetPresentationConfig,
  type ResetPresentationResult,
} from "../lib/resetPresentation";

/**
 * Live, locale-correct reset-time presentation for a provider's `resetsAt`
 * instant, backed by the production `formatResetPresentation` pipeline.
 *
 * Re-renders only as often as the enabled modules actually need to change
 * (see `countdownRefreshMs` on the result) -- never a bare 1-second loop.
 */
export function useResetPresentation(
  resetAt: string | null,
  config?: Partial<ResetPresentationConfig>,
): ResetPresentationResult | null {
  const { locale, translate } = useResetStageOptions();
  const [now, setNow] = useState(() => Date.now());

  const result = useMemo(() => {
    if (!resetAt) return null;
    return formatResetPresentation({ resetAt, now, locale: locale!, config, translate });
  }, [resetAt, now, locale, config, translate]);

  useEffect(() => {
    if (!resetAt || !result?.countdownRefreshMs) return;
    const id = window.setInterval(() => setNow(Date.now()), result.countdownRefreshMs);
    return () => window.clearInterval(id);
  }, [resetAt, result?.countdownRefreshMs]);

  return result;
}
