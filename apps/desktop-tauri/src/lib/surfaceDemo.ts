import { invoke } from "@tauri-apps/api/core";
import type { StageProvider } from "../components/orbit/stageTypes";

/** Visual fixtures only: never enter provider caches, accounts, history or auth. */
export const SURFACE_DEMO_PROVIDERS: StageProvider[] = [
  ["claude", "Claude", 73, "51 min"],
  ["codex", "OpenAI", 21, "2h 14m"],
  ["gemini", "Gemini", 58, "4h 08m"],
  ["cursor", "Cursor", 42, "6h 32m"],
  ["deepseek", "DeepSeek", 36, "1h 45m"],
  ["perplexity", "Perplexity", 64, "3h 20m"],
].map(([id, name, used, reset]) => ({
  id: String(id), name: String(name), iconId: String(id),
  resolvedMode: "used", primaryValue: Number(used), primaryLabel: "used",
  secondaryValue: 100 - Number(used), arcFraction: Number(used) / 100,
  reset: String(reset), status: "ok", accountLabel: "Demo · synthetic data",
}));

export const getSurfaceDemoMode = (): Promise<boolean> => invoke("get_surface_demo_mode");
export const setSurfaceDemoMode = (enabled: boolean): Promise<void> => invoke("set_surface_demo_mode", { enabled });
