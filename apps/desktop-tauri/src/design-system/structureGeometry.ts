/**
 * Shared structure geometry / safe-area contract.
 *
 * All three floating-structure render paths (FlowSurface direct,
 * ReelSurface, NotchSurface/NotchDetails — see
 * `docs/validation/STRUCTURE_SYSTEM_AUDIT.md` for the full 14-form
 * registry) draw their own deliberately-tuned per-form geometry. That
 * per-form tuning is real product work and must not be collapsed into one
 * generic rectangle. What was missing was a shared *floor*: a small set of
 * safe-box/safe-inset numbers every render path can layer under its own
 * tuned dimensions so no form's content silently exceeds the box its own
 * `overflow: hidden` container clips against.
 *
 * This module is that floor, not a replacement for per-form CSS. Each
 * render path keeps its own tuned width/height/anchor rules and additionally
 * clamps against these shared minimums via `Math.max()`/CSS `max()`, so a
 * form only grows past its tuned size when real content genuinely needs
 * the extra room (a long provider/plan name, a reset string, a provider
 * row) — never as a redesign of the tuned case.
 *
 * Concrete defect this exists to fix: `.flow-surface__details` (and the
 * NotchDetails/ReelSurface equivalents) use `overflow: hidden` with a
 * fixed per-form height. The focused-provider metric block renders up to
 * three stacked lines (value+label, then a "Resets …" line) below an
 * optional provider-identity row and the header row. When those rows'
 * natural content height exceeds the form's tuned height, the LAST line —
 * almost always the reset text — is the one silently clipped by
 * `overflow: hidden`. That is a structural sizing gap, not a CSS-value
 * typo, so the fix is a shared minimum-content-height contract rather than
 * another one-off pixel nudge.
 */

/** Pixel values below are unscaled; callers multiply by their own
 * `settings.scale` factor (see `scaled()` in FlowSurface.tsx) before use. */

/** Space reserved along the structure's outer edge that must never be
 * covered by content — keeps rounded-corner art and shadow bleed clear. */
export const STRUCTURE_OUTER_SAFE_INSET = 3;

/** Space reserved around Pin/Close/Drag controls so panel content (a long
 * provider name, a wide metric value) can never grow underneath and make a
 * control unreachable or visually ambiguous. */
export const STRUCTURE_CONTROL_SAFE_INSET = 8;

/** Inner padding a details/expanded panel keeps around its own content,
 * independent of the panel's outer tuned size. */
export const STRUCTURE_CONTENT_SAFE_INSET = 10;

/** Minimum clearance kept between a structure and the monitor edge when
 * anchored near a corner/edge, so drag/expand never places any part of the
 * structure fully off-screen. */
export const STRUCTURE_MONITOR_EDGE_CLEARANCE = 12;

/** Minimum side length of the safe box reserved for the provider identity
 * orb (icon) so it is never partially cropped by a neighboring safe box. */
export const STRUCTURE_PROVIDER_ORB_SAFE_BOX = 24;

/** Minimum side length of the safe box reserved for the Quotalis brand
 * mark, independent of Structure Theme — this box's *content* must also
 * never change per brand-identity-stability requirements. */
export const STRUCTURE_BRAND_ORB_SAFE_BOX = 22;

/** Minimum height reserved for a single reset-text line ("Resets in …" /
 * "Reset unavailable") at the structure's smallest supported font scale. */
export const STRUCTURE_RESET_TEXT_SAFE_HEIGHT = 13;

/** Minimum square safe box reserved for a circular progress ring so its
 * stroke is never cropped by an ancestor's `overflow: hidden`. */
export const STRUCTURE_PROGRESS_RING_SAFE_BOX = 30;

/** Row heights used to build up a details panel's minimum content height.
 * These intentionally mirror the real rendered rows in
 * FlowSurface.tsx/NotchDetails.tsx/ReelSurface.tsx (header, optional
 * provider-identity row, metric rows) rather than being invented numbers —
 * see `.flow-surface__detail-header`'s own `min-height: 21px`, which is
 * reused here rather than duplicated with a different value. */
const DETAILS_HEADER_ROW_HEIGHT = 21;
const DETAILS_PROVIDER_IDENTITY_ROW_HEIGHT = 24;
const DETAILS_METRIC_ROW_HEIGHT = 17;
const DETAILS_ROW_GAP = 8;

export interface DetailsContentShape {
  /** Whether the focused-provider identity row (icon + name [+ plan]) renders. */
  hasProviderIdentity: boolean;
  /** Number of stacked lines the metrics block renders — 2 for the plain
   * value+label+reset case ({@link STRUCTURE_RESET_TEXT_SAFE_HEIGHT} is the
   * second row), 1 when a paginated `UsageWindowList` replaces it. */
  metricRows: 1 | 2;
}

/**
 * Computes the minimum content height (unscaled px) a details/expanded
 * panel needs so its real rendered rows are never clipped by the panel's
 * own `overflow: hidden`. Callers combine this with their per-form tuned
 * height via `Math.max(tunedHeight, structureDetailsMinContentHeight(...))`
 * (or the CSS `max()` equivalent) — the tuned height still wins whenever it
 * is already large enough, so deliberate per-form sizing is unaffected.
 */
export function structureDetailsMinContentHeight(shape: DetailsContentShape): number {
  const rows = [DETAILS_HEADER_ROW_HEIGHT];
  if (shape.hasProviderIdentity) rows.push(DETAILS_PROVIDER_IDENTITY_ROW_HEIGHT);
  for (let i = 0; i < shape.metricRows; i += 1) rows.push(DETAILS_METRIC_ROW_HEIGHT);
  const rowsTotal = rows.reduce((sum, row) => sum + row, 0);
  const gapsTotal = DETAILS_ROW_GAP * (rows.length - 1);
  return rowsTotal + gapsTotal + STRUCTURE_CONTENT_SAFE_INSET * 2;
}
