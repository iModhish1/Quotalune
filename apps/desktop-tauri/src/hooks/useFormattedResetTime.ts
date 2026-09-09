import { resolveIntlLocale } from "../i18n/resolveIntlLocale";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "./useLocale";
import { computeCountdownParts, countdownRefreshIntervalMs } from "../lib/resetPresentation";

export type ResetTimeFormatMode = "reset" | "expires";

/**
 * Format a provider's reset timestamp for display.
 *
 * When `relative` is true, returns a live countdown string. `mode` selects
 * reset wording ("Resets in …") vs expiry wording ("Next expires in …").
 *
 * When `relative` is false, returns the absolute reset time converted to
 * the user's local timezone via `Intl.DateTimeFormat`.
 *
 * Falls back to `fallback` (typically the backend's `resetDescription`) when
 * `resetsAt` is absent or unparseable.
 *
 * The day/hour/minute *tiering* is delegated to the same
 * `computeCountdownParts` the production `resetPresentation.ts` pipeline
 * uses -- this hook no longer buckets a duration into days/hours/minutes
 * itself, so there is exactly one place that logic lives. What this hook
 * still owns, and `resetPresentation.ts` does not, is the "reset" vs.
 * "expires" sentence-wording choice (cost-window expiry uses different
 * locale keys than a quota reset) -- that distinction is real product
 * semantics specific to this hook's callers, not duplicated tiering logic.
 */
export function useFormattedResetTime(
  resetsAt: string | null,
  fallback: string | null,
  relative: boolean,
  mode: ResetTimeFormatMode = "reset",
): string | null {
  const { t, language } = useLocale();
  const absoluteResetFormatter = useMemo(() => new Intl.DateTimeFormat(resolveIntlLocale(language), {month:"short",day:"numeric",hour:"numeric",minute:"2-digit",numberingSystem:"latn"}), [language]);
  const [now, setNow] = useState(() => Date.now());

  const target = resetsAt ? Date.parse(resetsAt) : Number.NaN;
  const parts =
    resetsAt && !Number.isNaN(target) ? computeCountdownParts(target - now, "adaptive") : null;

  useEffect(() => {
    if (!resetsAt || !relative || !parts) return;
    const intervalMs = countdownRefreshIntervalMs(parts.tier);
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-registers
    // only when the countdown crosses into a new refresh tier, not on
    // every `now` tick.
  }, [resetsAt, relative, parts?.tier]);

  if (!resetsAt) {
    return fallback;
  }
  if (Number.isNaN(target) || !parts) {
    return fallback;
  }

  if (relative) {
    switch (parts.tier) {
      case "expired":
        return t(mode === "expires" ? "NextExpiresDueNow" : "TrayResetsDueNow");
      case "lessThanMinute": {
        const key = mode === "expires" ? "NextExpiresInMinutes" : "ResetsInMinutes";
        return t(key).replace("{}", "0");
      }
      case "day": {
        const key = mode === "expires" ? "NextExpiresInDaysHours" : "ResetsInDaysHours";
        return t(key)
          .replace("{}", String(parts.days))
          .replace("{}", String(parts.hours));
      }
      case "hour": {
        const key = mode === "expires" ? "NextExpiresInHoursMinutes" : "ResetsInHoursMinutes";
        return t(key)
          .replace("{}", String(parts.hours))
          .replace("{}", String(parts.minutes));
      }
      case "minute": {
        const key = mode === "expires" ? "NextExpiresInMinutes" : "ResetsInMinutes";
        return t(key).replace("{}", String(parts.minutes));
      }
    }
  }

  try {
    return absoluteResetFormatter.format(new Date(target));
  } catch {
    return fallback;
  }
}
