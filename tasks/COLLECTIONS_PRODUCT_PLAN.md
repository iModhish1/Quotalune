# QuotaArc — Collections and product completion

Status: user approved implementation on 2026-09-06, adding horizontal/vertical/grid
views and per-provider visible fields with immediate size previews. First reducer
and interactive browser studio implemented. Versioned Rust persistence and an
experimental Settings editor are implemented; native interaction verification and
detached native islands remain pending.
Preserve current dirty work and user icons.

## Product contract

### Additional approved interaction customization

Expose shared per-structure customization for hover details, wheel cycling,
automatic fold, fold delay, idle visible count and edge attachment on fold.
Every option must support enable/disable and persisted restore. Hover detail
selection must remain independent of carousel position. Unsupported geometry
combinations need explicit disabled capability explanations, not silent fallback.
Preview and native window sizing must use the same effective configuration;
shrinking artwork alone while retaining an oversized input window is not accepted.
Status: hoverDetails/wheelCycle/autoFold/foldDelayMs now have shared persisted
settings and Settings controls. Notch family consumes all four; Reel consumes
wheelCycle. Unsupported Settings toggles are disabled explicitly. Preview has
temporary controls; these do not persist. Remaining: full legacy/Reel integration,
per-structure overrides, idle count and optional attachment behavior. Satellite's
compact envelope is now 64×84 logical px in React and Rust, with native proof pending.

Structure → view → position are independent; style is an orthogonal token layer.
Dot Collections is a behavior option, not another renamed structure. Each
provider/account item has one stable identity and exactly one location: a group
or an independent island. Supported accounts only; no fabricated login state.

- Compact group displays at most three items; wheel pages the ordered remainder.
- Drag out detaches an item; source shrinks immediately on successful drop.
- Two items retain a two-slot group; one becomes a standalone item without shell;
  zero removes the group. This singleton behavior is an explicit interpretation.
- Drop onto another item forms a group; drop onto group inserts at previewed index.
- Reorder is distinct from detach; drag threshold, Escape rollback, pointer capture
  and keyboard alternatives prevent accidental operations. Do not duplicate items.
- Hover reveals only provider detail; clicking the collection control expands the
  collection. A provider click must not ambiguously both detach and expand.
- Snapping has edge/corner hysteresis, monitor work-area bounds, taskbar awareness,
  DPI-aware logical coordinates, unplugged-monitor recovery and user override.
- Persist versioned identity/order/group/position/scale, never usage fixtures or
  credentials in layout state. Restore positions only after monitor validation.

## Architecture and performance gate

First prototype native detached Dot islands with the existing shared provider
cache, one refresh scheduler and bounded rendering. Do not assume one WebView per
provider is cheap, or replace it with a full-desktop transparent hit-blocking window.
Compare bounded native child/owned-window strategies and shared rendering before
choosing. A failed performance gate blocks expansion of this architecture.

No continuously running decorative animation, WebGL scene or idle rAF loop.
Use short compositor-friendly transform/opacity transitions on interaction only;
reduced motion removes travel. Pause invisible UI work. GPU/CPU/process-tree memory
must be measured after settle for1/3/6/12 items, grouped/detached, hidden/visible,
with refresh disabled and enabled separately. Record hardware, build type, timing,
baseline and deltas; set defensible budgets from measurements, not invented claims.

## Notification semantics

Normalize provider data once into provider/account/window identity, used fraction,
remaining fraction, reset timestamp, observed timestamp and freshness. Thresholds
operate on canonical remaining fraction regardless of display mode. Unknown data
does not become0; old samples do not create resets.

Separate five-hour, weekly and other provider-defined windows. Configurable50/20/10/0
remaining alerts, user-defined thresholds, and percentage-step alerts with validation.
Defaults proposed:20/10/0 enabled,50 and periodic steps disabled. Crossing-only alerts,
cycle-specific deduplication, hysteresis and coalescing prevent repeated storms.

Scheduled countdown expiry is not proof of an actual reset: report expected vs
confirmed separately. Unexpected usage reduction is an observed change until a
cycle/reset signal corroborates it. Banked reset only if the provider exposes a
reliable signal; unknown providers show unsupported, not simulated support.

Notification UI names the app, provider and quota window, includes official app
identity plus provider icon, uses readable status text as well as color. Warning
amber/red progression; reset/available restrained teal. User chooses enabled events,
quiet behavior and presentation. Native Windows toasts remain governed by Windows;
custom in-app cards may offer matching motion but cannot masquerade as OS chrome.

## Application, branding, startup and installer

- Responsive charcoal/silver interface with subtle depth, not an always-running3D
  renderer. Settings navigation side/top/bottom selectable, persisted and accessible.
- Visual previews for structures, supported views and styles use actual components;
  concepts remain explicitly labelled, unavailable options cannot appear implemented.
- One canonical QuotaArc asset manifest for executable/window/tray/toast/shortcut/
  installer/uninstaller. Retain provider logos as provider identities, not app logos.
  Preserve legally required attribution and migration identifiers; no deleting git history.
- Startup is recommended and user-controlled, not silently enabled. Verify login
  startup, single-instance behavior and disabling it.
- Installer custom branding must preserve standard safety: repair/upgrade/uninstall,
  install location, version identity, rollback, signatures when available. No fake
  signature or SmartScreen bypass claims. Personal installation remains a final gate.

## Ordered acceptance gates

Axis adaptation checkpoint: Notch catalog, Rust anchor normalization and drag
docking now accept all eight dock anchors. Seam/Satellite rotate across top/bottom;
Ribbon rotates on side anchors. Body rotates separately from upright labels;
React/native envelopes swap together. Connector attachment clamps to the core near
corners. 472 frontend tests passed; final affected 17 tests/build and 20 Rust surface
tests passed. Native pixel verification remains pending. Legacy Flowline/Horizon
remain direction-limited; full catalog parity and the other gates are not complete.

1. Dot group interactions + persisted restore; browser and native proof separately.
2. Detached native islands + docking + performance gate at realistic provider counts.
3. Common view/structure/style selectors with real previews and compact size limits.
4. Notification normalization + deterministic replay tests + customization UI.
5. Unified app navigation/identity + startup + native notification proof.
6. Installer lifecycle + release build + full regression and visual acceptance.

Every remaining concept must pass same criteria before joining the selectable
catalog. Do not declare all structures/styles complete by registering names.

## Risks / decisions needing review

Native multi-island renderer is not selected yet; feasibility precedes commitment.
Synchronization accuracy is constrained by provider refresh APIs, rate limits and
available signals. Polling faster cannot promise real-time information. Use shared
deduplicated scheduler with backoff, stale indicator and manual refresh.

Generated storyboard is illustrative; duplicate icons, triangle tooltip and blank
slots in its output are not accepted requirements. Code must enforce uniqueness,
rounded connections and no phantom providers. No native proof yet for this wave.

## Checkpoint — 2026-09-06, persisted editor

### Actual Settings shell follow-up

- The real Settings component now has a charcoal/silver shell, sidebar/top/bottom
  navigation saved in this WebView's localStorage, and keyboard tab navigation.
  This preference is not yet included in Rust profile export or synchronization.
- Removed inherited tab margins/content max-width constraints in the new shell.
- Settings launch errors are surfaced in PopOutPanel; native settings opening
  explicitly restores, shows and focuses the window.
- 88 frontend files / 474 tests passed; TypeScript/Vite build, cargo check, and
  Dev custom-protocol binary build passed. Latest native visual verification is
  still outstanding; previous computer-use activation failed with Access denied.
- This is a shell redesign, not completion of every panel, native collections,
  notifications, performance qualification or release/installer gates.

- Added validated collection settings, legacy/malformed-data fallback, revision
  conflict rejection and persist-before-broadcast commands. The collection lock
  serializes collection writers only, not every existing Settings command.
- Settings → Surfaces exposes an experimental editor using live snapshots, not
  synthetic login data. Saving retains drafts on error; missing providers retain
  their layout as unavailable. The editor explicitly says native rendering is pending.
- Latest frontend suite and TypeScript/Vite build passed, including disappearing
  provider and failed-save tests. Rust checks: 1,445 shared tests, one doc-test,
  407 shell tests passed. Fresh Dev binary built before the final disappearing-
  provider frontend fix; rebuild again before claiming native proof of that fix.
- Strict Clippy is NOT green: existing notifications.rs lines 30 and 678 discard
  must-use results. No suppression or ignored tests added to hide these failures.
- Native UIA exposed the new editor button, but screenshot was black and activation
  recovery failed with GetCursorPos Access is denied (0x80070005). Native click,
  save/restart proof and visual acceptance are NOT established. No alternate
  input mechanism was used to bypass that access failure.
- Release remains blocked by native proof, detached-window architecture/performance,
  remaining catalog/UI/notification work and installer lifecycle verification.
