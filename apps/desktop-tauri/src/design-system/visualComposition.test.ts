import { describe, expect, it } from "vitest";
import { PROVIDER_PRESENTATION_IDENTITIES } from "./limitPresentation";
import { resolveVisualComposition } from "./visualComposition";

describe("resolveVisualComposition", () => {
  it("defaults to Follow Structure when nothing is set", () => {
    const result = resolveVisualComposition({ structureThemeId: "01-obsidian-orbit" });
    expect(result.presentationSource).toBe("followStructure");
    expect(result.resolvedProviderPresentationIdentity).toBe("adaptive");
    expect(result.provenance).toEqual({ kind: "followStructure" });
  });

  it("resolves adaptive explicitly to Follow Structure", () => {
    const result = resolveVisualComposition({
      structureThemeId: "solar-ember-material",
      identity: "adaptive",
    });
    expect(result.presentationSource).toBe("followStructure");
    expect(result.provenance).toEqual({ kind: "followStructure" });
  });

  it("resolves any non-adaptive identity to Independent", () => {
    const result = resolveVisualComposition({
      structureThemeId: "solar-ember-material",
      identity: "precision",
    });
    expect(result.presentationSource).toBe("independent");
    expect(result.resolvedProviderPresentationIdentity).toBe("precision");
    expect(result.provenance).toEqual({ kind: "independent" });
  });

  it("does not mutate the structure theme id — it is carried through unchanged", () => {
    const result = resolveVisualComposition({
      structureThemeId: "porcelain-halo-not-a-real-slug-but-opaque-to-the-resolver",
      identity: "prism",
    });
    expect(result.resolvedStructureThemeId).toBe(
      "porcelain-halo-not-a-real-slug-but-opaque-to-the-resolver",
    );
  });

  it("Independent does NOT change when only the structure theme id changes", () => {
    const a = resolveVisualComposition({ structureThemeId: "01-obsidian-orbit", identity: "glass" });
    const b = resolveVisualComposition({ structureThemeId: "sapphire-observatory", identity: "glass" });
    expect(a.resolvedProviderPresentationIdentity).toBe(b.resolvedProviderPresentationIdentity);
    expect(a.presentationSource).toBe(b.presentationSource);
  });

  it("Follow Structure tracks the structure id in the result even though the resolved identity stays adaptive", () => {
    const a = resolveVisualComposition({ structureThemeId: "01-obsidian-orbit", identity: "adaptive" });
    const b = resolveVisualComposition({ structureThemeId: "sapphire-observatory", identity: "adaptive" });
    expect(a.resolvedStructureThemeId).not.toBe(b.resolvedStructureThemeId);
    expect(a.resolvedProviderPresentationIdentity).toBe(b.resolvedProviderPresentationIdentity);
  });

  it("provider override wins over the explicit/global identity", () => {
    const result = resolveVisualComposition({
      structureThemeId: "01-obsidian-orbit",
      identity: "precision",
      providerOverrideIdentity: "ember",
      providerId: "claude",
    });
    expect(result.resolvedProviderPresentationIdentity).toBe("ember");
    expect(result.presentationSource).toBe("independent");
    expect(result.provenance).toEqual({ kind: "providerOverride", providerId: "claude" });
  });

  it("provider override affects only its own target — a second call without it is unaffected", () => {
    const claude = resolveVisualComposition({
      structureThemeId: "01-obsidian-orbit",
      identity: "adaptive",
      providerOverrideIdentity: "rose",
      providerId: "claude",
    });
    const codex = resolveVisualComposition({
      structureThemeId: "01-obsidian-orbit",
      identity: "adaptive",
    });
    expect(claude.resolvedProviderPresentationIdentity).toBe("rose");
    expect(codex.resolvedProviderPresentationIdentity).toBe("adaptive");
  });

  it("an explicit provider override of adaptive still resolves visually to Follow Structure, but keeps providerOverride provenance", () => {
    // The user deliberately set THIS provider's override to "adaptive" —
    // that's still a real, explicit per-provider choice (it could differ
    // from the global/explicit identity for other providers), so
    // provenance should say "provider override," not silently collapse
    // into "follow structure" and hide that a deliberate override exists.
    // The *visual* result (presentationSource/resolved identity) is
    // identical to plain Follow Structure either way.
    const result = resolveVisualComposition({
      structureThemeId: "01-obsidian-orbit",
      providerOverrideIdentity: "adaptive",
      providerId: "claude",
    });
    expect(result.presentationSource).toBe("followStructure");
    expect(result.resolvedProviderPresentationIdentity).toBe("adaptive");
    expect(result.provenance).toEqual({ kind: "providerOverride", providerId: "claude" });
  });

  it("falls back safely to adaptive for an invalid/unknown identity string", () => {
    const result = resolveVisualComposition({
      structureThemeId: "01-obsidian-orbit",
      identity: "not-a-real-identity" as never,
    });
    expect(result.resolvedProviderPresentationIdentity).toBe("adaptive");
    expect(result.presentationSource).toBe("followStructure");
  });

  it("falls back safely for a deleted/unknown provider override, deferring to the explicit identity", () => {
    const result = resolveVisualComposition({
      structureThemeId: "01-obsidian-orbit",
      identity: "precision",
      providerOverrideIdentity: "deleted-override" as never,
      providerId: "claude",
    });
    expect(result.resolvedProviderPresentationIdentity).toBe("precision");
    expect(result.presentationSource).toBe("independent");
    expect(result.provenance).toEqual({ kind: "independent" });
  });

  it("is pure: identical input always yields deep-equal output", () => {
    const input = {
      structureThemeId: "eclipse-ember",
      identity: "midnight" as const,
      providerOverrideIdentity: undefined,
    };
    expect(resolveVisualComposition(input)).toEqual(resolveVisualComposition({ ...input }));
  });

  it("covers every known provider-presentation identity without throwing", () => {
    for (const identity of PROVIDER_PRESENTATION_IDENTITIES) {
      const result = resolveVisualComposition({ structureThemeId: "01-obsidian-orbit", identity });
      expect(result.resolvedProviderPresentationIdentity).toBe(identity);
      expect(result.presentationSource).toBe(identity === "adaptive" ? "followStructure" : "independent");
    }
  });
});
