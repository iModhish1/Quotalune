/**
 * Shared Pin control for every floating-structure detail panel
 * (FlowSurface, ReelSurface, NotchDetails). Extracted after finding the
 * three independent render paths had drifted: FlowSurface already carries
 * a "Wave 6 Phase 4" correction replacing an ambiguous ⌖ crosshair glyph
 * with a real pin icon and a dynamic Pin/Unpin aria-label, but that fix
 * was never propagated — ReelSurface still rendered the old ⌖ glyph with
 * a static "Pin details" label (wrong even while already pinned), and
 * NotchDetails rendered plain "Pin"/"Unpin" text with no icon at all.
 * Centralizing the markup here means a future refinement can't silently
 * fail to reach the other two paths again.
 */
export function StructurePinButton({
  className,
  pinned,
  onTogglePinned,
}: {
  className?: string;
  pinned: boolean;
  onTogglePinned?: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onTogglePinned}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin details" : "Pin details"}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 1.5c-1.4 0-2.5 1.1-2.5 2.5 0 .9.3 1.9.7 2.7L4 9.8c-.3.4-.1 1 .4 1h3.1v3.2c0 .3.2.5.5.5s.5-.2.5-.5V10.8h3.1c.5 0 .7-.6.4-1l-2.2-3.1c.4-.8.7-1.8.7-2.7 0-1.4-1.1-2.5-2.5-2.5Z" />
      </svg>
    </button>
  );
}
