/**
 * DemoStage — controlled synthetic rendering of V2 surfaces for the visual
 * screenshot gate. Runs in a plain browser (no Tauri APIs), draws a
 * desktop-like backdrop with a fake taskbar so materials and geometry read
 * in context. Never renders real account data.
 *
 * Route: index.html?window=demo&surface=taskbar|top|edge&state=idle|hover|expanded&profiles=1|2
 */
import { DesignSystemProvider } from "../design-system";
import TaskbarArc from "../surfaces/taskbar-arc/TaskbarArc";
import TopArc from "../surfaces/top-arc/TopArc";
import EdgeArc from "../surfaces/edge-arc/EdgeArc";
import { HudFocus, DashboardHero } from "./DemoExtras";
import { NotchSurfaceV4, SlabSurfaceV4, SpineSurfaceV4 } from "./V4Surfaces";
import { TaskbarRadialV5, TopRadialV5, EdgeRadialV5, HudRadialV5 } from "./V5Surfaces";

const params = new URLSearchParams(window.location.search);
const surface = params.get("surface") ?? "taskbar";
const state = (params.get("state") ?? "idle") as "idle" | "hover" | "expanded";
const profileCount = Number(params.get("profiles") ?? "2");
const theme = (params.get("theme") ?? "dark") as "dark" | "light";
(window as unknown as { __qaDemoProfiles?: number }).__qaDemoProfiles = profileCount;


export default function DemoStage() {
  const gen = params.get("gen") ?? "v3";
  const showTaskbar = surface === "taskbar";
  const showTop = surface === "top";
  const showEdge = surface === "edge";

        if (gen === "v5") {
          const Comp =
            surface === "top" ? TopRadialV5
            : surface === "edge" ? EdgeRadialV5
            : surface === "hud" ? HudRadialV5
            : TaskbarRadialV5;
          const stage: Record<string, { w: number; h: number; pos: import("react").CSSProperties }> = {
            top: { w: 380, h: 220, pos: { left: "50%", top: 0, transform: "translateX(-50%)" } },
            edge: { w: 240, h: 260, pos: { right: 0, top: "50%", transform: "translateY(-50%)" } },
            hud: { w: 380, h: 380, pos: { left: "50%", top: "50%", transform: "translate(-50%, -50%)" } },
            taskbar: { w: 340, h: 240, pos: { left: "50%", bottom: 48, transform: "translateX(-50%)" } },
          };
          const s = stage[surface] ?? stage.taskbar;
          const st = (state === "hover" ? "hover" : state) as "idle" | "hover" | "expanded";
          return (
            <DesignSystemProvider theme={theme} motionSetting="off">
              <div className="demo-desktop" data-demo-theme={theme}>
                <div className="demo-wallpaper" />
                <div className="demo-anchor" style={{ position: "absolute", ...s.pos, width: s.w, height: s.h, zIndex: 5, overflow: "visible" }}>
                  <Comp state={st} />
                </div>
                <div className="demo-taskbar">
                  <div className="demo-taskbar__tb" /><div className="demo-taskbar__tb" />
                  <div className="demo-taskbar__tb" /><div className="demo-taskbar__tb" />
                </div>
              </div>
            </DesignSystemProvider>
          );
        }
        if (gen === "v4") {
          const W = state === "expanded" ? 620 : 320;
          const H = state === "expanded" ? 176 : 50;
          const anchors: Record<string, { anchor: "top" | "bottom" | "right"; w: number; h: number; pos: import("react").CSSProperties }> = {
            top: { anchor: "top", w: state === "expanded" ? 520 : 320, h: state === "expanded" ? 168 : 46, pos: { left: "50%", top: 0, transform: "translateX(-50%)" } },
            taskbar: { anchor: "bottom", w: state === "expanded" ? 620 : 300, h: state === "expanded" ? 176 : 50, pos: { left: "50%", bottom: 48, transform: "translateX(-50%)" } },
            edge: { anchor: "right", w: state === "expanded" ? 240 : 64, h: 240, pos: { right: 0, top: "50%", transform: "translateY(-50%)" } },
          };
          const a = anchors[surface === "top" ? "top" : surface === "edge" ? "edge" : "taskbar"];
          const Comp = surface === "top" ? NotchSurfaceV4 : surface === "edge" ? SpineSurfaceV4 : SlabSurfaceV4;
          return (
            <DesignSystemProvider theme={theme} motionSetting="off">
              <div className="demo-desktop" data-demo-theme={theme}>
                <div className="demo-wallpaper" />
                <div className="demo-anchor" style={{ position: "absolute", ...a.pos, width: a.w, height: a.h, zIndex: 5 }}>
                  <Comp state={state === "hover" ? "idle" : state} />
                </div>
                <div className="demo-taskbar">
                  <div className="demo-taskbar__tb" /><div className="demo-taskbar__tb" />
                  <div className="demo-taskbar__tb" /><div className="demo-taskbar__tb" />
                </div>
              </div>
            </DesignSystemProvider>
          );
        }

  const expanded = state === "expanded";

  return (
    <DesignSystemProvider theme={theme} motionSetting="off">
      <div className="demo-desktop" data-demo-theme={theme}>
        <div className="demo-wallpaper" />
        <div className="demo-icons">
          {[" recycle", "projects", "notes"].map((n) => (
            <div className="demo-icon" key={n}>
              <div className="demo-icon__glyph" />
              <span>{n.trim()}</span>
            </div>
          ))}
        </div>
        {showTaskbar && (
          <div
            className="demo-anchor"
            style={
              expanded
                ? { position: "absolute", left: "50%", bottom: 48, transform: "translateX(-50%)", width: 348, height: 292 }
                : { position: "absolute", left: "50%", bottom: 48, transform: "translateX(-50%)", width: 260, height: 48 }
            }
          >
            <TaskbarArcWrapped />
          </div>
        )}
        {showTop && (
          <div
            className="demo-anchor"
            style={
              expanded
                ? { position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: 348, height: 280 }
                : { position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: 300, height: 48 }
            }
          >
            <TopArcDemo />
          </div>
        )}
        {showEdge && (
          <div
            className="demo-anchor"
            style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 150, height: 200 }}
          >
            <EdgeArcDemo state={state} />
          </div>
        )}
        {(surface === "hud" || surface === "dashboard") && (
          <div
            className="demo-anchor"
            style={
              surface === "hud"
                ? { position: "absolute", right: 160, top: 120, width: 340, height: 200 }
                : { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 620, height: 420 }
            }
          >
            {surface === "hud" ? <HudFocus /> : <DashboardHero />}
          </div>
        )}
        <div className="demo-taskbar">
          <div className="demo-taskbar__tb" />
          <div className="demo-taskbar__tb" />
          <div className="demo-taskbar__tb" />
          <div className="demo-taskbar__tb" />
        </div>
      </div>
    </DesignSystemProvider>
  );
}

import { useEffect, useState, type ComponentType } from "react";

/** Wrap surfaces so their Tauri effects are inert in demo mode. */
function TaskbarArcWrapped() {
  const [Comp, setComp] = useState<null | ComponentType<{ demo?: { state: "idle" | "hover" | "expanded" } }>>(null);
  useEffect(() => setComp(() => TaskbarArc), []);
  if (!Comp) return null;
  return <Comp demo={{ state: state === "expanded" ? "expanded" : "idle" }} />;
}
function TopArcDemo() {
  const [Comp, setComp] = useState<null | ComponentType<{ demo?: { state: "idle" | "hover" | "expanded" } }>>(null);
  useEffect(() => setComp(() => TopArc), []);
  if (!Comp) return null;
  return <Comp demo={{ state: state === "expanded" ? "expanded" : "idle" }} />;
}
function EdgeArcDemo({ state }: { state: "idle" | "hover" | "expanded" }) {
  const [Comp, setComp] = useState<null | ComponentType<{ demo?: { state: "idle" | "expanded" } }>>(null);
  useEffect(() => setComp(() => EdgeArc), []);
  if (!Comp) return null;
  return <Comp demo={{ state: state === "expanded" ? "expanded" : "idle" }} />;
}
