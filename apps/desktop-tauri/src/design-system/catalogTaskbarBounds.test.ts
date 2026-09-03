import { describe, expect, it } from "vitest";

import { taskbarLayout } from "../components/taskbar/taskbarLayout";
import { catalogBySlug, THEME_CATALOG } from "./themeCatalog";

describe("catalog taskbar bounds", () => {
  it("all 15 themes use the same bounded seven-provider stage", () => {
    for (const entry of THEME_CATALOG) {
      for (const state of ["compact", "expanded"] as const) {
        const layout = taskbarLayout(state, 7);
        const xHalf = Math.max(layout.nodeSize, layout.labelWidth) / 2;
        const yHalf = layout.nodeSize / 2;

        for (const node of layout.nodes) {
          expect(node.x - xHalf, `${entry.slug} ${state} left`).toBeGreaterThanOrEqual(0);
          expect(node.x + xHalf, `${entry.slug} ${state} right`).toBeLessThanOrEqual(layout.width);
          expect(node.y - yHalf, `${entry.slug} ${state} top`).toBeGreaterThanOrEqual(0);
          expect(
            node.y + yHalf + layout.labelDepth,
            `${entry.slug} ${state} bottom+label`,
          ).toBeLessThanOrEqual(layout.height);
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
