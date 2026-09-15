import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StructureConnector } from "./StructureConnectorView";
import { resolveStructureConnector } from "./structureConnector";

describe("StructureConnector (Wave 1F §18, §21)", () => {
  it("renders nothing when the decision says attached", () => {
    const { container } = render(
      <StructureConnector decision={resolveStructureConnector({ x: 0, y: 0 })} family="notch" />,
    );
    expect(container.querySelector(".structure-connector")).not.toBeInTheDocument();
  });

  it("renders nothing when the decision says exceedsMaximum", () => {
    const { container } = render(
      <StructureConnector decision={resolveStructureConnector({ x: 200, y: 0 })} family="flow" />,
    );
    expect(container.querySelector(".structure-connector")).not.toBeInTheDocument();
  });

  it("renders at the required gap, sized narrow-and-tall for a horizontal (x-axis) gap", () => {
    const { container } = render(
      <StructureConnector decision={resolveStructureConnector({ x: 10, y: 0 })} family="reel" span={16} minGapAxis={8} />,
    );
    const svg = container.querySelector("svg.structure-connector");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "10");
    expect(svg).toHaveAttribute("height", "16");
    expect(svg).toHaveAttribute("data-orientation", "horizontal");
  });

  it("renders wide-and-short for a vertical (y-axis) gap", () => {
    const { container } = render(
      <StructureConnector decision={resolveStructureConnector({ x: 0, y: 10 })} family="flow" span={16} minGapAxis={8} />,
    );
    const svg = container.querySelector("svg.structure-connector");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "10");
    expect(svg).toHaveAttribute("data-orientation", "vertical");
  });

  it("selects a family-specific style class while sharing the same shape/markup", () => {
    for (const family of ["notch", "flow", "reel"] as const) {
      const { container, unmount } = render(
        <StructureConnector decision={resolveStructureConnector({ x: 10, y: 0 })} family={family} />,
      );
      expect(container.querySelector(`.structure-connector--${family}`)).toBeInTheDocument();
      expect(container.querySelectorAll(".structure-connector__bridge")).toHaveLength(1);
      unmount();
    }
  });

  it("is hidden from assistive tech (a purely decorative bridge, the real content is announced elsewhere)", () => {
    const { container } = render(
      <StructureConnector decision={resolveStructureConnector({ x: 10, y: 0 })} family="notch" />,
    );
    expect(container.querySelector("svg.structure-connector")).toHaveAttribute("aria-hidden", "true");
  });
});
