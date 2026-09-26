# Quotalis Product V3 — implementation and acceptance report

Date: 2026-09-10. **PRODUCT V3 NOT PASSED.** Engineering checks pass, but this is not a production-readiness or full visual-acceptance claim. The channel incident is a failed hard requirement, not a harmless warning. Native toast appearance/click acceptance, exact 70-provider native coverage and the largest-history interaction budget also remain open.

## Required 37-item report

1. **Starting HEAD:** `4f3e493e2150f813e96181460e05be63d6b46f1f`.
2. **Ending revision:** code candidate `ad2a95e8`, followed by the evidence/report commit containing this document. The final task response records the final repository HEAD. Branch: `feature/v9-theme-runtime`.
3. **Commits by wave:** `c70a2655` notification identity/activation; `10724df1` shared controls and bilingual copy; `8053c159` analytical model/Worker/local activity; `395a1d2c` operational Overview, nested Analytics, bounded rail and Providers integration; `92a3dd3f` channel isolation and notification repairs. Documentation/evidence is a separate final commit. No release or promotion.
4. **Generated concepts:** eleven A–K boards were generated before the UI implementation. These are design references, never native evidence or sources for metrics/logos.
5. **Master direction:** C's bounded rail, D's detail drawer, E's broad analytical canvas, I's provider operations layout and J's smoked controls. Original Quotalis/provider assets remain unchanged. See `PRODUCT_V3_DESIGN_REVIEW.md` for adopted/rejected details.
6. **Navigation:** Dashboard expands into Overview and Analytics. Workspace and Settings retain expandable children. Existing legacy destinations remain supported; Analytics is a typed Settings destination.
7. **Overview:** current provider rail, live summary, actionable attention and reset horizon. Deep-history/quality diagnostics are outside the operational view. Returning from a provider drilldown does not retain a provider-filtered operational snapshot; a regression test verifies this.
8. **Rail architecture:** deterministic source order and a clamped moving viewport, at most seven mounted instruments. Wheel, drag, arrows, Home/End/Page keys and searchable provider selection share the same logical position. There is no animation loop or WebGL. The old ellipse is removed; a subtle straight connector identifies the shared rail.
9. **Provider scale:** 1/6/12/24/40 passed native bounded-layout checks. Requesting 70 yields the **68 actual registered providers**, not 70 invented identities. Synthetic component tests reach all 70 items. Exact 70-item native proof remains unfulfilled; see measurements below.
10. **Quick details:** click opens a modal side panel with real physical windows, monetary contract presentation, reset information, provider actions and Analytics drilldown. Escape restores focus. Native wheel → drag → click → Escape passed after fixing a swallowed-followup-click defect. Demo is explicitly labeled inside the modal, with Refresh disabled.
11. **Plan:** a shared badge displays the supplied plan only; absent plan stays absent. The real Dev Codex capture displays ChatGPT Pro. No provider tier is inferred from its identity.
12. **Analytics architecture:** one effective snapshot and shared derivation boundary. Internal sections: Overview, Usage trends, Local activity, Resets, Providers, History and Data quality. Large quota history uses a module Worker; stale results are ignored and failures expose current-only state with an unavailable status.
13. **Global Analytics:** all-provider navigation and summaries work without summing incompatible quota percentages. Physical-series trend selection and the usage matrix remain separate from additive token activity. `DEV_FINAL_ANALYTICS_GLOBAL.png` was recaptured with the filter explicitly verified as All Providers.
14. **Provider Analytics:** clicking a provider scopes both current analytical state and history, with a provider identity header and details link. The rail and Providers workspace both expose drilldown. Monetary eligibility remains inherited from the existing truth layer.
15. **Activity:** actual Codex Workspaces daily token observations and indexed sessions; daily, UTC-week and cumulative token views. The view is explicitly Codex-only, currently fixed to the local index's 30-day request. Demo does not read personal CLI activity. Unsupported providers show unavailable. No tools/skills/turns/streaks are fabricated.
16. **Reset analytics:** a provider-logo horizon groups reported future reset times; detailed physical-window schedules remain available through disclosure. No reset is predicted from missing evidence. Native 68-provider review exposed compressed names in a crowded band; `ad2a95e8` adds minimum widths and bounded internal scrolling.
17. **Heatmaps:** existing quota matrix and coverage views remain source-backed; local activity shows observed daily cells. The latter is currently a simple presence/intensity presentation and does not meet the requested richer calendar/comparison visual ambition. Missing days are not invented as known zero.
18. **Tracking gaps:** unresolved observed account identity and unknown physical windows continue to prevent invalid comparisons. Local token records do not establish API billing channel. Cross-provider tool/skill/product activity lacks a common verified adapter. The local activity screen's source-status diagnostics and fixed range need further product refinement.
19. **Instrumentation:** no new user telemetry collection. Native measurements use local CDP counters and explicitly synthetic history arrays. A Dev-only proof command dispatches four notification cases; non-Dev proof/seed launches now fail before settings/logging/registration.
20. **Charts:** existing modular ECharts infrastructure and metric registry are reused, with bar support for additive token activity. Source gaps and reset boundaries remain meaningful. Tables have opaque sticky headers. No new chart dependency or permanent animation was added.
21. **Tooltips:** theme-aware confined chart tooltips and accessible readings remain available. Local token tooltips show exact observed values. A universal rich tooltip/popover replacement across every application page is not claimed complete.
22. **Providers V3:** operations filters, master/detail composition, clearer actions, plan identity, Analytics entry and shared workspace styling. Captured both Demo and real sign-in-required state. This is a material integration upgrade, not completion of every aspirational generated layout.
23. **Auth/connect:** supported Sign in is prominent; missing-auth provider targeting opens Connections & accounts. Existing supervised connection flow is retained. No credentials entered, account connected, or external login completion claimed during validation.
24. **Select/MultiSelect/Popover:** shared themed portal controls with search, optional groups/descriptions/disabled entries, keyboard movement, Escape, focus restoration and bulk selection. Table column selection enforces a minimum. Native searchable select and an actually expanded reset-table column menu were captured. Not every historic popover is rewritten.
25. **Notification brand repair:** stable internal AUMID retained; visible registration name Quotalis; no cross-channel registry deletion. Dev activation uses `quotalis-dev`. Four Dev proof dispatches succeeded. Windows API reported notifications Enabled and its history contains the current Quotalis toast XML.
26. **Notification icon result:** verbatim `\\?\` paths and XML escaping were repaired and tested. Native toast history now records `file:///N:/QuotaArc/quotaarc/target/debug/quotalis-icon-128.png`. **Actual visible toast icon is unverified.** XML acceptance is not visual acceptance.
27. **Notification deep links:** native direct URI activation targeted Claude/Connections correctly, including repeat activation after manually selecting Codex. Cold URL and warm event paths are implemented. A physical click on a visible Windows toast, and a complete cold-click matrix, are **not proven**.
28. **Other pages:** shared FormControls, themed portals, navigation and workspace styling propagate to settings and existing consumers. No claim that every page received three independent visual polish iterations.
29. **RTL:** native Arabic Overview and quick-panel captures, mirrored navigation and no root horizontal overflow. Existing keyboard direction handling is retained. Full screen-reader manual audit is not complete.
30. **Responsive:** native 1280×730 logical viewport (1920×1095 capture) and 520×688 logical narrow viewport. Narrow rail mounts one instrument; root overflow false. This is bounded evidence, not an exhaustive device matrix.
31. **Performance:** bounded rail and near-idle renderer counters measured; grouping calculation improved in the local Node benchmark. Worker native round-trip and main-thread scheduling delays remain too high at 250k points to claim the large-history gate passed. Exact values below.
32. **Design paths:** `docs/images/product-v3/design/{A_DASHBOARD,B_24_PROVIDERS,C_70_PROVIDERS,D_QUICK_DETAIL,E_ANALYTICS_GLOBAL,F_PROVIDER_ANALYTICS,G_ACTIVITY,H_RESETS,I_PROVIDERS,J_CONTROLS,K_NOTIFICATION}.png`.
33. **Historical native evidence:** the `DEV_FINAL_*`, `DEV_RAIL_REQUESTED_*_ACTUAL_*` and theme captures, plus five review boards, were withdrawn from the public image tree on 2026-09-27. Audit copies are in ignored `.local/historical-product-v3-native-2026-09-27/`. The captures belong to the former Quotalis presentation; representative review also found real readings and the earlier channel-isolation caveat. They are not current Quotalune release-gallery evidence. Early ITERATION1/2 and DASHBOARD_REAL captures were already excluded from isolated-Dev acceptance. `DEV_ITERATION3_DASHBOARD.png` was misnamed and depicted Analytics. Baseline channel isolation was not certified.
34. **Tests:** frontend 173 files / **1046 passed**; final test-only compatibility correction additionally reran the affected nine panel tests. TypeScript and production Vite build passed as part of final isolated native build, locale parity **1357** keys. Rust workspace desktop **473 passed / 1 pre-existing ignored**, core **1643 passed**, CLI **1 passed**, doctests **0**. Clippy `--workspace --all-targets -- -D warnings`, fmt check, secret scan (**1935 files**), added skip/focus scan (**0**) and final base-to-working-tree diff check passed. The ignored test intentionally reads real on-disk history and was not run. Build retains the existing 648.19 kB / 219.73 kB gzip analytics-engine chunk-size warning.
35. **Remaining limitations:** native toast appearance/physical clicks; exact 70 registered native items; largest-history transfer cost; full three-iteration visual coverage of all pages; richer activity calendar/normalized range controls; comprehensive cross-provider activity sources and universal rich tooltip/popover treatment. No invented completion percentages or visual scores.
36. **Personal status:** **FAILED hard condition.** Two earlier wrongly configured native builds used Personal paths and changed presentation settings; startup side effects may extend to logs/history/notification registration. Their exact processes were stopped, the user was informed, and no speculative rollback was made. The later builds explicitly use Rust `dev-channel`, reject mismatched proof/seed launches and restore only the fresh isolated-Dev presentation backup. See `PRODUCT_V3_CHANNEL_INCIDENT.md`.
37. **Verdict:** **PRODUCT V3 NOT PASSED.** Substantial implementation, tests and reviewable native evidence are delivered; the failed Personal condition cannot be retroactively turned into PASS. No release or subsequent product phase is started.

## Measured rail behavior

Five samples per requested size. Timings include settings IPC/persistence plus two animation-frame paint opportunities; they are **not FPS or pure rendering duration**. Final wide viewport mounted six instruments; End reached item 68/68.

| Requested | Actual catalog items | Mounted | Median request-to-paint ms | Root overflow |
|---:|---:|---:|---:|---|
| 1 | 1 | 1 | 94.5 | No |
| 6 | 6 | 6 | 108.3 | No |
| 12 | 12 | 6 | 106.8 | No |
| 24 | 24 | 6 | 131.8 | No |
| 40 | 40 | 6 | 182.4 | No |
| 70 | 68 | 6 | 178.3 | No |

Five-second native idle sample: CDP renderer TaskDuration delta **0.001231 s**, JS heap **12,197,344 bytes**, DOM nodes **4395**. These are renderer counters, not whole-process CPU or a leak test. Reduced-motion emulation was confirmed by `matchMedia` and computed rail transition **0s**. Three mounted theme samples produced distinct accents `#2dd4bf`, `#c4cdd8`, `#d4a179`; the previous surface theme was restored.

## Large-history measurements

The Node grouping benchmark used identical synthetic physical-series corpus shapes before/after, one warmup and five warm measurements. It is not a native renderer benchmark.

| Points | Before median ms | After median ms |
|---:|---:|---:|
| 25,000 | 49.24 | 28.34 |
| 100,000 | 221.13 | 123.29 |
| 250,000 | 560.13 | 335.06 |

Separately, the final bundled Worker was exercised inside native WebView2 with 70 synthetic observed series, five newly created Worker samples per size, including startup, structured cloning, calculation and response. The UI path selects a Worker only **above** 25,000 points; its 25k row below is an explicit benchmark, not the normal threshold path.

| Points | Native Worker round-trip median ms | Largest sampled 16-ms timer delay ms |
|---:|---:|---:|
| 25,000 | 195.9 | 14.1 |
| 100,000 | 714.8 | 81.3 |
| 250,000 | 1820.9 | 234.1 |

Worker calculation keeps the full synchronous aggregation out of the render path, but object transfer still pauses the main thread at large sizes. A compact/chunked transfer contract or backend bounded aggregation is required before accepting the largest stress case. Do not compare these native round trips directly to the Node-only calculation table as if they measure the same thing.

## Evidence handling

Additional explicit Dev-feature notification tests: desktop **9 passed**, core **34 passed**, CLI **0 selected**. No native notifications are emitted by these unit tests.

Local detailed logs and machine-readable samples remain under `.local/v3-*`: tests-final, cargo-final, clippy-final, fmt-final, native-build-final, secrets-final, added-skip-focus, rail-native-results, interactions-results, worker-native-results, theme-results and toast-history-final. No credentials or local project names were added to this report. Historical wrong-channel screenshots remain explicitly segregated by name/documentation, not silently presented as Dev proof.
