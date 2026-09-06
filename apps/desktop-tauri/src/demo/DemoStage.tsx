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
import { lazy, Suspense, type CSSProperties, type ReactNode } from "react";
import { DesignSystemProvider } from "../design-system";
import type { UsageDisplayConfig } from "../design-system";
import { HudFocus, DashboardHero } from "./DemoExtras";
import { NotchSurfaceV4, SlabSurfaceV4, SpineSurfaceV4 } from "./V4Surfaces";
import { TaskbarRadialV5, TopRadialV5, EdgeRadialV5, HudRadialV5 } from "./V5Surfaces";
import CatalogSurface from "./CatalogSurface";
import CatalogTaskbar, { CATALOG_TASKBAR_FIXTURE } from "./CatalogTaskbar";
import TaskbarMotionProof from "./TaskbarMotionProof";
import GeometrySurface from "./GeometrySurface";
import ReelPreview from "./ReelPreview";
import MaterialProof from "./MaterialProof";
import NotificationProof from "./NotificationProof";
import AppearanceProof from "./AppearanceProof";
import LogoProof from "./LogoProof";
import CollectionsStudio from "./CollectionsStudio";
import SurfaceGalleryProof from "./SurfaceGalleryProof";
import SettingsLayoutProof from "./SettingsLayoutProof";
import ProviderWorkspaceProof from "./ProviderWorkspaceProof";
import UsageSpendProof from "./UsageSpendProof";
import ThemeMarkProof from "./ThemeMarkProof";
import ProviderIdentityProof from "./ProviderIdentityProof";
import {
  TASKBAR_COMPACT_HEIGHT,
  TASKBAR_EXPANDED_HEIGHT,
  TASKBAR_STAGE_WIDTH,
} from "../components/taskbar/taskbarLayout";
import TopOrbitStage from "../components/top/TopOrbitStage";
import {
  TOP_ORBIT_COMPACT_HEIGHT,
  TOP_ORBIT_COMPACT_WIDTH,
  TOP_ORBIT_EXPANDED_HEIGHT,
  TOP_ORBIT_EXPANDED_WIDTH,
} from "../components/top/topOrbitLayout";
import EdgeOrbitStage from "../components/edge/EdgeOrbitStage";
import {
  EDGE_ORBIT_COMPACT_HEIGHT,
  EDGE_ORBIT_COMPACT_WIDTH,
  EDGE_ORBIT_EXPANDED_HEIGHT,
  EDGE_ORBIT_EXPANDED_WIDTH,
} from "../components/edge/edgeOrbitLayout";
import CatalogUsageHero from "../components/CatalogUsageHero";
import FloatingHudStage from "../floatbar/FloatingHudStage";
import "./demo.css";
import { demoMotionSetting } from "./demoSettings";

const LegacyTaskbarArc = lazy(() => import("../surfaces/taskbar-arc/TaskbarArc"));
const LegacyTopArc = lazy(() => import("../surfaces/top-arc/TopArc"));
const LegacyEdgeArc = lazy(() => import("../surfaces/edge-arc/EdgeArc"));

const params = new URLSearchParams(window.location.search);
const surface = params.get("surface") ?? "taskbar";
const state = (params.get("state") ?? "idle") as "idle" | "hover" | "expanded";
const profileCount = Number(params.get("profiles") ?? "2");
const theme = (params.get("theme") ?? "dark") as "dark" | "light";
const v6 = params.get("v6");
const usage = params.get("usage");
const usageCustom = params.get("usageCustom");
const focus = Number(params.get("focus") ?? "-1");
const motionSetting = demoMotionSetting(params.get("motion"));
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
  if (params.get("gen") === "collections") return <CollectionsStudio />;
  if (params.get("gen") === "reel") return <ReelPreview />;
  if (params.get("gen") === "materials") return <MaterialProof />;
  if (params.get("gen") === "notifications") return <NotificationProof />;
  if (params.get("gen") === "appearance") return <AppearanceProof />;
  if (params.get("gen") === "logos") return <LogoProof />;
  if (params.get("gen") === "surfaces") return <SurfaceGalleryProof />;
  if (params.get("gen") === "settings-layout") return <SettingsLayoutProof />;
  if (params.get("gen") === "providers") return <ProviderWorkspaceProof />;
  if (params.get("gen") === "usage-spend") return <UsageSpendProof />;
  if (params.get("gen") === "theme-marks") return <ThemeMarkProof />;
  if (params.get("gen") === "provider-identities") return <ProviderIdentityProof />;
  const gen = params.get("gen") ?? "v3";

  const stage = (w: number, h: number, pos: CSSProperties, node: ReactNode) => (
    <DesignSystemProvider theme={theme} motionSetting={motionSetting}>
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
  if (catalogSlug && params.get("gen") === "v8") {
    if (surface === "taskbar" && params.get("proof") === "motion") {
      const taskbarScale = Math.min(
        1,
        Math.max(0.32, (window.innerWidth - 24) / TASKBAR_STAGE_WIDTH),
        Math.max(0.32, (window.innerHeight - 72) / TASKBAR_EXPANDED_HEIGHT),
      );
      return stage(
        TASKBAR_STAGE_WIDTH,
        TASKBAR_EXPANDED_HEIGHT,
        {
          left: "50%",
          bottom: 48,
          transform: `translateX(-50%) scale(${taskbarScale})`,
          transformOrigin: "bottom center",
        },
        <TaskbarMotionProof
          catalog={catalogSlug}
          initialState={state === "expanded" ? "expanded" : "idle"}
        />,
      );
    }
    if (surface === "hud") {
      const width = 460;
      const height = 500;
      const scale = Math.min(
        1,
        Math.max(0.5, (window.innerWidth - 24) / width),
        Math.max(0.5, (window.innerHeight - 64) / height),
      );
      return stage(
        width,
        height,
        {
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
        },
        <FloatingHudStage
          catalog={catalogSlug}
          providers={CATALOG_TASKBAR_FIXTURE}
          selectedProviderId={CATALOG_TASKBAR_FIXTURE[0]?.id}
        />,
      );
    }
    if (surface === "quick" || surface === "dashboard") {
      const dashboard = surface === "dashboard";
      const width = dashboard ? 700 : 340;
      const height = dashboard ? 350 : 200;
      const scale = Math.min(1, Math.max(0.48, (window.innerWidth - 24) / width));
      return stage(
        width,
        height,
        {
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
        },
        <CatalogUsageHero
          variant={dashboard ? "dashboard" : "quick"}
          catalog={catalogSlug}
          providers={CATALOG_TASKBAR_FIXTURE}
        />,
      );
    }
    if (surface === "edge") {
      const edgeExpanded = state === "expanded";
      const edgeWidth = edgeExpanded ? EDGE_ORBIT_EXPANDED_WIDTH : EDGE_ORBIT_COMPACT_WIDTH;
      const edgeHeight = edgeExpanded ? EDGE_ORBIT_EXPANDED_HEIGHT : EDGE_ORBIT_COMPACT_HEIGHT;
      const edgeScale = Math.min(
        1,
        Math.max(0.5, (window.innerHeight - 64) / edgeHeight),
      );
      return stage(
        edgeWidth,
        edgeHeight,
        {
          right: 0,
          top: "50%",
          transform: `translateY(-50%) scale(${edgeScale})`,
          transformOrigin: "center right",
        },
        <EdgeOrbitStage
          catalog={catalogSlug}
          state={edgeExpanded ? "expanded" : "idle"}
          providers={CATALOG_TASKBAR_FIXTURE}
        />,
      );
    }
    if (surface === "top") {
      const topExpanded = state === "expanded";
      const topWidth = topExpanded ? TOP_ORBIT_EXPANDED_WIDTH : TOP_ORBIT_COMPACT_WIDTH;
      const topHeight = topExpanded ? TOP_ORBIT_EXPANDED_HEIGHT : TOP_ORBIT_COMPACT_HEIGHT;
      const topScale = Math.min(
        1,
        Math.max(0.36, (window.innerWidth - 24) / topWidth),
        Math.max(0.36, (window.innerHeight - 64) / topHeight),
      );
      return stage(
        topWidth,
        topHeight,
        {
          left: "50%",
          top: 0,
          transform: `translateX(-50%) scale(${topScale})`,
          transformOrigin: "top center",
        },
        <TopOrbitStage
          catalog={catalogSlug}
          state={state}
          providers={CATALOG_TASKBAR_FIXTURE}
        />,
      );
    }
    const taskbarHeight = state === "expanded" ? TASKBAR_EXPANDED_HEIGHT : TASKBAR_COMPACT_HEIGHT;
    const taskbarScale = Math.min(
      1,
      Math.max(0.32, (window.innerWidth - 24) / TASKBAR_STAGE_WIDTH),
      Math.max(0.32, (window.innerHeight - 72) / taskbarHeight),
    );
    return stage(
      TASKBAR_STAGE_WIDTH,
      taskbarHeight,
      {
        left: "50%",
        bottom: 48,
        transform: `translateX(-50%) scale(${taskbarScale})`,
        transformOrigin: "bottom center",
      },
      <CatalogTaskbar catalog={catalogSlug} state={state} />);
  }
  if (catalogSlug && params.get("gen") === "v75") {
    return stage(460, 300, { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
      <GeometrySurface catalog={catalogSlug} surface={surface} reducedMotion={params.get("rm") === "1"} />);
  }
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
  const nodes: Record<string, { w: number; h: number; pos: CSSProperties; node: ReactNode }> = {
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

function TaskbarArcWrapped({ state }: { state: "idle" | "hover" | "expanded" }) {
  return <Suspense fallback={null}><LegacyTaskbarArc demo={{ state }} /></Suspense>;
}
function TopArcWrapped({ state }: { state: "idle" | "hover" | "expanded" }) {
  return <Suspense fallback={null}><LegacyTopArc demo={{ state }} /></Suspense>;
}
function EdgeArcWrapped({ state }: { state: "idle" | "hover" | "expanded" }) {
  return <Suspense fallback={null}><LegacyEdgeArc demo={{ state }} /></Suspense>;
}
