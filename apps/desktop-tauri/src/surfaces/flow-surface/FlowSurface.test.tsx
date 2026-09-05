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
});
