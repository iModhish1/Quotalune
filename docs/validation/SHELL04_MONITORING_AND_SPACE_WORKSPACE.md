# SHELL-04 — controls, space workspace and provider tray

Code candidate: `45fbeab6` (2026-09-12). Dev only. Original app/provider marks and
Personal installation, data, processes and shortcuts were preserved.

Verified executable: `target/debug/QuotalisDev.exe`, SHA-256
`6819ddefbf4a664644c0743e7025d16ec116e2f61146551dbea5be71365d4795`.
Final normal launch: PID 14992, responding, visible non-minimized native window,
without proof/CDP/seed environment. Window caption is `Quotalis Settings`; the
verified binary/channel is Dev (`app.quotalis.desktop.dev`, `QuotaArc-Dev`).

## Delivered behavior

- Shared selects now measure their actual content, stay beside the trigger,
  constrain to the viewport, follow scrolling/resizing and close when their
  trigger disappears or is disabled. Keyboard navigation skips disabled options;
  selection uses a dot rather than a checkmark.
- Eleven primary destinations group monitoring, providers/profiles/collections,
  customization, settings and About. Appearance contains Themes, Provider Display
  and Reset Display; logo finish/prominence and OS theme moved there from General.
  Surfaces and Provider tray studio are independent primary destinations.
  Studio tabs scroll with content so they cannot cover section headings.
- One backdrop covers the main workspace client area, including its header and
  navigation. Four new original space scenes have static and animated variants.
  The approved Cosmic Observatory, plain theme color and managed custom imports
  remain. Retired palette IDs resolve to valid scenes without data loss.
- Animated scenes use an image, bounded image drift and a 96-star canvas with
  pointer parallax, drift and twinkling. No video, network stream or 3D dependency.
  Balanced/high presets cap scheduling at 24/30 fps and canvas DPR at 1.25.
  Blur/hidden/minimized, reduced motion, animations-off and low-CPU stop animation.
- Provider tray studio persists an exact observed physical limit, used/remaining,
  ring/arc/bar/number-badge templates, provider/app/silver accent, stroke, precision,
  optional name/plan, up to three tooltip limits and local token-history range.
  A configured unconnected provider can be pinned; unknown data draws a neutral
  mark, never invented zero usage. Main app tray behavior remains available.
- Notifications materialize original PNG marks in the channel's local assets
  directory. App events use Quotalis; provider events, including resets whose
  action opens Dashboard, use the provider mark. App AUMID registration supplies
  the Quotalis icon. Windows controls its header layout and icon size.

## Data and native lifecycle

`ProviderTrayConfig` is shared through Rust settings/load/save/update/snapshot and
the TypeScript bridge. Limit IDs include lane/observed label/duration (extras use
their observed ID). A missing/retired configured limit fails closed rather than
silently changing to a different quota. No quotas or billing channels are added.

Native icon reconciliation runs entirely on Tauri's main thread, obtains current
settings there and only then owns its registry lock. This removes a cross-thread
lock/main-thread dispatch deadlock found by independent review. The same review
caught an unconsumed click event; clicks now use the existing typed provider
settings-window route. Registration is checked using a Dev/proof-only command;
registration is not proof of visible Windows taskbar placement.

Tooltip text has Windows' 127 UTF-16-unit budget. Long name/plan/window labels are
bounded; at most three individually identified quotas appear. Token scanning is
opt-in, backgrounded and cached for five minutes by provider/range/local date.
Hover invalidates stale calendar reads even when automatic provider refresh is
off. Current support is local Codex/Claude logs, including available local account
logs, not a universal API or account-specific lifetime claim. Partial positive
readings carry `≥`; missing history is unavailable. Week means the local Monday
calendar week; month/year likewise use local boundaries. “Lifetime” means all
available local history. Incomplete coverage is retained through the cache.

Original SVGs were rasterized to native PNGs without changing their geometry.
62 registered providers have verified bundled marks; eight without such marks
fall back to the original Quotalis mark. A further PNG is a test fixture.

## Acceptance evidence and explicit limits

| Area | Executed evidence | Scope/result |
|---|---|---|
| Main routes | 11 destinations × English/Arabic × 1216/800 logical width | 44 cases, no horizontal document overflow or error boundary |
| Nested studios | Themes, Provider Display, Reset Display, Surfaces, Menu | Five routes passed on final rebuilt candidate; scrolled heading overlap removed |
| Shared selector | Native Cua open + before/after capture; WebView2 options and settings readback | On/Automatic/Off saved; popup remains inside viewport; keyboard End/Enter saved Automatic |
| Provider monitoring | Claude switch off/on with Rust readback | Restored original enabled providers; no auth mutation |
| Tray controls | 28 persisted control checks | Four styles, used/remaining, six token choices, three accents, precision 0/1/2, name/plan, stroke, pin/unpin |
| Native tray registration | Tauri registry readback | Codex icon exists after pin, absent after unpin |
| Tooltip selection | Real Codex available windows | Weekly + Spark selected and persisted; the three-limit cap additionally has source tests |
| Sidebar | Native WebView2 controls | Collapse/expand persisted |
| Background gallery | Actual card/filter clicks and image decode | 10 built-in choices: six static including plain/original, four animated; custom list preserved |
| Full-window images | Eight scene selections | Each backdrop rectangle equals 1216×700 client viewport; every image decoded at 1672×941 |
| Real motion | Timed captures + star pixel checksum + mouse move | Checksums differ; no fabricated analytical data |
| Motion guards | Native WebView2/OS minimize | Low CPU, animations-off, reduced motion and minimize pause verified |
| Notifications | Four actual Dev WinRT notification-history receipts | App, Codex usage, Claude auth and Codex reset retained the correct PNG and destination |
| Native toast/header appearance, OS tray hover/click | Attempted Cua desktop capture/foreground interaction | BLOCKED: desktop capture returns invalid handle `0x80070006`; foreground HWND is `0x0`. No pixel-level success claim |
| Credential workflows | Existing deterministic suite; navigation only | Live OAuth/account switching, keys, purchases, destructive data actions and login/reboot were not submitted as QA |
| Imported backgrounds | Existing storage implementation retained; full tests rerun | Existing user images preserved; native import/delete proof belongs to SHELL-03, not claimed rerun here |

Cua 0.21.0 captured the rebuilt Dev window and opened the select. Its background
option-click reported an unverifiable no-op; foreground retry was refused by
Windows. WebView2 DOM/input plus Rust readback verified the actual selection.
This is deliberately distinguished from Cua pixel interaction. Notification
history acceptance proves Windows delivery and payload, not whether a banner was
shown or the app header icon cache refreshed. No Explorer restart, global
notification preference change or taskbar promotion was forced.

The full matrix/controls/performance proof used `f97209a9`. After the final
CSS-only overlap repair, `45fbeab6` was rebuilt and received targeted five-route
and Cua gallery verification. Backend/frontend logic was unchanged by that repair.

The task is an implemented Dev upgrade with broad, bounded verification. It is
**not a claim that every feature and every authenticated provider combination has
been manually tested**, nor a full native toast/tray visual PASS.

## Performance measurement

Native Dev WebView2, three 5-second samples per mode, 1216-wide client. Focus and
motion preference were explicitly emulated for repeatability. These are the
whole renderer's main-thread timings, not process/system CPU or GPU estimates.

| Mode | Median task time / 5 s | Median script time / 5 s | Layouts |
|---|---:|---:|---:|
| No backdrop | 0.786 ms | 0 ms | 0 |
| Animated, balanced | 318.588 ms | 21.239 ms | 0 |
| Animated selection, low CPU guard | 0.852 ms | 0 ms | 0 median |

Animated heap samples were 8.01–8.64 MiB. The first no-background sample included
142 ms of other work; all raw samples are retained locally. The guard disables
the recurring scene work, but this is not a guarantee of no GPU cost or identical
results on all devices. Prefer static or low-CPU where appropriate.

## Quality gates

- Frontend: **192 files / 1,141 tests passed**.
- Rust workspace: desktop **481 passed, 1 existing ignored**; core **1,724 passed**;
  CLI **1 passed**; **0 doc tests**. No new ignored/focused tests.
  The existing ignored test is `manual_verification_against_real_history_db`.
- Workspace clippy, all targets, warnings denied: passed.
- Rust formatting, TypeScript check, production frontend build and verified
  Dev Tauri build: passed.
- Secret scan: **2,960 files clean** including final documentation.
- Locale contract: 1,546 canonical keys, no English omissions/duplicates; all 33
  added keys translated in Arabic. **743 pre-existing Arabic entries still fall
  back to English**; this is not full Arabic translation parity.
- `git diff --check`: passed.

Logs: `.local/shell04-{frontend-final,rust-final,clippy-final,native-build-final,secrets}.log`.
Detailed native records: `.local/shell04-{layout-final,controls,extra-controls,
background-qa,performance,guards-final,toast-receipts}.json`.

## Visual artifacts

- `docs/images/shell04/cua-select-final.png` — actual rebuilt Windows select.
- `docs/images/shell04/providers-{english,arabic}-{1216,800}.png` — route matrix.
- `docs/images/shell04/atmosphere-01.png` through `atmosphere-04.png` — real-data
  Dashboard with each original new scene.
- `docs/images/shell04/motion-0s.png`, `motion-2s.png` — bounded live scene sequence.
- `docs/images/shell04/appearance-library.png` — gallery before final tab-overlap
  correction; final corrected capture is recorded separately.
- `docs/images/shell04/cua-tray-final.png` — rebuilt tray editor; not an OS tray capture.
- `docs/images/shell04/cua-appearance-corrected.png` — final build, heading clear.
- `docs/images/shell04/normal-dev-launch.png` — final ordinary launch, original
  user presentation settings restored.

Assets were generated with the installed imagegen tool: detailed cinematic
astronomical scenes, dark usable UI areas, no text, logo or UI painted into art.
Outputs were copied unchanged. Native dimensions are **1672×941, not 4K**;
roughly 2.35–2.64 MB per PNG. Four raster files are reused by their animated
variants. They are illustrative astronomical concept art, not scientific imagery.

## Revisions and review

`398cd775` shared select; `d8a96fd2` original notification/provider marks;
`16b8aec9` space scenes; `12979aa9` tray/settings/navigation integration;
`c60810e0` review repairs for native scheduling, click routing and token coverage;
`f97209a9` Appearance controls/Dev registration proof; `45fbeab6` scrolled-heading
overlap correction. Independent Astra review identified four defects; mother
repaired them and reran affected/full checks. The reviewer accepted the repair
direction but did not reread the final diff; no second independent sign-off claimed.

All temporary QA settings are restored from the Dev presentation backup before
the final normal launch. No production deployment is performed.
