import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DemoSettingsSection from "./DemoSettingsSection";
import type { ProviderCatalogEntry, SettingsSnapshot } from "../types/bridge";

const CATALOG: ProviderCatalogEntry[] = [
  { id: "codex", displayName: "Codex", cookieDomain: null },
  { id: "claude", displayName: "Claude", cookieDomain: null },
  { id: "gemini", displayName: "Gemini", cookieDomain: null },
];

function settings(overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return {
    demoModeEnabled: false,
    demoProviderMode: "curated",
    demoProviderCount: 6,
    demoProviderIds: [],
    demoScenario: "connectedShowcase",
    demoSeed: 1,
    demoHistoryDays: 7,
    ...overrides,
  } as unknown as SettingsSnapshot;
}

describe("DemoSettingsSection", () => {
  it("defaults to OFF and hides all controls until enabled", () => {
    render(<DemoSettingsSection settings={settings()} catalog={CATALOG} update={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /Enable Demo Mode/ })).not.toBeChecked();
    expect(screen.queryByText("Provider Set")).not.toBeInTheDocument();
  });

  it("enabling reveals the controls and persists demoModeEnabled: true", () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings()} catalog={CATALOG} update={update} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Enable Demo Mode/ }));
    expect(update).toHaveBeenCalledWith({ demoModeEnabled: true });
  });

  it("disabling persists demoModeEnabled: false", () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings({ demoModeEnabled: true })} catalog={CATALOG} update={update} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Enable Demo Mode/ }));
    expect(update).toHaveBeenCalledWith({ demoModeEnabled: false });
  });

  it("provider count stepper persists the incremented/decremented count", () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings({ demoModeEnabled: true, demoProviderCount: 2 })} catalog={CATALOG} update={update} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase simulated provider count" }));
    expect(update).toHaveBeenCalledWith({ demoProviderCount: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Decrease simulated provider count" }));
    expect(update).toHaveBeenCalledWith({ demoProviderCount: 1 });
  });

  it("provider count stepper clamps at the 1-70 bounds (never 0)", () => {
    const update = vi.fn();
    const { rerender } = render(
      <DemoSettingsSection settings={settings({ demoModeEnabled: true, demoProviderCount: 1 })} catalog={CATALOG} update={update} />,
    );
    expect(screen.getByRole("button", { name: "Decrease simulated provider count" })).toBeDisabled();

    rerender(<DemoSettingsSection settings={settings({ demoModeEnabled: true, demoProviderCount: 70 })} catalog={CATALOG} update={update} />);
    expect(screen.getByRole("button", { name: "Increase simulated provider count" })).toBeDisabled();
  });

  it("scenario selection persists the chosen scenario", async () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings({ demoModeEnabled: true })} catalog={CATALOG} update={update} />);
    // Scenario is a QuotalisSelect (trigger button + document-portaled
    // option list), not a native <select> -- open it, then pick the option.
    fireEvent.click(screen.getByLabelText("Scenario"));
    fireEvent.click(await screen.findByRole("option", { name: "High Usage" }));
    expect(update).toHaveBeenCalledWith({ demoScenario: "highUsage" });
  });

  it("history-range selection persists 7 or 30 days", () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings({ demoModeEnabled: true })} catalog={CATALOG} update={update} />);
    fireEvent.click(screen.getByRole("radio", { name: "30 Days" }));
    expect(update).toHaveBeenCalledWith({ demoHistoryDays: 30 });
  });

  it("Custom provider mode reveals the picker with the real catalog", () => {
    render(
      <DemoSettingsSection
        settings={settings({ demoModeEnabled: true, demoProviderMode: "custom" })}
        catalog={CATALOG}
        update={vi.fn()}
      />,
    );
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
  });

  it("custom provider selection persists the exact selected set (add and remove)", () => {
    const update = vi.fn();
    const { rerender } = render(
      <DemoSettingsSection
        settings={settings({ demoModeEnabled: true, demoProviderMode: "custom", demoProviderIds: [] })}
        catalog={CATALOG}
        update={update}
      />,
    );
    fireEvent.click(screen.getByLabelText("Codex"));
    expect(update).toHaveBeenCalledWith({ demoProviderIds: ["codex"] });

    rerender(
      <DemoSettingsSection
        settings={settings({ demoModeEnabled: true, demoProviderMode: "custom", demoProviderIds: ["codex"] })}
        catalog={CATALOG}
        update={update}
      />,
    );
    fireEvent.click(screen.getByLabelText("Codex"));
    expect(update).toHaveBeenCalledWith({ demoProviderIds: [] });
  });

  it("the search filter narrows the picker to matching providers only", () => {
    render(
      <DemoSettingsSection
        settings={settings({ demoModeEnabled: true, demoProviderMode: "custom" })}
        catalog={CATALOG}
        update={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search…"), { target: { value: "clau" } });
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.queryByText("Codex")).not.toBeInTheDocument();
  });

  it("Regenerate Demo Data increments the seed deterministically (never Math.random)", () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings({ demoModeEnabled: true, demoSeed: 5 })} catalog={CATALOG} update={update} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate Demo Data" }));
    expect(update).toHaveBeenCalledWith({ demoSeed: 6 });
  });

  it("shows a live summary reflecting the current configuration", () => {
    render(
      <DemoSettingsSection
        settings={settings({ demoModeEnabled: true, demoProviderCount: 12, demoScenario: "highUsage", demoHistoryDays: 30 })}
        catalog={CATALOG}
        update={vi.fn()}
      />,
    );
    const summary = within(screen.getByText("Current configuration").closest("div")!);
    expect(summary.getByText("On")).toBeInTheDocument();
    expect(summary.getByText("3 providers")).toBeInTheDocument();
    expect(summary.getByText("High Usage")).toBeInTheDocument();
    expect(summary.getByText("30 days")).toBeInTheDocument();
  });
  it("caps a stored larger request at the actual catalog without silently rewriting settings", () => {
    const update = vi.fn();
    render(<DemoSettingsSection settings={settings({demoModeEnabled:true,demoProviderCount:70})} catalog={CATALOG} update={update}/>);
    expect(screen.getByRole("status")).toHaveTextContent("3");
    expect(screen.getByRole("button", {name:"Increase simulated provider count"})).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name:"Decrease simulated provider count"}));
    expect(update).toHaveBeenCalledWith({demoProviderCount:2});
  });
});
