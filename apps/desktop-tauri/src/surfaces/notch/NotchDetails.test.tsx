import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotchDetails } from "./NotchDetails";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";

function InteractivePinnedDetails() {
  const [pinned, setPinned] = useState(false);
  return (
    <NotchDetails
      provider={SURFACE_DEMO_PROVIDERS[0]}
      rect={{ x: 0, y: 0, width: 200, height: 120 }}
      pinned={pinned}
      onPin={() => setPinned((v) => !v)}
    />
  );
}

describe("NotchDetails", () => {
  it("shares the same Pin control (icon + dynamic label) every other structure uses, not plain Pin/Unpin text", () => {
    render(<InteractivePinnedDetails />);
    const pinButton = screen.getByRole("button", { name: "Pin details" });
    expect(pinButton).toHaveAttribute("aria-pressed", "false");
    expect(pinButton.textContent?.trim()).not.toBe("Pin");
    fireEvent.click(pinButton);
    const unpinButton = screen.getByRole("button", { name: "Unpin details" });
    expect(unpinButton).toHaveAttribute("aria-pressed", "true");
    expect(unpinButton.textContent?.trim()).not.toBe("Unpin");
  });

  it("uses the same Close label as every other structure render path (Collapse details)", () => {
    render(<InteractivePinnedDetails />);
    expect(screen.getByRole("button", { name: "Collapse details" })).toBeInTheDocument();
  });

  it("truncates a long reset string to one line with the full text in title, instead of wrapping into the fixed-rect footer", () => {
    // notchGeometry.ts gives every notch form's detail panel the same
    // fixed {width:248,height:148} rect, not derived from content, and
    // .notch-detail is overflow:hidden — a wrapped reset line would push
    // the meter/value/footer down and risk clipping the footer's Pin/Close
    // controls, the same class of defect FlowSurface's reset text had.
    const longResetProvider = {
      ...SURFACE_DEMO_PROVIDERS[0],
      reset: "2 days, 14 hours, 22 minutes, 9 seconds from now",
    };
    render(
      <NotchDetails
        provider={longResetProvider}
        rect={{ x: 0, y: 0, width: 248, height: 148 }}
        pinned={false}
      />,
    );
    const reset = screen.getByTitle(`Resets in ${longResetProvider.reset}`);
    expect(reset).toHaveTextContent(`Resets in ${longResetProvider.reset}`);
    // Footer controls must still be reachable regardless of reset length.
    expect(screen.getByRole("button", { name: "Collapse details" })).toBeInTheDocument();
  });
});
