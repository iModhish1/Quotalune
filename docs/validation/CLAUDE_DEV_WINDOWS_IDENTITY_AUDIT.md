# Claude Dev Windows identity audit — 2026-09-10

Traced every Dev-only use of the current AUMID (`app.quotaarc.desktop.dev`)
before changing anything, per the request's own mandatory ordering.

## Every reference found

`grep -rln "TOAST_AUMID|app\.quotaarc\.desktop" rust/src apps/desktop-tauri/src-tauri/src apps/desktop-tauri/src-tauri/*.json` (excluding `target/`):

| File | Role |
|---|---|
| `rust/src/paths.rs` | Defines `TOAST_AUMID` (dev-channel: `app.quotaarc.desktop.dev`; stable: `app.quotaarc.desktop`, **not touched**) |
| `rust/src/notifications.rs` | The **only** consumer: `ensure_aumid_registered()` (writes the `HKCU\Software\Classes\AppUserModelId\<AUMID>` registry key used by `CreateToastNotifier`), a `tracing::debug!` log line, and the protocol-scheme registration nearby |
| `apps/desktop-tauri/src-tauri/tauri.conf.json` | `identifier: "app.quotaarc.desktop"` (Personal/stable — **not touched**) |
| `apps/desktop-tauri/src-tauri/tauri.dev.conf.json` | `identifier: "app.quotaarc.desktop.dev"` (Dev — this is the NSIS-built shortcut's own AUMID source, separate from `TOAST_AUMID` but must move together — see below) |

## What does NOT reference the AUMID (confirmed safe to leave alone)

- `APP_DIR_NAME` (`rust/src/paths.rs`) — a separate, hardcoded constant
  (`QuotaArc-Dev` for Dev, `QuotaArc` for stable). The data/config/cache
  root does not derive from the AUMID at all.
- `REGISTRY_RUN_VALUE` (start-at-login `Run` key name) — also a separate
  constant, unrelated to toast identity.
- Single-instance detection (`tauri_plugin_single_instance`) — Tauri's own
  plugin keys its instance-detection mutex/pipe from the Tauri `identifier`
  field, not from `TOAST_AUMID` directly. Since `identifier` and
  `TOAST_AUMID` are currently the same string for Dev by coincidence (both
  `app.quotaarc.desktop.dev`), and this change moves both together (see
  below), single-instance behavior for Dev stays internally consistent —
  it simply changes its own identity string, with zero effect on Personal
  (whose `identifier`/single-instance mutex stay `app.quotaarc.desktop`,
  completely untouched).
- No `SetCurrentProcessExplicitAppUserModelID` call exists anywhere in this
  codebase — the app relies solely on the registry-key-based
  `CreateToastNotifier(AUMID)` path (the documented no-shortcut-required
  mechanism), plus, when installed, the NSIS shortcut's own AUMID property.
- Proof scripts (`scripts/dev-preflight.mjs`) check `channel`, `exe`, and
  `app_dir_name` — **never** the AUMID string itself. No proof-script
  change is required.
- Existing tests (`rust/src/paths.rs::app_dir_name_matches_channel`)
  assert `TOAST_AUMID` per-branch — this needs a value update, not a
  structural change (see the commit that follows this doc).

## Why `identifier` in `tauri.dev.conf.json` must move together with
`TOAST_AUMID`, even though they're logically separate concerns

The whole premise of this wave is testing whether a real Start Menu
shortcut resolves Windows' stale AUMID-display-name cache. An NSIS-built
shortcut's own `System.AppUserModel.ID` property is set by Tauri's NSIS
template from the config's `identifier` field, independent of the
hand-written `TOAST_AUMID` Rust constant. If only `TOAST_AUMID` moved,
the app would register toasts under the NEW AUMID via the registry-only
path but the shortcut would still carry the OLD AUMID — meaning the new
AUMID would have **no shortcut backing it at all**, which is a *weaker*
identity-resolution case than what was already tested and disproven in the
previous pass, not a genuine new test. Both must change together, to the
same new string, for this to be a real test of "does a fresh, never-before-seen
AUMID with a genuine shortcol behave differently from a stale-cached one."

## Decision

**Safe to change.** Scope: `TOAST_AUMID`'s dev-channel branch in
`rust/src/paths.rs` and `identifier` in `tauri.dev.conf.json` only, moving
together to the same new string. Personal's `TOAST_AUMID`
(`app.quotaarc.desktop`), `identifier` (`app.quotaarc.desktop`),
`APP_DIR_NAME`, and `REGISTRY_RUN_VALUE` are untouched in every branch.
`APP_DIR_NAME` (`QuotaArc-Dev`) stays as the Dev data root — no migration,
per the request's own explicit preference for continuity there.

New value chosen: `app.quotalis.desktop.dev` — follows the existing
naming convention (`app.<product>.desktop[.dev]`) with the product name
updated to match the current Quotalis branding, mirroring exactly how
`app.quotaarc.desktop` (stable) would read as `app.quotalis.desktop` in a
hypothetical future Personal rename (not done here — out of scope, no
Personal change).
