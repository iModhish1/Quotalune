/**
 * Visual-proof wrapper for the production taskbar stage.
 *
 * Geometry, material, theming and interaction live under components/ so
 * this harness cannot drift from the native surface.
 */
import TaskbarStage, {
  type StageProvider,
} from "../components/taskbar/TaskbarStage";
import { CATALOG_STAGE_FIXTURE } from "../components/orbit/stageFixture";

export type { StageProvider } from "../components/taskbar/TaskbarStage";

export const CATALOG_TASKBAR_FIXTURE = CATALOG_STAGE_FIXTURE;

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
