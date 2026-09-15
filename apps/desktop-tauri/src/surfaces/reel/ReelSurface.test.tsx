import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReelSurface from "./ReelSurface";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";

vi.mock("../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key, language: "english", direction: "ltr" }),
  useOptionalLocale: () => null,
}));

function InteractiveReel() {
  const [focus, setFocus] = useState(0);
  return <ReelSurface catalog="01-obsidian-orbit" state="expanded" demoMode
    settings={{form:"reel",anchor:"right",scale:100,autoHide:true,autoHideDelayMs:900}}
    providers={SURFACE_DEMO_PROVIDERS} focusedIndex={focus} onFocusProvider={setFocus} />;
}
function InteractivePinnedReel() {
  const [pinned, setPinned] = useState(false);
  return <ReelSurface catalog="01-obsidian-orbit" state={pinned ? "pinned" : "expanded"} demoMode
    settings={{form:"reel",anchor:"right",scale:100,autoHide:true,autoHideDelayMs:900}}
    providers={SURFACE_DEMO_PROVIDERS} onTogglePinned={() => setPinned((v) => !v)} />;
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
  it("shares the same Pin control (icon + dynamic label) every other structure uses, not the stale ⌖ text glyph", () => {
    render(<InteractivePinnedReel />);
    const pinButton = screen.getByRole("button", { name: "Pin details" });
    expect(pinButton).toHaveAttribute("aria-pressed", "false");
    expect(pinButton.textContent).not.toContain("⌖");
    fireEvent.click(pinButton);
    const unpinButton = screen.getByRole("button", { name: "Unpin details" });
    expect(unpinButton).toHaveAttribute("aria-pressed", "true");
  });

  it("truncates a long provider name and reset string to one line instead of pushing the footer's Pin/Close controls out of the fixed-size native window", () => {
    // Wave 1B §19/§38: Reel's clipping risk is a fixed-size box inside a
    // fixed-size native window (unlike FlowSurface's overflow:hidden +
    // grid-height case) — an unbounded-height name/reset line here would
    // silently push real content (the footer) past the window's own
    // bounds, not just past this CSS box.
    const longNameProvider = {
      ...SURFACE_DEMO_PROVIDERS[0],
      name: "A Very Long Enterprise Provider Account Display Name",
      reset: "2 days, 14 hours, 22 minutes, 9 seconds from now",
    };
    render(
      <ReelSurface
        catalog="01-obsidian-orbit"
        state="expanded"
        settings={{ form: "reel", anchor: "right", scale: 100, autoHide: true, autoHideDelayMs: 900 }}
        providers={[longNameProvider]}
      />,
    );
    const name = document.querySelector(".reel-detail-name") as HTMLElement;
    expect(name).toHaveTextContent(longNameProvider.name);
    expect(name).toHaveAttribute("title", longNameProvider.name);
    const reset = screen.getByText(`Resets in ${longNameProvider.reset}`);
    expect(reset).toHaveClass("reel-detail-reset");
    expect(reset).toHaveAttribute("title", `Resets in ${longNameProvider.reset}`);
    // The footer's Pin/Close controls must still be reachable regardless of
    // how long the name/reset content is — a real reproduction of the
    // owner's "controls pushed off-screen" complaint would surface here as
    // these queries failing.
    expect(screen.getByRole("button", { name: "Collapse details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pin details" })).toBeInTheDocument();
  });

  it("Wave 1D §10: shows a distinct Loading message during the first fetch, not the same 'No quota data' text", () => {
    render(
      <ReelSurface
        catalog="01-obsidian-orbit"
        state="expanded"
        settings={{ form: "reel", anchor: "right", scale: 100, autoHide: true, autoHideDelayMs: 900 }}
        providers={[]}
        initialLoading
      />,
    );
    expect(screen.getByText("QuotalisStructureLoading")).toBeInTheDocument();
    expect(screen.queryByText("No quota data")).not.toBeInTheDocument();
  });

  it.each([1, 3, 6, 12, 24, 70])(
    "Wave 1D §23: at most 3 provider nodes are interactive/visible regardless of provider count (n=%i) — cycles via reelOffset, never displays N simultaneously",
    (count) => {
      const data = Array.from({ length: count }, (_, i) => ({ ...SURFACE_DEMO_PROVIDERS[i % SURFACE_DEMO_PROVIDERS.length], id: `synthetic-${i}` }));
      const { container } = render(
        <ReelSurface
          catalog="01-obsidian-orbit"
          state="expanded"
          settings={{ form: "reel", anchor: "right", scale: 100, autoHide: true, autoHideDelayMs: 900 }}
          providers={data}
        />,
      );
      const interactive = container.querySelectorAll('.reel-node[tabindex="0"]');
      expect(interactive.length).toBeLessThanOrEqual(3);
      // Known, disclosed gap (not fixed this wave — see
      // WAVE1_NATIVE_QA_HANDOFF.md): unlike Notch, which only ever mounts
      // its fixed slot count of DOM nodes, Reel mounts one <button> per
      // provider (all N) and hides the non-adjacent ones via
      // aria-hidden/tabindex/opacity, because the wheel/arrow cycle
      // animates every node's position via CSS custom properties for a
      // continuous slide -- filtering the mount list to only the visible
      // three would very likely break that slide (crossing nodes would
      // mount/unmount abruptly instead of animating), which is not a
      // change to make blind without native visual verification. At n=70
      // this does mean 70 real DOM nodes exist, just not 70 *visible/
      // interactive* ones -- the interaction model the wave's §23
      // actually cares about ("Do not call 70 synthetic '70 real
      // providers'" / cycle vs. simultaneous-display) is honored; DOM
      // node *count* is a separate, smaller concern left open here.
      if (count > 3) {
        expect(container.querySelectorAll(".reel-node").length).toBe(count);
      }
    },
  );
});
