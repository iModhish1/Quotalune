import {useEffect, useRef, useState} from "react";
import {useLocale} from "../../hooks/useLocale";
import type {SettingsUpdate, WorkspacePreferences} from "../../types/bridge";

export const SIDEBAR_DEFAULT = 232;
export const SIDEBAR_MIN = 184;
export const SIDEBAR_MAX = 360;
export function clampSidebarWidth(width = SIDEBAR_DEFAULT, maximum = SIDEBAR_MAX): number {
  return Math.round(Math.max(SIDEBAR_MIN, Math.min(maximum, Number.isFinite(width) ? width : SIDEBAR_DEFAULT)));
}

/** Preview locally while dragging; only release persists through the shared settings authority. */
export function useSidebarLayout(preferences: WorkspacePreferences | null | undefined,
  navigation: WorkspacePreferences["navigation"], update: (patch: SettingsUpdate) => Promise<void>) {
  const [preview, setPreview] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  // Match the narrow overlay's 80vw boundary without overwriting the saved desktop width.
  const maxWidth = viewportWidth <= 600 ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.floor(viewportWidth * .8))) : SIDEBAR_MAX;
  const width = clampSidebarWidth(preview ?? preferences?.sidebarWidth, maxWidth);
  const persist = async (patch: Partial<WorkspacePreferences>) => {
    await update({workspacePreferences: {density: "comfortable", ...preferences, navigation, ...patch}});
  };
  return {
    width,
    maxWidth,
    collapsed: navigation === "side" && Boolean(preferences?.sidebarCollapsed),
    preview: setPreview,
    resize: async (next: number) => {
      try { await persist({sidebarWidth: clampSidebarWidth(next)}); }
      finally { setPreview(null); }
    },
    toggle: () => persist({sidebarCollapsed: !preferences?.sidebarCollapsed}),
  };
}

export function SidebarToggle({collapsed, onToggle, disabled}: {
  collapsed: boolean; onToggle: () => void; disabled?: boolean;
}) {
  const {t} = useLocale();
  const label = t(collapsed ? "WorkspaceExpandSidebar" : "WorkspaceCollapseSidebar");
  return <button className="workspace-sidebar-toggle" type="button" title={label} aria-label={label}
    aria-controls="product-navigation" aria-expanded={!collapsed} disabled={disabled} onClick={onToggle}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>
      <path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"}/>
    </svg>
  </button>;
}

export function SidebarResizeHandle({width, maxWidth = SIDEBAR_MAX, onPreview, onCommit, disabled, className = "", controls = "product-navigation"}: {
  width: number; onPreview: (width: number | null) => void;
  onCommit: (width: number) => void; disabled?: boolean; maxWidth?: number; className?: string; controls?: string;
}) {
  const {t} = useLocale();
  const drag = useRef<{id: number; x: number; start: number; width: number; sign: number; cleanup: () => void} | null>(null);
  const [dragging, setDragging] = useState(false);
  const cancel = () => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    active.cleanup();
    setDragging(false);
    onPreview(null);
  };
  useEffect(() => () => {
    const active = drag.current;
    drag.current = null;
    active?.cleanup();
  }, []);
  return <div className={`workspace-sidebar-resizer ${className}`} data-dragging={dragging} role="separator" tabIndex={disabled ? -1 : 0}
    aria-label={t("WorkspaceResizeSidebar")} title={t("WorkspaceResizeSidebarHelp")}
    aria-controls={controls} aria-orientation="vertical" aria-valuemin={SIDEBAR_MIN}
    aria-valuemax={maxWidth} aria-valuenow={width} aria-disabled={disabled || undefined}
    onPointerDown={event => {
      if (disabled || event.button !== 0 || drag.current) return;
      event.preventDefault();
      const handle = event.currentTarget;
      handle.focus();
      // WebView2 can deliver moves outside this narrow handle even after capture.
      // Window listeners keep the gesture intact and are removed on every exit.
      const move = (next: globalThis.PointerEvent) => {
        const active = drag.current;
        if (!active || active.id !== next.pointerId) return;
        active.width = clampSidebarWidth(active.start + (next.clientX - active.x) * active.sign, maxWidth);
        onPreview(active.width);
      };
      const finish = (next: globalThis.PointerEvent) => {
        const active = drag.current;
        if (!active || active.id !== next.pointerId) return;
        move(next);
        drag.current = null;
        active.cleanup();
        setDragging(false);
        if (active.width !== active.start) onCommit(active.width);
        else onPreview(null);
      };
      const pointerCancel = (next: globalThis.PointerEvent) => {
        if (drag.current?.id === next.pointerId) cancel();
      };
      const pointerId = event.pointerId;
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", pointerCancel);
        window.removeEventListener("blur", cancel);
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      };
      drag.current = {id: event.pointerId, x: event.clientX, start: width, width,
        sign: getComputedStyle(handle).direction === "rtl" ? -1 : 1, cleanup};
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", pointerCancel);
      window.addEventListener("blur", cancel);
      handle.setPointerCapture(pointerId);
      setDragging(true);
    }}
    onLostPointerCapture={() => { if (drag.current) cancel(); }}
    onDoubleClick={() => { if (!disabled) onCommit(clampSidebarWidth(SIDEBAR_DEFAULT, maxWidth)); }}
    onKeyDown={event => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        cancel();
        return;
      }
      if (disabled || drag.current || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const sign = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
      const next = event.key === "Home" ? SIDEBAR_MIN : event.key === "End" ? maxWidth
        : clampSidebarWidth(width + (event.key === "ArrowRight" ? 16 : -16) * sign, maxWidth);
      if (next !== width) onCommit(next);
    }}><span aria-hidden="true"/></div>;
}
