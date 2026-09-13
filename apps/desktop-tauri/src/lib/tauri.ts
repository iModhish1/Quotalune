import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AnalyticsSourceDescriptor,
  ApiKeyInfoBridge,
  ApiKeyProviderInfoBridge,
  AppInfoBridge,
  BootstrapState,
  CurrentSurfaceState,
  CookieInfoBridge,
  DetectedBrowserBridge,
  Language,
  LocaleStrings,
  NotificationSoundEvent,
  ProviderCatalogEntry,
  ProviderChartData,
  ProviderDetail,
  ProviderLocalUsageSummary,
  ProviderSummary,
  ProviderUsageSnapshot,
  ProviderInstanceSnapshot,
  ProviderTokenAccountsBridge,
  TokenAccountSupportBridge,
  SettingsSnapshot,
  SettingsUpdate,
  SurfaceMode,
  SurfaceTargetForMode,
  VisibleSurfaceMode,
  UpdateStatePayload,
  CookieSourceOption,
  RegionOption,
  CredentialStorageStatus,
  WorkAreaRect,
  AgentSession,
  AgentSessionDiscoveryResult,
  SessionFocusResult,
  TrayVisibilityStatusDto,
  UsageSpendSummary,
  SpendContract,
  CodexLocalProjectUsageSnapshot,
  CodexAccount,
  CodexAccountUsageSnapshot,
  CodexAccountsStateBridge,
  CodexSwitchResult,
  DeepSeekPricingStatus,
  DashboardSnapshot,
  DashboardRangeKind,
} from "../types/bridge";
import type { CatalogSurfaceId } from "../design-system/themeResolution";

export function getBootstrapState(): Promise<BootstrapState> {
  return invoke<BootstrapState>("get_bootstrap_state");
}

export function getProviderCatalog(): Promise<ProviderCatalogEntry[]> {
  return invoke<ProviderCatalogEntry[]>("get_provider_catalog");
}

export function reorderProviders(ids: string[]): Promise<ProviderSummary[]> {
  return invoke<ProviderSummary[]>("reorder_providers", { ids });
}

export function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  return invoke<SettingsSnapshot>("get_settings_snapshot");
}

export function getDashboardSnapshot(options: {
  range: DashboardRangeKind;
  timezone?: string;
  customSince?: number;
  customUntil?: number;
  providers?: string[];
}): Promise<DashboardSnapshot> {
  return invoke<DashboardSnapshot>("get_dashboard_snapshot", {
    range: options.range,
    timezone: options.timezone,
    customSince: options.customSince,
    customUntil: options.customUntil,
    providers: options.providers,
  });
}

export function updateSettings(
  patch: SettingsUpdate,
): Promise<SettingsSnapshot> {
  return invoke<SettingsSnapshot>("update_settings", { patch });
}

export function setProviderDetailWindow(provider: string, selection: string): Promise<void> {
  return invoke<void>("set_provider_detail_window", {provider, selection});
}

/** Null restores the inherited selection; [] explicitly hides all limit details. */
export function setProviderLimitOrder(provider: string, order: string[] | null): Promise<void> {
  return invoke<void>("set_provider_limit_order", { provider, order });
}

export function setProviderLimitPresentation(provider: string, presentation: import('../design-system/limitPresentation').LimitPresentation | null): Promise<void> {
  return invoke<void>('set_provider_limit_presentation', {provider,presentation});
}

export function setGlobalLimitPresentation(presentation: import('../design-system/limitPresentation').LimitPresentation): Promise<void> {
  return invoke<void>('set_global_limit_presentation', {presentation});
}

export function setResetPresentation(config: import('./resetPresentationSettings').ResetPresentationSettingsDto): Promise<void> {
  return invoke<void>('set_reset_presentation', {config});
}

export function setResetPresentationSurfaceOverride(
  surface: string,
  config: import('./resetPresentationSettings').ResetPresentationSettingsDto | null,
): Promise<void> {
  return invoke<void>('set_reset_presentation_surface_override', {surface,config});
}

export function setUsageSettings(
  globalMode: "used" | "remaining" | "hybrid",
  providerOverrides: Record<string, "used" | "remaining" | "hybrid">,
): Promise<void> {
  return invoke<void>("set_usage_settings", { globalMode, providerOverrides });
}

export type CatalogThemeScope = "global" | "profile" | `surface:${CatalogSurfaceId}`;

export function setCatalogTheme(
  slug: string,
  scope: CatalogThemeScope = "global",
): Promise<void> {
  return invoke<void>("set_catalog_theme", { slug, scope });
}

export function getTrayVisibilityStatus(): Promise<TrayVisibilityStatusDto> {
  return invoke<TrayVisibilityStatusDto>("tray_visibility_status");
}

export function listAgentSessions(): Promise<AgentSessionDiscoveryResult> {
  return invoke<AgentSessionDiscoveryResult>("list_agent_sessions");
}

export function focusAgentSession(
  session: AgentSession,
): Promise<SessionFocusResult> {
  return invoke<SessionFocusResult>("focus_agent_session", { session });
}

export function setSurfaceMode<M extends VisibleSurfaceMode>(
  mode: M,
  target: SurfaceTargetForMode<M>,
): Promise<SurfaceMode> {
  return invoke<SurfaceMode>("set_surface_mode", { mode, target });
}

export function dismissTrayPanel(): Promise<void> {
  return invoke<void>("dismiss_tray_panel");
}

/** Suppress flyout blur-dismiss while a resize/drag gesture is in flight. */
export function beginFlyoutGesture(): Promise<void> {
  return invoke<void>("begin_flyout_gesture");
}
export function endFlyoutGesture(): Promise<void> {
  return invoke<void>("end_flyout_gesture");
}

export function openSettingsWindow(tab: string): Promise<void> {
  return invoke<void>("open_settings_window", { tab });
}

/**
 * Open (or focus) the real Dashboard (PopOutPanel, MainRoute::Dashboard) in
 * the shared `main` window — the same destination sidebar navigation, tray
 * deep-links, and cold launch all converge on (Wave 6 Phase 3).
 */
export function openDashboard(): Promise<void> {
  return invoke<void>("open_dashboard");
}

/** Open (or focus) the detached flyout ("Pop Out Panel") window. */
export function openFlyoutWindow(): Promise<void> {
  return invoke<void>("open_flyout_window");
}

export function closeSettingsWindow(): Promise<void> {
  return invoke<void>("close_settings_window");
}

export function getCurrentSurfaceState(): Promise<CurrentSurfaceState> {
  return invoke<CurrentSurfaceState>("get_current_surface_state");
}

export function refreshProviders(): Promise<void> {
  return invoke<void>("refresh_providers");
}

export function refreshProvidersIfStale(): Promise<void> {
  return invoke<void>("refresh_providers_if_stale");
}

export function getProviderInstances(): Promise<ProviderInstanceSnapshot[]> {
  return invoke<ProviderInstanceSnapshot[]>("get_provider_instances");
}

export function getCachedProviders(): Promise<ProviderUsageSnapshot[]> {
  return invoke<ProviderUsageSnapshot[]>("get_cached_providers");
}

export function getDeepSeekPricingStatus(): Promise<DeepSeekPricingStatus | null> {
  return invoke<DeepSeekPricingStatus | null>("get_deepseek_pricing_status");
}

export function getWorkAreaRect(): Promise<WorkAreaRect> {
  return invoke<WorkAreaRect>("get_work_area_rect");
}

export function getCredentialStorageStatus(): Promise<CredentialStorageStatus> {
  return invoke<CredentialStorageStatus>("get_credential_storage_status");
}

export function getUpdateState(): Promise<UpdateStatePayload> {
  return invoke<UpdateStatePayload>("get_update_state");
}

export function checkForUpdates(): Promise<UpdateStatePayload> {
  return invoke<UpdateStatePayload>("check_for_updates");
}

export function downloadUpdate(): Promise<UpdateStatePayload> {
  return invoke<UpdateStatePayload>("download_update");
}

export function applyUpdate(): Promise<void> {
  return invoke<void>("apply_update");
}

export function dismissUpdate(): Promise<UpdateStatePayload> {
  return invoke<UpdateStatePayload>("dismiss_update");
}

export function openReleasePage(): Promise<void> {
  return invoke<void>("open_release_page");
}

export function openExternalUrl(url: string): Promise<void> {
  return invoke<void>("open_external_url", { url });
}

// ── Credential store bridge ──────────────────────────────────────────

export function getApiKeys(): Promise<ApiKeyInfoBridge[]> {
  return invoke<ApiKeyInfoBridge[]>("get_api_keys");
}

export function getApiKeyProviders(): Promise<ApiKeyProviderInfoBridge[]> {
  return invoke<ApiKeyProviderInfoBridge[]>("get_api_key_providers");
}

export function setApiKey(
  providerId: string,
  apiKey: string,
  label?: string,
): Promise<ApiKeyInfoBridge[]> {
  return invoke<ApiKeyInfoBridge[]>("set_api_key", {
    providerId,
    apiKey,
    label: label ?? null,
  });
}

export function removeApiKey(providerId: string): Promise<ApiKeyInfoBridge[]> {
  return invoke<ApiKeyInfoBridge[]>("remove_api_key", { providerId });
}

export function hasOpenRouterManagementApiKey(): Promise<boolean> {
  return invoke<boolean>("has_openrouter_management_api_key");
}

export function setOpenRouterManagementApiKey(apiKey: string): Promise<void> {
  return invoke<void>("set_openrouter_management_api_key", { apiKey });
}

export function removeOpenRouterManagementApiKey(): Promise<void> {
  return invoke<void>("remove_openrouter_management_api_key");
}

export function getManualCookies(): Promise<CookieInfoBridge[]> {
  return invoke<CookieInfoBridge[]>("get_manual_cookies");
}

export function setManualCookie(
  providerId: string,
  cookieHeader: string,
): Promise<CookieInfoBridge[]> {
  return invoke<CookieInfoBridge[]>("set_manual_cookie", {
    providerId,
    cookieHeader,
  });
}

export function removeManualCookie(
  providerId: string,
): Promise<CookieInfoBridge[]> {
  return invoke<CookieInfoBridge[]>("remove_manual_cookie", { providerId });
}

export function listDetectedBrowsers(): Promise<DetectedBrowserBridge[]> {
  return invoke<DetectedBrowserBridge[]>("list_detected_browsers");
}

export function importBrowserCookies(
  providerId: string,
  browserType: string,
): Promise<CookieInfoBridge[]> {
  return invoke<CookieInfoBridge[]>("import_browser_cookies", {
    providerId,
    browserType,
  });
}

export function getAppInfo(): Promise<AppInfoBridge> {
  return invoke<AppInfoBridge>("get_app_info");
}

export function getProviderChartData(
  providerId: string,
  accountEmail?: string,
): Promise<ProviderChartData> {
  return invoke<ProviderChartData>("get_provider_chart_data", { providerId, accountEmail });
}

export function getProviderLocalUsageSummary(
  providerId: string,
): Promise<ProviderLocalUsageSummary | null> {
  return invoke<ProviderLocalUsageSummary | null>("get_provider_local_usage_summary", { providerId });
}

/** The real analytics source registry -- capability map for the Analytics
 *  UI, mirrored 1:1 from `analytics_source_registry()`
 *  (rust/src/analytics_sources.rs). Cheap (directory-existence checks
 *  only, no file-content scanning), safe to call on every Analytics/
 *  Settings render. */
export function getAnalyticsSourceRegistry(): Promise<AnalyticsSourceDescriptor[]> {
  return invoke<AnalyticsSourceDescriptor[]>("get_analytics_source_registry");
}

export function getUsageSpendSummary(options?: { historyDays?: number; forceRefresh?: boolean }): Promise<UsageSpendSummary> {
  return invoke<UsageSpendSummary>("get_usage_spend_summary", {
    historyDays: options?.historyDays ?? null,
    forceRefresh: options?.forceRefresh ?? null,
  });
}

export function writeUsageSpendExport(payload: string): Promise<boolean> {
  return invoke<boolean>("write_usage_spend_export", { payload });
}

export function getSpendContract(
  providerId: string,
  options?: { historyDays?: number; includeOpenCodex?: boolean },
): Promise<SpendContract> {
  return invoke<SpendContract>("get_spend_contract", {
    providerId,
    historyDays: options?.historyDays ?? null,
    includeOpenCodex: options?.includeOpenCodex ?? null,
  });
}

export function getCodexWorkspacesSnapshot(options?: {
  forceRefresh?: boolean;
  historyDays?: number;
}): Promise<CodexLocalProjectUsageSnapshot> {
  return invoke<CodexLocalProjectUsageSnapshot>("get_codex_workspaces_snapshot", {
    forceRefresh: options?.forceRefresh ?? null,
    historyDays: options?.historyDays ?? null,
  });
}

// ── Token account bridge ─────────────────────────────────────────────

export function getTokenAccountProviders(): Promise<TokenAccountSupportBridge[]> {
  return invoke<TokenAccountSupportBridge[]>("get_token_account_providers");
}

export function getTokenAccounts(
  providerId: string,
): Promise<ProviderTokenAccountsBridge> {
  return invoke<ProviderTokenAccountsBridge>("get_token_accounts", { providerId });
}

export function addTokenAccount(
  providerId: string,
  label: string,
  token: string,
): Promise<ProviderTokenAccountsBridge> {
  return invoke<ProviderTokenAccountsBridge>("add_token_account", {
    providerId,
    label,
    token,
  });
}

export function removeTokenAccount(
  providerId: string,
  accountId: string,
): Promise<ProviderTokenAccountsBridge> {
  return invoke<ProviderTokenAccountsBridge>("remove_token_account", {
    providerId,
    accountId,
  });
}

export function setActiveTokenAccount(
  providerId: string,
  accountId: string,
): Promise<ProviderTokenAccountsBridge> {
  return invoke<ProviderTokenAccountsBridge>("set_active_token_account", {
    providerId,
    accountId,
  });
}

// ── Phase 5 — i18n ────────────────────────────────────────────────────

export function getLocaleStrings(
  language?: Language | null,
): Promise<LocaleStrings> {
  return invoke<LocaleStrings>("get_locale_strings", {
    language: language ?? null,
  });
}

export function setUiLanguage(language: Language): Promise<void> {
  return invoke<void>("set_ui_language", { language });
}

// ── Phase 6b — provider detail pane ──────────────────────────────────

export function getProviderDetail(providerId: string): Promise<ProviderDetail> {
  return invoke<ProviderDetail>("get_provider_detail", { providerId });
}

export function openProviderDashboard(providerId: string): Promise<void> {
  return invoke<void>("open_provider_dashboard", { providerId });
}

export function openProviderStatusPage(providerId: string): Promise<void> {
  return invoke<void>("open_provider_status_page", { providerId });
}

export interface ProviderLoginChallenge {
  providerId: string;
  requestId: string;
  userCode: string;
  verificationUri: string;
}

export type ProviderLoginPhaseName =
  | "starting"
  | "waiting"
  | "completed"
  | "failed"
  | "timedOut"
  | "canceled";

export interface ProviderLoginPhase {
  providerId: string;
  requestId: string;
  phase: ProviderLoginPhaseName;
  message?: string | null;
}

export interface ProviderLoginOptions {
  onChallenge?: (challenge: ProviderLoginChallenge) => void;
  onPhase?: (phase: ProviderLoginPhase) => void;
}

export interface ProviderLoginHandle {
  requestId: string;
  completion: Promise<void>;
  cancel: () => Promise<boolean>;
}

/** Start one request-scoped login and expose its completion and cancel controls. */
export function startProviderLogin(
  providerId: string,
  options: ProviderLoginOptions = {},
): ProviderLoginHandle {
  const requestId = crypto.randomUUID();
  let started = false;
  let cancelRequested = false;
  let cancelInFlight: Promise<boolean> | null = null;
  const listenerSetups = [
    options.onChallenge
      ? listen<ProviderLoginChallenge>("provider-login-challenge", (event) => {
          if (
            event.payload.providerId === providerId &&
            event.payload.requestId === requestId
          ) {
            options.onChallenge?.(event.payload);
          }
        })
      : Promise.resolve(undefined),
    options.onPhase
      ? listen<ProviderLoginPhase>("provider-login-phase", (event) => {
          if (
            event.payload.providerId === providerId &&
            event.payload.requestId === requestId
          ) {
            options.onPhase?.(event.payload);
          }
        })
      : Promise.resolve(undefined),
  ];
  const listens = (async () => {
    const results = await Promise.allSettled(listenerSetups);
    const stops = results
      .filter(
        (result): result is PromiseFulfilledResult<(() => void) | undefined> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) {
      for (const stop of stops) stop?.();
      throw failed.reason;
    }
    return stops;
  })();

  const completion = (async () => {
    const stops = await listens;
    try {
      if (cancelRequested) {
        options.onPhase?.({ providerId, requestId, phase: "canceled" });
        return;
      }
      started = true;
      await invoke<void>("trigger_provider_login", {
        providerId,
        loginRequestId: requestId,
      });
    } finally {
      for (const stop of stops) stop?.();
    }
  })();

  return {
    requestId,
    completion,
    cancel: () => {
      if (cancelRequested && !cancelInFlight) return Promise.resolve(false);
      if (cancelInFlight) return cancelInFlight;
      cancelRequested = true;
      cancelInFlight = (async () => {
        try {
          await listens;
          if (!started) return true;
          const accepted = await invoke<boolean>("cancel_provider_login", {
            providerId,
            loginRequestId: requestId,
          });
          if (!accepted) cancelRequested = false;
          return accepted;
        } catch (error) {
          cancelRequested = false;
          throw error;
        } finally {
          cancelInFlight = null;
        }
      })();
      return cancelInFlight;
    },
  };
}

/** Compatibility wrapper for existing callers that only await completion. */
export function triggerProviderLogin(
  providerId: string,
  onChallenge?: (challenge: ProviderLoginChallenge) => void,
  onPhase?: (phase: ProviderLoginPhase) => void,
): Promise<void> {
  return startProviderLogin(providerId, { onChallenge, onPhase }).completion;
}

export function revokeProviderCredentials(providerId: string): Promise<void> {
  return invoke<void>("revoke_provider_credentials", { providerId });
}

// ── Phase 6c — cookie source & region pickers ────────────────────────

export function getProviderCookieSourceOptions(
  providerId: string,
): Promise<CookieSourceOption[]> {
  return invoke<CookieSourceOption[]>("get_provider_cookie_source_options", {
    providerId,
  });
}

export function getProviderRegionOptions(providerId: string): Promise<RegionOption[]> {
  return invoke<RegionOption[]>("get_provider_region_options", { providerId });
}

export function setProviderUsageSource(providerId: string, source: string): Promise<void> {
  return invoke<void>("set_provider_usage_source", { providerId, source });
}

export function setProviderCookieSource(providerId: string, source: string): Promise<void> {
  return invoke<void>("set_provider_cookie_source", { providerId, source });
}

export function setProviderRegion(providerId: string, region: string): Promise<void> {
  return invoke<void>("set_provider_region", { providerId, region });
}

export function getProviderWorkspaceId(providerId: string): Promise<string | null> {
  return invoke<string | null>("get_provider_workspace_id", { providerId });
}

export function setProviderWorkspaceId(
  providerId: string,
  workspaceId: string,
): Promise<void> {
  return invoke<void>("set_provider_workspace_id", { providerId, workspaceId });
}

export function setProviderGatewayUrl(
  providerId: string,
  gatewayUrl: string,
): Promise<void> {
  return invoke<void>("set_provider_gateway_url", { providerId, gatewayUrl });
}

// ── Phase 6d — credential detection ──────────────────────────────────

export function openPath(path: string): Promise<void> {
  return invoke<void>("open_path", { path });
}

export function getGeminiCliSignedIn(): Promise<
  import("../types/bridge").GeminiCliStatus
> {
  return invoke("get_gemini_cli_signed_in");
}

export function getVertexAiStatus(): Promise<
  import("../types/bridge").VertexAiStatus
> {
  return invoke("get_vertexai_status");
}

export function listJetbrainsDetectedIdes(): Promise<
  import("../types/bridge").JetbrainsIde[]
> {
  return invoke("list_jetbrains_detected_ides");
}

export function setJetbrainsIdePath(path: string): Promise<void> {
  return invoke<void>("set_jetbrains_ide_path", { path });
}

export function getKiroStatus(): Promise<
  import("../types/bridge").KiroStatus
> {
  return invoke("get_kiro_status");
}

// ── Phase 7 — global shortcut capture + notification preview ──────────

export function registerGlobalShortcut(accelerator: string): Promise<void> {
  return invoke<void>("register_global_shortcut", { accelerator });
}

export function unregisterGlobalShortcut(): Promise<void> {
  return invoke<void>("unregister_global_shortcut");
}

export function playNotificationSound(event: NotificationSoundEvent): Promise<void> {
  return invoke<void>("play_notification_sound", { event });
}

export function reanchorTrayPanel(): Promise<void> {
  return invoke<void>("reanchor_tray_panel");
}

export function revealTrayPanelWindow(): Promise<void> {
  return invoke<void>("reveal_tray_panel_window");
}

/** Persist the user's manually-chosen flyout (Pop Out Dashboard) size. */
export function setFlyoutSize(width: number, height: number): Promise<void> {
  return invoke<void>("set_flyout_size", { width, height });
}

/** The remembered flyout size ([w, h]) if the user has resized it, else null. */
export function flyoutStoredSize(): Promise<[number, number] | null> {
  return invoke<[number, number] | null>("flyout_stored_size");
}

export function quitApp(): Promise<void> {
  return invoke<void>("quit_app");
}

// ── Codex multi-account (ADR 0003) ───────────────────────────────────

export function codexAccountsList(): Promise<CodexAccount[]> {
  return invoke<CodexAccount[]>("codex_accounts_list");
}

export function codexAccountAdd(): Promise<CodexAccount> {
  return invoke<CodexAccount>("codex_account_add");
}

export function codexAccountRemove(id: string): Promise<void> {
  return invoke<void>("codex_account_remove", { id });
}

export function codexAccountSwitch(id: string): Promise<CodexSwitchResult> {
  return invoke<CodexSwitchResult>("codex_account_switch", { id });
}

export function codexAccountFetch(
  id: string,
): Promise<CodexAccountUsageSnapshot> {
  return invoke<CodexAccountUsageSnapshot>("codex_account_fetch", { id });
}

export function codexAccountSnapshots(): Promise<
  Record<string, CodexAccountUsageSnapshot>
> {
  return invoke<Record<string, CodexAccountUsageSnapshot>>(
    "codex_account_snapshots",
  );
}

export function codexAccountRestartDesktop(
  sessionRoot?: string | null,
  backupDestination?: string | null,
  restoreSource?: string | null,
): Promise<void> {
  return invoke<void>("codex_account_restart_desktop", {
    sessionRoot,
    backupDestination,
    restoreSource,
  });
}

export function getCodexAccountsState(): Promise<CodexAccountsStateBridge> {
  return invoke<CodexAccountsStateBridge>("get_codex_accounts_state");
}

export function getSafeDiagnostics(): Promise<string> {
  return invoke<string>("get_safe_diagnostics");
}
