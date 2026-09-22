import { invoke } from "@tauri-apps/api/core";
import type { LocaleKey } from "../i18n/keys";

/** Mirror of `quotalis_core::connection_capabilities` as serialized by `capability_matrix_json`. */
export type ConnectionMethod = "apiKey" | "browserSession" | "cliSession" | "deviceFlow" | "localScanner" | "localGateway";
export type MethodRank = "recommended" | "alternative";
export interface MethodOffer { method: ConnectionMethod; rank: MethodRank; envVar: string | null; browserDomain: string | null; helpUrl: string | null }
export type InstallPolicy = { kind: "winget"; id: string } | { kind: "npm"; package: string } | { kind: "manualOnly" };
export interface CliDependencySummary { managedLogin?: boolean; tool: string; executables: string[]; install: InstallPolicy; installRequiresAdmin: boolean; docsUrl: string; sessionDetection: "authFile" | "statusCommand" | "usageFetch"; minVersion: string | null }
export type VerificationStrategy = "usageFetch" | "localDetection" | "gatewayProbe";
export type SupportStatus = "supported" | "deprecated" | "autoDetected" | "unsupported";
export interface ReportingCapabilities { usage: boolean; resetWindows: boolean; costs: boolean; localTokens: boolean; planWhenProvided: boolean }
export interface ProviderConnectionCapabilities {
  provider: string; displayName: string; status: SupportStatus; methods: MethodOffer[]; cli: CliDependencySummary | null;
  verification: VerificationStrategy; reporting: ReportingCapabilities; dashboardUrl: string | null; statusPageUrl: string | null;
}

export type CliStatus = { kind: "missing" } | { kind: "installed" } | { kind: "tooOld"; installed: string; required: string } | { kind: "versionUnknown" } | { kind: "broken" };
export type CliSessionState = "authenticated" | "notSignedIn" | "unknown";
export interface CliDetection { providerId: string; tool: string; status: CliStatus; path: string | null; version: string | null; session: CliSessionState; installAvailable: boolean; docsUrl: string; signInHint: string }
export interface InstallPlan { program: string; args: string[]; requiresAdmin: boolean; packageManager: string; package: string }
export type InstallOutcome = { kind: "succeeded" } | { kind: "packageManagerMissing" } | { kind: "packageNotFound" } | { kind: "networkError" } | { kind: "permissionDenied" } | { kind: "cancelled" } | { kind: "timedOut" } | { kind: "binaryNotFound" } | { kind: "failed"; summary: string };
export interface CliInstallResult { outcome: InstallOutcome; detection: CliDetection | null }

export type ConnectionState = "idle" | "detecting" | "requirementsMissing" | "readyToAuthenticate" | "authenticating" | "verifying" | "connected" | "refreshing" | "actionRequired" | "rateLimited" | "offline" | "timedOut" | "error" | "disconnecting";
export type ConnectionIssue = "cliMissing" | "cliTooOld" | "cliBroken" | "cliUnauthenticated" | "browserSessionMissing" | "sessionExpired" | "credentialsRejected" | "permissionDenied" | "rateLimited" | "offline" | "timedOut" | "sourceUnreadable" | "unsupported" | "error";
export interface ConnectionVerification { providerId: string; state: ConnectionState; issue: ConnectionIssue | null; method: ConnectionMethod | null; verifiedAt: string | null; plan: string | null; windowCount: number; resetsKnown: boolean; durationMs: number | null }
export interface ProviderConnectionStatus { providerId: string; enabled: boolean; state: ConnectionState; issue: ConnectionIssue | null; method: ConnectionMethod | null; lastVerified: string | null; stale: boolean }
export interface ProviderConnectionQaFixture { providerId: string; scenario: ConnectionQaScenario }
export const CONNECTION_QA_SCENARIOS = ["disconnected", "cliMissing", "cliOld", "cliReady", "cliUnauthenticated", "cookieMissing", "cookieValid", "cookieExpired", "apiKeyInvalid", "apiKeyValid", "oauthPending", "oauthSuccess", "oauthStateMismatch", "offline", "rateLimited", "timeout", "permissionDenied", "connected", "stale"] as const;
export type ConnectionQaScenario = (typeof CONNECTION_QA_SCENARIOS)[number];

export const getProviderConnectionCapabilities = (): Promise<ProviderConnectionCapabilities[]> => invoke("get_provider_connection_capabilities");
export const detectCliDependency = (providerId: string): Promise<CliDetection | null> => invoke("detect_cli_dependency", { providerId });
export const getCliInstallPlan = (providerId: string): Promise<InstallPlan | null> => invoke("get_cli_install_plan", { providerId });
export const installCliDependency = (providerId: string, confirmed: boolean): Promise<CliInstallResult> => invoke("install_cli_dependency", { providerId, confirmed });
export const cancelCliInstall = (providerId: string): Promise<boolean> => invoke("cancel_cli_install", { providerId });
export const verifyProviderConnection = (providerId: string, method?: ConnectionMethod): Promise<ConnectionVerification> => invoke("verify_provider_connection", { providerId, method });
export const saveProviderConnectionKey = (providerId: string, key: string): Promise<void> => invoke("save_provider_connection_key", { providerId, key });
export const disconnectProviderConnection = (providerId: string, method: ConnectionMethod): Promise<void> => invoke("disconnect_provider_connection", { providerId, method });
export const cancelProviderConnectionOperation = (providerId: string): Promise<boolean> => invoke("cancel_provider_connection_operation", { providerId });
export const cancelProviderVerification = (providerId: string): Promise<boolean> => invoke("cancel_provider_verification", { providerId });
export const getProviderConnectionStatus = (): Promise<ProviderConnectionStatus[]> => invoke("get_provider_connection_status");
export const getProviderConnectionQaFixture = (): Promise<ProviderConnectionQaFixture | null> => invoke("get_provider_connection_qa_fixture");
export const setProviderConnectionQaFixture = (fixture: ProviderConnectionQaFixture | null): Promise<void> => invoke("set_provider_connection_qa_fixture", { fixture });

export const METHOD_LABEL: Record<ConnectionMethod, LocaleKey> = { apiKey: "ConnectMethodApiKey", browserSession: "ConnectMethodBrowserSession", cliSession: "ConnectMethodCliSession", deviceFlow: "ConnectMethodDeviceFlow", localScanner: "ConnectMethodLocalScanner", localGateway: "ConnectMethodLocalGateway" };
export const STATE_LABEL: Record<ConnectionState, LocaleKey> = { idle: "ConnectStateIdle", detecting: "ConnectStateVerifying", requirementsMissing: "ConnectStateRequirementsMissing", readyToAuthenticate: "ConnectStateIdle", authenticating: "ConnectStateAuthenticating", verifying: "ConnectStateVerifying", connected: "ConnectStateConnected", refreshing: "ConnectStateVerifying", actionRequired: "ConnectStateActionRequired", rateLimited: "ConnectStateRateLimited", offline: "ConnectStateOffline", timedOut: "ConnectStateTimedOut", error: "ConnectStateError", disconnecting: "ConnectStateIdle" };
export const ISSUE_LABEL: Record<ConnectionIssue, LocaleKey> = { cliMissing: "ConnectIssueCliMissing", cliTooOld: "ConnectIssueCliTooOld", cliBroken: "ConnectIssueCliBroken", cliUnauthenticated: "ConnectIssueCliUnauthenticated", browserSessionMissing: "ConnectIssueBrowserSessionMissing", sessionExpired: "ConnectIssueSessionExpired", credentialsRejected: "ConnectIssueCredentialsRejected", permissionDenied: "ConnectIssuePermissionDenied", rateLimited: "ConnectIssueRateLimited", offline: "ConnectIssueOffline", timedOut: "ConnectIssueTimedOut", sourceUnreadable: "ConnectIssueSourceUnreadable", unsupported: "ConnectIssueUnsupported", error: "ConnectIssueError" };
export const INSTALL_OUTCOME_LABEL: Record<InstallOutcome["kind"], LocaleKey> = { succeeded: "ConnectInstallSucceeded", packageManagerMissing: "ConnectInstallManagerMissing", packageNotFound: "ConnectInstallPackageNotFound", networkError: "ConnectInstallNetwork", permissionDenied: "ConnectInstallPermission", cancelled: "ConnectInstallCancelled", timedOut: "ConnectInstallTimedOut", binaryNotFound: "ConnectInstallBinaryNotFound", failed: "ConnectInstallFailed" };

/** The user-facing line for a status: the issue when there is one, else the state. */
export function connectionStatusKey(state: ConnectionState, issue: ConnectionIssue | null, stale = false): LocaleKey {
  if (state === "connected" && stale) return "ConnectStateStale";
  return issue ? ISSUE_LABEL[issue] : STATE_LABEL[state];
}

export type ConnectStep = "method" | "requirements" | "configure" | "verify" | "success";

/** Steps a method really needs; nothing irrelevant is shown. */
export function stepsFor(method: ConnectionMethod, cli: CliDependencySummary | null): ConnectStep[] {
  switch (method) {
    case "cliSession": return ["requirements", "configure", "verify", "success"];
    case "deviceFlow": return ["configure", "verify", "success"];
    case "apiKey": return ["configure", "verify", "success"];
    case "browserSession": return ["requirements", "configure", "verify", "success"];
    case "localScanner": return ["verify", "success"];
    case "localGateway": return ["verify", "success"];
  }
}

/** Whether the flow can skip method selection. */
export function singleMethod(capabilities: ProviderConnectionCapabilities): ConnectionMethod | null {
  return capabilities.methods.length === 1 ? capabilities.methods[0].method : null;
}

/** Only https links from curated metadata are ever opened. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Requirements are real detections, never assumed green. */
export function cliRequirementSatisfied(detection: CliDetection | null | undefined): boolean {
  return !!detection && (detection.status.kind === "installed" || detection.status.kind === "versionUnknown");
}
