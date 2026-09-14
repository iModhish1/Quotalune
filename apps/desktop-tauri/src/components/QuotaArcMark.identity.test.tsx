import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QuotaArcMark from "./QuotaArcMark";
import { LOGO_VARIANTS, LOGO_SIZES } from "../design-system/logoAppearance";
import { ProviderIcon } from "./providers/ProviderIcon";
import { getProviderIcon } from "./providers/providerIcons";

/**
 * Wave 1B §6: brand-mark and provider-identity stability. Switching a
 * floating Structure's form/theme must never change the rendered Quotalis
 * logo asset or substitute a different provider's artwork.
 *
 * FlowSurface, ReelSurface and NotchSurface/NotchDetails all render the
 * brand mark via this same `QuotaArcMark` component (verified by import —
 * see FlowSurface.tsx's `OfficialQuotaArcMark`, ReelSurface.tsx's and
 * NotchSurface.tsx's identical `QuotaArcMark` imports), so asserting this
 * component's own identity invariants covers all three render paths
 * without needing to mount each one separately.
 */
describe("QuotaArcMark — brand identity stability", () => {
  it("always renders the one official mark asset, regardless of appearance variant or size preference", () => {
    const srcs = new Set<string>();
    for (const variant of LOGO_VARIANTS) {
      for (const sizePreference of LOGO_SIZES) {
        const { container, unmount } = render(
          <QuotaArcMark variant={variant} sizePreference={sizePreference} />,
        );
        const img = container.querySelector('img[data-quotaarc-mark="official"]');
        expect(img).not.toBeNull();
        srcs.add((img as HTMLImageElement).src);
        unmount();
      }
    }
    // Only appearance (data-logo-variant, rendered size) may vary — the
    // underlying asset reference never does.
    expect(srcs.size).toBe(1);
  });

  it("only changes the data-logo-variant attribute, never the mark's own DOM structure, across variants", () => {
    for (const variant of LOGO_VARIANTS) {
      const { container, unmount } = render(<QuotaArcMark variant={variant} />);
      const root = container.querySelector<HTMLElement>(".quotaarc-mark");
      expect(root?.getAttribute("data-logo-variant")).toBe(variant);
      expect(container.querySelectorAll('img[data-quotaarc-mark="official"]').length).toBe(1);
      unmount();
    }
  });
});

/**
 * Provider-identity stability: ProviderIcon resolves purely from
 * `providerId` (via `getProviderIcon`), with no Structure form/theme
 * parameter in its signature at all — so it is architecturally impossible
 * for a provider's artwork to be swapped by switching Structure. This test
 * pins that contract so a future refactor can't quietly add a form/theme
 * branch that substitutes different provider artwork.
 */
describe("ProviderIcon — provider identity stability", () => {
  it("renders the same brand icon markup for a given providerId across repeated mounts", () => {
    const providerIds = ["claude", "codex", "copilot", "gemini", "cursor"];
    for (const providerId of providerIds) {
      const first = render(<ProviderIcon providerId={providerId} />);
      const firstHtml = first.container.querySelector(`[data-provider-id="${providerId}"]`)?.innerHTML;
      first.unmount();
      const second = render(<ProviderIcon providerId={providerId} />);
      const secondHtml = second.container.querySelector(`[data-provider-id="${providerId}"]`)?.innerHTML;
      second.unmount();
      expect(firstHtml).toBe(secondHtml);
    }
  });

  it("never falls back to a different provider's icon entry for a known providerId", () => {
    const providerIds = ["claude", "codex", "copilot", "gemini", "cursor", "opencode", "deepseek", "groq"];
    const seen = new Map<string, string>();
    for (const providerId of providerIds) {
      const entry = getProviderIcon(providerId);
      const signature = entry.svgPath ?? entry.fallbackLetter;
      // Every known provider must resolve to its own distinct visual
      // identity — no two different providerIds may collapse onto the same
      // icon signature (which would look like "substituted provider
      // artwork" to the owner).
      for (const [otherId, otherSignature] of seen) {
        expect(signature === otherSignature && providerId !== otherId).toBe(false);
      }
      seen.set(providerId, signature);
    }
  });
});
