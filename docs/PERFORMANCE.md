# Performance

QuotaArc is an always-running utility: idle cost matters more than peak
throughput. Targets are engineering goals, not marketing numbers; every figure
below is a real measurement with the method stated.

## Measurement environment

Windows 11 (build 26200), x64, release build `0.1.0`, launched from the built
installer payload (`QuotaArc.exe`), tray-only mode (no optional surfaces),
default settings, no provider credentials configured (no network polling).

## Results (2026-09-02)

| Metric | Value | Method |
|---|---|---|
| Launch to process | **139 ms** | Stopwatch around `Start-Process` → process-exists, PowerShell |
| Main process working set | **46.2 MB** | `Process.WorkingSet64` after 20 s settle |
| Main process private bytes | **18.1 MB** | `Process.PrivateMemorySize64` |
| Full tree working set (main + WebView2 children) | **162.3 MB** | Sum over process tree incl. `msedgewebview2.exe` |
| Full tree private bytes | **50.4 MB** | Sum over process tree |
| Idle CPU | **0%** (below timer resolution over 30 s) | `TotalProcessorTime` delta over 30 s ÷ cores |
| Threads (main process) | 49 | `Process.Threads.Count` |

Honesty notes, per the project rules:

- The WebView2 working set is reported, not hidden. Tauri apps share the
  WebView2 runtime; the tree number is the realistic footprint users see.
- Idle CPU is measured with surfaces disabled. With a surface visible the
  compositor cost is bounded by WebView2 rendering; the Surface Engine's
  watcher parks itself when no surface window exists, and surfaces render no
  animation when provider data is unchanged (design-system rule: animate only
  on change).
- A release-vs-release comparison against the upstream Win-CodexBar baseline
  was not completed in this environment (only its debug build was compiled
  during the Phase 0 audit). Architecturally the shell is the same, and
  QuotaArc's additions (Surface Engine watcher: one 3 s tick while a surface
  exists; no other new steady-state work) are documented above. A follow-up
  A/B measurement on identical hardware is tracked as POLISH work.

## Design rules that protect these numbers

1. Adaptive polling with backoff (inherited `adaptive_refresh`).
2. No animation without a state change; springs rest completely.
3. Fullscreen watcher: single 3 s probe, only while a surface window exists;
   parks itself otherwise.
4. No network polling while the machine is idle beyond the configured refresh
   interval; provider backoff on failures (inherited).
