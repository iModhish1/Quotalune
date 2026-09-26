# Cross-wave regression matrix — active acceptance tracker

Scope: the 22 minimum interactions in historical appendix A66, plus defects found during integration. This is an acceptance tracker, not a declaration that the whole product passed. Historical screenshots do not validate the current source. The historical-wave inventory is recorded in `ALL_WAVES_RECONCILIATION_MATRIX.md`; its broader acceptance remains open.

Status **PARTIAL** means implementation or component evidence exists, but the complete interaction has not been established. No row below is a current native PASS. Paths are repository-relative. The frontend checkpoint for this increment is `.local/wave3-reporting-full-front.log` (1568 tests / 228 files); Rust results and exact candidate identity are recorded in `WAVE3_IMPLEMENTATION_REPORT.md` when complete. A suite pass supports only assertions the tests actually exercise.

**Native status re-verified 2026-09-26.** This tracker previously stated that native
closure was blocked by the environment. That is no longer accurate: the prior
all-black capture was a tooling-path failure, not an application defect, and a
freshness-proven Dev build now launches and paints its WebView2 content. See
`PHASE_NATIVE_VISUAL_EVIDENCE.md` and `evidence/`. No row above is promoted by
that change, because the captures cover the Settings surfaces only; the native
evidence each row still requires is unchanged.

| ID | Interaction | Located implementation / test evidence | Status | Required closure |
|---|---|---|---|---|
| CW01 | Provider connection → Dashboard | `ProviderDetailPane.test.tsx` proves real completion refreshes and simulated completion does not; `useDashboardSnapshot.test.ts` covers provider-refresh reload | PARTIAL | Exercise one connected provider through the real shared event/cache boundary, then native display; disconnected/error/empty must remain distinct |
| CW02 | Provider connection → Analytics | `useDashboardSnapshot.test.ts` covers filter propagation and superseded results; `useDashboardAnalyticsModel.test.tsx` covers stale worker responses | PARTIAL | Verify account/source identity and history scope across connect/reconnect, with no fabricated history or quota-to-money conversion |
| CW03 | Provider connection → Structure | Shared provider snapshot and structure consumers | PARTIAL | Trace connected/disconnected/stale snapshots into every render path; preserve selected physical limits and explicit missing values |
| CW04 | Provider connection → Tray | `apps/desktop-tauri/src-tauri/src/tray_bridge.rs` | PARTIAL | Drive connection transitions through tray reconciliation; native icon/tooltip and resource lifecycle proof |
| CW05 | Provider connection error → notification | `rust/src/notifications.rs` and typed connection state | PARTIAL | Verify each eligible real error class produces only its intended alert; retries must not duplicate alerts |
| CW06 | Provider connection error → notification history | `rust/src/notification_journal.rs`, shell notification-history commands | PARTIAL | Verify producer-to-journal error mapping, redaction, delivery-independent retention and read state |
| CW07 | Theme → Structures | `ThemeStructureMatrix.test.tsx`, theme-resolution tests | PARTIAL | Match assertions to all current registered forms/scopes; fresh native light/dark, placement and clipping evidence |
| CW08 | Theme → Tray | Shared tray renderer and `tray_bridge.rs` | PARTIAL | Validate selected identity, threshold semantics and native small-size legibility at supported DPI |
| CW09 | Theme → Background | `WorkspaceBackdrop.test.tsx` covers imported-image rendering, motion guards and decorative semantics | PARTIAL | Verify live theme changes across workspace pages with no override loss, clipping or repeated animation setup |
| CW10 | Color Mode → all appearance scopes | `themePreference.test.ts`, `useTheme.test.ts`, `themeResolution.test.ts` | PARTIAL | Inspect App/Structure/Provider identity independence, every Apply scope and restart persistence |
| CW11 | Language → onboarding | Shared locale keys, `ProviderConnectFlow.test.tsx` | PARTIAL | Locale parity is not layout proof; inspect Arabic text, method names, keyboard flow and narrow RTL |
| CW12 | Language → Structures | Shared structure controls and locale runtime | PARTIAL | Test localized labels and physical/logical placement separately; native text bounds |
| CW13 | Language → Tray | Tray tooltip renderer and shared locale runtime | PARTIAL | Verify Arabic, Unicode truncation boundaries, selected row order and Windows hover output |
| CW14 | Language → notifications | Notification branding/content and journal consumers | PARTIAL | Verify native header/body, provider artwork, redacted text and history layout in both languages |
| CW15 | Loading → Dashboard | `useDashboardSnapshot.test.ts`, `QuotalisLoadingStates.test.tsx` | PARTIAL | Validate initial, same-scope refresh, changed scope, empty and failed fetch without blanking valid cached data |
| CW16 | Loading → Structure | Shared loading components and structure render paths | PARTIAL | Verify refresh/first-load distinction and reduced-motion behavior in each actual structure |
| CW17 | Loading → Analytics | `useDashboardAnalyticsModel.test.tsx` proves pending fallback, stale-result rejection and worker disposal | PARTIAL | Validate chart loading/error/no-data distinctions and interaction continuity with large histories |
| CW18 | Credential disconnect → provider status | `commands/connection.rs`, connection-operation tests | PARTIAL | Exercise protected-copy removal, retained ambient-source truth, selected account and concurrent operation cancellation |
| CW19 | Credential disconnect → tray | Connection commands and tray reconciliation | PARTIAL | Verify immediate invalidation/removal for the intended provider/account only; no stale tooltip or orphan icon |
| CW20 | Credential disconnect → notification dedupe | Notification journal account keys and connection commands | PARTIAL | Verify reconnect/account-change does not reuse another account's dedupe state or expose raw identity |
| CW21 | History migration → Analytics/history | `notification_journal/compat_tests.rs` includes legacy/current/legacy writes, rollback, atomicity and ID collision tests | PARTIAL | Journal rollback checks do not prove analytics history migration; trace both stores and UI readback against fixtures |
| CW22 | Dev fixture → production-store isolation | `ProviderDetailPane.test.tsx`; fixture routing and cancellation tests in shell connection/system commands | PARTIAL | Existing tests cover simulated-login routing and global-refresh suppression; complete all remaining command/store mutation boundaries and native fixture lifecycle |
| CW23 | Adapter observation → bridge → connection summary | OpenRouter spend rows use informational semantics; Antigravity missing/unknown quota stays informational; bridge honors `usage_known`; shell verification counts only valid non-informational rows | PARTIAL | Code regression tests cover spend-only/unknown/known-zero, all row positions and shared monetary classification. Complete wider adapter audit and native summary evidence; count is presentation rows, not unique physical quotas |

## Repair evidence from this increment

The reporting review found that spend-only OpenRouter rows and Antigravity unknown-usage placeholders were counted as quota. An added OpenRouter adapter regression failed before repair (`.local/wave3-reporting-regression-before.log`). Source repair preserves their descriptions/rows while preventing quota-percentage assertions. Antigravity's empty-response fallback was corrected for the same reason. The shell test crosses the real `UsageSnapshot` → `ProviderUsageSnapshot::from_fetch_result` → verification boundary and preserves explicitly reported zero.

Static reporting policy now requires response evidence instead of treating legacy `supports_reset_windows` or `supports_credits` as proof. This removes false guarantees; it does **not** complete the per-provider reporting capability audit. Spend, Balance and Credits use the existing shared classifier; unknown observations do not acquire a monetary label.

## Execution order

Finish Wave 3's remaining source/capability and scenario coverage first. Use CW01–06 and CW18–23 as its integration gates. Reconcile the full historical ledger before declaring older waves current; then execute CW07–17 alongside product completion. No release or Personal promotion follows from this tracker.
