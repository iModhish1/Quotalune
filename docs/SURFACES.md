# Surface Engine

QuotaArc's product idea is a set of small, quiet, always-available *surfaces* — not one widget.
Every surface is optional; the tray alone keeps the product fully functional.

## Surfaces

| Surface | Window label | Shape | Interaction |
|---|---|---|---|
| Edge Arc | `edge-arc` | Vertical glass strip snapped to the right/left screen edge, vertically centered | Hover expands rows to name + percent; optional full click-through |
| Top Arc | `top-arc` | Top-center pill, 10 px below the top edge | Hover morphs the pill into an expanded card (plan badge, reset countdown) |
| Floating bar (inherited) | `floatbar` | Horizontal/vertical capacity strip | Upstream float bar, retained as an alternative surface |
| Tray | native | Tray icon + menu | Status rows, refresh, surface toggles, settings, updates, quit |
| Dashboard | `main`/`flyout` | Full panel | Per-provider cards, usage windows, costs, pace, forecast |

## Architecture

```
src-tauri/src/
  surface_kit.rs     — shared Win32 toolkit: transparent no-activate overlay windows,
                       layered alpha (opacity), WS_EX_TRANSPARENT (click-through),
                       HWND_TOPMOST reassertion, content-fullscreen foreground probe
  surfaces.rs        — Edge Arc + Top Arc lifecycle, typed settings patch/read
                       commands, fullscreen watcher, tray toggle dispatch
```

Frontend surfaces live in `apps/desktop-tauri/src/surfaces/{edge-arc,top-arc}/` and are routed by
window label in `App.tsx`. Both consume provider data through the shared `useProviders` hook —
the exact same cache and event stream as the tray and dashboard, so all surfaces agree.

## Native behavior contracts

- **No activation**: surfaces never steal focus (WS_EX_NOACTIVATE); clicking them does not
  defocus the active app.
- **No taskbar / no Alt+Tab pollution**: `skip_taskbar(true)` on all surface windows.
- **Always on top**: set at build, reasserted on every Moved/Resized/Focused event and after
  resize (z-order can drop across SetWindowPos calls).
- **DPI**: all positioning math is done in logical pixels via the window's live `scale_factor()`.
- **Monitor loss**: surfaces re-resolve `current_monitor()` on every show/resize; if the saved
  monitor is gone the placement falls to the current monitor. Geometry is never persisted
  parked/minimized (the -32000 park rule from upstream floatbar applies to floatbar).
- **Fullscreen/gaming**: a 3-second watcher (runs only while a surface window exists) probes the
  foreground window; a borderless/popup window covering ≥92% of its monitor is treated as
  content-fullscreen and surfaces hide themselves (per-surface setting, default ON). Browser F11
  and normal maximized windows keep a caption and are not treated as fullscreen.
- **Idle cost**: the watcher parks when no surface window exists; surfaces never animate unless
  provider data changes.

## Settings

Owned by `codexbar::settings::Settings` (fields `edge_arc_*`, `top_arc_*`), serde-defaulted so
existing settings files load unchanged. Ranges: opacity 30..=100, scale 75..=200. Edited live in
Settings → Surfaces (`update_surface_settings` command) or toggled from the tray menu.

## Testing

- Rust: `apps/desktop-tauri/src-tauri/src/surfaces.rs` tests cover patch clamping/normalization.
- The E2E path (window creation, positioning, seeded provider data, topmost) is validated with
  `CODEXBAR_SEED_USAGE_JSON=<path>` + the proof-harness pattern on native Windows.
