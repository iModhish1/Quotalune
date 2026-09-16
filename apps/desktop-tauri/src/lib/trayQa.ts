import { invoke } from "@tauri-apps/api/core";
import type { ProviderTrayConfig } from "../types/bridge";

/** Raw RGBA from the native tray renderer (`provider_tray::render_provider_tray_preview`). */
export interface TrayPreview {
  width: number;
  height: number;
  rgba: number[];
  tooltip: string;
}

export const renderProviderTrayPreview = (providerId: string, config: ProviderTrayConfig): Promise<TrayPreview> =>
  invoke("render_provider_tray_preview", { providerId, config });

/** Mirror of `tray_qa_fixture::TrayQaFixture`. Dev channel only; in memory only. */
export interface TrayQaFixture {
  providerId: string;
  dataState: "available" | "unavailable" | "error";
  usedPercent: number;
  secondaryUsedPercent: number | null;
  plan: string | null;
  resetMinutes: number | null;
  tokens: number | null;
}

export const getTrayQaFixture = (): Promise<TrayQaFixture | null> => invoke("get_tray_qa_fixture");
export const setTrayQaFixture = (fixture: TrayQaFixture | null): Promise<void> =>
  invoke("set_tray_qa_fixture", { fixture });

export const NOTIFICATION_QA_KINDS = ["info", "warning", "critical", "reset", "providerUnavailable", "authRequired"] as const;
export type NotificationQaKind = (typeof NOTIFICATION_QA_KINDS)[number];
export const sendNotificationQaFixture = (kind: NotificationQaKind, providerId: string): Promise<void> =>
  invoke("send_notification_qa_fixture", { kind, providerId });

/** Mirror of `quotalis_core::token_periods::TokenPeriodCapability`. */
export type TokenPeriod = "today" | "week" | "month" | "year" | "lifetime";
export interface TokenPeriodCapability {
  period: TokenPeriod;
  source: "codexLocalSessions" | "claudeLocalTranscripts";
  bestBound: "exact" | "lowerBound";
}
export const getTrayTokenPeriods = (providerId: string): Promise<TokenPeriodCapability[]> =>
  invoke("get_tray_token_periods", { providerId });
