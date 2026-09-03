import { describe, expect, it } from "vitest";
import { THEME_CATALOG } from "./themeCatalog";
import { catalogBySlug } from "./themeCatalog";

/** Mirrors CatalogTaskbar geometry: nodes must stay inside the stage. */
function stageExtents(slug: string, expanded: boolean) {
  const theme = catalogBySlug(slug) as NonNullable<ReturnType<typeof catalogBySlug>>;
  const count = expanded ? 7 : 3;
  const W = 820;
  const H = expanded ? 540 : 400;
  const R = expanded ? 168 : 118;
  const cx = W / 2;
  const cy = expanded ? H - R - 120 : H / 2;
  const orbitR = R + (expanded ? 40 : 22);
  const inst = expanded ? 66 : 58;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = expanded
      ? (-60 + i * 20) * (Math.PI / 180)
      : (-90 + i * 90) * (Math.PI / 180);
    xs.push(cx + orbitR * Math.sin(a));
    ys.push(cy - orbitR * Math.cos(a));
  }
  return { theme, W, H, xs, ys, inst };
}

describe("catalog taskbar bounds", () => {
  it("all 15 themes keep instruments, labels, and glow inside the stage", () => {
    for (const entry of THEME_CATALOG) {
      for (const expanded of [true, false]) {
        const { W, H, xs, ys, inst } = stageExtents(entry.slug, expanded);
        const label = expanded ? 46 : 30;
        for (let i = 0; i < xs.length; i++) {
          expect(xs[i] - inst / 2, `${entry.slug} left`).toBeGreaterThanOrEqual(0);
          expect(xs[i] + inst / 2, `${entry.slug} right`).toBeLessThanOrEqual(W);
        }
        for (let i = 0; i < ys.length; i++) {
          expect(ys[i] - inst / 2, `${entry.slug} top`).toBeGreaterThanOrEqual(0);
          expect(ys[i] + inst / 2 + label, `${entry.slug} bottom+label`).toBeLessThanOrEqual(H);
        }
      }
    }
  });

  it("catalog registry resolves every theme slug", () => {
    for (const entry of THEME_CATALOG) {
      expect(catalogBySlug(entry.slug)?.slug).toBe(entry.slug);
    }
  });
});
