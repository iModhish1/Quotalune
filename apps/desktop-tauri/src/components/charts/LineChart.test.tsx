import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineChart, type LineChartPoint } from "./LineChart";

function points(values: number[]): LineChartPoint[] {
  return values.map((value, i) => ({ label: `2026-09-0${i + 1}`, value }));
}

describe("LineChart", () => {
  it("does not fabricate a line from a single observation or a nonzero peak from zero", () => {
    const {container} = render(<LineChart data={[{label:"one",value:0}]} ariaLabel="Quota" animations={false}/>);
    expect(container.querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(1);
    expect(container.querySelector(".chart__axis-max")).toHaveTextContent("0.00");
  });
  it("spaces timestamps by elapsed time, splits missing intervals and supports keyboard tooltips", () => {
    const {container} = render(<LineChart data={[{label:"a",value:10,timestamp:0},{label:"b",value:20,timestamp:1},{label:"c",value:30,timestamp:10}]} expectedStep={1} ariaLabel="Quota" animations={false}/>);
    const points=container.querySelectorAll(".chart__point");
    expect(Number(points[1].getAttribute("cx"))).toBeCloseTo(29.6);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    fireEvent.focus(points[1]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("20.00");
    fireEvent.keyDown(points[1],{key:"Escape"});
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("never truncates a caller-supplied axis label, regardless of length or script (regression: a real Arabic screenshot caught a hardcoded .slice(-5) cutting 'سبتمبر' into 'بتمبر')", () => {
    const arabicLabelPoints: LineChartPoint[] = [
      { label: "٤ سبتمبر", value: 10 },
      { label: "٧ سبتمبر", value: 20 },
    ];
    render(<LineChart data={arabicLabelPoints} ariaLabel="Usage" animations={false} />);
    expect(screen.getByText("٤ سبتمبر")).toBeInTheDocument();
    expect(screen.getByText("٧ سبتمبر")).toBeInTheDocument();
    expect(screen.queryByText("بتمبر")).not.toBeInTheDocument();
  });

  it("shows the empty message when there is no data", () => {
    render(<LineChart data={[]} ariaLabel="Usage" emptyMessage="No data yet" />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders the bare max value with no prefix when maxLabel is omitted (back-compat)", () => {
    render(<LineChart data={points([10, 20, 30])} ariaLabel="Usage" animations={false} />);
    const axisMax = document.querySelector(".chart__axis-max");
    expect(axisMax).toHaveTextContent("30.00");
    expect(axisMax).not.toHaveTextContent("Max");
  });

  it("prefixes the peak value with the caller-supplied, pre-translated maxLabel", () => {
    render(
      <LineChart data={points([10, 20, 30])} ariaLabel="Usage" animations={false} maxLabel="Max" />,
    );
    const axisMax = document.querySelector(".chart__axis-max");
    expect(axisMax).toHaveTextContent("Max 30.00");
  });

  it("anchors the peak label to the actual peak point, not a fixed center, so it never floats disconnected from the data", () => {
    // Peak is the LAST point here -- if the label still used a fixed
    // SVG_WIDTH/2 position it would sit in the middle, disconnected from
    // where the peak actually is (near the right edge).
    render(
      <LineChart data={points([10, 20, 90])} ariaLabel="Usage" animations={false} maxLabel="Max" />,
    );
    const axisMax = document.querySelector(".chart__axis-max") as HTMLElement;
    // Position is a PERCENTAGE of the chart's actual rendered width (see
    // the fix in LineChart.tsx: the axis previously used raw pixels
    // matching the fixed 280-unit design width, which never rescaled to a
    // real card's much wider rendered width -- percentages track it
    // correctly regardless of container size). A fixed-center
    // implementation would place this at exactly 50%. The peak (last of
    // 3 points) should anchor well to the right of center, clamped
    // within the label's margin.
    const left = parseFloat(axisMax.style.left);
    expect(left).toBeGreaterThan(50);
  });

  it("clamps the peak label so it never overlaps the start/end date labels, even when the peak is the very first or last point", () => {
    const first = render(
      <LineChart data={points([90, 10, 10])} ariaLabel="Usage" animations={false} maxLabel="Max" />,
    );
    const leftAtStart = parseFloat(
      (document.querySelector(".chart__axis-max") as HTMLElement).style.left,
    );
    expect(leftAtStart).toBeGreaterThanOrEqual(18 - 0.5);
    first.unmount();

    render(<LineChart data={points([10, 10, 90])} ariaLabel="Usage" animations={false} maxLabel="Max" />);
    const leftAtEnd = parseFloat(
      (document.querySelector(".chart__axis-max") as HTMLElement).style.left,
    );
    expect(leftAtEnd).toBeLessThanOrEqual(82 + 0.5);
  });

  it("isolates the numeric peak value in <bdi> for safe rendering inside RTL text", () => {
    render(
      <LineChart data={points([10, 20, 30])} ariaLabel="Usage" animations={false} maxLabel="Max" />,
    );
    const bdi = document.querySelector(".chart__axis-max bdi");
    expect(bdi).toHaveTextContent("30.00");
  });

  it("renders a grounding baseline hairline and a distinct ring on the actual peak point (section 13 visual refinement)", () => {
    render(<LineChart data={points([10, 90, 30])} ariaLabel="Usage" animations={false} />);
    expect(document.querySelector(".chart__baseline")).not.toBeNull();
    const peakRing = document.querySelector(".chart__peak-ring") as SVGCircleElement | null;
    expect(peakRing).not.toBeNull();
    // Peak is the middle point (index 1) -- the ring must sit at that
    // point's x, not a fixed/arbitrary position.
    const points_ = Array.from(document.querySelectorAll(".chart__point"));
    expect(peakRing?.getAttribute("cx")).toBe(points_[1].getAttribute("cx"));
  });

  it("fills the area under the line with a gradient (not a single flat opacity block)", () => {
    render(<LineChart data={points([10, 20, 30])} ariaLabel="Usage" animations={false} />);
    expect(document.querySelector("linearGradient")).not.toBeNull();
    const area = document.querySelector(".chart__area");
    expect(area?.getAttribute("fill")).toMatch(/^url\(#/);
  });
});
