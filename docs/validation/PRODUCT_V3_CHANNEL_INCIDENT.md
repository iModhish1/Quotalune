# V3 validation channel incident — 2026-09-10

## Confirmed failure

The first two V3 native builds used `tauri.dev.conf.json` (Dev filename/identifier) without Rust `dev-channel`. That JSON previously did not set Cargo features. Native processes 45264 and 12052 consequently used Personal application paths. This was detected when `show_notification_proof` refused the non-Dev channel at approximately04:01 local time. The active exact process12052 was stopped immediately.

The presentation proof calls changed Demo count/scenario/history, display/privacy presentation, workspace/analytics preferences and last page through the app. Personal settings file modification time was observed at03:59:01; Dev settings remained at the preceding day's23:43:54. No complete, immediately-before snapshot of Personal exists for these changes. Earlier presentation backups are not proven suitable for rollback. Do not restore those backups speculatively.

Normal application startup may also have persisted refresh/history/log and notification registration state. The full effect is not claimed known. No credentials were printed, no account connection was initiated, and no installer/release promotion was run. These facts do not make Personal untouched.

## Evidence status

ITERATION1_* and ITERATION2_* plus DASHBOARD_REAL images under product-v3/native are UI evidence from the incorrectly configured build, NOT isolated Dev acceptance evidence. Later Dev evidence must use an explicit DEV_ prefix and verified feature gating.

## Prevention and recovery scope

`tauri.dev.conf.json` now sets `build.features=["dev-channel"]`. Startup also rejects a non-Dev compiled binary with a Dev filename or proof-mode request before logging/settings/registration. Tests cover this guard. Rebuild with explicit `--features dev-channel` as defense in depth, then verify the Dev-only proof command succeeds.

The user was informed immediately. No blind Personal rollback, deletion, registry cleanup or migration was attempted. Product V3 cannot meet the requested Personal-untouched PASS condition for this run.
