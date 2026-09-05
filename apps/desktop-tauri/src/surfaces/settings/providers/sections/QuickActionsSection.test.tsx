import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickActionsSection } from "./QuickActionsSection";

describe("QuickActionsSection", () => {
  it("offers a primary sign-in action whenever a provider has a supported connection flow", () => {
    const connect = vi.fn();
    render(
      <QuickActionsSection
        provider={{ id: "claude", displayName: "Claude", canConnect: true } as never}
        busy={false}
        onRefresh={vi.fn()}
        onConnect={connect}
        onOpenDashboard={vi.fn()}
        onOpenStatusPage={vi.fn()}
        onBuyCredits={vi.fn()}
        t={(key) => ({
          QuickActions: "Quick actions",
          ActionRefresh: "Refresh",
          ActionSwitchAccount: "Sign in / switch account",
        })[key] ?? key}
      />,
    );

    const button = screen.getByRole("button", { name: "Sign in / switch account" });
    expect(button).toHaveClass("btn--primary");
    fireEvent.click(button);
    expect(connect).toHaveBeenCalledOnce();
  });
});
