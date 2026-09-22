# Active implementation plan — complete product requirements

Authority: `MASTER_REQUIREMENTS.md` (2026-09-06). This section supersedes conflicting
historical product decisions below. The active goal remains unfinished. Every new
message must update the ledger and this backlog, not replace previous requirements.

## Current About correction and publication gate

P06-17 revised: the owner rejected the first About layout. Prioritize product,
version and updates; move the purple creator credit/avatar and contact icons to
the footer. The latest objective authorizes publication after correction and
verification without another approval question. Other release gates remain.
Notification-center implementation and all other requirements remain active.
Latest revision ae46db11 adds a publication prerequisite: visually verify the
Windows notification header's original app mark. About adds the verified TAWAJUD
AI mark/link and bounded interactive creator glow. Do not replace native proof
with a successful test-toast request or registry write.

## Ordered delivery gates

Current packet (2026-09-06 continuation): advance E03/E04 from palette variants
to complete portable identities. Each live theme owns a unique named signature,
frame/inlay, meter treatment, connector, mark treatment and restrained motion;
the shared renderer applies those as paint-only tokens without changing quota
semantics, provider branding or native footprints. The production gallery and
browser-safe identity lab compare real renderers, default to a material-revealing
Lens preview, and isolate app light/dark appearance from widget identity. Full
frontend verification plus a fresh native replacement have passed. A 2,268-case
React matrix now covers every 9 Theme × 14 Structure × 9 Anchor ×
compact/expanded pairing, with targeted browser proofs across light/dark
appearance and opposing corners. DPI-scaled Win32 magnetism now snaps during
the native move loop on either axis while release commits the persistent anchor.
Next, obtain physical pointer acceptance and extend visual evidence across the
remaining renderer/anchor families; native input review remains open rather
than inferred passed.

Notification-center packet (2026-09-06): G06/G07 now use a real branded preview
instead of a text summary: official mark, provider icon, status, semantic meter,
used/remaining equivalents and localized explanatory copy. The event selector is
a compact unified panel, provider/limit override copy is localized, and 398px
dark/light browser proofs plus the full frontend and locale gates pass. Native toast
content now localizes the provider window and event reason, including explicit Arabic,
and states both used and remaining quota for every relevant event. Native toast visual
rendering, animation and Windows input acceptance remain explicit open evidence.

Settings-layout packet (2026-09-06): F01/F03/F05/F07/F08 now have a responsive
shell proof using the production classes and components. Side, top and bottom
navigation remain independent layout modes; navigation choices are localized
preview cards rather than an ambiguous select. General, Notifications and Advanced
use a content-sized two-column mosaic only when the viewport can support it, and
collapse to one column without horizontal overflow. The visual matrix caught and
fixed a real grid-track compression defect in the notification preview. Native
resize/maximize/pointer acceptance and complete Arabic page screenshots remain open.

Surface-control packet (2026-09-06): B/C/F controls in Surfaces no longer expose
raw form-like checkbox stacks or value-less sliders. Interaction availability is
explained per option, every range reports its live value, and demo/size actions have
one consistent hierarchy and visible selected state across app appearances. The
real themed 14-structure catalog remains the visual source of truth. A duplicate
initial tray measurement discovered during this packet was removed and stress-checked
to prevent a late second reveal under load. Full Surfaces localization and native
pointer acceptance remain subsequent gates.

Latest additions: D12 joins gates 2–3 (distinct source limits, never merged by duration);
A06 joins gate 4 (user-selectable logo colorways); F09–F10 join gate 7 with explicit
light-mode preview isolation and content-sized layout/overflow regression checks.

1. **Requirement reconciliation (A–H):** preserve all requests, distinguish partial
   code from verified behavior, and retain explicit conflicts/supersessions. Evidence:
   master ledger plus this plan. This is documentation completion, not product completion.
2. **Independent limit model (D01–D08):** discover actual available limits with stable
   IDs; store selected IDs and order per provider, with empty distinct from default.
   Migrate legacy presets without losing intent when a provider is offline. Keep
   unknown IDs recoverable. Tests: zero/one/many limits, reordered windows, offline
   recovery, migration, used/remaining normalization and settings round-trip.
3. **Limit editor and shared renderer (D02–D09):** checkable items, accessible reorder,
   per-limit bar/value/both, ring/horizontal/vertical and independent fill direction.
   Show two selected limits and page extras by wheel/keyboard without cycling the
   provider. Live preview uses the actual renderer and reports logical dimensions.
   Gate: interaction tests and screenshots across structures, directions and counts.
4. **Official identity (A01–A05):** use the About vector as the single master; derive
   legible theme variants and native raster sizes, brighter silver rim and adjustable
   reveal size. Inventory every UI/tray/executable/toast/installer asset before
   replacing references. Preserve attribution and unrelated user assets. Gate:
   asset-reference checks, small-size visual contact sheet, rebuilt native identity.
5. **Structure and collection architecture (B01–B14, C01–C06):** fix all anchors,
   corners, drag/snap, collapse and shared interactions before accepting new shapes.
   Collections support detach/merge/reorder, max-three paging and empty disappearance.
   Gate: pure reducer/layout tests, real pointer tests, native multi-monitor/DPI and
   input-pass-through evidence. Measure detached-window cost before architecture choice.
6. **Full visual identities (E01–E07):** inventory and visually evaluate all four
   libraries, score distinct silhouettes, compactness, readability and feasibility;
   generate selected concepts, then implement them one at a time. Themes include
   typography, material, ornament, motion and bounded shape treatment, not palette
   swaps alone. Keep quota semantics and layout safety shared. Gate: every theme ×
   structure × supported view/anchor; compare generated reference with actual output.
7. **Application completeness (F01–F08, D10–D11):** reorganize all settings, helper
   text, live previews, Arabic/RTL, light/dark/system, window resizing and navigation;
   implement genuine supported provider sign-in and clearly isolated demo data.
   Gate: all-page interaction inventory, persisted settings, RTL/light screenshots,
   native resize/maximize/fullscreen; never access credentials without existing consent.
8. **Usage events (G01–G07):** per-window configurable thresholds/steps, expected and
   unexpected resets, banked events, normalization and deduplication. Gate: deterministic
   event fixtures including account change, stale samples and missed crossings; branded
   accessible notification previews, reduced motion and non-interruption behavior.
9. **Release acceptance (H01–H10):** settled/hidden CPU and full-process-tree memory,
   startup opt-in, installer/update/uninstall, current complete tests/build/static checks,
   native DPI/monitor matrix and exact binary provenance. No publishing or signing
   claims without actual artifacts and required authority. Native input currently
   unverified due to Access denied; this does not block safe code/browser work.

## Packet discipline

The root owns integration. Before each implementation slice record requirement IDs,
exact files/ownership, baseline and acceptance checks; split large slices rather than
editing shared schemas concurrently. Run focused tests first, then affected integration
checks. Record actual results and remaining gates in `todo.md`. Browser fixtures and
generated concepts never substitute for installed Windows evidence. No new dependencies
without confirmation. Preserve Personal, authentication data and unrelated dirty files.

## Historical foundation plan (superseded where conflicting)

> 2026-09-06: The historical foundation below is preserved. The new requested
> Collections/product-completion wave is specified in `COLLECTIONS_PRODUCT_PLAN.md`.
> Its multi-island behavior supersedes the old single-overlay product restriction,
> but the lightweight native rendering approach must pass a feasibility gate first.

## Overview

Build the approved Flowline, Horizon Fold and Corner Petal forms through one
native Windows overlay and one shared provider renderer. This plan is
subordinate to `docs/FLOW_SURFACE_SPEC.md`. The existing catalog remains
archived; future themes vary material tokens only.

## Architecture Decisions

- Use one selectable Flow Surface form at a time: Flowline, Horizon Fold or
  Corner Petal. Never create multiple overlay windows.
- Use Rust as the sole owner of native bounds, monitor recovery, placement,
  resize acknowledgement and one-expanded-window coordination.
- Treat all third-party Notchy/Notchi repositories as reference material only. No source code will be copied: the MIT projects are macOS/Xcode apps, and Notchi is GPL-3.0-only.
- Use `hidden → peek → compact → hover → expanded ↔ pinned` states. Settings
  and Dashboard remain normal windows; all legacy orbital overlays stay retired.
- Archive inactive theme catalog entries without deleting assets or history. Only Obsidian Orbit remains selectable at runtime during the foundation phase.

## Task List

### Phase 1: Contract and native layout

- [ ] Task 1: Add normalized presentation settings and pure compact/expanded
  envelope resolution with tests.
- [ ] Task 2: Wire one native surface window to form/anchor settings and remove
  dependence on retired Edge/Taskbar overlays.

### Checkpoint: Native boundary

- [ ] Build and focused tests pass.
- [ ] Exactly one overlay can be opened and all bounds are work-area safe.

### Phase 2: Shared composition

- [ ] Task 3: Build a shared Flow Surface provider atom and the Flowline form.
- [ ] Task 4: Add Horizon Fold and Corner Petal as form-only reflows.
- [ ] Task 5: Implement hidden/peek/auto-hide/pin motion and accessible focus.

### Checkpoint: Live Windows usability

- [ ] Fresh Dev binary shows all forms without desktop obstruction.
- [ ] Compact, detail, pin and auto-hide state changes stay responsive.

### Phase 3: Presentation controls and proof

- [ ] Task 6: Add Settings controls for form, anchor, scale, auto-hide, delay,
  opacity/fullscreen and restore.
- [ ] Task 7: Capture live Windows evidence and test 100%/150% DPI bounds.

### Checkpoint: Interaction candidate

- [ ] Fresh Dev build proves compact, expanded, pinned, moved, and recovered
  states on Windows.

### Phase 4: Theme protocol

- [ ] Task 8: Add the first additional material-only theme only after the
  default Obsidian Pulse forms have passed native proof.

### Checkpoint: Review candidate

- [ ] Local test/build gates pass.
- [ ] Fresh native captures match the tested commit.
- [ ] Independent Sol review is complete before declaring the foundation ready.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legacy catalog imports are widespread | High | Inventory imports before changing exports; retain archive adapters temporarily. |
| Surface-specific layout logic bypasses Rust DTOs | High | Add tests that require resolved layout consumption and inspect native windows. |
| Theme removal loses future creative work | Medium | Preserve inactive registry and assets in an explicit archive, without deleting history. |
| Large transparent WebViews remain expensive | Medium | Measure settled process tree after consolidating compositions and remove idle animation. |

## Open Questions

## Active product redesign goal — 2026-09-06

This goal supersedes the earlier one-theme-only product scope, not its safety
or evidence requirements. The 15 user screenshots are the baseline: clipped
select text, unstyled controls, stretched cards, monochrome inaccurate previews,
legacy information architecture and window restoration during tab navigation.
Preserve required upstream license attribution separately from product identity.

Ordered delivery: (1) navigation geometry stability + shared form controls,
(2) real component visual test host and all-page captures, (3) structure/style
separation and token-driven colored live previews, (4) every-edge/corner layout
and interaction matrix, (5) weekly/session/both provider display with reset
availability, (6) configurable threshold/reset notifications, (7) redesigned
page layouts and default list navigation preference, (8) native/performance and
installer acceptance. Each slice requires focused tests, a build and rendered
evidence. Native input permission failures remain explicitly unverified, not
authorization to bypass platform security or fabricate native evidence.

- None blocking: Obsidian Orbit is selected as the canonical starting theme because it is the existing default dark theme and provides the strongest readability baseline.
# Reference-driven identity wave

Read `REFERENCE_DESIGN_REVIEW.md` for the 2026-09-06 visual comparison and shortlist.
Next identity work must implement semantic visual slots and reference-character
prototypes, not count palette variants as new structures. Silver → Eclipse →
Sapphire; retain every existing requirement in MASTER_REQUIREMENTS.md.

## Provider workspace continuation — 2026-09-06

The Providers page is now organized by task priority: searchable provider
roster, persistent selected identity, usage plus connection actions, then
provider-specific configuration. The layout uses two balanced columns where
space permits and collapses without fixed-height clipping. Keep limit selection
and ordering work separate: Session, 5-hour, Weekly, model-specific and extra
windows remain independently selectable product concepts even when a provider
source exposes only a subset.

## Usage-display continuation — 2026-09-06

The Usage Display editor now treats every provider window as an independent,
ordered selection. Its always-visible live preview is the acceptance surface:
the settings choice, displayed order, indicator content, shape and direction
must agree before saving. The next continuation is native multi-size capture,
then the remaining full-product queue in `MASTER_REQUIREMENTS.md`; do not regress
to preset combinations or merge Session and 5-hour in copy, storage or rendering.

## Mark/theme integration correction — 2026-09-06

The screenshots prove that a globally correct logo asset is insufficient when
its frame reads as a foreign black sticker. Keep the exact About mark as the
master glyph, but require every theme identity to define the mark frame, rim,
blend and shadow consumed by all structures. User-selected logo finishes remain
an independent personalization layer; theme integration must preserve glyph
contrast rather than override that choice.

## Curated library wave — 2026-09-06

The supplied 50-theme catalog is now a scored visual source rather than an
unbounded palette dump. This wave adds fifteen clearly differentiated identities,
including multiple daylight-safe systems. Each identity must implement surface,
edge, relief, ornament, typography, meter, connector, motion and official-mark
tokens while remaining compatible with every structure. A theme-specific mark
treatment is automatic; manual logo finishes are a separate user preference.
Acceptance requires unique slugs/signatures, canonical provider colors, explicit
light metadata, a full Theme × Structure × State render test and inspected visual
proof after the transparent official-glyph correction.

## Provider presentation identity layer — 2026-09-06

Introduce a third explicit customization layer: application shell theme,
structure identity and provider presentation identity are independent. Provider
identities may restyle card inlays, type hierarchy, meter tracks/caps, ring
materials and value emphasis, but may not merge limit sources, alter provider
meaning or reduce numeric contrast. Support global inheritance and per-provider
overrides, live previews and deterministic compatibility checks across the full
structure-theme matrix. State colors remain semantic and win over decoration.

Implemented inheritance contract: `global_limit_presentation` is the persisted
base identity/shape/content/direction. `provider_limit_presentation[provider]`
is an optional complete override; deleting it resumes inheritance immediately.
The normalized bridge passes only validated values to every live surface. The
Usage & Spend studio exposes the global identity first and provider overrides
below it, with Arabic copy in the shared locale registry. A deterministic
24-theme × 8-provider-identity render matrix protects values, labels and meters;
native-DPI visual contrast inspection remains a separate acceptance gate.

## Shared surface interactions correction — 2026-09-06

Interaction toggles are no longer disabled by structure name. The Top Arc host
owns hover reveal, wheel paging and delayed fold for every generic structure;
Notch and Reel keep their provider-level wheel/hover handlers without receiving
a second bubbled cycle. Detail folding and whole-surface auto-hide use separate
timers, so leaving an expanded surface first restores its compact footprint and
only then permits the configured hide behavior. Focused tests cover enabled and
disabled behavior; physical pointer acceptance remains part of the native gate.

## Dedicated provider-display workspace — 2026-09-06

Promote provider presentation from scattered controls to its own Settings page.
The page has two bounded views so the 24-identity gallery and per-provider rules
are never mounted as one giant reading flow: Identity Library owns global visual
language and semantic-state preview; Usage Display owns used/remaining semantics,
independent ordered limits, shape/content/direction, per-provider inheritance and
provider accent color. Themes remains application/structure identity only, and
Usage & Spend remains accounting/analytics only. Acceptance covers native dark,
light and Arabic RTL captures, no horizontal overflow, locale parity and the full
frontend/theme-structure compatibility suites.

## Single Dashboard consolidation — 2026-09-09

Owner supersedes multi-mode experiments. Completed legacy-mode normalization,
retirement of Three.js/Spatial/Hybrid and their selectors/routes, and one shared
limits-first Analytics Dashboard. Existing Demo, truth-layer monetary semantics,
reset presentation and theme/identity systems remain authoritative. Native Dev
captures, fresh quality gates and bounded performance/bundle comparison are in
`docs/validation/DASHBOARD_CONSOLIDATION.md`. Code frozen at `c90b12a7`.
Engineering acceptance passed; stop here and return screenshots for owner review.

## Professional product upgrade — K01–K09

Audit source contracts first, then grouped navigation, provider state/template/auth,
analytics correctness, shared settings/templates, isolated Demo and final native QA.
Architecture, evidence and acceptance: docs/validation/PRODUCT_UPGRADE_AUDIT.md.

Completed scoped implementation at `17c99c02`; final evidence and limitations in
`docs/validation/PRODUCT_UPGRADE_VALIDATION.md`. Native testing additionally closed
a cross-window settings feedback race. No release/Personal promotion performed.

## Product V2 — L01–L09
Follow the controlled nine-wave dependency order in
`docs/validation/QUOTALIS_PRODUCT_ARCHITECTURE_V2_AUDIT.md`.
Freeze settings/metric interfaces before independent implementation. Preserve all
legacy tab IDs. Run affected gates per wave and native proof on the final binary.

## L12 — Wave 4.5 checkpoint
The professional analytics platform, measured rendering/lifecycle, native golden states and full quality gates are complete. Evidence: `docs/validation/ANALYTICS_V3_VALIDATION.md`. Stop for owner visual review; Providers V2.1 is not started. Preserve the remaining Product V2 backlog above.

## Analytics V4 owner-selected cosmic implementation
Selected image implemented directly after owner rejected further concept sheets. Preserve original Quotalis/provider artwork, source-backed metrics, Dev-only validation and existing customization. Stop before Providers redesign. Evidence and remaining visual acceptance: docs/validation/ANALYTICS_V4_VALIDATION.md.

## Product V3 execution
1. Audit current native surfaces, capabilities and Windows notification identity; generate A–K concepts.
2. Shared controls and nested navigation; operational overview and provider rail/quick detail.
3. Capability-driven Analytics Center and safe source-backed views.
4. Providers operations and shared page system.
5. Notification identity/icon/actions repair in Dev only.
6. Native scale/RTL/themes/controls/performance proof, full quality gates, final acceptance report.

Product V3 checkpoint: implementation and bounded native evidence delivered in
`docs/validation/PRODUCT_V3_VALIDATION.md`. **NOT PASSED**: earlier misconfigured
builds touched Personal, visible toast acceptance remains unverified, the catalog
has 68 native items rather than 70, and the 250k-history transfer budget is unmet.
Engineering tests/builds pass. Do not turn this checkpoint into release approval
or claim all page-level visual gates complete.

## POST-RELEASE-01 — 2026-09-12 continuation

Latest release lineage reconciled at 0f108437. Subsequent Analytics/promotion
closeouts supersede the older unfinished analytics checklist above; preserve its
historical verdict. Native baseline exposed missing Tauri Dev identity in the
verified build workflow. Repair this boundary first, independently review it,
then complete native smoke and source gates. Current source repair: 7efe92d5.
Rollback instructions corrected separately at 4b7869cd; no rollback/install run.
Current findings, exact gates and remaining authorized backlog are recorded in
docs/validation/CODEX_POST_RELEASE_HANDOFF.md. Personal remains frozen; its actual
shortcut drift is reported, not silently repaired.

## SHELL-01 — 2026-09-12
Compact the shared shell and merge repeated Settings introductions. Add persisted
sidebar width/collapse with pointer and keyboard resizing, improve branch controls,
then validate migrations, frontend interactions, full gates and fresh native Dev.

Completed at 8a925f5e. Fresh native CUA and narrow/RTL evidence, exact source gates,
and graceful restart verification: docs/validation/WORKSPACE_SHELL_COMPACT.md.

## SHELL-02
Consolidate related destinations without changing native route IDs. Add shared
persisted background choices and opt-in bounded pointer interaction, remove
page-owned shell styling and repair observed layout issues, then validate native
visuals/performance and full source gates.

Completed at a42f1ab6: four primary destinations, five settings groups, four shared
backgrounds, live motion guards, native CUA/RTL/light/narrow proof and 1,116 frontend
tests. Evidence: docs/validation/WORKSPACE_BACKGROUNDS_NAVIGATION.md.

## SHELL-03
1. Freeze eight-page IA, provider split/enable semantics and owned image-storage contract.
2. Compact layouts; reusable divider, themed switches and scrollbar treatment; About.
3. Catalog/filters, local import/delete, bounded animation and exact persistence.
4. Native Dev wide/narrow/RTL/interaction/import/performance proof; source gates/docs.

Completed at code candidate d0bb0165. Native review repaired header overlap,
large-image rendering and outside-handle drag completion. Final checks and bounded
performance measurements: docs/validation/WORKSPACE_LIBRARY_PROVIDER_LAYOUT.md.

## SHELL-04
1. Audit shared controls, background composition, notification identity and tray data contracts.
2. Fix control lifecycle/placement; consolidate Appearance and independent Surface/Tray studios.
3. Replace gallery filler with space imagery and bounded interactive scene layers.
4. Implement real-limit tray selection/tooltip contracts and notification imagery.
5. Execute control/feature coverage matrix, native Dev proof, full gates and launch updated Dev.

SHELL-04 implemented through 45fbeab6; full source gates, 44 primary route cases,
five nested studio routes and native persisted-control/background proof recorded.
Updated ordinary Dev launch completed. Native desktop capture/foreground access
blocks toast-header and OS tray hover/click visual acceptance; no false PASS.
See docs/validation/SHELL04_MONITORING_AND_SPACE_WORKSPACE.md for exact coverage.
## QA-05 execution plan
Latest steering (2026-09-13): prioritize native visual evidence and layout repair.
1. Capture every primary destination and nested section in the actual Dev app,
   including lower scroll content and open menus; index captures by route/state.
2. Inspect each image, record whitespace, clipping, alignment, logo contrast and
   hierarchy defects with image evidence. Navigation alone is not feature PASS.
3. Repair shared spacing/layout causes first, then page-specific defects while
   preserving logo assets, data semantics and the user's saved settings.
4. Rebuild verified Dev, repeat affected native views and compare before/after.
   Report coverage gaps explicitly; retain security/installer work below.

Original full QA scope (still required):
1. Inventory all 18 editor routes, controls, actions, Demo scenarios and native
   surfaces; map every action to safe reversible / external-auth / destructive.
2. Inspect current Dev through guarded Desktop Visual QA. Exercise safe controls
   and Demo scenarios via background UIA or adapter-owned isolated browser DOM.
   Record visual evidence, expected/actual values and unsupported input paths.
3. Audit secret boundaries, Demo isolation, capabilities and installer lifecycle;
   repair evidence-backed defects, with regression tests.
4. Build Dev installer, inspect install/upgrade/uninstall behavior in an isolated
   compatible environment if available. Preserve Personal and user data.
5. Run full source gates and security scans; repeat affected native cases, restore
   only QA-owned changes and publish an explicit coverage/defect/compatibility report.

QA05 verified repair checkpoint (2026-09-13): 112 native screenshots indexed,
shared layout/control/logo repairs rebuilt and compared, 1,145 frontend tests,
483 desktop / 1,736 core / 1 CLI Rust tests passed (1 intentional desktop ignore).
Security and installer safety fixes are committed; full native option coverage,
OS tray/toast and disposable installer lifecycle acceptance remain open.
Evidence: docs/validation/QA05_NATIVE_VISUAL_REVIEW.md.

## PRODUCT-06 execution
Latest priority P06-15: release packaging, supported format matrix and authentic
theme/structure gallery now take precedence over optional further polishing.
Audit exact installer/runtime resources and owner URLs, build a frozen candidate,
verify archives/hashes and installer identity, then publish only to iModhish1.
Do not relabel the Windows desktop as macOS/Linux/ARM-native without evidence.
Retain new design batches, remaining auth/tray/QA work in the acceptance ledger.
P06-08 verified increment: persisted profile ordering, explicit rename/save/cancel,
distinct copy names, membership search, localized controls and themed inputs.
Native create/rename/copy/reorder persistence/delete/search passed; all QA profiles
removed, Default retained. Source and screenshots: PRODUCT06_OWNER_COMPLETION.md.
Collections packet verified: fixed detach ID collision after persisted layout
reload, preserved offline providers/current order when gathering, and exposed
targeted regrouping without dragging. Native draft detach/regroup/discard and
compact theme-aware layout verified; persisted collision regression passed.
Profile appearance packet verified: global preferences survive profile overrides;
flat patches distinguish absent/null/value. Native Light activation, Inherit
clearing, restart persistence and active QA-profile deletion passed. Screenshots
exposed and verified repair of light-mode surface/text contrast. Default restored,
no QA profiles remain. See PRODUCT06_OWNER_COMPLETION.md for exact evidence.
Remaining profile follow-up: native Structure Theme catalog assignment/clear,
global preference edits while overridden, RTL/narrow and surface permutations.
Native follow-up: inspect fresh 7ea33671 captures, compact Navigation Layout
cards and stacked description margins, rebuild and compare General/Notifications.
Capture labels are not coverage: the last Settings invocation toggled navigation
while About stayed open; that image must not count as a Settings page capture.
1. Repair screenshot-backed shared layout and original-logo contrast (P06-01/02).
2. Trace additional-account command resolution, then implement provider/account
   instance identity, ordering and badge settings end-to-end (P06-03/04/07).
3. Reconcile app/native identity, background motion taxonomy and design batches
   (P06-05/06); expand and verify Profiles/Collections (P06-08).
4. Add complete workflow help and owner-focused About with accurate upstream/tool
   credit (P06-09/10). Prepare release files and installer evidence (P06-11).
5. Verify source, native visuals, credentials boundaries and exact GitHub identity;
   publish only after the specified owner account is verified (P06-12).
6. Implement the persistent notification center and unread badge (P06-16),
   covering alert producer ingestion, redacted logs, read state, dedup and
   evidence-backed offline recovery. Complete native and persistence checks.

## Continuation Wave 1 (2026-09-14) — started and partially completed

Started: legal quick-close, structure registry audit, structure Pin/Close
consistency fix (real drift found across ReelSurface/NotchDetails vs.
FlowSurface, fixed with shared component + regression tests), partial
loading-state audit. Completed and verified: commits `70531577`,
`a26e8ffb`, `534d9519`, `a33113ad`. Not completed: safe-area system, the
owner's other screenshot-defect categories, theme-composition Apply
dialog, unified loading-visual language, native structure QA matrix. Full
detail: `docs/validation/STRUCTURE_SYSTEM_AUDIT.md`,
`docs/validation/LOADING_STATE_MATRIX.md`,
`docs/validation/CLAUDE_EXECUTION_SEQUENCE.md`.

## Wave 3 continuation — 2026-09-22

Preserved inherited dirty onboarding implementation and added capability-derived flow, profile-scoped cookie import, protected-key routing, cancellation/fixture/source isolation and CLI execution hardening. Automated gates and exact remaining evidence limits are recorded in `docs/validation/WAVE3_IMPLEMENTATION_REPORT.md`. Native closure remains DEFERRED — ENVIRONMENT BLOCKED. Release gate CLOSED; no Personal promotion. This is not whole-product completion.


## Master Goal continuation — 2026-09-22

The owner's two master documents extend execution through remaining Wave 3, product completion, historical/cross-wave reconciliation, security/OSS and release preparation. Track the full objective in `docs/validation/GOAL_MODE_MASTER_EXECUTION.md`; no earlier requirement is silently dropped. Current increment closes Dev simulated login, cancellation finalization and simulated-success/live-refresh isolation, with generic challenge errors and regression coverage. Full tests pass (frontend1564/228, desktop561+1ignored, core1858, CLI1). Native remains deferred and release CLOSED. Next: verify capability reporting declarations and complete remaining registry/scenario reliability coverage; then historical reconciliation and product-completion work. Goal remains ACTIVE, not complete.

### Reporting evidence checkpoint — 2026-09-22
Wave 3 reporting now requires observed response evidence; no legacy reset/cost guarantee. OpenRouter spend-only and Antigravity unknown/empty quota rows remain informational, and known zero remains valid. Independent review and adapter/bridge regressions completed. Current tests: frontend1568/228, desktop564+1existingignored, core1860, CLI1; TypeScript/build/clippy/fmt/secret/diff checks pass. Native remains deferred, release CLOSED. CROSS_WAVE_REGRESSION_MATRIX.md now tracks22mandatory interactions plus the repaired observation flow; full historical reconciliation and remaining provider capability/scenario audit remain open. Canonical post-commit Dev identity must be captured before treating the binary as current.

### Historical inventory and connection-method checkpoint — 2026-09-22
All three historical ledgers have been read completely. ALL_WAVES_RECONCILIATION_MATRIX.md now preserves the original phases, numbered families and superseded decisions with current implementation/test anchors and explicit acceptance gaps; CROSS_WAVE_REGRESSION_MATRIX.md remains the interaction gate. Credential cancellation and unsupported browser offerings are repaired. The current source also preserves actual API-key/device/CLI provenance across desktop and CLI, with independent review and full tests (frontend1568/228, desktop569+1existingignored, core1868, CLI1). No native/live-auth or full Wave3 PASS is claimed. Next: harden the preexisting raw Copilot gh-token fetch through the trusted bounded runner; finish remaining provider scenario/capability/stress work, then Product Completion and release gates. Personal and published v0.11.0 remain unchanged.

### Bounded credential subprocess checkpoint — 2026-09-22

- Source commit `f974936e`: Copilot uses the curated, bounded supervisor for CLI credential reads; secret output stays outside diagnostics, future drop cancels the process, and incomplete output fails closed.
- Windows fixture helper and positive-startup assertions corrected; 19 supervisor tests pass. Full Rust: desktop569/1existingignored, core1874, CLI1, doctests0. Clippy/fmt/diff/4258-file secret scan pass. Independent findings repaired and re-reviewed; no live credentials used.
- Exact final Dev HEAD/hash follows in `.local/wave3-gh-dev-build.log`; no native UI or release PASS is inferred. Remaining method/scenario coverage, Product Completion, native/security/OSS/RC gates retain their prior status. Personal/v0.11.0 unchanged.
