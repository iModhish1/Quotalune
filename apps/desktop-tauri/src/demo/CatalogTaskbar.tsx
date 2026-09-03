/**
 * Visual-proof wrapper for the production taskbar stage.
 *
 * Geometry, material, theming and interaction live under components/ so
 * this harness cannot drift from the native surface.
 */
import TaskbarStage, {
  type StageProvider,
} from "../components/taskbar/TaskbarStage";

export type { StageProvider } from "../components/taskbar/TaskbarStage";

export const CATALOG_TASKBAR_FIXTURE: StageProvider[] = [
  { id: "openai", name: "OpenAI", iconId: "openai", resolvedMode: "remaining", arcFraction: 0.74, primaryValue: 74, secondaryValue: 26, primaryLabel: "remaining", reset: "3h 40m", status: "ok" },
  { id: "claude", name: "Claude", iconId: "claude", resolvedMode: "remaining", arcFraction: 0.68, primaryValue: 68, secondaryValue: 32, primaryLabel: "remaining", reset: "26h 18m", status: "ok" },
  { id: "gemini", name: "Gemini", iconId: "gemini", resolvedMode: "remaining", arcFraction: 0.55, primaryValue: 55, secondaryValue: 45, primaryLabel: "remaining", reset: "22h 38m", status: "ok" },
  { id: "llama", name: "Meta", iconId: "llama", resolvedMode: "remaining", arcFraction: 0.6, primaryValue: 60, secondaryValue: 40, primaryLabel: "remaining", reset: "5d 4h", status: "ok" },
  { id: "mistral", name: "Mistral", iconId: "mistral", resolvedMode: "remaining", arcFraction: 0.45, primaryValue: 45, secondaryValue: 55, primaryLabel: "remaining", reset: "1d 2h", status: "attention" },
  { id: "deepseek", name: "DeepSeek", iconId: "deepseek", resolvedMode: "remaining", arcFraction: 0.7, primaryValue: 70, secondaryValue: 30, primaryLabel: "remaining", reset: "19h 12m", status: "ok" },
  { id: "perplexity", name: "Perplexity", iconId: "perplexity", resolvedMode: "remaining", arcFraction: 0.5, primaryValue: 50, secondaryValue: 50, primaryLabel: "remaining", reset: "3d 12h", status: "ok" },
];

interface Props {
  catalog: string;
  state: "idle" | "hover" | "expanded";
  providers?: StageProvider[];
  focusedIndex?: number;
}

export default function CatalogTaskbar({
  catalog,
  state,
  providers = CATALOG_TASKBAR_FIXTURE,
  focusedIndex = 0,
}: Props) {
  return (
    <TaskbarStage
      catalog={catalog}
      state={state}
      providers={providers}
      focusedIndex={focusedIndex}
    />
  );
}
