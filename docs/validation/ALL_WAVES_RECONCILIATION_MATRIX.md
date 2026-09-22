# Historical waves — current reconciliation

Source checkpoint: `04776618c03e1ea6ae7dcd2ccbefb616f7da4121`, clean before this documentation packet. The three authoritative ledgers (`tasks/MASTER_REQUIREMENTS.md`, `tasks/plan.md`, `tasks/todo.md`) have been read completely. This index preserves their distinct numbering systems; `C1` is not `C01`, and Product V2 Wave 1 is not the later Structure Wave 1. The duplicated historical E08 descriptions remain separate obligations below.

This is an acceptance inventory, not blanket reacceptance. **PARTIAL** means implementation/evidence exists but the original requirement's complete current acceptance is unproven. **SUPERSEDED** applies only to an explicitly replaced design, never to a missing invariant. No entire historical wave is promoted to PASS by a green aggregate suite. No current native acceptance is claimed. Native closure is **ENVIRONMENT BLOCKED** under the current master; old screenshots remain historical.

## Evidence and path key

Paths below are repository-relative. `UI` = `apps/desktop-tauri/src`, `SHELL` = `apps/desktop-tauri/src-tauri/src`, `CORE` = `rust/src`, `VALIDATION` = `docs/validation`. A component's `.test.ts(x)` means its existing colocated test; Rust tests are in the named module unless otherwise specified. These are located regression anchors, not assertions that every original criterion has a test.

| Key | Current implementation | Automated evidence / limits |
|---|---|---|
| Identity | UI/design-system/logoAppearance.ts; UI/surfaces/brandIdentity.test.tsx; UI/surfaces/settings/tabs/AboutTab.tsx | logoAppearance.test.ts, brandIdentity.test.tsx, AboutTab.test.tsx. Native icon readability and Windows header identity remain open. |
| Surfaces | UI/surfaces/flow-surface, reel, notch, top-arc; SHELL/surfaces.rs; CORE/surface_layout.rs | TopArc.drag.test.tsx, TopArc.qaFixture.test.tsx, NotchSurface.test.tsx; surface placement/geometry tests and Rust placement tests. See WAVE1_NATIVE_QA_HANDOFF.md for exact render-family mappings. |
| Themes | UI/design-system/themeCatalog.ts, themeResolution.ts, visualComposition.ts, appearanceComposition.ts; CORE/settings/appearance_composition.rs | Colocated resolver tests; UI/surfaces/settings/ThemeStructureMatrix.test.tsx; ApplyThemeSheet.test.tsx. Rendering tests do not establish visual contrast. |
| Presentation | UI/surfaces/settings/tabs/ProviderDisplayTab.tsx, ProviderIdentityGallery.tsx, UsageDisplaySection.tsx | Colocated tests; UI/components/orbit/ProviderIdentityThemeMatrix.test.tsx. Independent physical-limit/source truth must survive every consumer. |
| Collections / profiles | UI/surfaces/collections/CollectionsNativeView.tsx, collectionModel.ts; UI/surfaces/settings/tabs/ProfilesTab.tsx; CORE/settings/collections.rs, profiles.rs; SHELL/shell/collections_window.rs | Colocated component/model tests; Rust settings/profile tests. Actual detached-window lifecycle is separate. |
| Shell / navigation | UI/surfaces/Settings.tsx; UI/surfaces/settings/settingsNavigation.ts, SidebarControls.tsx; UI/surfaces/settings/providers/ProvidersSidebar.tsx | Settings.test.ts, settingsNavigation.test.ts, SidebarControls.test.tsx, ProvidersSidebar.test.tsx. Maximize/Snap and native resize need Windows evidence. |
| Provider connection | CORE/connection_capabilities.rs, cli_dependencies.rs, connection_security.rs; SHELL/commands/connection.rs, providers.rs, system.rs; UI/surfaces/settings/providers/connect/ProviderConnectFlow.tsx; UI/surfaces/settings/providers/ProviderDetailPane.tsx | Rust registry/security/fixture tests; colocated flow/detail tests. Method selection versus actual verification source has open review findings. Live credentials are not fixture evidence. |
| Data / analytics | CORE/dashboard_data.rs, history.rs, pricing_eligibility.rs, cost_scanner.rs; UI/hooks/useDashboardSnapshot.ts, useDashboardAnalyticsModel.ts; UI/surfaces/dashboard/analytics | Rust semantic tests; hook/selector tests; analytics component tests. Exports, account scope, every adapter and every cross-wave consumer require final sweep. |
| Provider rail / resets | UI/surfaces/dashboard/analytics/ProviderRail.tsx; UI/components/providers/ProviderResets.tsx; CORE/core/reset_inventory.rs; CORE/settings/provider_instances.rs | ProviderRail.test.tsx (bounded 1/6/12/24/40/70, 3/4 choice, circular reorder seam, real plan, account isolation); ProviderResets.test.tsx; Rust inventory/settings tests. No inferred company-wide cause. |
| Backgrounds | UI/design-system/backgroundCatalog.ts, WorkspaceBackdrop.tsx, backgroundMotion.ts; CORE/workspace_backgrounds.rs; SHELL/commands/workspace_backgrounds.rs | Colocated catalog/backdrop/motion tests and Rust import validation. Source guards pause/clean up interaction; actual visual quality and CPU/GPU cost remain unverified here. |
| Controls / loading | UI/components/analytics/QuotalisSelect.tsx, QuotalisMultiSelect.tsx; UI/design-system/QuotalisLoadingStates.tsx | QuotalisSelect.test.tsx, QuotalisLoadingStates.test.tsx; LOADING_STATE_MATRIX.md. Whole-product keyboard/focus and all async consumers remain open. |
| Tray | CORE/settings/provider_tray.rs, tray/provider.rs, tray/dpi.rs, token_periods.rs; SHELL/provider_tray.rs, tray_bridge.rs | Rust renderer/lifecycle/UTF-16/coverage tests; WAVE2_NATIVE_QA_HANDOFF.md. Renderer and tooltip tests are not Explorer/native shell proof. |
| Notifications | CORE/notifications.rs, notification_journal.rs; UI/surfaces/settings/NotificationCenter.tsx; UI/hooks/useNotificationHistory.ts | Journal tests and compat_tests.rs with frozen legacy_v0_11_0.rs; component/hook tests. Actual header/provider artwork and activation remain native gates. |
| Packaging / safety | scripts/dev-preflight.mjs, scripts/build-dev-verified.mjs; SHELL build identity and fixture guards | Canonical Dev build at this source checkpoint passed with embedded HEAD and identical source/copy SHA256. Installer execution and final stable candidate are not covered. |

The latest complete automated run at this checkpoint: frontend **1,568 tests / 228 files**; desktop **564 passed / 1 existing ignored**; core **1,860 passed**; CLI **1 passed**; doctests **0**. TypeScript, production frontend build, workspace Clippy, formatting, secret scan and diff checks passed. Logs: `.local/wave3-reporting-{full-front,full-rust,tsc,build,clippy,dev-build}.log`. These counts are observations, not acceptance targets. See WAVE3_IMPLEMENTATION_REPORT.md for scope. Current evidence is reusable only while its relevant source remains unchanged.

## Ledger families and original phases

Each row's native evidence is **none current / blocked** unless stated otherwise. Original goals and major requirements are retained together to avoid silently dropping a family. Action columns are remaining acceptance, not authorization to redo accepted systems.

| ID / original stage | Original goal and major requirements | Current implementation / tests (key above) | Current native evidence | Status | Regression risk and required action |
|---|---|---|---|---|---|
| A01–A06 — identity | Original app/provider glyphs, logo prominence, finish propagation, artwork integrity | Identity; Themes; Tray | None current | PARTIAL | Inspect original assets across themes, DPI, taskbar and notifications; do not redesign glyphs. |
| B01–B14 — presentation contract | Structure × presentation × placement × identity, docking, native fit and independent controls | Surfaces; Themes; Presentation | None current | PARTIAL | Complete all-form geometry/interaction sweep, including actual monitor work areas. |
| C01–C06 — independent Collections | Detached groups, per-item customization, persistent layout | Collections / profiles | None current | PARTIAL | Exercise multiple detached collections, restore/persistence and isolation. |
| D01–D12 — usage and actual auth | Independent ordered physical limits, selection, presentation and real supported account connection | Presentation; Data / analytics; Provider connection | None current | PARTIAL | Verify chosen source/account reaches all displays; finish current Wave 3. |
| E01–E07 — reference theme library | Full visual identities across all structures, original mark integration | Themes; Identity | None current | PARTIAL | Inspect visual distinction/contrast and all states, not only signature uniqueness. |
| E08 — preview/catalog obligation | Reference-driven preview coverage recorded in opening ledger text | Themes; Presentation | None current | PARTIAL | Retain this obligation separately from the later reused E08 identifier. |
| E08 — provider identity obligation | Provider identity independent of structure with semantic state priority | Themes; Presentation | None current | PARTIAL | Verify inheritance/override and warning contrast through all consumers. |
| F01–F13 — whole app/settings/language | Every page, coherent ownership, window lifecycle, navigation, Arabic/English | Shell / navigation; Controls / loading; Identity | None current | PARTIAL | Current responsive/RTL/focus matrix and page-density inspection required. |
| G01–G08 — events/notifications | Reset events, synchronized status, preferences, quiet/sound/custom alerts | Notifications; Provider rail / resets | None current | PARTIAL | Reconcile all producers/history/delivery and physical-limit subscriptions. |
| H01–H10 — quality/release | Performance, evidence, installer, security and public delivery | Packaging / safety; all keys | None current | PARTIAL | Full current release gates; historical publication is not future RC acceptance. |
| Foundation Task 0 — approved forms | Freeze requested structure family | Surfaces | Historical only | PARTIAL | Reconcile current registry/form requirements rather than restoring old counts. |
| Foundation Task 1 / plan Phase 1 | Presentation contract and native layout | Surfaces; Presentation | Historical only | PARTIAL | Preserve one native coordinate authority and independent presentation. |
| Foundation Task 2 / plan Phase 2 | Flowline vertical slice and shared composition | Surfaces; Themes | Historical only | PARTIAL | Verify current shared families; no duplicate structure engine. |
| Foundation Task 3 / plan Phase 3 | Form reflow, settings and presentation proof | Surfaces; Shell / navigation | Historical only | PARTIAL | Current resize/content growth/keyboard proof. |
| Foundation Task 4 / plan Phase 4 | Final interaction proof and theme protocol | Themes; Surfaces | Historical only | PARTIAL | Replace stale proof with final candidate evidence. |
| Foundation material-only / one-overlay restrictions | Earlier limited theme/overlay direction | Later B/C/E requirements; modern Themes and Collections | Not needed for removed restriction | SUPERSEDED | Only the restrictive design is replaced; lifecycle and truthful presentation remain required. |
| Collections C1 — model | Independent collection domain | Collections / profiles | None current | PARTIAL | Review all persisted fields and migration. |
| Collections C2 — view | Collection workspace/native representation | Collections / profiles | None current | PARTIAL | Current interaction and visuals. |
| Collections C3 — persistence | Preserve user collection layout/settings | Collections / profiles | None current | PARTIAL | Restart/round-trip and compatibility evidence. |
| Collections C4 — native islands | Independent native window feasibility | Collections / profiles; Surfaces | None current | PARTIAL | Native multiple-window/z-order proof. |
| Collections C5 — docking | Magnetic placement and anchors | Surfaces | None current | PARTIAL | Monitor/DPI and persistence proof. |
| Collections C6 — presentation contract | Shared independent presentation | Presentation; Collections / profiles | None current | PARTIAL | Verify no collection bypass of shared resolver. |
| Collections C7 — previews | Actual rendering previews | Collections / profiles; Themes | None current | PARTIAL | Compare preview and runtime. |
| Collections C8 — each concept | Distinct requested structures/themes | Surfaces; Themes | None current | PARTIAL | Per-concept evidence; no count-only acceptance. |
| Collections C9 — events | Real state/reset event model | Notifications; Provider rail / resets | None current | PARTIAL | Producer and scope audit. |
| Collections C10 — notification settings | Preferences and sound/quiet controls | Notifications | None current | PARTIAL | Test persisted selection and muted-delivery/history split. |
| Collections C11 — custom notification UI | Styled meaningful alert presentation | Notifications | None current | PARTIAL | Current contrast/RTL and all alert states. |
| Collections C12 — native notifications | Windows delivery and identity | Notifications; Identity | None current | PARTIAL | Native headers, artwork and activation. |
| Collections C13 — navigation | Organized pages/destinations | Shell / navigation | None current | PARTIAL | Reconcile later consolidation, no duplicate shallow pages. |
| Collections C14 — identity | Original brand across surfaces | Identity | None current | PARTIAL | Native finish/glyph proof. |
| Collections C15 — startup | Window/startup behavior | Shell / navigation; Packaging / safety | None current | PARTIAL | Cold launch/minimized/single-instance evidence. |
| Collections C16 — installer | Safe upgrade/install package | Packaging / safety | None current | PARTIAL | Final candidate installation/rollback in safe environment. |

## Design and analytics evolution

| ID / original stage | Original goal and major requirements | Current implementation / tests | Current native evidence | Status | Regression risk and required action |
|---|---|---|---|---|---|---|
| 2026-09-06 active redesign / reference-driven identity wave | Complete product redesign, reference identities, Crescent Rail, docking | Surfaces; Themes; Collections / profiles | Historical only | PARTIAL | Preserve requested families; verify current composition and placement. |
| Settings window lifecycle packet | Tab switches preserve maximize/Snap | settingsNavigation.ts explicitly avoids reentering Settings; colocated tests | Historical only | PARTIAL | Native maximize/Snap switch/reopen sequence. |
| Settings content-origin packet | Correct content origin and clipping | Shell / navigation | Historical only | PARTIAL | Current safe gutters and scroll origin. |
| Top/bottom navigation reflow | Horizontal navigation and wheel mapping | settingsNavigation.ts and tests | Historical only | PARTIAL | Confirm retained modes are reachable and responsive. |
| Cross-structure theme identity packet | Same identity across structures | Themes | Historical only | PARTIAL | Final all-form/Light/RTL matrix. |
| Provider workspace density packet | Dense readable provider management | ProvidersSidebar and detail components/tests | Historical only | PARTIAL | Inspect short/narrow/pane resize with actual onboarding content. |
| Independent usage-limit editor packet | Order and style each true physical limit | Presentation | Historical only | PARTIAL | Verify all providers retain independent limit semantics. |
| Theme-adaptive official mark packet | Blend original glyph into selected identity | Identity; Themes | Historical only | PARTIAL | Contrast/safe-area evidence without asset substitution. |
| Curated theme-library expansion | Fifteen additional differentiated full identities | themeCatalog and themeCatalogExpansion; catalog/matrix tests | Historical only | PARTIAL | Verify current catalog and visual quality; historical count is not runtime constant. |
| Provider identity studio / gallery | Global base and provider override, live preview | Presentation; visualComposition | Historical only | PARTIAL | Test independent source values and semantic state priority. |
| Shared surface interactions correction | Common hover/wheel/fold, no double bubbling | Surfaces; orbitalSurfaceRefresh.test.tsx | Historical only | PARTIAL | Stress focus/hover/drag transitions and cleanup. |
| Dedicated Provider Display page | Bounded identity/usage editors | ProviderDisplayTab and tests | Historical only | PARTIAL | Preserve functionality through later Appearance consolidation, not necessarily an extra nav page. |
| Settings density/responsibility and Arabic labels | Remove empty space; coherent settings and source labels | Shell / navigation; Presentation; locale registry | Historical only | PARTIAL | Current page-by-page RTL/density audit. |
| I01/I04/I05 — Dashboard modes/3D/Hybrid | Earlier selectable dashboard engine experiment | Replaced by J and current single operational/analytics architecture | Not applicable to removed modes | SUPERSEDED | Do not restore Three.js, Hybrid or mode switcher. |
| I02/I03/I06–I08 — retained Dashboard Studio obligations | Analytics, pricing provenance, sanitized errors, customization and audit | Data / analytics; Themes; Provider connection | None current | PARTIAL | Semantics/privacy remain required despite removal of 3D. |
| J01–J06 — Single Dashboard consolidation | One data-backed dashboard and removal of multi-mode runtime | Data / analytics; operational dashboard/rail | Historical c90b12a7 only | PARTIAL | Check dead routes/dependencies and replacement tests; later dedicated Analytics is intentional. |
| K01–K09 — professional product upgrade | Providers/auth, IA, shared customization, analytics truth, Demo and templates | Provider connection; Shell / navigation; Data / analytics; Themes | Historical 17c99c02 only | PARTIAL | Reconcile remaining full product requirements; Demo never becomes real data. |
| L01–L09 / Product V2 Wave 0 | Architecture audit and plan | Current ledgers; GOAL_MODE_MASTER_EXECUTION.md | Not required for audit | PARTIAL | Current completion matrix replaces stale scope assumptions. |
| Product V2 Wave 1 | Unified Settings and IA | Shell / navigation; Themes | Historical only | PARTIAL | Current settings/studio responsibilities and persistence. |
| Product V2 Wave 2 | Metric registry / data truth | Data / analytics | None current | PARTIAL | Final monetary/source/account contract sweep. |
| Product V2 Wave 3 | Reusable analytic primitives | Data / analytics; Controls / loading | None current | PARTIAL | Chart lifecycle, controls, keyboard/ARIA and truthful missing data. |
| Product V2 Wave 4 | Dashboard V2 | Data / analytics; Provider rail / resets | Historical only | PARTIAL | Current operational/analytics split preserves underlying truth. |
| Product V2 Wave 5 | Provider Operations | Provider connection | None current | PARTIAL | Modern Wave 3 is the completion path, not an independent registry. |
| Product V2 Wave 6 | Unified customization | Themes; Presentation | None current | PARTIAL | All scopes, overrides and migration. |
| Product V2 Wave 7 | RTL / performance | All UI keys | None current | PARTIAL | Fresh representative performance/RTL evidence. |
| Product V2 Wave 8 | Native final validation | Packaging / safety; prepared native matrices | None current | ENVIRONMENT BLOCKED | Requires supported real-window evidence. |
| L10 — inline Settings navigation | Expandable subpages under Settings | Shell / navigation | Historical only | PARTIAL | Keyboard/RTL and later deduplication of shallow pages. |
| L11 — Analytics Waves 2–4 continuation | Close metric/primitives/dashboard work | Data / analytics | Historical only | PARTIAL | Later code exists despite old unchecked bullets; do not bulk flip historical checkboxes. |
| L12 — Analytics V3 / Wave 4.5 | Professional visualization platform | Data / analytics; Controls / loading | Owner later rejected appearance | PARTIAL | Retain functional obligations; presentation direction replaced by L13. |
| L13 rejected A/B concepts | Earlier muted alternative concepts | Owner explicitly selected cosmic reference instead | Rejection recorded in ledger | SUPERSEDED | Do not use rejected concepts as accepted visual target. |
| L13 — Analytics V4 cosmic/master selection | Chosen space visual, planets, provider logos, truthful charts | Backgrounds; Provider rail / resets; Data / analytics | Historical iterations only | PARTIAL | Retain original logos; inspect current hierarchy and owner-selected imagery. |
| PRODUCT-V3 | Operational Dashboard, dedicated Analytics, clickable bounded rail, controls and provider operations | Provider rail / resets; Data / analytics; Provider connection | Historical evidence/incident only | PARTIAL | Current all-provider stress; preserve Dev isolation and source semantics. |

## Product, shell, safety and release stages

| ID / original stage | Original goal and major requirements | Current implementation / tests | Current native evidence | Status | Regression risk and required action |
|---|---|---|---|---|---|---|
| POST-RELEASE-01 | Forensic lineage, Dev identity and rollback | Packaging / safety; current clean lineage | Historical only | PARTIAL | Reconcile final candidate identity and remote state; preserve recorded Personal incident. |
| SHELL-01 | Compact header, resizable/collapsible RTL sidebar | Shell / navigation | Historical only | PARTIAL | Current responsive/persisted width and mouse/keyboard splitter checks. |
| SHELL-02 | Related navigation, shared backgrounds | Backgrounds; Shell / navigation | WORKSPACE_BACKGROUNDS_NAVIGATION.md is historical | PARTIAL | Workspace coverage and scope independence, actual performance. |
| SHELL-03 | Compact provider panes, switches, standalone About, background filters/import | Backgrounds; ProvidersSidebar; Identity | WORKSPACE_LIBRARY_PROVIDER_LAYOUT.md is historical | PARTIAL | Current safe gutters, splitters, import/delete and enabled-versus-authenticated. |
| SHELL-04 | Shared controls, cinematic backgrounds, monitoring studio, notification identity | Controls / loading; Backgrounds; Tray; Notifications | SHELL04_MONITORING_AND_SPACE_WORKSPACE.md is historical | PARTIAL | Native tray/header proofs remain open; don't confuse flyout zoom with raster size. |
| QA-05 | Every control/feature, visual/security/installer audit | All keys; QA05_NATIVE_VISUAL_REVIEW.md | Historical atlas, not exhaustive/current | PARTIAL | Current inventory plus actual supported native environment; no arbitrary Windows compatibility claim. |
| P06-01 | Original legible provider logos | Identity; Tray | None current | PARTIAL | Check all providers and backgrounds/DPI. |
| P06-02 | Compact General/Notifications/Appearance/Menu Bar/Profiles | Shell / navigation; Collections / profiles | None current | PARTIAL | Current page-density and bottom-clearance evidence. |
| P06-03 | Additional Codex accounts, independent instances, badge/order | Provider connection; Provider rail / resets; SHELL/commands/provider_instances.rs | None current | PARTIAL | Current supported login and account isolation, not ambient-session success. |
| P06-04 | API/manual cookie/browser profile workflows | Provider connection | None current | PARTIAL | Minimum cookie collection and each real method's verification; credentials required for live acceptance. |
| P06-05 | Original finish on native identity/notifications | Identity; Notifications; Tray | None current | PARTIAL | Windows header image remains mandatory native gate. |
| P06-06 | More structures/themes/backgrounds with actual motion | Surfaces; Themes; Backgrounds | None current | PARTIAL | Distinction, quality and motion evidence; no static item falsely called animated. |
| P06-07 | Multiple independent account/provider tray icons | Tray | None current | PARTIAL | Verify account binding, toggle lifecycle and DPI in native shell. |
| P06-08 | Rich Profiles/Collections workflows | Collections / profiles | None current | PARTIAL | Complete persistence, restoration and independent configuration evidence. |
| P06-09 | In-product documentation for all areas | About/help and studio copy; current content audit pending | None current | PARTIAL | Inventory every main workspace's help and correct stale claims. |
| P06-10 | About/creator/tool attribution/contact | Identity; legal documents | None current | PARTIAL | Current legal/source consistency and product-first revision. |
| P06-11 / P06-15 | Owner GitHub, professional downloads and verified installer/support | Packaging / safety; QUOTALIS_0_11_0_PUBLICATION.md | Publication is historical | PARTIAL | Preserve v0.11.0; new candidate needs every gate. Direct owner identity confirmation superseded private-email proof, not release gates. |
| P06-12 | Full requirements/security/native evidence | All keys; current reconciliation and cross-wave matrices | None current | PARTIAL | No broad PASS from component coverage. |
| P06-13 | Last/weekly/banked resets, inventory and expiry | Provider rail / resets | None current | PARTIAL | Audit every reset consumer; unknown is not No Reset; account drop is not company-issued reset. |
| P06-14 and seam correction | Eight physical badge/reset positions; 3/4 circular foreground, wheel, persisted order/anchor | Provider rail / resets; rail tests inspect seam/anchor/count and motion preferences | None current | PARTIAL | Native wheel/RTL/restart persistence and all indicator locations. |
| P06-16 and granular-subscription amendments | Persistent center/unread badge, event/received time, recovery, dedupe, per-physical-limit switches and sounds | Notifications; journal/compatibility/component tests | None current | PARTIAL | Full producer/subscription/startup reconciliation plus UI/native behavior. |
| P06-17 About revisions | Product-first About, final creator footer, original employer mark, motion/contact/project links | Identity; AboutTab tests | None current | PARTIAL | Current visual/footer/reduced-motion evidence and legal accuracy. |
| P06-17 second-approval wait | Earlier wait for a second owner review before publication | Later explicit owner authorization in ledger | Not applicable | SUPERSEDED | Authorization does not waive mandatory readiness gates. |
| P06-17 v0.11.0 publication | Publish original source/assets/features-first presentation | QUOTALIS_0_11_0_PUBLICATION.md (historical evidence) | Historical screenshot only | PARTIAL | Immutable published baseline; current remote/assets not reverified in this packet. Do not retarget or overwrite. |
| M — 71-section master / legal quick-close | Whole product, legal provenance and branding | LEGAL_OPEN_SOURCE_AUDIT.md; current LICENSE/NOTICE/THIRD_PARTY_NOTICES; all keys | None current | PARTIAL | Reaudit current dependencies/attribution and finish product; prior legal-only slice was not completion. |
| M — initial Continuation Wave 1 | Structure closure, theme composition, loading | Surfaces; Themes; Controls / loading | None current | PARTIAL | Later accepted Wave 1 supersedes the early progress snapshot, not its requirements. |
| Current Wave 1 code (1B–1F) | All structures, shared connectors/safe-area, accessible movement, composition/migration/loading/Dev QA | Surfaces; Themes; Controls / loading; WAVE1_NATIVE_QA_HANDOFF.md | None current | PARTIAL | Code baseline accepted by master; final cross-wave sweep still required. Don't rebuild without a reproduced defect. |
| Current Wave 1 native | DPI/work-area/all-form visual and interaction closure | WAVE1_NATIVE_QA_MATRIX.json | None | ENVIRONMENT BLOCKED | Execute only when supported real capture is available. |
| Current Wave 2 code / 2C rollback | Tray renderer/lifecycle/tooltips/tokens, notifications/privacy/history/legacy writes | Tray; Notifications; frozen legacy rollback fixture | None current | PARTIAL | Code baseline accepted; final regression and native completion remain separate. |
| Current Wave 2 native | Tray/Explorer/toast artwork/activation/Arabic | WAVE2_NATIVE_QA_MATRIX.json | None | ENVIRONMENT BLOCKED | Requires current Windows evidence; code paths alone don't prove icons. |
| Current Wave 3 | Complete truthful supported onboarding, security, reliability and fixtures | Provider connection; WAVE3_IMPLEMENTATION_REPORT.md; generated capability matrix schema 2 | None current | PARTIAL | Finish selected-method verification review, per-provider reporting/scenario coverage, stress and final adversarial acceptance. |
| Current Wave 3 native | Every method/state, Providers page, Light/RTL | WAVE3_NATIVE_QA_MATRIX.json | None | ENVIRONMENT BLOCKED | Prepared cases are READY, not PASS. |
| Master Goal A | Reconcile inherited work and preserve changes | GOAL_MODE_MASTER_EXECUTION.md; this matrix; coherent commits | Not required for source inventory | PARTIAL | Inventory exists; complete source/acceptance mapping as work closes. |
| Master Goal B | Finish Wave 3 | Provider connection | None current | PARTIAL | Above Wave 3 actions. |
| Master Goal C / Wave 4 | Product-wide backgrounds, IA, pages, controls, responsive/a11y/performance | All UI keys | None current | PARTIAL | Complete current full-product audit and repair actual findings after Wave 3. |
| Master Goal D | Native Waves 1–4 | Existing Wave 1–3 handoffs; Wave 4 matrix still required | None | ENVIRONMENT BLOCKED | New capability/evidence needed, not repeated prohibited capture attempts. |
| Master Goal E | Cross-wave security, OSS and rollback | Credential/journal tests; existing legal docs | None current | PARTIAL | Fresh whole-product/dependency/license/installer audit. |
| Master Goal F | Exact RC/public preparation | Packaging / safety; current repo/CI/release scripts | None current | PARTIAL | Final clean HEAD, version reconciliation, current artifacts/CI and truthful gallery. |
| Master Goal G | Publish only after every gate | Existing immutable v0.11.0 is not next release | None current | PARTIAL | Closed until code/security/OSS/CI/native gates pass; Personal remains frozen. |

## Closure rules and next work

Use `CROSS_WAVE_REGRESSION_MATRIX.md` for the mandatory interaction sweep; this historical index does not replace it. Both matrices must be refreshed at Wave 3 closure, Wave 4 closure and final RC. The number of rows is an indexing choice, not a count of independently delivered features; final totals must distinguish superseded subrequirements from whole waves.

Verified regressions repaired during current work include unsafe CLI candidate execution/cancellation boundaries, simulated sign-in escaping to live work, and unknown/spend-only rows counted as quota. Their bounded evidence is in WAVE3_IMPLEMENTATION_REPORT.md. Do not call the entire historical feature REGRESSED merely because an adjacent defect was repaired; retain the concrete defect and replacement test.

Next implementation gate is current Wave 3's selected-method/source/account verification and remaining provider-specific evidence, followed by Product Completion. No native, live-account, final accessibility, final performance, installer or release PASS is established by this document.
