# Publication and native-evidence status — Quotalune

Date: 2026-09-26. Working branch `release/quotalune-integration`, HEAD
`1fdf1d0a15c5faf717dbe9a384d54e742d33ab5e`.

## Repository rename

The owner repository was renamed from `iModhish1/Quotalis` to
`iModhish1/Quotalune`.

- `https://github.com/iModhish1/Quotalis` now answers `301` and redirects to
  the renamed repository, so existing links and the v0.11.0 release URL keep
  working.
- The published `v0.11.0` release and its `v0.11.0` tag are unchanged:
  still published on 2026-09-13, still marked Latest, not a draft or
  prerelease. Nothing about the historical release was retargeted or
  overwritten.
- No history was rewritten. `main` advanced by fast-forward only; the owner's
  previous `main` head `dde6b262` is a strict ancestor of the current head.

## Public presentation

| Field | Value |
| --- | --- |
| Description | Windows-first, local-first desktop app for AI provider quotas, resets and usage history. Quotalune keeps Codex, Claude, Cursor and 60+ providers in one customizable workspace. No account, no cloud dependency, no telemetry. |
| Homepage | https://github.com/iModhish1/Quotalune |
| License | MIT |
| Visibility | public |
| Default branch | main |
| Topics | ai, analytics, claude, codex, dashboard, desktop-app, local-first, open-source, privacy, quota, react, rust, tauri, usage-tracking, windows |

The README now carries three real interface previews captured from a
freshness-proven Windows build, cropped to the application window so no
operating-system title bar is shown. The gallery states plainly that only the
Settings surfaces are captured so far.

## CI

| Run | Commit | Result |
| --- | --- | --- |
| 36212728173 | c8a76e39 | failure — one test |
| 36213734968 | 1fdf1d0a | success |
| 36214389620 | 20287078 | success |
| 36214828487 | bba1d74e | failure — three tests |
| 36215467841 | 450912e0 | **success** |

The first CI run failed on exactly one test,
`providers::antigravity::tests::powershell_discovery_cmdlets_are_available_without_a_user_profile`,
which panicked with `cmdlet discovery: Timeout`. The cause was environmental:
the test asserted a host precondition by spawning a real PowerShell through the
production probe helper, whose 15s `PROBE_TIMEOUT` a cold GitHub Windows runner
can exceed while autoloading the NetTCPIP module. A `#[cfg(test)]`-only helper
with a 120s budget now backs those environment probes. `PROBE_TIMEOUT` itself is
unchanged, because it is a user-facing responsiveness guarantee for interactive
provider probes and must not be weakened to satisfy a test.

The next failure was the same root cause in three different tests, none of which
this work changes behaviour in, and all of which pass locally:

- `claude_signature_probe_never_loads_user_shadow_module` timed out. It asserts a
  real security property by running PowerShell with an isolated `PSModulePath`
  and calling `Get-AuthenticodeSignature`. It now shares the single
  `ENV_PROBE_TIMEOUT` constant with the Antigravity probe.
- `live_pty_cancellation_returns_before_wall_timeout` required cancellation in
  under 5s. The property that matters is that cancellation returns well before
  the command's own 15s timeout, so the bound is now 10s and still
  distinguishes cancel from timeout.
- `aborting_async_owner_stops_a_live_pty_worker` required the PTY child to
  create its readiness marker within 5s. Readiness is "the child ran our
  command", not a performance measurement, so the deadline is 30s. The
  abort-and-terminate assertions are untouched.

`PROBE_TIMEOUT` remains 15s throughout. The final run is green on both required
jobs: `Rust fmt / clippy / test` and `Frontend locale / typecheck / tests`.

## Settings-tab whitelist drift

`surface_target.rs` documents that its `SETTINGS_TAB_IDS` whitelist must mirror
the frontend `SettingsTabId` union, and its own regression comment records that
this drift had already happened once before.

`analyticsSources` had drifted. It is declared in the frontend `SettingsTabId`
union, listed in the live `TAB_META`, rendered by `Settings.tsx` as
`<AnalyticsSourcesTab />`, categorised in the settings centre and covered by
frontend tests — but it appeared nowhere in Rust. The consequence was real, not
cosmetic: `settings:analyticsSources` was rejected by the proof harness, and
`commands/settings.rs` silently discarded a persisted `lastSettingsTab` of
`analyticsSources` while `main.rs` filtered it out of startup routing, so the
tab did not round-trip.

The entry is restored, and a structural test now parses the `SettingsTabId`
union out of `bridge.ts` at compile time and fails if the whitelist rejects any
tab the frontend declares. That guard is proven rather than assumed: removing
the entry makes it fail with the offending tab named, and restoring it passes.

`surface_target.rs` is the only place in the Rust tree that claims to mirror a
frontend list, so this was the only instance of the defect class.

## Native visual evidence

See `PHASE_NATIVE_VISUAL_EVIDENCE.md`.

- The earlier all-black capture was a tooling-path failure, not an application
  defect: every desktop MCP returned `unsupported call`, and the capture path in
  use produced a blank frame.
- Driving the sanctioned Desktop Visual QA stack through its guarded
  `scripts/mcp-client.mjs` adapter, a freshness-proven Dev build
  (worktree HEAD == embedded HEAD, SHA-256 `3bb9c7a9...`, `channel=dev`,
  `app.quotalis.desktop.dev`) launches job-owned, opens a real window, and paints
  its WebView2 content.
- Three captures are recorded and each has a luminance variance above 1200 on a
  sampled pixel grid, so none is a blank frame. The local vision model read back
  the Quotalune brand and real controls from the live window.
- All physical mouse and keyboard input stayed disabled and no guard was
  bypassed. A user pause later ended further capture and was not worked around.

## Release gate

Source is published and CI is green. The **v0.12.0 release is deliberately not
published yet.**

The master goal makes a public release conditional on complete mandatory native
visual evidence. That evidence is currently PARTIAL: the Settings surfaces are
captured, while the dashboard tray panel, providers, analytics, the appearance,
surface and tray studios, the background gallery, Light mode and Arabic/RTL
still need their own real captures, and tray and notification appearance has not
been captured natively. The seeded dashboard screenshot was discarded rather
than published because the window was occluded and ran off the right screen
edge.

An earlier draft of this document proposed extending the Dev proof harness so
the remaining surfaces could be opened without synthetic input. That work turned
out to be unnecessary: the harness already accepts `settings:<tab>` for every
tab in the shell, including `dashboard`, `analytics`, `providers`,
`providerDisplay`, `themes`, `surfaces` and `dashboardStudio`. The remaining
work is capture only, and each surface is one launch plus one screenshot with
no synthetic input at all. The one genuine harness defect found along the way
was the missing `analyticsSources` entry described above.

What actually blocks the remaining captures is not tooling. The Desktop Visual
QA adapter reported `DESKTOP_QA_PAUSED: User has control`, and per the stack's
rules a user pause is never cleared or worked around; only a user Resume
reopens it. Nothing about the application prevents the remaining captures.

Publishing a tagged release with artifacts now would overstate what has been
verified. The honest next step is to capture the remaining surfaces, then
publish.
