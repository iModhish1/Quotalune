/** One decorative transform per input frame, at most 30Hz; zero idle scheduling. */
export function attachBackgroundInteraction(root: HTMLElement, glow: HTMLElement) {
  let frame = 0;
  let lastPaint = -Infinity;
  let x = 0, y = 0;
  let active = document.visibilityState === "visible" && document.hasFocus();
  const clear = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    glow.style.opacity = "0";
  };
  const paint = () => {
    frame = 0;
    if (!active) return;
    const rect = root.getBoundingClientRect();
    glow.style.transform = `translate3d(${Math.round(x - rect.left - 180)}px,${Math.round(y - rect.top - 180)}px,0)`;
    glow.style.opacity = "1";
    // RAF's frame timestamp can precede this callback; use the same clock as input.
    lastPaint = performance.now();
  };
  const move = (event: PointerEvent) => {
    if (!active || event.pointerType === "touch") return;
    x = event.clientX; y = event.clientY;
    if (!frame && performance.now() - lastPaint >= 1000 / 30) frame = requestAnimationFrame(paint);
  };
  const blur = () => { active = false; clear(); };
  const focus = () => { active = document.visibilityState === "visible"; };
  const visibility = () => { active = document.visibilityState === "visible" && document.hasFocus(); if (!active) clear(); };
  root.addEventListener("pointermove", move, {passive: true});
  root.addEventListener("pointerleave", clear);
  window.addEventListener("blur", blur);
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    clear();
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerleave", clear);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", focus);
    document.removeEventListener("visibilitychange", visibility);
  };
}
