# Active product backlog

Authority: `MASTER_REQUIREMENTS.md`; sequence and acceptance: `plan.md`.

- 2026-09-06 provider-display + shared-interaction continuation: separated
  Provider Display from Surfaces and Themes, with 24 provider presentation
  identities plus global/per-provider limit content, shape, direction, order and
  accent controls. Identity previews now reflect the saved bar/value mode instead
  of forcing both. Shared hover reveal, mouse-wheel paging and delayed folding now
  operate across every structure without double-cycling the Notch/Reel families.
  Repaired a real Windows/DPI heading collision by giving eyebrow, title and
  description independent grid rows, explicit line heights and invariant spacing;
  the same protection is applied to the Provider Display hero. Verification: 116
  frontend files / 637 tests, 17 Rust surface tests, 953 locale keys, TypeScript
  and production/native Debug builds pass. Fresh maximized native proof is
  `.local/proof/provider-display-text-overlap-fixed/01-providerDisplay.png` at
  1280x730 CSS px with no horizontal overflow. Current Debug executable runs as
  PID 12012; physical drag/DPI acceptance, complete collection rendering and
  release packaging remain open. SHA256
  `F544ED73F376B062AC490A42DB5962099F7002D893903D1BA33DDA5B804E7115`.

- 2026-09-06 surface-control continuation: audited all fifteen native screenshots
  against the current real-renderer gallery. The structure catalog itself is now
  materially ahead of those captures (14 themed real footprints), so this packet
  targeted the remaining primitive control layer: interaction options are structured
  rows with title, helper, switch and an explicit unavailable reason; opacity, scale
  and hide-delay controls expose live values; demo and size actions have coherent
  grouping and selected states in dark and light appearances. Added a regression for
  live values and unavailable explanations. A repeatedly flaky tray sizing test was
  traced to two competing initial measurement passes; the duplicate layout-key pass
  is now skipped on mount. The timing test passed five consecutive focused runs and
  the full suite under concurrent build load. Verification: 109 frontend files / 567
  tests, 923 locale keys and production build pass. Fresh native Debug build
  (2026-09-06 14:19:48 local) runs on Surfaces as PID 34732, SHA256
  `1AFB2E507D0A6B190DBEE1DEEF89657589D3CFE4C82A70764C49263EDF0B96BC`.

- 2026-09-06 settings-layout continuation: replaced the cramped navigation
  selector with three localized, explanatory preview cards and added its nine
  strings to both English and Arabic. General, Notifications and Advanced now
  use a balanced two-column mosaic on wide windows while retaining a single
  column at narrow widths; full-width navigation and notification-preview
  sections keep their natural content height. A real 1440px light-mode proof
  exposed and led to a fix for a notification preview that grid sizing had
  compressed into a clipped strip. Top and bottom navigation now preserve whole
  labels, including Notifications, and remain compact in two rows at 720px.
  Browser evidence covers side/dark/1440px, top/light/1440px,
  bottom/dark/720px and side/light/398px with no horizontal clipping. Full
  verification: 109 frontend files / 566 tests, 1,468 core tests, 425 Windows
  tests, 923 locale keys, production build, strict Clippy, Rust format and diff
  checks. Fresh native Debug build (2026-09-06 14:09:57 local) runs on General
  as PID 11328, SHA256
  `D932D1B24B0D34DD98C7FBC04DF78F7B6734520A8B4160B400136D7CB449F59A`.
  Native pointer/resize acceptance remains open because no native application
  surface is exposed to the available computer-use channel.

- 2026-09-06 notification-center continuation: replaced the text-only summary
  with a compact branded notification specimen that uses the official QuotaArc
  mark, the actual provider icon component, a semantic consumption meter and
  simultaneous used/remaining threshold language. Localized the preview status,
  helper/disclaimer and provider/limit override heading in English and Arabic.
  Consolidated the repetitive event cards into a denser two-column control panel
  that collapses cleanly to one column, without decorative hover movement. Browser
  proofs at 398px confirm both dark and light appearances with no clipped state or
  horizontal overflow. Native threshold, exhaustion, milestone, session transition
  and reset toasts now show used and remaining quota together, localize their title,
  reason and session/5-hour/weekly label from the application language, and include
  explicit Arabic predictive-warning copy. Full frontend verification remains 108
  files / 565 tests; all 1,468 core tests pass, locale parity is 914 keys, and the
  production/native Debug builds plus strict Clippy, Rust format and diff checks
  pass. Fresh native Debug build (2026-09-06 13:51:54 local) runs on the
  Notifications page as PID 74732, SHA256
  `413F461B4A0A7EDE19E2BFE60D53A65A1279AEB011FFAC0D5F7E45144B589C9D`.
  Native toast appearance and input acceptance remain open because computer-use
  still exposes no native Windows application surface.

- 2026-09-06 magnetic docking + full-anchor continuation: replaced the
  release-only 24px feel with DPI-scaled live Windows magnetism during the
  native move loop. The window now attracts independently on both axes, so
  approaching two walls produces a true corner snap without resizing the
  structure; release persistence still owns the final anchor and safe monitor
  clamp. Added pure Windows coverage for four walls, four corners and an
  untouched free drop. Fixed the missing Flowline corner detail placement and
  Horizon top/bottom-corner core/detail direction, including edge-aware hidden
  tabs. Extended the real-renderer compatibility matrix from 252 to 2,268
  cases: 9 identities × 14 structures × 9 anchors × compact/expanded. Browser
  proofs at 398px confirm expanded Horizon/bottom-right opens upward and
  expanded Flowline/top-left opens inward. Current checks: 108 frontend files /
  565 tests, 425 Windows tests, 896 locale keys, production build, strict
  Clippy, Rust format and diff check pass.
  Fresh native Debug build (2026-09-06 13:21:00 local) runs as PID 35332,
  SHA256 `AB17657B71E57C3020E23312C4A7558C3EF2FE08424DD58993354E3EF94A7125`.
  Computer-use still exposes no native Windows app surface, so physical mouse
  acceptance of the new Win32 hook remains open; the executable and process
  provenance are verified.

- 2026-09-06 complete-identity continuation: repaired a real catalog fallback
  that assigned the same Orbit motion to all nine live themes. Every identity
  now has a distinct bounded motion character and tempo (150–230ms), plus its own named visual
  signature, inset treatment, meter cap, connector material and official-mark
  treatment. These paint-only tokens flow through the shared Notch, Reel and
  Flow renderers without changing footprints or provider colors. Theme cards
  now identify signature and motion, and production cards expose compact
  Frame/Meter/Motion facets; Lens is the default comparison
  structure because it exposes more material than the micro Satellite view.
  Added a browser-safe nine-theme identity lab and fixed a light-mode selector
  leak that had painted internal structure buttons white. Inspected the compact
  398px light proof with no horizontal clipping; dark/light switching and all
  nine identity rows are present. Added an initial 252-case React compatibility matrix
  covering 9 themes × 14 structures × compact/expanded, and visually checked
  Seam/light, Orbit Reel/dark and Horizon/light without clipping. Current checks:
  108 frontend files / 565
  tests, 1,467 core tests, 423 Windows tests, 896 locale keys, production build,
  strict Clippy, Rust format and diff check all pass. Fresh native Debug build
  (2026-09-06 13:06:56 local) is running on the Themes page as PID 16220,
  SHA256 `680CCB94E0B8529140B27C6DEC9F10A8C17B1687EFB20BB715925D19029F31EB`.
  Computer-use still reports zero Windows applications, so native visual/input
  acceptance remains open together with the full Theme × Structure × View ×
  Anchor matrix.

- 2026-09-06 Settings geometry + structure gallery continuation: tab changes
  no longer send a native surface transition when Settings already owns the
  shared window, and a visible same-mode retarget no longer calls show/focus.
  Focused React and Rust regressions pass. Replaced the structure catalog's
  placeholder feel with real themed compact renderers, truthful logical
  footprint badges, a full-width responsive catalog and compact docking row.
  Fixed the 398px hero compression without horizontal overflow. The visual
  proof route had become a blank screen after localized surface renderers were
  introduced; it now uses a browser-safe locale context, and a top-level error
  boundary prevents unexplained black windows. Full frontend: 105 files / 560
  tests. Final verification for this packet: 106 frontend files / 561 tests,
  1,467 core tests, 423 Windows tests, 896 locale keys, strict Clippy, Rust
  format, diff check and production build all pass. Fresh native Debug build
  (2026-09-06 12:35:38 local) is running as PID11328, SHA256
  `70E915E64DA3C4791E6B0911382F7E4B990CEE7740B1E3B7D4CA2FFB7C1B1D2B`.
  Native resize/maximize/visual input is still open because computer-use still
  reports zero Windows applications.

- 2026-09-06 independent notification categories: added persisted, independently
  switchable High usage, Critical usage, Limit exhausted, Provider incident,
  Session depleted and Quota restored preferences while retaining the separate
  predictive-pace control. The Rust notification engine now gates each matching
  event without suppressing unrelated categories, and recovery always clears its
  depleted dedupe key even when the restored toast is disabled. Replaced the flat
  controls with compact semantic event cards and repaired their light-theme token
  inheritance. Browser proof was inspected in both dark and light at 1280x720;
  the grid uses the available width without the former phantom sidebar. Added
  an independently enabled arbitrary milestone interval from 1% to 100%; its
  first observation establishes a quiet baseline, later crossings notify once,
  and a quota reset re-arms that lane. Added independently switchable scheduled-reset and
  unexpected-early-reset events for every real quota lane. Classification uses
  the prior announced boundary plus a substantial usage drop, rejects stale
  out-of-order samples, and ignores small reset-time jitter. Banked Reset Credit
  is now a separate switch backed by Codex's structured reset-credit window: the
  first observation is quiet, only a true count increase alerts, and a decrease
  clears/re-arms the lane. Disabled monitoring still advances its baseline so
  re-enabling cannot replay stale credits. Current verification: 104 frontend
  files / 556 tests, 1,466 core tests, 421 Windows tests, 891 locale keys and a
  clean production TypeScript/Vite build.
  Added three independent custom-WAV/test lanes for scheduled reset, unexpected
  early reset and banked reset credit. Their settings migrate safely from older
  files and all nine locale bundles carry explicit labels and explanations;
  locale parity is now 891 keys. Cross-process dedupe now persists threshold,
  milestone, status, session, expected/unexpected reset, banked-credit and
  predictive warnings. The bounded store contains SHA-256 fingerprints instead
  of raw account identities, restores across launches, rearms on recovery and
  ignores corrupt state without stopping refresh. Current verification: 104
  frontend files / 556 tests, 1,466 core tests, 421 Windows tests and a clean
  production build. Strict Clippy for both Rust packages also passes with
  warnings denied. The final native branded renderer remains open. Fresh native
  Added persisted local-time quiet hours with normal, overnight and full-day
  intervals. Delivery is muted while refresh, transition tracking and dedupe
  continue, so ending quiet hours does not replay threshold/reset events that
  happened inside the interval. The responsive time controls include Arabic
  RTL copy and light/dark native input treatment; locale parity is 896 keys.
  Current verification: 104 frontend files / 557 tests, 1,467 core tests, 422
  Windows tests, strict Clippy, format/diff checks and the production build all
  pass. Fresh native Debug build (2026-09-06 12:04:34 local) is running as PID
  65376, SHA256
  `928CC21E743E59DF722E176621A0C736F52BD9FCB87C4B1C180650FB0930BE9F`.

- 2026-09-06 Arabic/RTL foundation: added Arabic as a persisted ninth language
  (`arabic`, `ar`, `ar-SA`, `العربية`) across Rust, IPC catalog and TypeScript.
  Locale loading now sets the document `lang` and `dir` before publishing the
  bundle. Added 81 reviewed Arabic shell/general/notification/usage strings;
  untranslated keys intentionally fall back to English, so full professional
  translation remains open. The settings sidebar now follows RTL to the right.
  Browser regression first caught a double-mirrored grid (nav remained left),
  then verified the fix at 440x720: nav x=382 width=58, content x=0 width=382,
  no horizontal overflow; screenshot `output/playwright/settings-rtl-light-440-fixed.png`
  inspected. Full frontend 103 files / 547 tests, 17 locale core tests, nine
  language tests, nine native locale-command tests and production build pass.
  All-page Arabic copy, mixed-direction provider labels, RTL top/bottom layouts
  and native visual acceptance remain open.
  Fresh native Dev build completed in 1m03s and is running as PID71804,
  SHA256 9B3FF6D126CE0DD4FFF17D053390120C20D24DCC08BB0AAC23207B7F8C90EDAC.

- 2026-09-06 notification-window architecture: provider threshold overrides now
  use the complete runtime provider catalog instead of a hard-coded Codex/Claude
  grid. The selected provider exposes independent provider, Session, 5-hour and
  Weekly lanes. Rust preserves `fiveHour`, maps a native 300-minute primary
  window to it, and inherits legacy `provider:session` values when an explicit
  five-hour value is absent. Safe future IDs and nonstandard minute cadences are
  preserved independently; model-specific, tertiary and named extra windows now
  enter threshold notification/hook evaluation too. Toast bodies convert internal
  IDs to readable labels. The notification preview uses the official shared mark.
  Focused frontend 18/18, full frontend 102 files / 546 tests, 12 notification
  core tests, core/native focused tests and production build all pass; locale
  parity remains 829 keys. Dark/light 440px screenshots were inspected with no
  horizontal clipping. Fresh native Dev build completed in 40.59s and is running
  as PID15864, SHA256 6269CCE6A190108B78157617B89B5CBAE0ED7903504D56B9E4E29B05A148E99A.
  Per-rule enable/interval controls, localized explanatory copy and native toast
  visual acceptance remain open, so the notification requirement is not complete.

- 2026-09-06 shared settings shell: replaced the legacy text-only header used
  by every settings page with `SettingsShellHeader`, the official About mark,
  active translated page heading, compact window actions and a restrained arc
  motif. About now consumes the same shared mark component. At <=560px the
  sidebar becomes a 58px icon rail while keeping accessible labels. Browser
  proof passes light 1280x800, dark 440x720, no horizontal overflow, and stable
  900x640 root/window geometry across six navigation targets. Full frontend:
  102 files / 545 tests; locale parity 829 keys; production build 699 modules.
  Fresh native Dev build succeeded in 23.29s and is running as PID73288,
  SHA256 8AA8AAE4B857DC2A83BFF182FE6525B7F6BEAF0ABAF73513B6D75B00344A28CC.
  Computer-use inventory still exposes browsers only and zero Windows apps, so
  native pixels/input/maximize remain unverified rather than inferred.

- 2026-09-06 Crescent Rail: registered in frontend/native settings and shared
  footprint table; compact height follows 1–3 visible providers, top/bottom rotate.
  Native envelope test passes; full frontend suite 101 files / 544 tests passes.
  Browser bounds pass nine positions with three visible synthetic providers.
  Right/top screenshots inspected: moved demo badge inside silhouette and grip
  away from last provider. Native running PID39560 predates Crescent; native
  visual, DPI, corners and full interaction acceptance remain open.

- 2026-09-06 integration gate: full frontend suite passes, 101 files / 542 tests.
  Production frontend build passes (829 locale keys aligned); native Dev build
  passes in 27.04s. Replaced verified Dev PID74476 only; launched PID39560 at
  07:20:18 local, target/debug/QuotaArc.exe, proof target settings:usageSpend.
  SHA256 C9FE0688363F7982D5FD3DEE8AECB504E0214BF3F06E3B1BFFB03F1207FD641D.
  Includes nine themes, shared finish/contour fixes, illustrated shape picker,
  and value-only spacing fix. Native visibility/input and full release acceptance
  still unverified. Dirty worktree preserved; no release/commit claim.

- 2026-09-06: Replaced shape-only dropdown with three illustrated native-radio
  choices (horizontal/vertical/ring), shared per-provider editor, explicit demo
  percentage explanation. Responsive stacked small layout, selected/focus states,
  no bitmap payload or animation loop. 12 editor/integration tests and TypeScript
  pass. Browser keyboard-arrow selection and no picker overflow verified at
  440/1100 viewport widths; both light-mode screenshots inspected. Other option
  families, Arabic labels, dark/RTL visual acceptance and native rebuild remain open.

- 2026-09-06: Fixed renderer CSS overriding shared identity finishes in Notch/Reel.
  Added a metallic Notch contour stroke clipped to its own silhouette (unique SVG
  clip IDs, decorative, unchanged envelope); deck front receives matching stroke.
  23 focused tests and TypeScript pass. Browser asserts radial identity finishes
  reach all three detail renderers for Sapphire/Eclipse. Increased capture viewport
  and inspected complete Sapphire screenshot, including Flow bottom. Full native,
  all-anchor and reference-fidelity acceptance remains open.

- 2026-09-06: Added Sapphire Observatory and Eclipse Ember runtime catalog entries
  and Rust validation support. Both use canonical provider colors, independent
  material/identity tokens and real gallery previews. 16 frontend theme/gallery
  tests, TypeScript and focused Rust catalog validation passed. Browser envelope
  matrix now covers 486 combinations. Captured both runtime previews; visible
  frame/material differs, but reference richness is not yet matched. Capture's
  bottom Flow area is cut by viewport capture, so no full visual acceptance claim.
  Dev PID74476 predates these themes; native rebuild and full-reference styling open.

- 2026-09-06: Started non-palette theme identity contract: seven distinct bounded
  detail-corner, inset-relief, edge-treatment and label-font combinations consumed
  by shared Notch/Reel/Flow CSS. Native dimensions and quota semantics unchanged.
  Fixed material background bleeding into ring meters. Ten theme/material tests
  and TypeScript passed. Browser matrix: 378 combinations (seven themes × prior
  54 cases), no measured inner clipping. Ember Alloy screenshot inspected; full
  theme art direction, reference-library fidelity, motion and all-anchor/native
  visual acceptance remain open. This is not completion of full theme identities.

- 2026-09-06: Value-only limits no longer retain the hidden ring/vertical meter
  grid column. Fill direction is disabled with an explanation while value-only
  is selected; saved shape/direction are retained. RED/GREEN regressions and 15
  focused tests pass; TypeScript passes. Browser envelope matrix expanded to
  54 combinations (3 renderers × 3 shapes × 3 contents × 2 directions), all
  passed inner text/scroll and panel-bound checks. This is the default-anchor
  synthetic fixture, not all native anchors/scales. Dev PID74476 predates this fix.

- 2026-09-06: Shared About-asset mark now has a static silver rim in reveal
  controls; removed old 13/15px per-form overrides. Target is 24px (21px in the
  narrower Notch), constrained by the existing host. Native envelopes/hit areas
  are unchanged. 27 focused branding/pagination/editor tests passed and production
  frontend build passed. User-selectable logo variants/size and visual acceptance
  remain open; this is not completion of the branding requirement.
  Native Dev rebuild initially hit the running executable lock; stopped only
  verified Dev PID44392, rebuilt successfully in 21.69s, launched PID74476 at
  06:52:26 local with settings:usageSpend proof request. Includes presentation
  persistence/editor, envelope and pagination repairs plus reveal rim. Native
  visual/input acceptance remains unverified; process launch is not visual proof.

- 2026-09-06: Limit pagination now scopes state to provider identity and ordered
  source IDs in all three live renderers. Provider/selection changes start on the
  first pair; ordinary quota refresh preserves the current pair. Added a regression
  that failed before the change and passed afterward. Offline providers with only
  presentation customization remain visible in settings (separate RED/GREEN test).
  Focused UI suites: 14 passed; TypeScript check passed. Native build still pending.

- 2026-09-06: Expanded limit-envelope browser regression now checks inner text
  overflow and scroll height as well as direct panel bounds. It reproduced Reel
  ring overflow (97px content inside 92px). Centered the two ring meters above
  their labels and removed redundant row margins without enlarging the panel.
  `check-limit-envelopes.cjs` passed all nine shape/renderer combinations
  (ring/horizontal/vertical × Notch/Reel/Flow), two meters each. Native Dev has
  not yet been rebuilt with this change; other anchors/scales remain unverified.

- [x] D12: distinguish every actual Session/5-hour/other source limit; no cadence-based merging.
  - Stable source IDs now preserve Session, explicitly named 5-hour, Weekly,
    model-specific and extra windows independently. The live editor regression
    renders Session and 5-hour together and the provider proof no longer uses
    the rejected combined label.
- [ ] A06: selectable color variants of the official About logo.
  - UI packet implemented: the exact About SVG remains the single source and
    now has Silver, Arctic, Aurora, Ember and Violet finishes plus compact,
    balanced and prominent sizes. General Settings shows every finish as a
    real preview; the selection persists and updates all shared React marks.
  - Regression proof: 104 frontend files / 552 tests pass; the fixed visual
    board `output/playwright/logo-system-fixed.png` shows the preserved orbital
    glyph (not a color square), all five finishes and measured 50/56/65 px
    prominence with no horizontal overflow.
  - Native identity packet implemented: `logo_variant` and
    `logo_scale_percent` now persist in the canonical Rust settings, migrate
    legacy files to Silver/116%, clamp corrupt values, flow through the bridge,
    synchronize every webview, and redraw the dynamic tray icon immediately.
  - Replaced the old unrelated galaxy/ring application assets with PNG/ICO and
    notification resources generated from the exact About SVG. The dynamic
    usage icon now has transparent rounded corners and a finish-colored luminous
    rim; its internal prominence follows 90/100/116% without changing the OS
    hit target.
  - Full gates pass: 1,453 core tests, 420 Windows tests, 104 frontend files / 552
    tests, 829-key locale parity and the 703-module production build. Pixel tests
    verify rounded transparency, finish differentiation and prominence sizing.
  - New identity controls are localized in English and Arabic (including
    descriptions and every finish/size label); other locales safely use the
    complete English fallback. Locale parity is now 842 keys and all 17 locale
    tests pass.
  - Remaining before full A06 acceptance: visually inspect the rebuilt native
    Windows title/tray/notification surfaces across DPI/light/dark combinations.
  - Fresh native build launched from the exact target at 09:25:55 local: PID
    19108, executable SHA-256
    `AB100EDF3FFE9C3FD6540F8905FB27CA8020FAD642B166D1AFA62D664A534482`,
    ICO SHA-256
    `C989758D92BF04501F707A2FE1D49D56D226EDBF0CFE63F0373C5AA44E5698B6`.
    Permitted CUA still reports no native Windows application surfaces, so the
    required native screenshot is honestly left open rather than inferred from
    browser or asset previews.
- [ ] F09–F10: light-mode preview style isolation, contrast and content-sized layouts across pages.
  - 2026-09-06: SettingsStudio button paint/size rules now exclude StructurePreview
    and collection canvas descendants. Surface hero/control headings have light-mode
    colors; structure catalog spans full grid width with responsive columns instead
    of occupying one long half-width column. Browser `check-preview-isolation.cjs`
    passed: actual preview button paint equal in light/dark, full-width catalog and
    no grid overflow at 560/1100px. `preview-isolation-light.png` visually inspected;
    TypeScript passed. This fixture covers three real renderers, not every native page.
    Collections/Providers contrast and all-page spacing audit remain open.
  - Embedded collections editor now follows light app chrome, keeps preview widget
    text light on its dark canvas, removes forced full-viewport minimum height and
    uses a bounded 320px/60dvh canvas. These collection-specific styles are not yet
    visually accepted. Frontend production build passed (829 locale keys aligned),
    native Dev build with dev-channel,tauri/custom-protocol passed in 62s.
    Replaced only verified Dev PID12352 with PID44392 at 2026-09-06 06:19:32 local,
    `target/debug/QuotaArc.exe`, requested settings:usageSpend. Includes new limit
    editor and preview isolation fixes. Native input/visibility remains unverified.

- [x] Reconcile requirements visible in the conversation into a durable ledger.
- [x] Supersede conflicting historical restrictions and require append-on-new-message.
- [ ] D01–D08: stable-ID multi-select/order model and safe legacy migration.
  - 2026-09-06: shared stage renderer accepts ordered selected source IDs, preserves
    unavailable selections and distinguishes empty from absent. Regression failed
    before implementation; focused stage tests 8 passed and TypeScript passed.
    This is a render-contract increment only: persisted bridge schema, arbitrary-item
    checkbox editor, semantic source-ID audit and migration remain open.
  - Follow-up: Rust Settings/RawSettings and SettingsSnapshot now round-trip
    `provider_limit_order`; frontend snapshot validation accepts ordered string IDs,
    deduplicates without reordering and ignores malformed entries. Full frontend
    97 files / 529 tests passed; TypeScript passed; focused Rust round-trip test
    passed (410 filtered out). Setter command and checkbox editor still pending;
    no native visual claim and no installed binary update in this packet.
  - Save-command increment: registered `set_provider_limit_order` and typed frontend
    wrapper. Validates provider and bounded nonempty IDs before mutation, preserves
    ordered uniqueness and other providers, supports explicit empty and null inheritance.
    Rust regression first failed (missing function), then passed: 1 test / 411 filtered;
    TypeScript passed. UI still uses the legacy editor: replace it next, including its
    old preset-specific tests. No claim that the user-facing choice workflow is finished.
  - Editor integration: removed preset dropdown and hard-coded session/weekly toggles.
    Actual reported source windows now have independent checkboxes and earlier/later
    controls, persisted via the new command with rollback on failure. Preview consumes
    identical saved ordering; offline selected IDs remain represented. Full frontend
    98 files / 531 tests passed and TypeScript passed. Browser local fixture screenshot
    `output/playwright/limit-choices-light.png` inspected after moving 5-hour before
    Session; only console error was favicon 404. Not installed/native acceptance.
    Remaining: stable semantic source-ID audit, explicit inheritance reset UI, RTL,
    display-type/direction customization, two-limit paging and native verification.
  - Shared UsageWindowList now accepts optional ring/horizontal/vertical,
    bar/value/both and reverse direction; two-item pages with wheel isolation and
    accessible previous/next controls. Tests first failed, then full frontend passed
    99 files / 533 tests and TypeScript passed. Browser fixture rings inspected;
    inspection revealed excessive spreading, so paged content is capped at 320px
    (post-cap screenshot pending). Production defaults remain unchanged until the
    presentation setting schema/editor are connected. Native Dev44392 predates this.
  - Presentation persistence contract now exists in Rust Settings/RawSettings and
    SettingsSnapshot. Frontend validates variants and supplies per-provider presentation
    to NotchDetails, Reel and Flow detail renderers. Full frontend 99 files / 534 tests
    passed; TypeScript passed; focused Rust serialization/variant test passed (412
    filtered). Still requires mutation command + production customization controls,
    per-limit overrides and native envelope/visual tests before feature acceptance.
  - Production presentation editor + `set_provider_limit_presentation` now connected.
    Each provider has shape/content/direction controls, optimistic update and rollback;
    preview receives same presentation. Focused integration first failed, then passed.
    TypeScript and native compile/focused serialization test passed. Per-limit (rather
    than per-provider) overrides, explicit absolute horizontal direction in RTL,
    inherited reset control and all native two-meter envelope tests remain open.
    Running Dev44392 still predates presentation editor; do not claim native deployment.
  - Envelope regression browser test found real 2-meter clipping in Notch and Flow.
    Compact side-by-side meter/text layout and reduced Notch footer spacing made
    3 shapes × 3 detail renderers pass direct-child bounds at scale100. Expanded
    StructurePreview now sizes its frame to its actual fitted content. Visual review
    then caught word-breaking in narrow Reel: vertical gutter reduced to6px, ring
    to28px, word splitting removed. These final gutter changes need fresh screenshots;
    do not treat direct-child geometry alone as text/native acceptance. Evidence script:
    `scripts/check-limit-envelopes.cjs`; fixture uses four explicitly synthetic limits.
  - Independent-source/reset increment: the production editor now proves that
    Session, Codex Spark 5-hour and additional 5-hour sources retain separate
    stable IDs, checkboxes and ordering; none is merged by cadence or wording.
    Limit-selection inheritance and indicator inheritance now have separate,
    explicit reset actions backed by the existing null semantics. Horizontal
    fill direction is physical Left-to-right / Right-to-left and no longer
    changes meaning under Arabic RTL. Replaced this editor's hard-coded dark
    paints with application material/ink tokens so light mode remains legible.
    Focused tests: 23 passed; full frontend: 104 files / 554 tests; locale parity
    842 keys; production build: 703 modules. Native visual verification and
    per-limit presentation overrides (beyond current per-provider presentation)
    remain open.
  - All-anchor docking increment: the shared catalog, preview envelope, native
    settings normalizer and Windows placement engine now accept all nine anchors
    for every one of the 14 current structures. Flowline rotates into a compact
    horizontal rail at top/bottom; Horizon rotates into a compact vertical rail
    at left/right; both open details inward at walls and corners. The demo gallery
    now renders all 14 structures with their real envelopes instead of treating
    every non-notch structure as Reel. Browser visual checks covered Flowline/top,
    Flowline/top-left and Horizon/left. Focused frontend: 17 + 11 tests; full
    frontend: 104 files / 554 tests; core: 1,453 tests; Windows: 420 tests; locale
    parity: 842 keys; production build: 703 modules. Fresh native drag/DPI/taskbar
    proof remains required, so B07/B08 are not closed.
  - Arabic limit-editor increment: all new independent-limit and indicator
    controls now use the locale bridge, including keyboard/screen-reader names,
    explicit physical fill directions and professionally written Arabic copy.
    The nine locale bundles remain key-complete at 874 keys. Focused frontend:
    24 tests; full frontend: 104 files / 554 tests; production build: 703 modules.
    Other older hard-coded Settings copy still needs the broader F04 audit.
- [x] D02–D09: checkable editor, reordered live preview, display modes and two-limit paging.
  - Source implementation and automated acceptance are complete: arbitrary
    multi-select, ordering, bar/value/both, ring/horizontal/vertical, physical
    direction and two-at-a-time wheel paging. Native visual capture remains a
    separate H-series acceptance item.
- [ ] A01–A05: official About master in all assets; theme contrast and adjustable reveal size.
- [ ] B01–B14: all-anchor smooth behavior and distinct compact structures/shared views.
- [ ] C01–C06: detachable/rejoinable, reorderable and persistent provider collections.
- [ ] E01–E07: complete library evaluation, selected concepts and full theme identities.
- [ ] F01–F08, D10–D11: settings completeness, Arabic/RTL, light mode, sign-in and demo isolation.
- [ ] G01–G07: configurable normalized usage/reset events and branded notifications.
- [ ] H01–H10: performance, native matrix, installer and release acceptance.

Unchecked means acceptance remains open even where earlier code exists. Current
native executable predates some source changes; screenshots/tests of browser fixtures
must not be reported as native completion. New requests are added here and to the ledger.

## Historical Flow Surface Foundation Tasks

## New wave — Collections / product completion (2026-09-06)

Plan: `COLLECTIONS_PRODUCT_PLAN.md`. Historical checklist below is preserved.
All new tasks are pending; each slice requires focused tests, build and applicable
native proof. Split any slice exceeding five implementation files before coding.

- [ ] C1: Pure group reducer: detach/merge/reorder, unique ownership,1/2/3/6/12
  items, cancellation. Files: new collections model and tests. Depends: review.
- [ ] C2: Dot group view: max3visible, wheel paging, shrink/empty behavior,
  hover vs click. Files: Dot collection component/CSS/tests. Depends:C1.
- [ ] C3: Versioned layout persistence: round-trip, corruption fallback, migration,
  no account secrets. Files: layout settings/bridge/tests. Depends:C1.
- [ ] Checkpoint: C1–C3 tests + browser interaction proof; human review.
- [ ] C4: Native detached renderer feasibility: measure1/3/6/12 islands and input
  pass-through; select architecture from evidence. Files: bounded native prototype
  module/proof script/report. Depends:C2. No Personal install.
- [ ] C5: Native docking transaction: edges/corners/DPI/taskbar, Escape rollback,
  monitor loss recovery. Files: coordinator/placement/tests. Depends:C3,C4.
- [ ] Checkpoint: fresh Dev build native drag, regroup, restart and performance.
- [ ] C6: Separate structure/view/style settings with validation/migration; no fake
  supported combinations. Files: presentation model/bridge/tests. Depends:C5.
- [ ] C7: Live preview gallery, scale and accessibility. Files: gallery/previews/tests.
  Depends:C6. Verify actual sizes, keyboard,125–200%DPI and reduced motion.
- [ ] C8: Each approved concept implemented as its own bounded slice, shared view
  contract and style tokens; screenshot comparison and bounds tests. Depends:C7.
- [ ] C9: Canonical alert events per provider/account/window with stale/reset
  classification and dedupe. Files: event engine/fixtures/tests. Depends:C1.
- [ ] C10: Threshold/step/window settings validation and round-trip. Files:
  notification settings/bridge/tests. Depends:C9.
- [ ] C11: Notification customization UI, previews and opt-in event categories.
  Files: notifications tab/component/tests. Depends:C10.
- [ ] C12: Native and in-app notification renderers: identity, window label,
  accessible status, no focus stealing. Depends:C11. Native delivery proof required.
- [ ] Checkpoint: replay expected/unexpected/reset/banked/threshold traces; verify
  switching Used/Remaining never changes alert event identity or duplicates alerts.
- [x] C13: Side/top/bottom app navigation, persisted and keyboard accessible.
  Files: Settings shell/navigation/CSS/tests. Depends:C7.
- [ ] C14: Canonical identity manifest and asset audit; preserve provider icons and
  required attribution. Files: branding manifest/consumers/audit. Depends:C13.
- [ ] C15: Startup opt-in validation: login,disable,single-instance. Files:
  startup integration/settings/tests. Depends:C14.
- [ ] C16: Branded installer lifecycle: fresh install/upgrade/repair/uninstall,
  rollback and signature status. Files: installer config/assets/smoke checks.
  Depends:C12,C14,C15.
- [ ] Final gate: all applicable suites, release build, native visual acceptance,
  settled CPU/GPU/full-tree memory, freshness behavior, installer evidence. No
  production-ready claim until evidence is complete.

## Task 0: Freeze the approved surface family

**Description:** Use the approved Flowline, Horizon Fold and Corner Petal
references as the structural contract before changing runtime code.

**Acceptance criteria:**
- [x] The approved references show three compact forms and inward details.
- [x] The approved references contain no orbital, giant, or full-screen composition.
- [x] The approved interaction is hidden/hover/expand/pin rather than permanent UI.

**Verification:**
- [ ] Human visual approval of the generated boards and
  `docs/FOUNDATION_UI_BLUEPRINT.md`.

**Dependencies:** None

## Task 1: Presentation contract slice

**Description:** Add normalized form, anchor, scale and auto-hide settings plus
pure tested native envelope resolution.

**Acceptance criteria:**
- [ ] Invalid settings fall back to Flowline/right/100%/900 ms.
- [ ] Every compact and detail envelope is bounded within the work area.
- [ ] Only one native overlay is eligible to show.

**Verification:**
- [ ] Rust unit tests and TypeScript contract tests pass.
- [ ] Frontend type check and production build pass.

**Dependencies:** Task 0

## Task 2: Flowline vertical slice

**Description:** Render the compact Flowline and its inward detail bubble from
real provider data; add hide, peek, hover, expanded and pinned states.

**Acceptance criteria:**
- [ ] Compact Flowline is ≤56 logical px wide and auto-hides by default.
- [ ] Detail bubble opens into free work area and is keyboard reachable.
- [ ] Clicking/dragging never loses the surface outside the monitor work area.

**Verification:**
- [ ] Focused React and native coordinator tests pass.
- [ ] Fresh native Windows capture proves Flowline states and drag recovery.

**Dependencies:** Task 1

## Task 3: Form reflow and settings slice

**Description:** Add Horizon Fold and Corner Petal over the shared atom, then
expose form, position and auto-hide controls in Settings.

**Acceptance criteria:**
- [ ] Form change reuses one native window and immediately clamps bounds.
- [ ] Settings persist and live-update form, anchor, scale and delay.
- [ ] Reduced motion removes travel and hover never causes a resize.

**Verification:**
- [ ] Interaction tests pass.
- [ ] Native captures prove all three forms at 100% and 150% DPI.

**Dependencies:** Task 2

## Task 4: Final proof slice

**Description:** Verify that the overlay remains light, non-interruptive and
recoverable before enabling future themes.

**Acceptance criteria:**
- [ ] Hidden, compact, hover and expanded settled measurements are recorded.
- [ ] Full test/build gates and native captures are attached to the exact build.
- [ ] The first non-default theme remains blocked until this proof passes.

**Verification:**
- [ ] Full test/build gates pass.
- [ ] Human review accepts the native evidence.

**Dependencies:** Task 3

## Active redesign acceptance ledger (2026-09-06)

- [ ] Tab changes preserve normal, maximized and fullscreen window geometry.
      Verify native transition policy tests and native interaction when available.
- [ ] Shared controls have readable text, consistent dark appearance and keyboard
      behavior across General, Providers, Notifications, Display, Surfaces, Themes,
      Usage and About. Verify real CSS browser bounds and page screenshots.
- [ ] All structure previews render their actual shape, provider instruments and
      selected style without clipping; no monochrome placeholder thumbnails.
- [ ] New selectable styles propagate through every live structure and preview;
      motion is bounded, reduced-motion aware, and idle resource use is measured.
- [ ] All structures support edges/corners/free placement with native docking proof.
- [ ] Each provider can select session/weekly/both, countdowns and available resets;
      unavailable metrics remain honest and configuration survives restart.
- [ ] Notifications expose per-window thresholds/custom steps and confirmed reset
      controls, deduplication and previews; never infer unsupported banked resets.
- [ ] Every page receives the QuotaArc redesign; navigation defaults to a list and
      its placement preference lives in Settings. Preserve license attribution.
- [ ] Native screenshot/input path verified or specific remaining limitation
      reported; full app, installer and settled performance acceptance completed.

### Settings window lifecycle packet — 2026-09-06

- [x] Detached Settings opens at a practical `1040×760` studio size while
      fitting inside the active monitor work area and retaining `520×440` as
      the supported resize floor.
- [x] Genuine restored move/resize geometry is saved under a detached-window
      key and restored safely; stale/off-screen coordinates are clamped.
- [x] Maximize/minimize bounds are never persisted as the normal restored size.
- [x] The native close button hides the detached Settings window after saving
      geometry, so reopening does not recreate a clipped `720×660` window.
- [x] Same-mode Settings tab retarget remains size-neutral; focused Rust tests
      cover the tab transition policy and four geometry cases.
- [x] Frontend geometry and window-action tests pass (6 tests).
- [x] Fresh rebuilt native Settings window accepts ordinary resize and exposes
      the expected Windows thick-frame/maximize styles. A direct `320×240`
      undersize request is repaired back to the safe minimum, and native
      maximize/restore succeeds on the real window. Verified against PID 69936,
      SHA-256 `48C25CD0FF678DC2E112ED213E53414427CE1A047D73BC5B1B98A13183B42CC7`
      (built 2026-09-06 16:16:14 +03:00); original restored bounds were returned.
- [x] Native WebView2 proof switched through and captured all ten Settings tabs
      at a `1006×688` logical viewport (`1.5×` DPI). The reusable
      `scripts/capture-native-settings-tabs.mjs` gate records per-tab geometry,
      rejects horizontal overflow and verifies the responsive column contract.
      Its first run exposed the Surfaces preview crossing the right edge; the
      corrected run has zero horizontal-overflow failures across all ten tabs.
- [x] Advanced uses a balanced two-column layout at the actual high-DPI desktop
      viewport, with heavy text/shortcut controls stacked inside their cards;
      its scroll height fell from `1947` to `1557` logical px without crushing
      labels. General and Notifications deliberately remain one column until
      `1180px`, because the attempted earlier split increased wrapping/scroll.
- [x] Detached Settings close/reopen verified through the native Tauri window
      API: the window hid, reopened directly on Advanced, stayed resizable and
      maximizable, and preserved the exact `(180,48)` / `1582×1088` outer
      bounds. Evidence: `.local/proof/settings-reopen/evidence.json`; reusable
      gate: `scripts/verify-native-settings-reopen.mjs`.

### Settings content-origin packet — 2026-09-06

- [x] Switching tabs or navigation placement resets both content scroll axes,
      preventing a wide editor from leaving the next page shifted into blank
      space.
- [x] The page viewport clips accidental horizontal overflow; intentionally
      scrollable editors retain ownership of their own internal scrollers.
- [x] Direct page children are bounded to the content column and RTL numeric
      control spacing uses logical margins.
- [x] Focused Settings/Surfaces/Themes/Providers tests pass (13), full frontend
      passes (103 files / 548 tests), locale drift check and production build pass.
- [x] Fresh native Dev binary rebuilt and launched: PID 22072, SHA-256
      `4FC96F3593EBF82A14142F2B97A8291E4E441EA48405ECA4AAE699CC70F0D446`.
- [x] Native all-tab capture completed through the running WebView2 debugging
      endpoint after the CUA inventory exposed no Windows application surfaces.
      This is a real Tauri-window render, not the browser-only demo route; ten
      screenshots and per-tab geometry live under `.local/proof/settings-tabs`.
- [x] Repeat the ten-tab native matrix in both dark and light appearance without
      persisting a user preference. Both matrices pass page and nested-container
      overflow gates. The light run exposed a clipped Providers quick-action
      column and internal horizontal scrollbar; a provider-detail container
      query now stacks its overview/workspace at the actual available width.
- [x] Focused Settings/Provider/Advanced/Surfaces verification passes (7 files /
      21 tests), locale parity remains 929 keys and the production build passes
      with 718 transformed modules after the native visual fixes.

### Top/bottom navigation reflow — 2026-09-06

- [x] Top and bottom navigation use one compact, non-wrapping row with a hidden
      horizontal scrollbar. Mouse-wheel input maps to the dominant wheel axis,
      and selecting an off-screen tab scrolls it completely into view.
- [x] Keyboard left/right navigation and the side-list mode remain unchanged.
      Native WebView2 evidence covers all ten tabs in side, top and bottom modes;
      every active tab is visible and no document/body horizontal overflow exists.
- [x] Focused navigation tests pass (5) and the production build passes.
- [x] Native restored, maximized and minimum-size matrices cover all ten pages.
      The viewport remains exactly stable while switching: restored `1080×688`,
      maximized `1280×730`, and minimum `520×440`. Windows rejected a forced
      `400×300` resize at the native minimum (`802×716` physical at 150% DPI),
      and the original `1642×1088` physical bounds were restored afterward.
      No page or internal horizontal overflow occurred. Evidence:
      `.local/proof/settings-restored-all-tabs/evidence.json`,
      `.local/proof/settings-maximized-all-tabs/evidence.json`, and
      `.local/proof/settings-minimum-all-tabs/evidence.json`.

### Cross-structure theme identity packet — 2026-09-06

- [x] The nine catalog themes now define a complete shared surface identity:
      finish, ornament, rim weight, icon frame, label tracking, depth and accent
      halo. The tokens resolve through the same renderer rather than swapping a
      structure for a theme-specific mockup.
- [x] All fourteen structure previews consume the identity tokens, including
      compact bodies, details, gauges, connectors and meters. Representative
      Obsidian, Sapphire, Ceramic and Ember captures prove visibly different
      dark, constellation, ceramic and forged-metal identities.
- [x] Provider brand colors are independent from surface themes. Applying a
      theme no longer turns Claude, OpenAI or Gemini into arbitrary theme
      colors; a regression test fixes OpenAI at its canonical accent.
- [x] Themes Settings language now describes full identities instead of
      misleadingly calling them materials, exposes identity traits and accent
      swatches, and keeps global/profile/surface inheritance explicit.
- [x] Browser proof at `1440×1000` renders all 14 structures with no horizontal
      page overflow. Focused tests pass (3 files / 16 tests), full frontend passes
      (103 files / 548 tests), locale drift matches 829 keys, production build
      passes with 700 transformed modules, and `git diff --check` is clean.
- [ ] Fresh native capture of all nine identities across compact, hover and
      detail states remains required before E03/E04 can be accepted completely.

### Provider workspace density packet — 2026-09-06

- [x] Providers now use an adaptive roster/workspace split instead of a narrow
      legacy list beside one stretched detail column.
- [x] Provider identity remains visible in a sticky header; usage and meaningful
      login/dashboard actions share the first scan line.
- [x] Configuration sections flow into a dense two-column workspace on wide
      windows and one ordered column below 900px; below 680px roster and detail
      become a document flow with no fixed-height clipped pane.
- [x] Reorder controls remain keyboard reachable but no longer clutter every
      inactive row; active/visible counts and search remain immediate.
- [x] Browser-safe proof uses the production provider classes and preserves
      Session / 5-hour, Weekly and Model limit as separate rows. Focused tests
      pass (5), full frontend passes (110 files / 568 tests), locale parity 923
      and production/native debug builds pass.
- [x] Fresh native executable launched directly on Providers: PID 75196, mtime
      2026-09-06 14:36:21, SHA-256
      `02A932EBB87024C2D8D2256EEC6196BEAEAE180D29D2DC89D2737CAF4EEAD641`.
- [ ] Capture the rebuilt native Providers page at restored, maximized and
      minimum widths when Windows application surfaces become available to CUA.

### Independent usage-limit editor packet — 2026-09-06

- [x] Replace the preset detail selector with independent checkbox choices for
      every reported limit. Session and named 5-hour windows are separate data
      sources and must never be presented as one `Session / 5-hour` option.
- [x] Keep the selected-limit order explicit and editable with accessible move
      controls; disabling one limit preserves every other selected limit.
- [x] Show the provider's real filtered limits immediately in the editor, and
      update that preview as selection, order, content, shape or direction
      changes instead of hiding it behind a closed disclosure.
- [x] Restyle the editor as a dense responsive workspace with compact selected
      states, position badges and controls that remain usable at narrow widths.
- [x] Focused tests pass (3 files / 15 tests), full frontend passes (110 files /
      569 tests), locale parity is 923 keys and the production build passes with
      708 transformed modules.
- [ ] Capture and inspect this editor in the rebuilt native Settings window at
      minimum, restored and maximized sizes before closing the visual QA item.
- [x] Fresh native executable launched directly on Usage & Spend: PID 58896,
      mtime 2026-09-06 14:51:14, SHA-256
      `A6D47901F65058C7AE5FBD7F896F535F0187BA0790A667094845E5DECD2DBA77`.

### Theme-adaptive official mark packet — 2026-09-06

- [x] Record the screenshot regression: the official mark kept an unrelated
      black tile while Tidal/Obsidian structure bodies changed identity.
- [x] Every catalog identity now owns an explicit mark frame, rim color and
      blend treatment in addition to its mark shadow. The official About glyph
      remains the source image; only its surrounding material adapts.
- [x] Flow, Notch and Reel renderers consume the same identity tokens without
      changing mark geometry, surface bounds or pointer targets.
- [ ] Capture all nine identity treatments on compact and reveal marks and
      reject any treatment whose glyph/rim contrast disappears at native DPI.

### Curated theme-library expansion — 2026-09-06

- [x] Inspect all five visual indexes covering the supplied 50-theme library,
      plus inventory the Legendary, ZIP and loose-image sources supplied by the
      user. Selection is based on visual distinction and legibility, not count.
- [x] Add fifteen production identities spanning technical, glass, editorial,
      metallic, natural and expressive directions, with a balanced set of true
      light themes.
- [x] Give every added identity its own adaptive official-mark frame, rim,
      highlight and contrast treatment. The global logo finish remains optional;
      the structure theme must always supply a legible automatic base treatment.
- [x] Verify every added identity against all fourteen structures and both
      compact/detail states; inspect the theme-mark matrix in dark and light.
- [x] Keep provider colors canonical and ensure theme selection never changes
      usage meaning, footprint, docking or hit targets.

### Provider presentation identity studio — 2026-09-06

Current evidence: sixteen persisted identities render the same two source limits
without altering `aria-valuenow`; the browser proof covers adaptive, precision,
glass, pearl, prism, mono, signal and luxe. A persisted global presentation is now
inherited by every provider without an override, while reset removes only the
provider override. The deterministic 24-theme × 16-provider-identity matrix keeps
both values, labels and meters intact across all 384 pairings. Full frontend
verification passes 113 files / 599 tests. The separate 24-theme × 14-structure ×
9-anchor × 2-state matrix also passes; Rust settings and identity round-trip tests
plus the production build pass. Fresh Debug binary runs on Usage & Spend as PID
36780, mtime 2026-09-06 16:05:17, SHA-256
`7B1E343363E6FC1F0EE8A917076D0DE42DCEF2094425D617AF9DE34B58FAF27C`.
Every fixed identity now owns an opaque contrast plate and both primary and
secondary text tokens pass a deterministic WCAG AA ratio check. The expanded
set adds Frost, Ember, Jade, Rose, Cobalt, Bronze, Paper and Ultraviolet, including
two bright identities intended for light structures. The full frontend suite now
passes 113 files / 608 tests, the production frontend build passes, and a fresh
native Debug build was captured on Usage & Spend with all sixteen identity cards
visible and no document overflow. Exhaustive native-DPI inspection across every
individual pairing remains open.

The six-provider editor no longer repeats every heavy control in the reading flow:
each provider is now a compact disclosure with its active limit count and identity.
Native measurement fell from 6456px to 4115px when closed (2341px reclaimed).
Opening Codex preserves the complete live editor; container-aware reflow keeps all
sixteen names, three shape choices, selects and preview legible at 150% Windows DPI
in both dark and light appearances.

- [x] Add a dedicated provider-identity section separate from structure themes
      and from the app light/dark shell theme.
- [x] Provide multiple professional display identities for provider cards,
      values, progress tracks, rings, labels and status treatments; allow a
      global choice plus per-provider overrides.
- [x] Keep Session, 5-hour, Weekly, model and extra limits independently
      selectable/orderable while applying the chosen presentation identity.
- [x] Preview every change live with current logical dimensions before saving.
- [x] Validate number, percent, meter and reset-label contrast across every
      supported structure theme and both light/dark identities. Semantic warning
      and exhaustion colors must remain distinguishable from decorative accents.
      Computed actual rendered colors (not token names): 23 of 24 identities
      carry a theme-independent opaque plate (name/value/reset-label text
      already AA-checked against it); `adaptive` inherits `--surface-text`/
      `--surface-muted` on `theme.bg[0]`, now checked for all 24 themes
      (`ProviderIdentityThemeMatrix.test.tsx`) — all pass, no changes needed.
      Meter/arc fill was a real gap: the raw provider brand color is rendered
      directly against the meter track with no adjustment, and 88 of 200
      brand-color × track combinations measured under WCAG's 3:1 non-text
      floor (as low as 1.05:1 — provider accents essentially invisible against
      several light-plate identities and against deepseek's blue on several
      dark tracks). Root cause: no shared primitive computed effective
      fill-vs-track contrast anywhere; each of 4 call sites just piped a raw
      hex into `--provider-color`. Fixed at the shared layer: added
      `design-system/meterFill.ts` (`resolveMeterTrack`, `accessibleMeterFill`,
      `providerMeterFillColor`) — nudges a fill the minimum amount toward
      black/white until it clears 3:1, otherwise leaves brand colors untouched.
      Wired into all 4 producers (`FlowSurface.tsx`, `UsageDisplaySection.tsx`,
      `ProviderIdentityGallery.tsx`, `demo/ProviderIdentityProof.tsx`).
      Regression: `meterFill.test.ts` (5 tests) covers all 8 canonical
      provider colors × all 25 real tracks (23 fixed identities + adaptive
      light/dark) at >=3:1, post-fix. Full suite 119 files / 651 tests,
      `tsc --noEmit` clean. Not covered by this pass, documented rather than
      silently closed: focus/selected-state outlines have no bespoke color
      token in this component (inherit the browser/OS default), so a static
      token check doesn't apply — native visual inspection is the right gate
      for those and is covered by the todo.md:901 native-DPI pass next.
      Settings-page previews (`UsageDisplaySection`, `ProviderIdentityGallery`)
      have no structure theme in scope, so their adaptive-identity preview
      approximates the dark track default rather than the live app theme —
      acceptable for a settings-page preview, called out here rather than
      assumed correct.
- [x] Preserve smooth switching and low idle cost; no continuous animation loop.

### Provider presentation identity gallery — 2026-09-06

- [x] Added a dedicated provider-identity gallery ahead of structure themes, with
      real limit renderers, live shape preview, filtering and one-click global
      application. Loading is gated before apply so a fast click cannot overwrite
      the user's stored shape, content or direction.
- [x] Expanded the identity library from 16 to 24 with Midnight Glass, Mint
      Aerogel, Cobalt Porcelain, Champagne Glass, Terracotta Halo, Cyber Lime,
      Graphite Studio and Royal Amethyst, derived from the supplied concept-library
      families. Six identities use protected bright plates; the others use protected
      dark plates, while Adaptive deliberately inherits the structure theme.
- [x] Full frontend verification passes 114 files / 619 tests, including the
      identity/theme and theme/structure/anchor/view matrices. Rust persistence
      accepts all 24 and rejects unknown identities (2 focused tests). Production
      TypeScript/Vite build passes (720 modules). Native dark and light Themes
      evidence shows the gallery without document or internal horizontal overflow:
      `.local/proof/provider-identities-native-heading-v2/evidence.json` and
      `.local/proof/provider-identities-native-light/evidence.json`.
- [x] The gallery chrome is fully wired to the shared locale bundle, including
      professional Arabic copy and RTL-safe logical CSS; identity names remain
      proper names as required. Locale parity passes at 941 keys and Rust locale
      verification passes 17 tests. Final native Debug proof is PID 62164,
      SHA-256 `3B4709FDF599DA21884FA4FF489AAB4D0AEBD39FB3F98C2B1CD550162D3BC21F`,
      with `.local/proof/provider-identities-native-final/evidence.json` passing.
- [x] Complete the exhaustive 24 provider identities × 24 structure themes ×
      dark/light semantic contrast matrix and fix any warning/exhaustion collisions.
      23 of the 24 identities use a theme-independent opaque contrast plate by
      design (`contrastBase` in `providerPresentationIdentity.ts`), already
      covered by the existing self-contained AA test. `adaptive` is the one
      identity whose warning/critical/exhausted tones actually depend on the
      active structure theme (CSS falls back to `color-mix(in srgb, currentColor
      72%, #hex)` against `theme.bg[0]`), so it needed a genuine per-theme check.
      Added `ProviderIdentityThemeMatrix.test.tsx` ("keeps the adaptive
      identity's warning/critical/exhausted tones AA-legible on every structure
      theme"): all 24 themes pass ≥4.5:1 contrast for all three tones with no
      warning/critical/exhausted collisions (lowest margin 6.80:1, solar-pearl
      warning). No color values needed to change — zero collisions found.

Semantic-state progress: the shared limit renderer now normalizes `used` and
`remaining` before assigning Normal/20% warning/10% critical/0% exhausted.
Every fixed identity receives plate-aware semantic colors with a measured AA
ratio of at least 4.5:1; Adaptive derives urgency from its inherited contrast
text. The gallery exposes a non-persisted state preview. Native evidence:
`.local/proof/provider-identities-critical-dark-ar/evidence.json` and
`.local/proof/provider-identities-exhausted-light/evidence.json`. Full frontend
verification passes 115 files / 633 tests. Current Debug binary is PID 40868,
mtime 2026-09-06 18:14:00, SHA-256
`933D75E0BA6082B3AA6296912DACF83E2B8488EF9EEDC0EAA5E6D0BD5E0790A5`.

### Dedicated Provider Display page — 2026-09-06

- [x] Added `Provider Display` as a first-class native Settings destination,
      adjacent to provider account setup but independent from it. The shell and
      Rust surface-target validator accept the new deep link.
- [x] Removed provider identities from `Themes` and limit presentation from
      `Usage & Spend`. The new page exposes two lightweight views so the 24-card
      library and all provider rules do not inflate one continuous page.
- [x] Consolidated global and per-provider identity, used/remaining semantics,
      independent limit selection/order, meter shape, value/bar content, fill
      direction and provider accent color. The live preview now receives the
      actual provider id and effective custom color.
- [x] Verified dark Critical, light rules, and Arabic RTL Warning native states
      at 1280×730 with no horizontal overflow. Evidence:
      `.local/proof/provider-display-page-dark/evidence.json`,
      `.local/proof/provider-display-rules-light/evidence.json`, and
      `.local/proof/provider-display-arabic-rtl/evidence.json`.
- [x] Locale parity is 953 keys; Rust locale tests pass 17/17; production build
      passes; full frontend verification passes 116 files / 635 tests including
      the 24-theme × structure/anchor/view matrix.
- [x] Fresh native Debug binary is PID 21904, mtime 2026-09-06 18:27:32,
      SHA-256 `7632374EDAD1A34F0A2115A20B4B3642224F4716C0487C5DA846675A3730F95B`.
- [x] Continue the exhaustive native DPI and compact-window visual matrix; this
      remains a publication gate and is not replaced by the automated matrix.
      Ran a real native visual pass against a fresh Dev binary built from
      `4d84d983` (`target/debug/QuotaArcDev.exe`, SHA-256
      `26FA9E2E26D1AB361090CC74847459F9DFE2AB80F0ED9A09F9D8D869B3A0FB4D`,
      PID 33668, `app.quotaarc.desktop.dev` — isolated from Personal),
      launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`
      and driven over WebView2 DevTools/CDP. Fixed a real regression in
      `scripts/capture-native-settings-tabs.mjs`: its `settingsTarget()`
      selector predated the current detached-Settings-window architecture
      (`?window=settings`) and could no longer find the window at all — now
      matches the detached target first, falling back to the old shape.
      Captured and inspected at 1920x1200 physical / 150% Windows scale (DPR
      1.5, the only physical DPI available on this machine): dark, light,
      Arabic RTL, critical semantic state, the live Usage Display meter-fill
      preview (confirms `providerMeterFillColor` is actually wired into the
      running app, not just unit-tested), and a compact 398px width via CDP
      `Emulation.setDeviceMetricsOverride` (native window left untouched).
      Zero horizontal overflow, zero clipping, zero contrast collisions in
      any capture. One transient incident (Settings window minimized during
      a `set_size` experiment) — recovered via `ShowWindow(SW_RESTORE)`, no
      data loss, and worked around for the rest of the pass by using CDP
      viewport emulation instead of native window resize. Full results and
      screenshots: `.local/proof/provider-display/provider-display-visual-
      evidence.json`. Explicitly NOT covered and left open: 100%/125%/200%
      DPI (no second physical display on this machine — would need to be
      labeled SIMULATED, not attempted here), the full 24-theme ×
      24-provider-identity combination natively (the automated
      `ThemeStructureMatrix.test.tsx` already covers 3,024 theme × structure
      × anchor × state combinations at the DOM level; this pass sampled
      representative states rather than repeating that matrix by hand), and
      real OS-level mouse/keyboard input acceptance (this pass drove the DOM
      via CDP, not physical input events).

### Settings density and responsibility audit — 2026-09-06

- [x] Removed the provider-presentation editor from `Usage & Spend`; the page now
      fits its 669px native viewport when no cost rows are available and reads as
      accounting rather than visual customization.
- [x] Removed provider identities from `Themes`; its native page height fell from
      4400px to 2970px while retaining 24 complete structure identities.
- [x] Reflowed General at wide sizes: Language and app Appearance share a balanced
      row, all five logo finishes use a real horizontal grid, System uses both
      columns, and Automation no longer leaves a vacant half-page. Native scroll
      height fell from 1619px to 1305px, then 1256px after the final automation
      reflow, with no horizontal overflow in dark or light mode.
- [x] Captured every one of the 11 Settings destinations at 1280×730 in dark and
      light mode. All report zero horizontal overflow:
      `.local/proof/settings-current-11-dark/evidence.json` and
      `.local/proof/settings-current-11-light/evidence.json`.
- [x] Current Debug binary: PID 31020, mtime 2026-09-06 18:41:10,
      SHA-256 `10653BB02DBD5910DCBA740707404F807E06235F6255192A80B9139534AB0119`.

### Provider identity customization and Arabic source labels — 2026-09-06

- [x] Make provider presentation a separate, persisted layer above structure
      themes. The gallery now saves shape, bar/value content and fill direction
      immediately, while the existing provider editor supplies per-provider
      overrides and independent limit selection/order.
- [x] Protect primary/secondary text with AA contrast plates for every fixed
      identity and add a theme-independent edge treatment to custom-colored
      progress fills/rings so a provider accent cannot disappear into its track.
- [x] Localize canonical Session, 5-hour, Weekly, remaining/used and reset
      labels at the shared renderer source. Preserve non-canonical provider labels
      verbatim instead of incorrectly collapsing them into a generic session.
- [x] Verify 114 frontend files / 621 tests, 950 locale keys, 17 Rust locale
      tests and the 720-module production build. Native dark Arabic and light
      gallery captures have no horizontal overflow:
      `.local/proof/provider-identities-final-dark-ar/evidence.json` and
      `.local/proof/provider-identities-final-light/evidence.json`.
- [x] Fresh native Debug binary: PID 6804, mtime 2026-09-06 18:05:50,
      SHA-256 `EE9F1DEF46F69DD105DB141F20E7265758A85053EB97AB49004D5B93CCC9D4CF`.

## Single Dashboard consolidation — 2026-09-09

- [x] Retire public 3D/Spatial/Hybrid modes, renderer/lab routes and Three.js.
- [x] Safely resolve legacy persisted modes to Analytics without file migration.
- [x] Preserve deterministic Demo and distinct Spend/Balance/Credits semantics.
- [x] Put limits/reset tracking first; retain history, theme and provider identity.
- [x] Verify RTL, narrow/maximized, three themes and real/Demo native captures.
- [x] Run 920 frontend tests; Rust 455 + 1611 + 1 passed, one existing ignored.
- [x] Complete tsc/build, clippy/fmt, 1085-key parity and changed-code scans.
- [x] Record no-CDP idle CPU/memory and before/after production bundle evidence.
- [x] Keep Personal untouched; stop at FINAL DASHBOARD PASS.

Evidence: `docs/validation/DASHBOARD_CONSOLIDATION.md`.

## Professional product upgrade — K01–K09
- [x] Architecture/auth/settings/analytics audit and contract inventory.
- [x] Grouped navigation with stable destinations and keyboard behavior.
- [x] Provider workspace, explicit connection states and supported auth fixes.
- [x] Correct quota/account/time/currency semantics with counterexample tests.
- [x] Shared customization propagation and varied readable templates.
- [x] Read-only Providers Demo using existing configurable seeded model.
- [x] Full quality gates, fresh Dev screenshots and honest final report.

Scoped engineering acceptance: `docs/validation/PRODUCT_UPGRADE_VALIDATION.md`.
External consent completion and credential-store/profile resolver migration are
not claimed complete; see that report's remaining scope.

## Product V2 — L01–L09
- [x] Wave 0: source audit, architecture and acceptance contract.
- [x] Wave 1: Settings/Workspace consolidation, search, legacy links and navigation tests.
- [ ] Wave 2: metric registry, aggregation/comparison and deterministic corpus.
- [ ] Wave 3: shared analytical primitives and chart correctness.
- [ ] Wave 4: Dashboard V2 and persisted meaningful presentation.
- [ ] Wave 5: Provider Operations and supported auth lifecycle.
- [ ] Wave 6: unified customization/reset/default propagation.
- [ ] Wave 7: RTL/accessibility/responsive and performance benchmarks.
- [ ] Wave 8: native evidence, all gates, final acceptance report.


### L10 owner navigation correction
- [x] Replace duplicate Settings rail with inline expandable sidebar children.
- [x] Restore full editor width and General Language/Appearance row.
- [x] Preserve destination IDs, search draft state, keyboard and collapsed semantics.
- [x] 992 frontend tests, TypeScript, production/native Dev build, 520 RTL/720 LTR/maximized screenshots.
- [x] Restore Dev presentation baseline after proof.
- [x] Owner accepted L10; overall L01–L09 runtime matrix remains open.

### L11 Dashboard Waves 2–4 checkpoint
- [x] Typed metric inventory, observation edge-case fixes and independent review.
- [x] Current Limits, Trend Intelligence, attention, Reset Horizon and coverage integration.
- [x] 1001 frontend tests, full Rust gates, native Dev build and screenshot matrix.
- [x] Restore Dev presentation baseline; stop before further Providers redesign.
- [ ] Owner Dashboard V2 visual acceptance.

### L12 — Analytics V3 visualization platform (Wave 4.5)
- [x] Official ECharts/visx/internal SVG and TanStack audit; modular ECharts 6.1.0/SVG selected.
- [x] Shared analytics model, registry-gated specs, lifecycle, theme/identity and HTML reading alternatives.
- [x] Compact limit instruments, metric/attention rails, trends/comparison/atlas, reset timeline, tables and coverage diagnostics.
- [x] Fresh native Demo6, real Dev, Arabic, dense/narrow and four-theme proof; owner review board and matched V2/V3 images.
- [x] Renderer 100–100k, model/backend 25k–250k, five-sample native interactions/idle and twenty unmount cycles.
- [x] 1,017 frontend tests / 167 files; Rust 469 + 1,638 + 1 passed, one existing ignored; build, clippy, fmt, 1,323-key parity and scans green.
- [x] Restore Dev presentation; keep Personal untouched; stop before Providers V2.1.
- [ ] Owner Analytics V3 visual acceptance.

Engineering/evidence verdict: ANALYTICS V3 PASS. Report: `docs/validation/ANALYTICS_V3_VALIDATION.md`.

## Analytics V4 cosmic checkpoint
- [x] Owner-selected background, planetary instruments and editorial dashboard implemented.
- [x] Original app/provider logo assets preserved.
- [x] Truthful matrix, reset bands, comparison and accessible provider picker tested.
- [x] Native Dev iteration, RTL/narrow/real-data and lifecycle evidence captured.
- [ ] Owner visual acceptance of the native result; no next-wave work authorized by this checkpoint.

## POST-RELEASE-01 — current continuation, 2026-09-12

- [x] Reconcile latest source 0f108437, accepted app dfd81974 and packaging 1b3a6db3.
- [x] Verify installed 0.11.0 binary hash/version with read-only diagnostics.
- [x] Run fresh frontend/Rust/build/locale/quality baseline gates.
- [x] Repair reproduced Dev Tauri/single-instance identity gap, preserve base window config.
- [x] Add mixed/missing identity and alternate-output checks; independent critical review.
- [x] Correct unsafe rollback guidance; record 23 matching payloads and manifest self-entry mismatch.
- [x] Native Dev baseline pages open, charts load and native Windows click works.
- [ ] Personal shortcut repair/re-pin: later explicit Personal authorization required.
- [ ] Separate future slices: deferred Claude warm aggregation, reset editor consolidation, visible copy/title residue.

Full current evidence and qualifications: docs/validation/CODEX_POST_RELEASE_HANDOFF.md.

## SHELL-01
- [x] Compact shared toolbar and Settings context/search header.
- [x] Persist sidebar width/collapse; support drag, keyboard and RTL.
- [x] Improve primary navigation branch targets and chevrons.
- [x] Source gates and native Dev wide/narrow/RTL interaction proof.

Candidate 8a925f5e; evidence and limitations: docs/validation/WORKSPACE_SHELL_COMPACT.md.

## SHELL-02
- [x] Group monitoring/configuration destinations and preserve deep links.
- [x] Shared background controls and optional bounded interaction.
- [x] Remove page-owned shell overrides and fix layout inconsistencies.
- [x] Native performance/visual evidence and full source gates.

Candidate a42f1ab6; evidence, measurements and limits:
docs/validation/WORKSPACE_BACKGROUNDS_NAVIGATION.md. Owner visual acceptance remains separate.

## SHELL-03
- [x] Compact provider/page layouts, safe gutters, shared resize and scroll behavior.
- [x] Logo-aligned switches, truthful enabled/unconnected provider visibility.
- [x] Eight primary pages and standalone About upgrade.
- [x] Categorized background batches, local import/persist/delete and motion guards.
- [x] Full source gates and native Dev functional/visual/performance evidence.

Code candidate d0bb0165; 1,132 frontend tests, 32 native route checks, Cua and
WebView2 interaction proof: docs/validation/WORKSPACE_LIBRARY_PROVIDER_LAYOUT.md.

## SHELL-04
- [x] Shared select/control defect and related lifecycle/layout recovery.
- [x] Consolidated Appearance plus main Surface and Tray studios.
- [x] Cinematic full-workspace static/interactive backgrounds.
- [ ] Notification app/provider branding with native Windows proof.
- [x] Per-provider tray icon, selected real limit, tooltip and token coverage controls.
- [x] Explicit feature/control coverage, source gates, native proof and updated Dev launch.

Candidate 45fbeab6: 1,141 frontend tests; desktop 481/core 1,724/CLI 1 Rust tests;
44 native primary-route cases, five final nested routes and persisted control tests.
Notification branding is implemented and four correct WinRT history receipts are
verified. Native toast/header pixels and OS tray hover/click remain unverified:
Cua desktop capture fails with 0x80070006 and foreground HWND is 0x0. No blanket
all-features/credential-workflows PASS. Final normal Dev PID 14992 is open.
Evidence: docs/validation/SHELL04_MONITORING_AND_SPACE_WORKSPACE.md.
## QA-05
- [ ] Feature/control inventory and explicit coverage matrix.
- [ ] Guarded native/isolated visual Demo scenario and settings tests.
- [ ] Security/secret-leakage and Demo isolation review; reproduce and fix defects.
- [ ] Dev installer build, compatibility and lifecycle verification.
- [ ] Full gates, visual regression evidence, restored QA state and final report.

QA05 checkpoint: native primary-page and selected nested/filters/Demo proof,
layout/logo/control/security repairs, full source gates and 112-image atlas are
recorded in docs/validation/QA05_NATIVE_VISUAL_REVIEW.md. Checkboxes above remain
open because exhaustive control and installer/native OS acceptance is incomplete.

## PRODUCT-06
- [ ] P06-01/02: provider contrast, compact related layouts and Menu Bar section.
- [ ] P06-03/04: independent accounts and all supported connection methods.
- [ ] P06-05/06/07: native brand finish, truthful motion catalog and multi-icon tray.
- [ ] P06-08/09: Profiles/Collections capabilities and complete workflow help.
- [ ] P06-10/11: owner About, release artifacts and verified owner GitHub account.
- [ ] P06-12: native/source/security/installer requirement-level acceptance.


P06-03 increment: independent persisted Codex account cards, missing/conflicting
observation gating, targeted refresh, saved cross-provider order and numbered
badge presentation are implemented for the operational rail. Independent review
repairs cover modal select ancestry and transient discovery UUIDs. Source gates
and remaining native/account/tray coverage are in PRODUCT06_OWNER_COMPLETION.md.
The P06-03/04 checkbox remains open.

- [ ] P06-13: shared reset inventory badges, separate reset-event / weekly-schedule / Banked Reset expiry semantics, per-account source tests and native proof.

- [ ] P06-14: eight badge/reset positions, circular 3/4-card rail, saved anchor and physical left/right arrangement; native and persistence proof.

P06-13/P06-14 source increment: implemented typed account-scoped inventories,
eight positions, bounded circular rail, serial saved anchor/order and isolated
Demo presentation. Source review repaired four defects; frontend1172/core1763/
desktop496/CLI1 green (desktop1pre-existingignored). Native Dev verified all
sixteen position selections, saved position readback across relaunch, shared-edge
spacing, real per-card reset facts and six-provider/four-visible Demo navigation.
Original settings and real mode restored. Evidence and final Dev hash are in
PRODUCT06_OWNER_COMPLETION.md. Three-card/70-provider/wheel/anchor combinations
are source-tested; remaining native coverage and stage/tray-specific reset layouts
stay open. Do not mark whole-product PASS.

P06-08 profile increment: explicit rename/save, distinct copies, persisted order,
membership search and localized original-provider icons are implemented. Native
Dev proved create/rename/copy, order persistence across relaunch, and confirmed
deletion of only QA profiles. Default remained active. A capture-backed search
field style repair is included. Full source gates and exact counts are recorded
in PRODUCT06_OWNER_COMPLETION.md. Nullable theme inheritance and Collections
repairs remain open; the broad P06-08 checkbox is intentionally not closed.

P06-08 Collections increment: fixed saved detached-ID collisions and loss of
offline providers/order during Gather all. Added targeted regrouping without
dragging, with EN/AR guidance. Regression tests and native draft detach/regroup/
discard passed; no owner layout saved. Native screenshots prompted a compact
full-width control layout and theme-aware preview repair. Final visual evidence
is recorded in PRODUCT06_OWNER_COMPLETION.md; profile inheritance, broader
collection customization and native detached-window coverage remain open.

P06-08 appearance increment: corrected nullable profile updates and preserved
global appearance across switching. Native Light assignment/activation, Inherit
clearing, restart readback and deletion of the active QA profile passed. Replaced
four-choice appearance dropdown with visible buttons. Screenshot review found
and repaired light-mode dark surfaces/dark text; final Light/Default captures
were visually inspected. Default active and zero QA profiles confirmed after
restart. Full frontend 1184, desktop502+1ignored/core1764/CLI1; source/build gates
green. Structure Theme native selection/clear and broader surface/layout matrices
remain open; this is not whole-product QA or release acceptance.

- 2026-09-13 P06-17: About identity, owner contribution, technology roles and
  original-project credits implemented in a1582bde; native page reviewed. Repaired
  the missing Local update channel across frontend/patch parser, with passing
  regression and workspace checks. Owner visual approval is pending before new
  final packages or publication. See PRODUCT06_ABOUT_OWNER_REVIEW.md. P06-16
  notification-center implementation remains open.

- 2026-09-14 Continuation Wave 1 (Structure closure + theme composition +
  loading UX): legal quick-close (LICENSE/THIRD_PARTY_NOTICES/Cargo.toml
  authorship, `70531577`); real structure registry audit finding the actual
  14-form/3-render-path system (`docs/validation/STRUCTURE_SYSTEM_AUDIT.md`);
  found and fixed a real Pin/Close consistency defect (ReelSurface's stale
  `⌖` glyph + static aria-label bug, NotchDetails' plain-text pin/differing
  close label) with a shared `StructurePinButton` and regression tests
  (`a26e8ffb`); partial loading-state audit confirming the shared data hook
  already keeps cached data visible on same-scope refresh
  (`docs/validation/LOADING_STATE_MATRIX.md`). Full gates re-run and green:
  frontend 203 files/1254 tests, Rust desktop 504/1 ignored/core 1774/CLI 1,
  clippy, fmt, secret scan, locale parity, Dev-verified build all passed.
  Safe-area system, theme-composition Apply dialog, unified loading visual
  language and native structure QA matrix remain open — see
  `docs/validation/CLAUDE_EXECUTION_SEQUENCE.md` for the full remaining
  sequence. Not whole-product QA or release acceptance.

## Wave 3 continuation — 2026-09-22

Preserved inherited dirty onboarding implementation and added capability-derived flow, profile-scoped cookie import, protected-key routing, cancellation/fixture/source isolation and CLI execution hardening. Automated gates and exact remaining evidence limits are recorded in `docs/validation/WAVE3_IMPLEMENTATION_REPORT.md`. Native closure remains DEFERRED — ENVIRONMENT BLOCKED. Release gate CLOSED; no Personal promotion. This is not whole-product completion.
