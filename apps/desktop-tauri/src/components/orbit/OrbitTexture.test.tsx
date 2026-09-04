import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CANONICAL_THEME, THEME_CATALOG } from "../../design-system/themeCatalog";
import OrbitTexture from "./OrbitTexture";

describe("OrbitTexture", () => {
  it("renders the bounded canonical structural identity", () => {
    for (const theme of THEME_CATALOG) {
      const { container, unmount } = render(
        <svg><OrbitTexture theme={theme} cx={200} cy={160} radiusX={150} radiusY={110} /></svg>,
      );

      expect(container.querySelector(`[data-geometry-texture="${theme.geometry}"]`)).not.toBeNull();
      expect(container.querySelectorAll("defs").length).toBe(1);
      expect(container.querySelector("animate, animateTransform")).toBeNull();
      unmount();
    }
  });

  it("uses unique paint-server identifiers for concurrent surfaces", () => {
    const theme = CANONICAL_THEME;
    const { container } = render(
      <svg>
        <OrbitTexture theme={theme} cx={200} cy={160} radiusX={150} radiusY={110} />
        <OrbitTexture theme={theme} cx={500} cy={160} radiusX={150} radiusY={110} />
      </svg>,
    );

    const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
