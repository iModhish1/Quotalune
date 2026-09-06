# Native OS-level input matrix — 0.10.1

## What was attempted

A real (not CDP/DOM-synthetic) OS-level input test: launched a fresh Dev
binary, opened the native Settings window, brought it to the foreground via
`SetForegroundWindow` (Win32, confirmed the correct HWND by PID+title match),
and sent real `Tab` keypresses via `System.Windows.Forms.SendKeys` from
PowerShell.

## Result: this environment cannot deliver real OS input reliably — reported honestly, not glossed over

`SendKeys.SendWait` returned a benign-looking "operation completed
successfully" exception (a known quirk when no genuine interactive input
session backs the call) — but checking `document.activeElement` afterward via
WebView2 DevTools showed focus never left `<body>`. The keypresses did not
reach the application. This automated session does not have a genuine
interactive Windows input session attached (no real keyboard/mouse hardware
event injection path), so `SendKeys` (and by extension any other synthetic
Win32 input-injection approach available from this session) cannot be trusted
as OS-level input proof here.

This matters and is called out explicitly rather than quietly working around
it with CDP: CDP's `Input.dispatchKeyEvent` / DOM `KeyboardEvent` dispatch
(used throughout this session's other native captures, and by
`ProviderIdentityThemeMatrix.test.tsx`-style component tests) exercises the
same JS event handlers a real keypress would — but it does **not** prove the
OS itself routes a real keyboard/mouse event to the right HWND, through the
right WebView2 accessibility tree, respecting real Z-order/focus/IME state.
Both this session's CDP-driven checks and unit tests already cover the
former; only real hardware/input covers the latter.

## What is genuinely still open

- **Tab / Shift+Tab / Arrow keys / Home / End / Enter / Space / Escape** as
  real OS keystrokes, and **real mouse** clicks/hover/drag, on: Settings (all
  11 destinations), the Collections window, the tray flyout, and the
  Provider Display identity gallery/cards.
- **UIAutomation/accessibility tree** verification (e.g. via Windows
  Accessibility Insights) — not attempted; needs a human or a UIA-capable
  test harness with real input session access, neither available here.

## Recommendation

This is a genuine environment blocker for *this specific session*, not a
permanently unfixable gap: it needs either the owner doing a short manual
pass on their own machine (a five-minute Tab-through of Settings + the
Collections window + Escape-to-close would cover the highest-value cases), or
a CI/test runner with a real attached interactive desktop session (most
Windows CI runners support this; this sandboxed session apparently does not).
Marking this open rather than claiming it passed.
