import { expect, it } from "vitest";
import { SURFACE_DEMO_PROVIDERS } from "./surfaceDemo";

it("supplies six explicitly synthetic, unique, bounded quota records without credentials", () => {
  expect(new Set(SURFACE_DEMO_PROVIDERS.map(p => p.id)).size).toBe(6);
  for (const p of SURFACE_DEMO_PROVIDERS) {
    expect(p.accountLabel).toMatch(/synthetic/);
    expect(p.arcFraction).toBe((p.primaryValue ?? 0) / 100);
    expect(p.primaryValue).toBeGreaterThanOrEqual(0);
    expect(p.primaryValue).toBeLessThanOrEqual(100);
    expect(p).not.toHaveProperty("token");
    expect(p).not.toHaveProperty("email");
  }
});
