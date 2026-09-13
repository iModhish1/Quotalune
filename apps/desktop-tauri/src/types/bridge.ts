export type SurfaceMode = "hidden" | "trayPanel" | "popOut" | "settings";
export type VisibleSurfaceMode = Exclude<SurfaceMode, "hidden">;
export type SettingsTabId =
  | "dashboard"
  | "analytics"
  | "general"
  | "providers"
  | "providerDisplay"
  | "collections"
  | "profiles"
  | "resetDisplay"
  | "dashboardStudio"
  | "analyticsSources"
  | "notifications"
  | "menuBar"
  | "menu"
  | "usageSpend"
  | "surfaces"
  | "themes"
  | "advanced"
  | "about";

/** Legacy wire values accepted for compatibility. The sole runtime is Analytics; Rust resolves all values to analytics2d. */
export type DashboardModeId = "analytics2d" | "providers3d" | "hybrid" | "spatial";

/** Dashboard rendering performance budget, independent of provider-refresh
 *  power settings. Mirrors `quotalis_core::settings::DashboardPerformancePreset`. */
export type DashboardPerformancePreset = "lowCpu" | "balanced" | "highFidelity";

/** Phase 5.2: how Demo Mode picks which providers to simulate.
 *  Mirrors `quotalis_core::settings::DemoProviderMode`. */
export type DemoProviderMode = "curated" | "custom";

/** Phase 5.2: which deterministic simulated dataset Demo Mode generates.
 *  Mirrors `quotalis_core::settings::DemoScenario`. */
export type DemoScenario =
  | "connectedShowcase"
  | "balancedActivity"
  | "highUsage"
  | "resetSoon"
  | "mixedStatus"
  | "monetarySemantics";

// ── Narrowed string-literal unions (persisted settings enums) ─────────

export interface ProviderTrayConfig {
  enabled:boolean; limitId:string; style:"ring"|"arc"|"bar"|"badge"; showAsUsed:boolean;
  tooltipLimitIds:string[]; showName:boolean; showPlan:boolean;
  tokenRange:"none"|"today"|"week"|"month"|"year"|"lifetime";
  precision:number; color:"provider"|"identity"|"silver"; stroke:number;
}
export type TrayIconMode = "single" | "perProvider";

export type NotificationSoundTheme = "windows" | "codexBar";

export type NotificationSoundEvent =
  | "predictiveWarning"
  | "highUsage"
  | "criticalUsage"
  | "exhausted"
  | "statusIssue"
  | "sessionDepleted"
  | "sessionRestored"
  | "expectedReset"
  | "unexpectedReset"
  | "bankedResetCredit";

export interface NotificationSoundPaths {
  predictiveWarning: string | null;
  highUsage: string | null;
  criticalUsage: string | null;
  exhausted: string | null;
  statusIssue: string | null;
  sessionDepleted: string | null;
  sessionRestored: string | null;
  expectedReset: string | null;
  unexpectedReset: string | null;
  bankedResetCredit: string | null;
}

export interface NotificationEventPreferences {
  highUsage: boolean;
  criticalUsage: boolean;
  exhausted: boolean;
  statusIssue: boolean;
  sessionDepleted: boolean;
  sessionRestored: boolean;
  expectedReset: boolean;
  unexpectedReset: boolean;
  bankedResetCredit: boolean;
}

export interface NotificationQuietHours {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
}

export type MetricPreference =
  | "automatic"
  | "session"
  | "weekly"
  | "model"
  | "tertiary"
  | "credits"
  | "extraUsage"
  | "monthlyPlan"
  | "average";

export type Language =
  | "english"
  | "chinese"
  | "chinesetraditional"
  | "japanese"
  | "korean"
  | "spanish"
  | "russian"
  | "turkish"
  | "arabic";

/** Language catalog entry from the Rust backend. */
export type LanguageOption = {
  /** Stable bridge/settings value (e.g. "english") */
  value: Language;
  /** Native display name (e.g. "English", "中文", "Español") */
  display: string;
};

export type UpdateChannel = "local" | "stable" | "beta";

export type ThemePreference = "auto" | "light" | "dark";

export type MenuBarDisplayMode = "minimal" | "compact" | "detailed";

/** How cost is rendered on provider MenuCards (#2976). */
export type CostSummaryDisplayStyle = "compact" | "detailed" | "hidden";
export type FloatBarOrientation = "horizontal" | "vertical";
export type FloatBarStyle = "floating" | "taskbar" | "hud";

export type TrayVisibilitySupport = "supported" | "unsupportedOs";
export type TrayVisibilityState = "promoted" | "notPromoted" | "entryNotFound" | "unknown";

export type DeepSeekPricingPeriod = "standard" | "peak" | "offPeak";

export interface DeepSeekPricingStatus {
  period: DeepSeekPricingPeriod;
  currentLocalTime: string;
  nextTransitionLocalTime: string | null;
  effectiveLocalTime: string;
}

export interface TrayVisibilityStatusDto {
  support: TrayVisibilitySupport;
  state: TrayVisibilityState;
}

export type TrayPanelSurfaceTarget = { kind: "summary" };
export type PopOutSurfaceTarget =
  | { kind: "dashboard" }
  | { kind: "provider"; providerId: string };
export type SettingsSurfaceTarget = { kind: "settings"; tab: SettingsTabId };

export type SurfaceTarget =
  | TrayPanelSurfaceTarget
  | PopOutSurfaceTarget
  | SettingsSurfaceTarget;

export type SurfaceTargetForMode<M extends VisibleSurfaceMode> =
  M extends "trayPanel"
    ? TrayPanelSurfaceTarget
    : M extends "popOut"
      ? PopOutSurfaceTarget
      : SettingsSurfaceTarget;

export interface CurrentSurfaceState {
  mode: SurfaceMode;
  target: SurfaceTarget;
}

export interface AgentSession {
  id: string;
  provider: "codex" | "claude" | "pi";
  /** Pi-family dialect (upstream 0.48.0 #2626); absent for Codex/Claude. */
  dialect?: "pi" | "omp";
  /** Optional session title (Pi-family `session_info`/`title` records). */
  sessionName?: string;
  source: "cli" | "desktopApp" | "ide" | "unknown";
  state: "active" | "idle";
  pid: number | null;
  transcriptPath: string | null;
  host: string;
  workspace: {
    cwd: string | null;
    projectName: string | null;
  };
  activity: {
    startedAt: string | null;
    lastActivityAt: string | null;
  };
  focusTarget:
    | { kind: "process"; pid: number }
    | { kind: "transcript"; transcriptPath: string }
    | { kind: "none" };
}

export interface AgentSessionHostResult {
  host: string;
  sessions: AgentSession[];
  error: string | null;
}

export type AgentSessionDiscoveryResult =
  | { status: "disabled" }
  | { status: "hosts"; hosts: AgentSessionHostResult[] };

export type SessionFocusResult =
  | { status: "focused" }
  | { status: "unsupported"; message: string }
  | { status: "failed"; message: string };

export interface ProviderCatalogEntry {
  id: string;
  displayName: string;
  cookieDomain: string | null;
}

export interface ProviderSummary {
  id: string;
  displayName: string;
  enabled: boolean;
  order: number;
}

export interface AnalyticsPreferences {
  sectionOrder: string[];
  hiddenSections: string[];
  chartStyle: "precision" | "minimal" | "detailed";
  quotaTemplate: "precision" | "compact" | "dual" | "rail";
  defaultRange: Exclude<DashboardRangeKind, "custom">;
  providerFilterScope: "history" | "all";
}

export interface WorkspacePreferences {
  density: "comfortable" | "compact" | "dense";
  navigation: "side" | "top" | "bottom";
  sidebarWidth?: number;
  providerSidebarWidth?: number;
  sidebarCollapsed?: boolean;
  background?: "none" | "cosmic" | "aurora" | "starfield" | `atmosphere-${string}` | `motion-${string}` | `custom:${string}`;
  backgroundMotion?: "static" | "interactive";
  backgroundIntensity?: "subtle" | "balanced" | "vivid";
}

export interface SettingsSnapshot {
  /** Effective native scheduler cadence, including adaptive/low-power policy.
   * Null means manual; absent means old bridge/unavailable evidence. */
  effectiveRefreshIntervalSecs?: number | null;
  enabledProviders: string[];
  providerOrder?: string[];
  refreshIntervalSecs: number;
  adaptiveRefresh: boolean;
  refreshAllProvidersOnMenuOpen: boolean;
  lowPowerMode: boolean;
  lowPowerModePreference?: "off" | "on" | "automatic";
  dashboardMode?: DashboardModeId;
  dashboardPerformancePreset?: DashboardPerformancePreset;
  workspacePreferences?: WorkspacePreferences | null;
  analyticsPreferences?: AnalyticsPreferences | null;
  /** Phase 5.2 Demo Mode -- optional (rather than matching the Rust
   *  snapshot's always-present fields) so the many existing hand-built
   *  `SettingsSnapshot` test fixtures across the codebase don't all need
   *  updating; `demoMode/config.ts`'s `resolveDemoConfig` treats a
   *  missing value the same as the real default (disabled). */
  demoModeEnabled?: boolean;
  demoProviderMode?: DemoProviderMode;
  demoProviderCount?: number;
  demoProviderIds?: string[];
  demoScenario?: DemoScenario;
  demoSeed?: number;
  demoHistoryDays?: number;
  startAtLogin: boolean;
  startMinimized: boolean;
  startupDestination?: "dashboard" | "providerDisplay" | "lastOpened";
  lastSettingsTab?: string;
  showNotifications: boolean;
  notificationEvents?: NotificationEventPreferences;
  notificationQuietHours?: NotificationQuietHours;
  soundEnabled: boolean;
  notificationSoundTheme: NotificationSoundTheme;
  notificationSoundPaths: NotificationSoundPaths;
  highUsageThreshold: number;
  criticalUsageThreshold: number;
  usageStepNotificationPercent?: number;
  providerUsageThresholds?: Record<string, UsageThresholdOverride>;
  predictivePaceWarningEnabled: boolean;
  showPace?: boolean;
  trayIconMode: TrayIconMode;
  providerTrayConfigs?: Record<string,ProviderTrayConfig>;
  providerInstancePresentation?: ProviderInstancePresentation;
  switcherShowsIcons: boolean;
  menuBarShowsHighestUsage: boolean;
  menuBarShowsPercent: boolean;
  showAsUsed: boolean;
  showAllTokenAccountsInMenu: boolean;
  enableAnimations: boolean;
  resetTimeRelative: boolean;
  showResetWhenExhausted: boolean;
  menuBarDisplayMode: MenuBarDisplayMode;
  hidePersonalInfo: boolean;
  privacyMode?: boolean;
  catalogTheme?: string;
  activeProfileCatalogTheme?: string | null;
  /** Runtime profile override; theme remains the saved global preference. */
  activeProfileTheme?: ThemePreference | null;
  surfaceCatalogThemes?: Partial<Record<"taskbar" | "top" | "edge" | "hud" | "quick" | "dashboard", string>>;
  usageDisplayMode?: string | null;
  providerUsageOverrides?: Record<string, string>;
  providerDetailWindows?: Record<string, string>;
  providerLimitOrder?: Record<string, string[]>;
  providerLimitPresentation?: Record<string, import('../design-system/limitPresentation').LimitPresentation>;
  globalLimitPresentation?: import('../design-system/limitPresentation').LimitPresentation;
  resetPresentation?: import('../lib/resetPresentationSettings').ResetPresentationSettingsDto;
  resetPresentationOverrides?: Record<string, import('../lib/resetPresentationSettings').ResetPresentationSettingsDto>;
  updateChannel: UpdateChannel;
  autoDownloadUpdates: boolean;
  installUpdatesOnQuit: boolean;
  globalShortcut: string;
  /** Extra Codex home or sessions directories scanned for local cost estimates. */
  codexCustomSessionsDirs: string[];
  agentSessionsEnabled?: boolean;
  agentSessionSshHosts?: string[];
  /** Master switch for external hooks (hooks.json next to settings). */
  hooksEnabled?: boolean;
  /** Route provider HTTPS through a user HTTP(S) proxy (#235). */
  httpProxyEnabled?: boolean;
  httpProxyUrl?: string;
  httpProxyUsername?: string;
  httpProxyPassword?: string;
  uiLanguage: Language;
  theme: ThemePreference;
  logoVariant?: import('../design-system/logoAppearance').LogoVariant;
  logoScalePercent?: number;
  /** 100..=250 — clamped server-side. */
  windowScalePercent: number;
  /** 100..=200 — clamped server-side. */
  trayScalePercent: number;
  powertoysStatusPipeEnabled: boolean;
  claudeAvoidKeychainPrompts: boolean;
  codexSparkUsageVisible: boolean;
  disableKeychainAccess: boolean;
  wayfinderGatewayUrl?: string;
  providerMetrics: Record<string, MetricPreference>;
  floatBarEnabled: boolean;
  /** 30..=100 — clamped server-side. */
  floatBarOpacity: number;
  /** 75..=200 — clamped server-side. */
  floatBarScale: number;
  floatBarOrientation: FloatBarOrientation;
  floatBarStyle: FloatBarStyle;
  floatBarClickThrough: boolean;
  /** Empty array = show all enabled providers. */
  floatBarProviderIds: string[];
  /** When true, render with dark text/glass for light desktops. */
  floatBarDarkText: boolean;
  /** When true, render the selected metric's next reset inline in each provider pill. */
  floatBarShowResetInline: boolean;
  /** When true, scan and render local cost summaries. */
  floatBarShowCost: boolean;
  /** Promote the tray icon out of the Windows hidden-icons overflow (Win11 only). */
  promoteTrayIcon?: boolean;
  /** When true, show Claude Daily Routines quota row (default true). */
  claudeDailyRoutinesUsageVisible: boolean;
  /**
   * Explicit consent to read (and refresh) Claude Code's own OAuth
   * credentials for the Claude provider. Default false — without consent
   * OAuth stays closed and Auto falls back to labeled reduced-fidelity CLI
   * usage (upstream #2634/#2745).
   */
  claudeAllowReadingClaudeCodeCredentials: boolean;
  /** Alibaba Token Plan region: cn | intl | cn-personal | intl-personal. */
  alibabaTokenPlanRegion: string;
  /** Optional work-week length [2,6] for session-equivalent weekly forecast. */
  weeklyProgressWorkDays?: number | null;
  /** How cost is rendered on provider cards (#2976). */
  costSummaryDisplayStyle: CostSummaryDisplayStyle;
  /** Opt-in read-only OpenCodex usage.jsonl import. */
  openCodexUsageLogsEnabled?: boolean;
  hideNativeCodexCostWhenOpenCodexPresent?: boolean;
  /** Per-provider accent color overrides (CLI name → hex color, #2972). */
  providerAccentColors: Record<string, string>;
}

/** Partial settings object — only include fields you want to change. */
export interface SettingsUpdate {
  enabledProviders?: string[];
  refreshIntervalSecs?: number;
  adaptiveRefresh?: boolean;
  refreshAllProvidersOnMenuOpen?: boolean;
  lowPowerMode?: boolean;
  lowPowerModePreference?: "off" | "on" | "automatic";
  dashboardMode?: DashboardModeId;
  dashboardPerformancePreset?: DashboardPerformancePreset;
  workspacePreferences?: WorkspacePreferences | null;
  analyticsPreferences?: AnalyticsPreferences | null;
  demoModeEnabled?: boolean;
  demoProviderMode?: DemoProviderMode;
  demoProviderCount?: number;
  demoProviderIds?: string[];
  demoScenario?: DemoScenario;
  demoSeed?: number;
  demoHistoryDays?: number;
  startAtLogin?: boolean;
  startMinimized?: boolean;
  startupDestination?: "dashboard" | "providerDisplay" | "lastOpened";
  lastSettingsTab?: string;
  showNotifications?: boolean;
  notificationEvents?: NotificationEventPreferences;
  notificationQuietHours?: NotificationQuietHours;
  soundEnabled?: boolean;
  notificationSoundTheme?: NotificationSoundTheme;
  notificationSoundPaths?: NotificationSoundPaths;
  highUsageThreshold?: number;
  criticalUsageThreshold?: number;
  usageStepNotificationPercent?: number;
  providerUsageThresholds?: Record<string, UsageThresholdOverride>;
  predictivePaceWarningEnabled?: boolean;
  showPace?: boolean;
  trayIconMode?: TrayIconMode;
  providerTrayConfigs?: Record<string,ProviderTrayConfig>;
  providerInstancePresentation?: ProviderInstancePresentation;
  switcherShowsIcons?: boolean;
  menuBarShowsHighestUsage?: boolean;
  menuBarShowsPercent?: boolean;
  showAsUsed?: boolean;
  showAllTokenAccountsInMenu?: boolean;
  enableAnimations?: boolean;
  resetTimeRelative?: boolean;
  showResetWhenExhausted?: boolean;
  menuBarDisplayMode?: MenuBarDisplayMode;
  hidePersonalInfo?: boolean;
  updateChannel?: UpdateChannel;
  autoDownloadUpdates?: boolean;
  installUpdatesOnQuit?: boolean;
  globalShortcut?: string;
  codexCustomSessionsDirs?: string[];
  agentSessionsEnabled?: boolean;
  agentSessionSshHosts?: string[];
  hooksEnabled?: boolean;
  httpProxyEnabled?: boolean;
  httpProxyUrl?: string;
  httpProxyUsername?: string;
  httpProxyPassword?: string;
  uiLanguage?: Language;
  theme?: ThemePreference;
  logoVariant?: import('../design-system/logoAppearance').LogoVariant;
  logoScalePercent?: number;
  windowScalePercent?: number;
  trayScalePercent?: number;
  powertoysStatusPipeEnabled?: boolean;
  claudeAvoidKeychainPrompts?: boolean;
  claudeAllowReadingClaudeCodeCredentials?: boolean;
  codexSparkUsageVisible?: boolean;
  disableKeychainAccess?: boolean;
  /** Map of provider CLI name → metric preference label. */
  providerMetrics?: Record<string, MetricPreference>;
  floatBarEnabled?: boolean;
  floatBarOpacity?: number;
  floatBarScale?: number;
  floatBarOrientation?: FloatBarOrientation;
  floatBarStyle?: FloatBarStyle;
  floatBarClickThrough?: boolean;
  floatBarProviderIds?: string[];
  floatBarDarkText?: boolean;
  floatBarShowResetInline?: boolean;
  floatBarShowCost?: boolean;
  promoteTrayIcon?: boolean;
  claudeDailyRoutinesUsageVisible?: boolean;
  alibabaTokenPlanRegion?: string;
  weeklyProgressWorkDays?: number | null;
  costSummaryDisplayStyle?: CostSummaryDisplayStyle;
  openCodexUsageLogsEnabled?: boolean;
  hideNativeCodexCostWhenOpenCodexPresent?: boolean;
  providerAccentColors?: Record<string, string | null>;
}

export interface UsageThresholdOverride {
  high?: number;
  critical?: number;
}

/** One provider row for Settings → Usage & Spend. */
export interface UsageSpendDailyPoint {
  day: string;
  amount: number;
}

export interface UsageSpendRow {
  providerId: string;
  displayName: string;
  sevenDay: number | null;
  thirtyDay: number | null;
  sevenDayTokens?: number | null;
  thirtyDayTokens?: number | null;
  currency: string;
  source: string;
  includedInOverview?: boolean;
  daily?: UsageSpendDailyPoint[];
  /** F8: true when served from stale cache while a re-scan is in progress. */
  refreshing?: boolean;
  /** ISO 8601 timestamp of the stale snapshot when refreshing. */
  staleUpdatedAt?: string;
}

export interface UsageSpendSummary {
  rows: UsageSpendRow[];
  contract: SpendContract;
}

export type CostProvenance = "listPriceEstimate" | "vendorMetered" | "mixed" | "unknown";

export interface CostCoverageCounts {
  priced: number;
  unpriced: number;
  unmetered: number;
  estimated: number;
}

export interface SpendTokenMix {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  reasoningTokens: number | null;
}

export interface SpendModelRow {
  model: string;
  costUsd: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  customPricing: boolean;
}

export interface SpendDailyPoint {
  day: string;
  costUsd: number | null;
  totalTokens: number | null;
}

export interface SpendActivityCell {
  weekday: number;
  hour: number;
  conversations: number;
}

export interface ImportedSpendSource {
  sourceId: string;
  displayName: string;
  requestCount: number;
  conversationCount: number;
  tokenMix: SpendTokenMix;
  coverage: CostCoverageCounts;
  models: SpendModelRow[];
  hourlyActivity: SpendActivityCell[];
}

/** Codex local Workspaces snapshot (get_codex_workspaces_snapshot). */
export type CodexWorkspacesSourceStatus =
  | "complete"
  | "catalogMissing"
  | "catalogLocked"
  | "catalogCorrupt"
  | "catalogIncompatible";

export interface CodexWorkspacesUsageTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Phase 4C: `knownUsd` is computed from local Codex JSONL session logs,
 *  which carry no evidence distinguishing a subscription-covered session
 *  from a per-token-metered API session -- `eligible` says whether
 *  `knownUsd` may be shown as a trustworthy dollar figure. Always `false`
 *  today; check it (or treat `!eligible` as "Unavailable") before
 *  rendering `knownUsd`. */
export interface CodexWorkspacesCostEstimate {
  knownUsd: number;
  unknownTokens: number;
  eligible: boolean;
}

export interface CodexWorkspacesDailyPoint {
  day: string;
  totalTokens: number;
  cachedInputTokens: number;
  estimatedCostUsd: number | null;
}

export interface CodexWorkspacesSessionUsage {
  id: string;
  projectId: string;
  displayTitle: string;
  cwd: string | null;
  startedAt: string | null;
  latestActivity: string | null;
  totals: CodexWorkspacesUsageTotals;
  costEstimate: CodexWorkspacesCostEstimate;
  topModel: string | null;
}

export interface CodexWorkspacesProjectUsage {
  id: string;
  displayName: string;
  path: string | null;
  totals: CodexWorkspacesUsageTotals;
  costEstimate: CodexWorkspacesCostEstimate;
  sessionCount: number;
  latestActivity: string | null;
  topModel: string | null;
  topSessions: CodexWorkspacesSessionUsage[];
}

/** Global per-model token aggregate (rust/src/codex_workspaces::ModelUsage).
 *  Codex-only -- Claude's local scanner has no per-message model
 *  attribution beyond a single `topModel` guess (field matrix). Ranked
 *  descending by `totalTokens` server-side; do not re-sort/re-derive here. */
export interface CodexWorkspacesModelUsage {
  model: string;
  totalTokens: number;
  lastObserved: string | null;
}

export interface CodexLocalProjectUsageSnapshot {
  updatedAt: string;
  historyDays: number;
  scopeSignature: string;
  indexedFileCount: number;
  skippedFileCount: number;
  total: CodexWorkspacesUsageTotals;
  /** All indexed conversations in the selected history window. */
  sessions: CodexWorkspacesSessionUsage[];
  projects: CodexWorkspacesProjectUsage[];
  daily: CodexWorkspacesDailyPoint[];
  sourceStatus: CodexWorkspacesSourceStatus;
  /** Empty on snapshots cached before this field existed. */
  modelTotals: CodexWorkspacesModelUsage[];
}


export interface SpendContract {
  providerId: string;
  historyDays: number;
  knownCostUsd: number | null;
  knownZero: boolean;
  provenance: CostProvenance;
  priceCoverage: CostCoverageCounts;
  priceCoverageRatio: number | null;
  historyCoverageEstablished: boolean;
  tokenMix: SpendTokenMix;
  conversationCount: number;
  models: SpendModelRow[];
  projects: CodexWorkspacesProjectUsage[];
  conversations: CodexWorkspacesSessionUsage[];
  daily: SpendDailyPoint[];
  hourlyActivity: SpendActivityCell[];
  projectSourceStatus: CodexWorkspacesSourceStatus | null;
  customPricingActive: boolean;
  imports: ImportedSpendSource[];
}


export interface BootstrapState {
  contractVersion: string;
  providers: ProviderCatalogEntry[];
  settings: SettingsSnapshot;
}

// ── Provider usage snapshot types ────────────────────────────────────

export interface RateWindowSnapshot {
  usedPercent: number;
  remainingPercent: number;
  windowMinutes: number | null;
  resetsAt: string | null;
  resetDescription: string | null;
  isExhausted: boolean;
  isInformational?: boolean;
  reservePercent: number | null;
  reserveDescription: string | null;
  reserveWillLastToReset?: boolean;
  reserveEtaSeconds?: number | null;
}

export interface CostDailyPoint {
  day: string;
  amount: number;
}

export interface CostSnapshotBridge {
  used: number;
  limit: number | null;
  remaining: number | null;
  currencyCode: string;
  /** Optional currency symbol (e.g. "€", "$", "¥") for localized rendering. */
  currencySymbol?: string | null;
  period: string;
  resetsAt: string | null;
  formattedUsed: string;
  formattedLimit: string | null;
  balance?: number | null;
  formattedBalance?: string | null;
  daily?: CostDailyPoint[];
}

export interface PaceSnapshot {
  stage: "on_track" | "slightly_ahead" | "ahead" | "far_ahead" | "slightly_behind" | "behind" | "far_behind";
  deltaPercent: number;
  willLastToReset: boolean;
  etaSeconds: number | null;
  expectedUsedPercent: number;
  actualUsedPercent: number;
}

export interface SessionEquivalentForecastSnapshot {
  estimatedWindowsToExhaustWeekly: number;
  windowsUntilReset: number;
  availableWindowsUntilReset: number;
  sampleCount: number;
  weeklyResetsAt: string;
  weeklyUsedPercent: number;
}

/** Backend-classified provider availability state (camelCase serde on the bridge). */
export type ProviderStateKind =
  | "ready"
  | "needsAuthentication"
  | "expiredSession"
  | "localRuntimeOffline"
  | "unknown";

export type ProviderBadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center" | "middle-left" | "middle-right";
export interface ProviderInstancePresentation {
  order: string[];
  badgePosition: ProviderBadgePosition | "start" | "end";
  showAccountNumbers: boolean;
  resetPosition?: ProviderBadgePosition | "start" | "end";
  showResetBadge?: boolean;
  visibleCount?: 3 | 4;
  anchorId?: string | null;
}

export interface ProviderInstanceSnapshot {
  resetFacts?: ProviderResetFacts | null;
  instanceId: string;
  providerId: string;
  accountId: string | null;
  accountOrdinal: number | null;
  accountLabel: string | null;
  snapshot: ProviderUsageSnapshot | null;
}

export interface ProviderUsageSnapshot {
  resetFacts?: ProviderResetFacts | null;
  providerId: string;
  displayName: string;
  primary: RateWindowSnapshot;
  /** Settings-selected metric shared by native and webview presentation surfaces. */
  selectedMetric: RateWindowSnapshot;
  primaryLabel?: string;
  secondary: RateWindowSnapshot | null;
  secondaryLabel?: string;
  modelSpecific: RateWindowSnapshot | null;
  tertiary: RateWindowSnapshot | null;
  /** F5: duration-cadence label for tertiary ("monthly", "weekly" etc.) */
  tertiaryLabel?: string;
  extraRateWindows: Array<{
    id: string;
    title: string;
    window: RateWindowSnapshot;
  }>;
  cost: CostSnapshotBridge | null;
  planName: string | null;
  accountEmail: string | null;
  sourceLabel: string;
  updatedAt: string;
  error: string | null;
  errorState: ProviderStateKind;
  pace: PaceSnapshot | null;
  accountOrganization: string | null;
  trayStatusLabel: string | null;
  fetchDurationMs?: number | null;
  wayfinderUsage?: WayfinderUsageSnapshot | null;
  sessionEquivalentForecast?: SessionEquivalentForecastSnapshot | null;
}

export interface WayfinderRouteSummary {
  name: string;
  requests: number;
  tokens: number;
  realized: number;
  baseline: number;
  saved: number;
}

export interface WayfinderUsageSnapshot {
  gatewayStatus: string;
  offline: boolean;
  dryRun: boolean;
  missingKeys: string[];
  modelCount: number;
  models: string[];
  requests: number;
  estimatedRequests: number;
  tokens: number;
  realized: number;
  baseline: number;
  saved: number;
  savedPercent: number;
  periodDays: number;
  unit: string;
  priced: boolean;
  routes: WayfinderRouteSummary[];
}

export interface RefreshCompletePayload {
  providerCount: number;
  errorCount: number;
}

export interface RefreshStartedPayload {
  providerIds: string[];
}

export interface CredentialStorageStatus {
  manualCookies: string;
  apiKeys: string;
  tokenAccounts: string;
}

// ── Update state types ───────────────────────────────────────────────

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateStatePayload {
  status: UpdateStatus;
  version: string | null;
  error: string | null;
  progress: number | null;
  releaseUrl: string | null;
  canDownload: boolean;
  canApply: boolean;
  /** Unix-ms timestamp of the last completed update check, or `null`
   *  if the app has not checked during this session. */
  lastCheckedAt: number | null;
}

// ── Credential store types ───────────────────────────────────────────

export interface ApiKeyInfoBridge {
  providerId: string;
  provider: string;
  maskedKey: string;
  savedAt: string;
  label: string | null;
}

export interface ApiKeyProviderInfoBridge {
  id: string;
  displayName: string;
  envVar: string | null;
  help: string | null;
  dashboardUrl: string | null;
}

export interface CookieInfoBridge {
  providerId: string;
  provider: string;
  savedAt: string;
}

export interface DetectedBrowserBridge {
  browserType: string;
  displayName: string;
  profileCount: number;
}

export interface AppInfoBridge {
  name: string;
  version: string;
  buildNumber: string;
  updateChannel: string;
  tagline: string;
}

// ── Chart data types ─────────────────────────────────────────────────

export interface DailyCostPoint {
  date: string;
  value: number;
}

/** Exact local token totals per day (upstream 0.50.0 #2930). */
export interface DailyTokenPoint {
  date: string;
  tokens: number;
}

export interface ServiceUsagePoint {
  service: string;
  creditsUsed: number;
}

export interface DailyUsageBreakdown {
  day: string;
  services: ServiceUsagePoint[];
  totalCreditsUsed: number;
}

/** Mirrors rust/src/analytics_sources.rs::AnalyticsSourceId exactly --
 *  do not add a source here that has no corresponding Rust variant. */
export type AnalyticsSourceId =
  | "providerCurrentState"
  | "providerHistory"
  | "providerReportedMonetary"
  | "codexLocalActivity"
  | "claudeLocalActivity";

/** Mirrors AnalyticsScope. Local CLI-log scanning is always "device" --
 *  never "account", even when only one account is configured. */
export type AnalyticsScope = "account" | "provider" | "device";

/** Mirrors AnalyticsAvailability. */
export type AnalyticsAvailability = "available" | "noDataYet" | "unsupported";

/** Mirrors AnalyticsCapabilities -- every flag is a real, cited capability,
 *  never inferred client-side from a provider id string. */
export interface AnalyticsCapabilities {
  quota: boolean;
  resets: boolean;
  monetary: boolean;
  tokens: boolean;
  models: boolean;
  sessionCount: boolean;
  dailyActivity: boolean;
}

/** Mirrors AnalyticsSourceDescriptor -- the authoritative capability map
 *  returned by `get_analytics_source_registry`. The frontend must consult
 *  this rather than re-deriving capability rules from a provider id. */
export interface AnalyticsSourceDescriptor {
  id: AnalyticsSourceId;
  label: string;
  scope: AnalyticsScope;
  capabilities: AnalyticsCapabilities;
  availability: AnalyticsAvailability;
  reads: AnalyticsSourceFact[];
  doesNotRead: AnalyticsSourceFact[];
}

/** One atomic, real fact about what a source reads/does not read
 *  (`quotalis_core::analytics_sources::AnalyticsSourceFact`). Backend-
 *  authoritative -- the frontend maps each identifier to one localized
 *  phrase (`AnalyticsSourcesTab.tsx`'s `SOURCE_FACT_KEY`); it never
 *  re-derives which facts apply to which source. */
export type AnalyticsSourceFact =
  | "providerLiveQuotaPlanStatus"
  | "persistedQuotaResetSamples"
  | "providerReportedMonetaryFigures"
  | "timestamps"
  | "tokenCounts"
  | "modelIdentifiers"
  | "promptOrResponseContent"
  | "localCliLogs"
  | "locallyEstimatedCost"
  | "perSessionRecord"
  | "dollarCost"
  | "sessionIdentity";

export interface ProviderLocalUsageSummary {
  todayCost: number | null;
  thirtyDayCost: number | null;
  thirtyDayTokens: number | null;
  latestTokens: number | null;
  topModel: string | null;
  estimateNote: string;
  tokenCostUpdatedAtMs: number;
}

export interface ProviderChartData {
  providerId: string;
  costHistory: DailyCostPoint[];
  creditsHistory: DailyCostPoint[];
  usageBreakdown: DailyUsageBreakdown[];
  localUsage: ProviderLocalUsageSummary | null;
  tokensHistory: DailyTokenPoint[];
  tokensIncomplete: boolean;
}

// ── Token account types ──────────────────────────────────────────────

export interface TokenAccountSupportBridge {
  providerId: string;
  displayName: string;
  title: string;
  subtitle: string;
  placeholder: string;
}

export interface TokenAccountBridge {
  id: string;
  label: string;
  addedAt: string;
  lastUsed: string | null;
  isActive: boolean;
}

export interface ProviderTokenAccountsBridge {
  providerId: string;
  support: TokenAccountSupportBridge;
  accounts: TokenAccountBridge[];
  activeIndex: number;
}

// ── Phase 4 — provider ordering / cookie source / region ─────────────

export interface ProviderSummary {
  id: string;
  displayName: string;
  enabled: boolean;
  order: number;
}

// ── Phase 4 — credential detection ───────────────────────────────────

export interface GeminiCliStatus {
  signedIn: boolean;
  credentialsPath: string | null;
}

export interface VertexAiStatus {
  hasCredentials: boolean;
  credentialsPath: string | null;
}

export interface JetbrainsIde {
  id: string;
  displayName: string;
  path: string;
  detected: boolean;
}

export interface KiroStatus {
  available: boolean;
  hint: string | null;
}

// ── Phase 4 — session / environment ──────────────────────────────────

export interface WorkAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Phase 5 — i18n ────────────────────────────────────────────────────

/** Snapshot returned by `get_locale_strings`. */
export interface LocaleStrings {
  language: Language;
  entries: Record<string, string>;
}

/** Payload emitted for `locale-changed`: the persisted language label. */
export type LocaleChangedPayload = Language;

// ── Phase 6b — provider detail pane ──────────────────────────────────

/** Aggregated per-provider payload powering the Settings detail pane. */
export type ProviderAuthCapability = "noAuthRequired" | "credentialInput" | "deviceFlow" | "supervisedCli" | "externalDashboard" | "detectionOnly" | "unsupported";

export interface ProviderDetail {
  resetFacts?: ProviderResetFacts | null;
  authCapability?: ProviderAuthCapability;
  id: string;
  displayName: string;
  enabled: boolean;

  // Identity
  email: string | null;
  plan: string | null;
  authType: string | null;
  sourceLabel: string | null;
  organization: string | null;
  lastUpdated: string | null;

  // Usage windows — mirror RateWindowSnapshot.
  session: RateWindowSnapshot | null;
  sessionLabel?: string | null;
  weeklyLabel?: string | null;
  weekly: RateWindowSnapshot | null;
  modelSpecific: RateWindowSnapshot | null;
  tertiary: RateWindowSnapshot | null;
  extraRateWindows: Array<{
    id: string;
    title: string;
    window: RateWindowSnapshot;
  }>;

  cost: CostSnapshotBridge | null;
  pace: PaceSnapshot | null;

  lastError: string | null;
  errorState: ProviderStateKind | null;

  dashboardUrl: string | null;
  statusPageUrl: string | null;
  buyCreditsUrl: string | null;
  /** The desktop shell can start a browser, device, or supported CLI sign-in flow. */
  canConnect?: boolean;

  hasSnapshot: boolean;

  /** Persisted provider usage source (auto | cli | oauth | web). */
  usageSource?: string | null;
  /** Phase 6c — currently-persisted cookie source value ("auto" | "manual" | "off" | …).
   *  `null` for providers that do not expose a cookie-source picker. */
  cookieSource: string | null;
  /** Phase 6c — currently-persisted region value. `null` for non-regional providers. */
  region: string | null;
}

// ── Phase 6c — cookie-source & region pickers ────────────────────────

export interface CookieSourceOption {
  value: string;
  label: string;
  description?: string;
}

export interface RegionOption {
  value: string;
  label: string;
}

// ── Codex multi-account (ADR 0003) ───────────────────────────────────

export type CodexAccountSource = "ambient" | "managedByApp";

export interface CodexAccount {
  id: string;
  nickname: string | null;
  emailHint: string | null;
  authSubject: string | null;
  providerAccountId: string | null;
  codexHomePath: string;
  source: CodexAccountSource;
  createdAt: string;
  updatedAt: string;
  lastAuthenticatedAt: string | null;
}

export interface CodexUsageWindow {
  usedPercent: number;
  resetAt: string | null;
  limitWindowSeconds: number;
}

export interface CodexCreditsBalance {
  hasCredits: boolean;
  unlimited: boolean;
  balance: number | null;
}

export interface CodexAccountUsageSnapshot {
  resetFacts?: ProviderResetFacts | null;
  email: string | null;
  providerAccountId: string | null;
  plan: string | null;
  allowed: boolean | null;
  limitReached: boolean | null;
  primaryWindow: CodexUsageWindow | null;
  secondaryWindow: CodexUsageWindow | null;
  credits: CodexCreditsBalance | null;
  updatedAt: string;
}

export interface CodexSwitchResult {
  materializedAccount: CodexAccount | null;
  backupPath: string | null;
  ambientAccount: CodexAccount | null;
  desktopSessionBackupPath: string | null;
  desktopSessionRestorePath: string | null;
  desktopSessionRestoreExists: boolean;
}

export interface CodexAccountsStateBridge {
  accounts: CodexAccount[];
  snapshots: Record<string, CodexAccountUsageSnapshot>;
}

// ── Dashboard data (Phase 1: docs/validation/DASHBOARD_DATA_ARCHITECTURE.md) ──

/** What real data actually exists for a query. The last three are always
 *  `false` today -- the local history schema has no columns for token
 *  counts, request counts, or model attribution. */
export interface DataAvailability {
  firstSampleAt: number | null;
  lastSampleAt: number | null;
  sampleCount: number;
  hasCostData: boolean;
  hasTokenData: boolean;
  hasRequestData: boolean;
  hasModelData: boolean;
}

/** Named distinctly from the pre-existing `ProviderSummary` (provider
 *  ordering/enablement DTO, unrelated) to avoid TS interface-merging
 *  colliding two structurally different shapes under the same name. */
export interface DashboardProviderSummary {
  provider: string;
  accountId: string;
  usedPercent: number;
  remainingPercent: number;
  /** Authoritative reset instant (ISO-8601) -- the Reset Presentation
   *  system owns display formatting, not this contract. */
  resetsAt: string | null;
  lastSampleAt: number;
}

export interface UsageTrendPoint {
  provider: string;
  accountId: string;
  bucketStart: number;
  usedPercent: number;
  remainingPercent: number;
  sampleCount: number;
}

/** Phase 4A: what kind of number `costUsed` actually is -- never infer
 *  this from the field name. "cumulative" = a running total for the
 *  provider's current billing period (must not be summed across time
 *  buckets of the same series); "pointInTime" = a prepaid balance (can
 *  legitimately decrease as money is spent); "delta" = a genuine
 *  per-bucket incremental amount (safe to sum -- not produced by any
 *  provider today); "unknown" = semantics could not be established
 *  (legacy row, or a provider with proven ambiguous/dual-path
 *  semantics like Codex) -- must not be aggregated into a trusted total.
 *  See `docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md`. */
export type CostMeasurementKind = "cumulative" | "delta" | "pointInTime" | "unknown";

/** Phase 4A.1: the orthogonal dimension to `CostMeasurementKind` -- WHAT
 *  a monetary reading represents, not its temporal shape. Proven false
 *  by a real provider-adapter audit that `CostMeasurementKind` alone was
 *  sufficient: several providers write a prepaid balance into the same
 *  field a spend total uses elsewhere, and a balance/spend confusion is
 *  a distinct mistake from summing cumulative snapshots.
 *  - "spend": money actually consumed against a billing period/credit
 *    allotment -- the ONLY kind the Dashboard Spend KPI may ever show.
 *  - "balance": a prepaid balance (cash-denominated) -- remaining funds,
 *    never spend. Can legitimately decrease as money is spent.
 *  - "credits": a provider-defined, non-cash-equivalent unit (e.g. a
 *    ChatGPT account credit balance) -- no proven USD/EUR conversion.
 *  - "unknown": could not be established (legacy row, unclassified
 *    provider/path) -- excluded from every KPI.
 *  See `docs/validation/PHASE4_DATA_ACCURACY_AUDIT.md` "Phase 4A.1". */
export type MonetaryQuantityKind = "spend" | "balance" | "credits" | "unknown";

export interface SpendTrendPoint {
  provider: string;
  accountId: string;
  bucketStart: number;
  /** A reading in whatever `quantityKind`/`measurementKind` say it is --
   *  always provider-reported (see `DashboardSnapshot.costContract.origin`),
   *  never a Quotalis-computed figure. Despite the field's historical
   *  name, this is NOT always "spend" -- check `quantityKind` before
   *  showing it under a Spend label. */
  costUsed: number;
  /** ISO 4217 currency code, `null` for a legacy (pre-Phase-4A) sample --
   *  never assume USD. */
  currencyCode: string | null;
  measurementKind: CostMeasurementKind;
  quantityKind: MonetaryQuantityKind;
}

/** Where a monetary figure came from. Quotalis today only ever produces
 *  "providerReported" (real) or "unavailable" (no usable figure) --
 *  "locallyEstimated"/"userConfigured" exist in the contract but nothing
 *  constructs them yet (the history schema lacks the token/model billing
 *  inputs a trustworthy local estimate would require). */
export type CostOrigin = "providerReported" | "locallyEstimated" | "userConfigured" | "unavailable";

/** Whether a trustworthy monetary total exists, distinct from
 *  `DataAvailability.hasCostData` (which only says *some* cost row
 *  exists, not whether it can be safely aggregated). "legacyAmbiguous" =
 *  real numeric rows exist but predate the currency/measurement-kind
 *  columns, so their semantics cannot be proven. */
export type CostAvailability = "available" | "legacyAmbiguous" | "unavailable";

/** Whether Quotalis's own pricing catalog needs to be (or has been)
 *  verified for the shown figure. "notRequired" is what every
 *  provider-reported figure carries -- pricing-catalog verification does
 *  not apply to a number Quotalis didn't compute. */
export type PricingStatus = "notRequired" | "unverified" | "verified";

/** Phase 4A: the formal, structured description of what `spendTrend`
 *  (and any KPI/total derived from it) actually means. Nothing may infer
 *  monetary semantics from a naked number any more -- read this instead. */
export interface CostContract {
  origin: CostOrigin;
  /** Never "unknown" if it can be helped -- collapses to "unknown" the
   *  moment more than one quantity kind (or an unclassified provider)
   *  appears in the relevant sample set. A balance and a spend total are
   *  never combined into one figure. */
  quantityKind: MonetaryQuantityKind;
  measurementKind: CostMeasurementKind;
  /** Only set when every relevant sample shares one unambiguous currency
   *  -- `null` when currencies differ or are unknown; never guessed. */
  currencyCode: string | null;
  /** Human-readable period/scope ("Monthly", a provider-defined string,
   *  or "unknown" when the aggregated set mixes periods). */
  period: string;
  availability: CostAvailability;
  pricingStatus: PricingStatus;
}

export type DashboardRangeKind =
  | "today"
  | "last7Days"
  | "last30Days"
  | "thisMonth"
  | "last3Months"
  | "thisYear"
  | "custom";

/** The one normalized data contract every Dashboard widget consumes. */
export interface QuotaHistoryPoint {
  provider: string;
  accountId: string;
  /** Observed provider account identity, never a guessed profile membership. */
  accountScope: "observed" | "unresolved" | "legacy";
  windowKey: string;
  windowLabel: string | null;
  windowMinutes: number | null;
  bucketStart: number;
  observedAt: number;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: number | null;
  sampleCount: number;
  /** Raw observation integrity retained through bucket aggregation. */
  hasConflictingSamples?: boolean;
  counterDecreased?: boolean;
}

export interface DashboardSnapshot {
  generatedAt: number;
  rangeSince: number;
  rangeUntil: number;
  grain: "hourly" | "daily";
  timezone: string;
  availability: DataAvailability;
  providers: DashboardProviderSummary[];
  usageTrend: UsageTrendPoint[];
  spendTrend: SpendTrendPoint[];
  costContract: CostContract;
  /** Physical-window observations over requested and preceding comparable span.
   * Older clients/fixtures omit this; absence never upgrades legacy selected data. */
  quotaHistory?: QuotaHistoryPoint[];
}

export type ResetDatum<T> = {state:'known';value:T}|{state:'unavailable';reason:'notReported'|'fetchFailed'|'malformed'|'notObserved'|'ambiguousAccount'|'conflictingEvidence'}|{state:'unsupported'};
export interface BankedResetCard { opaqueId:string|null;status:'available'|'used'|'expired'|'unknown';expiresAt:ResetDatum<string>; }
export interface ProviderResetFacts {
 observedAt:string;
 providerIssuedResets:ResetDatum<number>;
 lastActualReset:ResetDatum<{windowKey:string;observedAt:string;classification:'scheduled'|'unexpected';evidence:'providerReported'|'boundaryAdvanced'}>;
 nextWeeklyReset:ResetDatum<{windowKey:string;resetsAt:string}>;
 bankedResetCards:ResetDatum<{reportedAvailableCount:number;cards:BankedResetCard[];detailsComplete:boolean}>;
}
