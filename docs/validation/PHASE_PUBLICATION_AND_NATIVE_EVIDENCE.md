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
| 36213734968 | 1fdf1d0a | **success** |

The first CI run failed on exactly one test,
`providers::antigravity::tests::powershell_discovery_cmdlets_are_available_without_a_user_profile`,
which panicked with `cmdlet discovery: Timeout`. The cause was environmental:
the test asserted a host precondition by spawning a real PowerShell through the
production probe helper, whose 15s `PROBE_TIMEOUT` a cold GitHub Windows runner
can exceed while autoloading the NetTCPIP module. A `#[cfg(test)]`-only helper
with a 120s budget now backs those environment probes. `PROBE_TIMEOUT` itself is
unchanged, because it is a user-facing responsiveness guarantee for interactive
provider probes and must not be weakened to satisfy a test.

The second run is green on both required jobs: `Rust fmt / clippy / test` and
`Frontend locale / typecheck / tests`.

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

Publishing a tagged release with artifacts now would overstate what has been
verified. The honest next step is to capture the remaining surfaces, then
publish.