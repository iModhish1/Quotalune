# SHELL-01 — Compact workspace and adjustable sidebar

2026-09-12. Owner request: annotated screenshot `56582426`. Source baseline
`ddceb626`; application candidate `8a925f5e4225`. Engineering/native Dev validation
passed for this slice. Owner visual approval and Personal promotion are separate.

## Delivered behavior

- The common toolbar is compact. Settings' duplicated global introduction and
  category introduction are replaced with one category/context + search strip.
  Search keeps the current editor and its draft mounted.
- A named collapse/expand button sits at logical start: left in English, right
  in Arabic. Collapsing removes navigation from layout, focus and accessibility
  traversal and gives the editor the full width. The recovery button remains visible.
- The boundary has a 10px pointer target, visible line and central grip. Pointer
  capture keeps dragging reliable outside the boundary. Preview is local; release
  writes once through `update_settings`. Cancellation/Escape discards the preview.
- Arrow keys resize in physical direction, Home/End use bounds, double-click
  restores default width. Focus indication and localized labels are provided.
- Width defaults to 232 CSS px and is bounded to 184–360. Below 600px the sidebar
  overlays content; its maximum also respects 80% of the viewport. Viewport changes
  do not overwrite the saved desktop width. Top/bottom navigation stays available.
- Dashboard, Workspace and Settings branches retain their existing hierarchy and
  navigation semantics. Their primary buttons have 44px minimum height and clear
  28px chevron wells. No additional dropdown navigation was introduced.
- Original app/provider logo assets, provider values and analytics contracts remain
  unchanged. No dependencies or new pricing/data computation were introduced.

## Implementation and persistence

`SidebarControls.tsx` owns presentation preview and pointer/keyboard controls.
`WorkspaceLayout.css` owns shared shell geometry. Existing `SettingsShell` and
`ProductNavigation` remain the content/navigation owners. `WorkspacePreferences`
now includes `sidebarWidth` and `sidebarCollapsed` in the frontend bridge and Rust
model. Lenient disk loading defaults corrupt/missing fields individually; runtime
updates normalize bounds. Existing density/navigation writers preserve these fields.
Events from the existing settings hook continue to synchronize mounted windows.

## Source validation

| Check | Result |
|---|---|
| Frontend full suite, final source | 183 files, 1104 passed |
| New sidebar interaction suite | 9 passed; drag/release/cancel, keyboard/RTL, hidden nav, preferences, narrow bounds |
| Rust workspace — desktop | 475 passed, 1 pre-existing ignored, 0 failed |
| Rust workspace — core | 1697 passed, 0 ignored, 0 failed |
| Rust workspace — CLI | 1 passed; doctests 0 |
| Clippy workspace/all targets, warnings denied | Passed |
| Rust formatting | Passed |
| TypeScript and production frontend build | Passed |
| Locale parity | 1463 matching keys; four new EN/AR strings |
| Verified Dev identity tests | 13 passed |
| Focus/skip scan on changed tests | No new focused/skipped tests |
| Diff whitespace and secret scan | Passed |

Existing bundle warnings remain: entry chunk 511.41kB and analytics engine 660.12kB
(223.52kB gzip). This slice does not change the analytics engine. No new benchmark
or blanket performance claim is made.

## Fresh native evidence

Built with `node scripts/build-dev-verified.mjs`; embedded candidate `8a925f5e4225`.
Actual executable: `target/debug/QuotalisDev.exe`.
SHA256: `e33b8491849de8052774051313fa0844e3f7faa44cd118740f8535b15b586552`.
Verified identity: Dev / `QuotaArc-Dev` / `app.quotalis.desktop.dev`.

Native CUA retest on candidate PID 14144, HWND 723524: drag changed persisted width
232 → 292; native toggle hid/reopened sidebar; native Dashboard chevron navigated
and expanded the branch. Initial iteration also exercised RTL drag (292 → 353),
native ArrowRight (232 → 248), and End (360). CUA reported effect as unverifiable;
acceptance is based on the resulting live WebView geometry and settings readback,
not its delivery status alone.

At 1216×688 CSS px, Settings toolbar measured 48.67px and the combined context/search
strip 65.28px. Expanded sidebar 232px; collapsed content 1216px with hidden nav and
no separator. Arabic toggle x=1168 vs English x=12. Dashboard's existing shell
layout measured 64px toolbar; compact geometry is not claimed identical on every
page. Providers and General were also opened and visually inspected.

Native resizing exercised 800×700 and 520×700. The running window enforces a 520px
minimum despite a smaller resize request. A separate WebView viewport override
tested 320×700: saved width 360 is displayed at 256, matching resize bounds;
collapsed content remains full width. It is not represented as a 320px OS window.
No document horizontal overflow or error boundary appeared in these captures.

Reload and application-native Quit/relaunch retained width 280 and collapsed=true
(confirmed on new PID 12552). An earlier forced-stop restart returned a different
tab/collapse state; its cause was not established and that attempt is not accepted
as persistence proof. Abrupt termination durability is not certified by this slice.
Temporary Dev language/presentation preferences were restored and read back; the
proof instance was closed through its native Quit command. Personal was neither
launched nor updated by this UI task.

Historical screenshots were withdrawn from `docs/images/shell01/` on
2026-09-27 because they show the former Quotalis brand and are not current
Quotalune release proof. Audit copies are in ignored
`.local/historical-shell01-04-2026-09-27/shell01/`. The filenames below
describe the earlier test states only:

- `FINAL_NATIVE_WINDOW.png`: CUA Windows capture, original logo, compact settings.
- `FINAL_EN_EXPANDED.png`, `FINAL_EN_COLLAPSED.png`: expanded and full-width editor.
- `FINAL_AR_EXPANDED.png`, `FINAL_AR_NATIVE_800.png`: RTL and actual narrow window.
- `FINAL_AR_NATIVE_520.png`: actual minimum-width overlay.
- `FINAL_AR_VIEWPORT_320.png`, `FINAL_AR_NARROW_COLLAPSED.png`: viewport stress case.
- `FINAL_DASHBOARD.png`, `FINAL_PROVIDERS.png`, `FINAL_GENERAL.png`: shared-shell smoke.
- `FINAL_RESTART_COLLAPSED.png`: graceful restart persistence.

The page-level editors/illustrations retain their existing individual layouts.
This closes the requested shared-header/sidebar correction, not a redesign of every
internal card or a new Analytics acceptance phase. Personal release remains frozen
under the previous handoff constraints.
