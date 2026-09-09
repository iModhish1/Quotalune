import { describe, expect, it } from "vitest";
import { providerMonetaryQuantityKind } from "./providerMonetaryKind";
describe("shared monetary classification after renderer retirement", () => {
  it.each([["claude", "spend"], ["openaiapi", "spend"], ["devin", "balance"], ["codex", "credits"], ["commandcode", "credits"], ["unknown-provider", "unknown"]])("classifies %s as %s", (id, kind) => expect(providerMonetaryQuantityKind(id)).toBe(kind));
});
