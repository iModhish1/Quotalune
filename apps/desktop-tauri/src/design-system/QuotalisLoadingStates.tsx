import { useLocale } from "../hooks/useLocale";
import type { LocaleKey } from "../i18n/keys";
import "./QuotalisLoadingStates.css";

/**
 * Wave 1B §38: the shared Quotalis loading visual language. Deliberately a
 * small API (§38 "do not build six giant components") reusing the same
 * obsidian/titanium shimmer material `DashboardHost.css`'s skeleton already
 * established (`--qa-material-raised` color-mix gradient, reduced-motion
 * guarded) rather than inventing a second visual language for it.
 *
 * `QuotalisAsyncState` covers the five states where there is nothing of the
 * caller's own to show yet: `loading` (first load, no cached data),
 * `noData`, `unavailable`, `error`, `timeout`. It intentionally does NOT
 * have a `zero` or `refreshing` variant:
 *
 * - **Real zero (§42)** is not a loading state at all — it is real,
 *   successfully-loaded data whose value happens to be 0. The caller
 *   renders its own real value UI directly; nothing in this module ever
 *   substitutes a "No data"/"Unavailable" message for an observed zero.
 *   That is a caller-side contract this module cannot enforce by itself,
 *   which is exactly why it is not one of this component's own states —
 *   folding "zero" in here would invite exactly the bug §42 warns about.
 * - **Refreshing (§41)** is additive, not a full-state replacement: valid
 *   cached data stays on screen and a small `QuotalisRefreshingBadge` is
 *   rendered alongside it. Use `QuotalisAsyncState` only for the *first*
 *   load with nothing cached yet.
 */
export type QuotalisAsyncStatus = "loading" | "noData" | "unavailable" | "error" | "timeout";

export interface QuotalisAsyncStateProps {
  status: QuotalisAsyncStatus;
  /** Required for "unavailable"/"error"/"timeout"; ignored for "loading"/"noData". */
  message?: string;
  /** Shown only for "error"/"timeout" when provided. Never shown for the other statuses. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Number of skeleton bars to render for "loading". */
  skeletonRows?: number;
}

/**
 * One real, static message per status — the reason all five read as
 * distinct UI, not a "Retry" test asserting they're merely different
 * *props*. §43: "Unavailable" never quietly becomes "0%"/"$0"/"reset now";
 * §45: Timeout gets its own message, not folded into a generic error.
 * Localized (§24) via the shared locale system — no hardcoded English.
 */
const DEFAULT_MESSAGE_LOCALE_KEY: Record<Exclude<QuotalisAsyncStatus, "loading">, LocaleKey> = {
  noData: "QuotalisLoadingNoData",
  unavailable: "QuotalisLoadingUnavailable",
  error: "QuotalisLoadingError",
  timeout: "QuotalisLoadingTimeout",
};

export function QuotalisAsyncState({
  status,
  message,
  onRetry,
  retryLabel,
  skeletonRows = 3,
}: QuotalisAsyncStateProps) {
  const { t } = useLocale();
  if (status === "loading") {
    return <QuotalisSkeleton rows={skeletonRows} />;
  }
  const resolvedMessage = message ?? t(DEFAULT_MESSAGE_LOCALE_KEY[status]);
  const resolvedRetryLabel = retryLabel ?? t("QuotalisLoadingRetry");
  return (
    <div className="quotalis-async-state" data-status={status} role={status === "error" || status === "timeout" ? "alert" : "status"}>
      <p className="quotalis-async-state__message">{resolvedMessage}</p>
      {/* Retry is only ever offered for a genuinely retryable condition —
          "no data" (nothing has loaded because nothing exists yet) and
          "unavailable" (the provider/surface itself doesn't support this)
          are not failures a retry would fix, so no button is rendered for
          them even if a caller passes onRetry by mistake. */}
      {(status === "error" || status === "timeout") && onRetry && (
        <button type="button" className="quotalis-async-state__retry" onClick={onRetry}>
          {resolvedRetryLabel}
        </button>
      )}
    </div>
  );
}

/** Standalone skeleton, also used internally by QuotalisAsyncState's
 * "loading" status. Obsidian/titanium shimmer, static under reduced motion
 * (handled entirely in CSS — see QuotalisLoadingStates.css). */
export function QuotalisSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="quotalis-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="quotalis-skeleton__bar" key={i} />
      ))}
    </div>
  );
}

/**
 * §41: rendered ALONGSIDE cached content during a background refresh —
 * never replaces it. Small, quiet, no full-content blur (§39).
 *
 * `dotOnly` (Wave 1E §18): for a caller with no room for visible text (a
 * tight compact structure silhouette that must not resize/reflow —
 * FlowSurface's `orbital`/`petal`/`lens` forms hide even their own
 * provider-name text in this state), renders only the pulsing dot
 * visually while keeping the same `role="status"` text for assistive
 * tech via `aria-label` instead of visible content. The dot alone is
 * still a real, visible "something is updating" signal — not silently
 * dropped, just not laid out as flowing text.
 */
export function QuotalisRefreshingBadge({ label, dotOnly = false }: { label?: string; dotOnly?: boolean }) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("QuotalisLoadingUpdating");
  if (dotOnly) {
    return (
      <span className="quotalis-refreshing-badge quotalis-refreshing-badge--dot-only" role="status" aria-label={resolvedLabel}>
        <span className="quotalis-refreshing-badge__dot" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="quotalis-refreshing-badge" role="status">
      <span className="quotalis-refreshing-badge__dot" aria-hidden="true" />
      {resolvedLabel}
    </span>
  );
}
