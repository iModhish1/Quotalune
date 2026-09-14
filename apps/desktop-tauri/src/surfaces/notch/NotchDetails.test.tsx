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
});
