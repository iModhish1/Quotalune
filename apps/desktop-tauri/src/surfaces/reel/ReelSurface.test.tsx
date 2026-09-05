import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReelSurface from "./ReelSurface";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";

function InteractiveReel() {
  const [focus, setFocus] = useState(0);
  return <ReelSurface catalog="01-obsidian-orbit" state="expanded" demoMode
    settings={{form:"reel",anchor:"right",scale:100,autoHide:true,autoHideDelayMs:900}}
    providers={SURFACE_DEMO_PROVIDERS} focusedIndex={focus} onFocusProvider={setFocus} />;
}
describe("Orbit Reel", () => {
  it("reaches all six providers and wraps to Claude with honest demo labels", () => {
    render(<InteractiveReel />);
    for (const provider of SURFACE_DEMO_PROVIDERS) {
      expect(screen.getByRole("dialog", { name: `${provider.name} quota details` })).toBeInTheDocument();
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(provider.primaryValue));
      fireEvent.click(screen.getByRole("button", { name: "Next provider" }));
    }
    expect(screen.getByRole("dialog", { name: "Claude quota details" })).toBeInTheDocument();
    expect(screen.getByText("DEMO · SYNTHETIC")).toBeInTheDocument();
  });
  it("uses Home/End/arrows once per key and keeps off-path nodes unfocusable", () => {
    render(<InteractiveReel />);
    const host = screen.getByRole("region", { name: "Orbit Reel provider selector" });
    fireEvent.keyDown(host, { key: "End" });
    expect(screen.getByRole("dialog", { name: "Perplexity quota details" })).toBeInTheDocument();
    fireEvent.keyDown(host, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Claude quota details" })).toBeInTheDocument();
    expect(document.querySelectorAll('.reel-node[tabindex="0"]')).toHaveLength(3);
    expect(document.querySelectorAll('.reel-node[disabled]')).toHaveLength(3);
  });
});
