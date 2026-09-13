import { describe, expect, it } from "vitest";
import { TEST_PROVIDER_CATALOG } from "../../test/providerCatalog";
import { PROVIDER_ICON_REGISTRY } from "./providerIcons";
import grokArtwork from "./icons/ProviderIcon-grok.svg?raw";

describe("provider icon registry", () => {
  it("preserves Grok's white mark on its original dark backing plate", () => {
    expect(PROVIDER_ICON_REGISTRY.grok.svgPath).toBe(grokArtwork);
  });
  it("has explicit icon metadata for every provider in the catalog", () => {
    for (const [id] of TEST_PROVIDER_CATALOG) {
      expect(PROVIDER_ICON_REGISTRY[id], id).toBeDefined();
    }
  });
});
