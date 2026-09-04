import { useState } from "react";

import TaskbarStage from "../components/taskbar/TaskbarStage";
import { CATALOG_STAGE_FIXTURE } from "../components/orbit/stageFixture";
import {
  TASKBAR_COMPACT_HEIGHT,
  TASKBAR_EXPANDED_HEIGHT,
} from "../components/taskbar/taskbarLayout";

interface TaskbarMotionProofProps {
  catalog: string;
  initialState?: "idle" | "expanded";
}

/**
 * Stateful proof shell around the production TaskbarStage. It owns only the
 * interaction state needed by browser automation; layout, material and motion
 * remain the same implementation used by the native Taskbar window.
 */
export default function TaskbarMotionProof({
  catalog,
  initialState = "idle",
}: TaskbarMotionProofProps) {
  const [expanded, setExpanded] = useState(initialState === "expanded");
  const [focusedIndex, setFocusedIndex] = useState(0);

  return (
    <div
      className="qa-taskbar-motion-proof"
      data-proof-state={expanded ? "expanded" : "idle"}
      data-proof-focus={focusedIndex}
      style={{ height: TASKBAR_EXPANDED_HEIGHT }}
    >
      <div
        className="qa-taskbar-motion-proof__stage"
        style={{ height: expanded ? TASKBAR_EXPANDED_HEIGHT : TASKBAR_COMPACT_HEIGHT }}
      >
        <TaskbarStage
          catalog={catalog}
          state={expanded ? "expanded" : "idle"}
          providers={CATALOG_STAGE_FIXTURE}
          focusedIndex={focusedIndex}
          onFocusProvider={setFocusedIndex}
          onToggleExpanded={() => setExpanded((current) => !current)}
        />
      </div>
    </div>
  );
}
