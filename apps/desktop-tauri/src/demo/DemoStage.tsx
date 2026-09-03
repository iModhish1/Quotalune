/**
 * DemoStage — controlled synthetic rendering of QuotaArc surfaces for the
 * visual screenshot gate. Runs in a plain browser (no Tauri APIs).
 *
 * Routes:
 *   ?window=demo&gen=v5|v4|v3&surface=taskbar|top|edge|hud|dashboard
 *   &state=idle|hover|expanded&profiles=N&theme=dark|light
 *   &v6=obsidian|graphite|midnight|ceramic|mono
 *   &usage=used|remaining|hybrid&usageCustom=claude:used,codex:remaining&focus=N
 */
import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { DesignSystemProvider } from "../design-system";
import type { UsageDisplayConfig } from "../design-system";
import TaskbarArc from "../surfaces/taskbar-arc/TaskbarArc";
import TopArc from "../surfaces/top-arc/TopArc";
import EdgeArc from "../surfaces/edge-arc/EdgeArc";
import { HudFocus, DashboardHero } from "./DemoExtras";
import { NotchSurfaceV4, SlabSurfaceV4, SpineSurfaceV4 } from "./V4Surfaces";
import { TaskbarRadialV5, TopRadialV5, EdgeRadialV5, HudRadialV5 } from "./V5Surfaces";
import CatalogSurface from "./CatalogSurface";

const params = new URLSearchParams(window.location.search);
const surface = params.get("surface") ?? "taskbar";
const state = (params.get("state") ?? "idle") as "idle" | "hover" | "expanded";
const profileCount = Number(params.get("profiles") ?? "2");
const theme = (params.get("theme") ?? "dark") as "dark" | "light";
const v6 = params.get("v6");
const usage = params.get("usage");
const usageCustom = params.get("usageCustom");
const focus = Number(params.get("focus") ?? "-1");
const usageConfig: UsageDisplayConfig | undefined =
  usage || usageCustom
    ? {
        global: (usage ?? "remaining") as "used" | "remaining" | "hybrid",
        providerOverrides: Object.fromEntries(
          (usageCustom ?? "")
            .split(",")
            .filter(Boolean)
            .map((kv) => kv.split(":")) as [string, "used" | "remaining" | "hybrid"][],
        ),
      }
    : undefined;
(window as unknown as { __qaDemoProfiles?: number }).__qaDemoProfiles = profileCount;

export default function DemoStage() {
  const gen = params.get("gen") ?? "v3";

  const stage = (w: number, h: number, pos: CSSProperties, node: React.ReactNode) => (
    <DesignSystemProvider theme={theme} motionSetting="off">
      <div
        className="demo-desktop"
        data-demo-theme={theme}
        {...(v6 ? { "data-qa-v6": v6 } : {})}
      >
        <div className="demo-wallpaper" />
        <div className="demo-anchor" style={{ position: "absolute", width: w, height: h, zIndex: 5, overflow: "visible", ...pos }}>
          {node}
        </div>
        <div className="demo-taskbar">
          <div className="demo-taskbar__tb" />
          <div className="demo-taskbar__tb" />
          <div className="demo-taskbar__tb" />
          <div className="demo-taskbar__tb" />
        </div>
      </div>
    </DesignSystemProvider>
  );

  const catalogSlug = params.get("catalog");
  if (catalogSlug) {
    return stage(460, 300, { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
      <CatalogSurface catalog={catalogSlug} surface={surface} state={state} />);
  }
  if (gen === "v5") {
    const layout: Record<string, { w: number; h: number; pos: CSSProperties }> = {
      taskbar: { w: 340, h: 240, pos: { left: "50%", bottom: 48, transform: "translateX(-50%)" } },
      top: { w: 380, h: 220, pos: { left: "50%", top: 0, transform: "translateX(-50%)" } },
      edge: { w: 240, h: 260, pos: { right: 0, top: "50%", transform: "translateY(-50%)" } },
      hud: { w: 380, h: 380, pos: { left: "50%", top: "50%", transform: "translate(-50%, -50%)" } },
    };
    const s = layout[surface] ?? layout.taskbar;
    const Comp =
      surface === "top" ? TopRadialV5
      : surface === "edge" ? EdgeRadialV5
      : surface === "hud" ? HudRadialV5
      : TaskbarRadialV5;
    const st = (state === "hover" ? "hover" : state) as "idle" | "hover" | "expanded";
    return stage(s.w, s.h, s.pos, <Comp state={st} focus={focus} usageConfig={usageConfig} />);
  }

  if (gen === "v4") {
    const anchors: Record<string, { w: number; h: number; pos: CSSProperties }> = {
      top: { w: state === "expanded" ? 520 : 320, h: state === "expanded" ? 168 : 46, pos: { left: "50%", top: 0, transform: "translateX(-50%)" } },
      taskbar: { w: state === "expanded" ? 620 : 300, h: state === "expanded" ? 176 : 50, pos: { left: "50%", bottom: 48, transform: "translateX(-50%)" } },
      edge: { w: state === "expanded" ? 240 : 64, h: 240, pos: { right: 0, top: "50%", transform: "translateY(-50%)" } },
    };
    const a = anchors[surface] ?? anchors.taskbar;
    const Comp = surface === "top" ? NotchSurfaceV4 : surface === "edge" ? SpineSurfaceV4 : SlabSurfaceV4;
    return stage(a.w, a.h, a.pos, <Comp state={state === "expanded" ? "expanded" : "idle"} />);
  }

  // V3 generation + hud/dashboard heroes
  const expanded = state === "expanded";
  const nodes: Record<string, { w: number; h: number; pos: CSSProperties; node: React.ReactNode }> = {
    taskbar: {
      w: expanded ? 348 : 260,
      h: expanded ? 292 : 48,
      pos: { left: "50%", bottom: 48, transform: "translateX(-50%)" },
      node: <TaskbarArcWrapped state={state} />,
    },
    top: {
      w: expanded ? 348 : 300,
      h: expanded ? 280 : 48,
      pos: { left: "50%", top: 0, transform: "translateX(-50%)" },
      node: <TopArcWrapped state={state} />,
    },
    edge: {
      w: 150,
      h: 200,
      pos: { right: 0, top: "50%", transform: "translateY(-50%)" },
      node: <EdgeArcWrapped state={state} />,
    },
    hud: {
      w: 340,
      h: 200,
      pos: { right: 160, top: 120 },
      node: <HudFocus />,
    },
    dashboard: {
      w: 620,
      h: 420,
      pos: { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
      node: <DashboardHero />,
    },
  };
  const n = nodes[surface] ?? nodes.taskbar;
  return stage(n.w, n.h, n.pos, n.node);
}

function useLazyComponent(Comp: ComponentType<{ demo?: { state: "idle" | "hover" | "expanded" } }>, state: "idle" | "hover" | "expanded") {
  const [Mounted, setMounted] = useState<null | ComponentType<{ demo?: { state: "idle" | "hover" | "expanded" } }>>(null);
  useEffect(() => setMounted(() => Comp), [Comp]);
  if (!Mounted) return null;
  return <Mounted demo={{ state: state === "expanded" ? "expanded" : state === "hover" ? "hover" : "idle" }} />;
}

function TaskbarArcWrapped({ state }: { state: "idle" | "hover" | "expanded" }) {
  return useLazyComponent(TaskbarArc, state);
}
function TopArcWrapped({ state }: { state: "idle" | "hover" | "expanded" }) {
  return useLazyComponent(TopArc, state);
}
function EdgeArcWrapped({ state }: { state: "idle" | "hover" | "expanded" }) {
  return useLazyComponent(
    EdgeArc as ComponentType<{ demo?: { state: "idle" | "hover" | "expanded" } }>,
    state,
  );
}
