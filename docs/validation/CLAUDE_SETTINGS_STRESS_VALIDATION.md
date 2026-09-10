# Claude settings stress + live-propagation validation — 2026-09-10

Wave C §1-2. Real native evidence against a freshly rebuilt,
`dev-preflight`-verified `QuotalisDev.exe` (rebuilt from this session's
current source, including all control-migration and analytics-hardening
commits) — not a stale binary, not a simulation.

## Method

Two real Dev windows opened simultaneously (`main` + `settings`, the
app's own default startup state — `startupDestination: providerDisplay`
opens Settings alongside the main window). Driven via the same
CDP/`window.__TAURI_INTERNALS__.invoke()` harness established in earlier
phases (`.local/proof/claude-audit/lib.mjs`, `cdp-lib.mjs`), which calls
the real Tauri IPC bridge exactly as the real UI does — not a mock.

Script: `.local/proof/claude-audit/50-settings-stress.mjs`.

## 1. 32-round alternating write stress test

Alternates writes across the 9 required categories every round (density,
Structure Theme, Provider Identity, chart style, Dashboard performance
preset, Reset preference, navigation preference, UI language, Demo
scenario), using a **per-category counter** for value selection (not the
global round index — an earlier draft of this script aliased to the same
index every time for any option array whose length evenly divided the
9-round category cadence, which would have silently tested only one
value per field despite looking like real alternation; caught before
trusting the result, fixed, and rerun).

After every single write: read back immediately from **both** open
windows (`main` and `settings`), not just the window that issued the
write — this also proves live cross-window propagation, not only
single-window round-tripping.

**Result: 32/32 rounds passed.** Every write's readback matched the
written value in both windows, immediately, with no restart between
rounds. Zero lost writes. For the two categories that share a nested
object (`workspacePreferences.density`/`.navigation`), both sibling
fields were always present after every write — zero stale sibling
overwrites (a change to `density` never dropped `navigation`, and vice
versa).

Full round-by-round detail: `.local/proof/claude-audit/stress-round1.out`.

### One real defect classification recorded (not a bug)

The first draft used `dashboardPerformancePreset` values `"auto"` and
`"efficient"`, which are not members of the
`DashboardPerformancePreset` enum (`rust/src/settings.rs:669`, valid
values `lowCpu`/`balanced`/`highFidelity`). `update_settings`'s patch
application (`apps/desktop-tauri/src-tauri/src/commands/settings.rs:205-209`)
silently no-ops on an unparseable enum string for this field — the rest
of the patch still applies, no error is returned. Traced this and
confirmed it is a **pre-existing, consistent, deliberate pattern**
across the same function for `low_power_mode_preference` and
`dashboard_mode` too (same `if let Some(x) = ... && let Some(parsed) =
Enum::parse(x) { apply }` shape, same silent-skip-on-unparseable
semantics) — not a defect introduced by or specific to this test, and
not changed. Corrected the test's values to the real enum and reran
clean.

## 2. Restart persistence

After the 32 rounds: captured the full 100-key settings snapshot,
**closed the Dev process** (`taskkill /F /IM QuotalisDev.exe`, confirmed
via `tasklist` that no Quotalis process remained running), ran
`node scripts/dev-preflight.mjs target/debug/QuotalisDev.exe` again
(mandatory before the relaunch — PASS), relaunched, and read the
snapshot back from the freshly started process.

**Result: 100/100 keys identical, 0 diffs, 0 missing, 0 added.**
Script: `.local/proof/claude-audit/51-restart-readback.mjs`. Every field
touched across all 32 rounds (density, navigation, catalogTheme,
globalLimitPresentation.identity, analyticsPreferences.chartStyle,
dashboardPerformancePreset, resetPresentation.preset, uiLanguage,
demoScenario) survived the real process restart with its final
stress-test value intact — not merely "a settings file exists," but
byte-for-byte snapshot equality through a genuine process exit and
relaunch.

## 3. Live propagation (no restart)

Already proven by the stress test's own read-back-from-both-windows
design (see §1): every one of the 32 writes was visible in the **other**
already-open window (`main`, which never itself issued the write)
immediately after the write, with no restart and no manual refresh.
Covers: Structure Theme, Provider Identity, density, chart style, and
Reset Presentation from the required list explicitly; UI language,
Dashboard performance preset, navigation, and Demo scenario as well
(broader than the minimum required set).

No separate live-propagation pass was needed beyond this, since the
stress test's dual-window read-back design already is that test,
executed 32 times rather than once.

## Verdict

**SETTINGS: PASS.** 32/32 stress rounds correct; zero lost writes; zero
stale sibling overwrites; unrelated settings preserved (100 keys stable
throughout); restart persistence exact (0 diffs); live cross-window
propagation proven on every round, not just spot-checked.
