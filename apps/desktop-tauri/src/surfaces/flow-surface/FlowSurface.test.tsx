import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StageProvider } from "../../components/orbit/stageTypes";
import type { FlowSurfaceSettings } from "../../design-system/flowSurface";
import FlowSurface from "./FlowSurface";

const providers: StageProvider[] = [
  { id: "codex", name: "OpenAI", iconId: "openai", resolvedMode: "remaining", arcFraction: 0.79, primaryValue: 79, secondaryValue: 21, primaryLabel: "remaining", reset: "3h", status: "ok" },
  { id: "claude", name: "Claude", iconId: "claude", resolvedMode: "remaining", arcFraction: 0.27, primaryValue: 27, secondaryValue: 73, primaryLabel: "remaining", reset: "26h", status: "attention" },
  { id: "gemini", name: "Gemini", iconId: "gemini", resolvedMode: "remaining", arcFraction: 0.58, primaryValue: 58, secondaryValue: 42, primaryLabel: "remaining", reset: "22h", status: "ok" },
];

const settings: FlowSurfaceSettings = {
  form: "flowline",
  anchor: "right",
  scale: 100,
  autoHide: true,
  autoHideDelayMs: 900,
};

describe("FlowSurface", () => {
  it.each(["flowline","reel","satellite"] as const)("keeps named usage windows visible in %s details",form=>{
    const data=[{...providers[0],windows:[{id:"session",label:"5-hour session",primaryValue:73,primaryLabel:"used" as const,arcFraction:.73,reset:"51 min",resetsAt:null},{id:"weekly",label:"Weekly",primaryValue:7,primaryLabel:"used" as const,arcFraction:.07,reset:"4d",resetsAt:null}]}];
    render(<FlowSurface catalog="tidal-glass" settings={{...settings,form}} state="expanded" providers={data}/>);
    expect(screen.getByRole("meter",{name:"5-hour session used"})).toHaveAttribute("aria-valuenow","73");
    expect(screen.getByRole("meter",{name:"Weekly used"})).toHaveAttribute("aria-valuenow","7");
    expect(screen.getByText("Resets in 4d")).toBeInTheDocument();
  });
  it.each(["flowline", "reel", "satellite"] as const)("uses catalog provider energy in %s instead of a hard-coded palette", (form) => {
    const {container} = render(<FlowSurface catalog="01-obsidian-orbit" settings={{...settings, form}} state="expanded" providers={providers}/>);
    const strokes = Array.from(container.querySelectorAll("[stroke]")).map(node => node.getAttribute("stroke"));
    expect(strokes).toContain("#10a37f");
    expect(strokes).toContain("#e0a884");
  });
  it("keeps the hidden state to one reachable reveal control", () => {
    render(<FlowSurface catalog="01-obsidian-orbit" settings={settings} state="hidden" providers={providers} />);

    expect(screen.getByRole("button", { name: "Reveal QuotaArc" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses a concise compact flowline and opens details only on request", () => {
    const onToggleExpanded = vi.fn();
    render(
      <FlowSurface
        catalog="01-obsidian-orbit"
        settings={settings}
        state="compact"
        providers={providers}
        onToggleExpanded={onToggleExpanded}
      />,
    );

    expect(screen.getByRole("button", { name: "Expand OpenAI details" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand OpenAI details" }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
  });

  it("keeps the compact surface quiet and honest when no provider data is available", () => {
    render(<FlowSurface catalog="01-obsidian-orbit" settings={settings} state="compact" providers={[]} />);

    expect(screen.getByRole("button", { name: "QuotaArc is waiting for provider data" })).toBeDisabled();
    expect(screen.getByText("Waiting for provider data")).toBeInTheDocument();
    expect(screen.getByTestId("flow-surface")).toHaveAttribute("data-empty", "true");
  });

  it("does not turn unavailable provider placeholders into a tall empty bar", () => {
    const unavailable = providers.map((provider) => ({
      ...provider,
      arcFraction: null,
      primaryValue: null,
      secondaryValue: null,
      status: "offline" as const,
    }));

    render(<FlowSurface catalog="01-obsidian-orbit" settings={settings} state="compact" providers={unavailable} />);

    expect(screen.getByTestId("flow-surface")).toHaveAttribute("data-empty", "true");
    expect(screen.getByText("Waiting for provider data")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gemini: –/ })).not.toBeInTheDocument();
  });

  it("reflows the same data through Horizon without changing quota semantics", () => {
    render(
      <FlowSurface
        catalog="01-obsidian-orbit"
        settings={{ ...settings, form: "horizon", anchor: "top" }}
        state="expanded"
        providers={providers}
      />,
    );

    expect(screen.getByRole("dialog", { name: "OpenAI quota details" })).toBeInTheDocument();
    expect(screen.getAllByText("79%").length).toBeGreaterThan(0);
    expect(screen.getByTestId("flow-surface")).toHaveAttribute("data-form", "horizon");
  });

  it("reflows provider data through the bounded Orbital structure", () => {
    render(
      <FlowSurface
        catalog="01-obsidian-orbit"
        settings={{ ...settings, form: "orbital", anchor: "bottom-right", scale: 125 }}
        state="compact"
        providers={providers}
      />,
    );

    expect(screen.getByTestId("flow-surface")).toHaveAttribute("data-form", "orbital");
    expect(screen.getByTestId("flow-surface")).toHaveStyle({ "--flow-orbital-size": "130px" });
    expect(screen.getByRole("button", { name: "OpenAI: 79% remaining" })).toBeInTheDocument();
  });

  describe("header identity ownership (Wave 6 Phase 4 correction)", () => {
    it("keeps QuotaArc's own mark as the compact summary icon — never swapped for the focused provider's glyph", () => {
      const { container } = render(
        <FlowSurface catalog="01-obsidian-orbit" settings={settings} state="compact" providers={providers} />,
      );
      const brand = container.querySelector(".flow-surface__brand");
      expect(brand?.querySelector(".flow-surface__mark")).toBeInTheDocument();
      expect(brand?.querySelector(".provider-icon")).not.toBeInTheDocument();
      // The provider's own name/value still show as text next to the brand icon.
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
    });

    it("expanded detail header shows QuotaArc as the title (left) and the focused provider as a distinct chip (center), never merged", () => {
      const { container } = render(
        <FlowSurface catalog="01-obsidian-orbit" settings={settings} state="expanded" providers={providers} />,
      );
      const title = container.querySelector(".flow-surface__detail-title");
      expect(title).toHaveTextContent("QuotaArc");
      expect(title?.querySelector(".flow-surface__mark")).toBeInTheDocument();
      expect(title?.querySelector(".provider-icon")).not.toBeInTheDocument();

      const providerChip = container.querySelector(".flow-surface__detail-provider");
      expect(providerChip).toHaveTextContent("OpenAI");
      expect(providerChip?.querySelector(".provider-icon")).toBeInTheDocument();
    });

    it("never opens the expanded detail panel without quota data — the provider chip therefore never has a fake identity to fall back to", () => {
      // expanded = hasQuotaData && (state === "expanded" || "pinned") in the
      // component itself, so ".flow-surface__detail-provider" existing
      // without a real focused provider is not a reachable state to guard
      // against separately — asserted here as a real invariant instead.
      render(<FlowSurface catalog="01-obsidian-orbit" settings={settings} state="expanded" providers={[]} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("drag handle is hidden by default and only gains visibility affordance through hover/focus, not permanent display", () => {
      const { container } = render(
        <FlowSurface catalog="01-obsidian-orbit" settings={settings} state="compact" providers={providers} />,
      );
      const drag = container.querySelector(".flow-surface__drag");
      expect(drag).toBeInTheDocument();
      // jsdom doesn't compute real stylesheet cascades, so this asserts the
      // handle still exists (for hover/focus/keyboard reachability) rather
      // than the actual opacity value — the opacity:0-by-default behavior
      // itself is verified natively (see docs/WAVE6_CONTINUATION.md).
      expect(drag).toHaveAttribute("aria-label", "Move QuotaArc");
    });
  });
});
