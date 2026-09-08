import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineChart, type LineChartPoint } from "./LineChart";

function points(values: number[]): LineChartPoint[] {
  return values.map((value, i) => ({ label: `2026-09-0${i + 1}`, value }));
}

describe("LineChart", () => {
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
    const left = parseFloat(axisMax.style.left);
    // SVG_WIDTH is 280; a fixed-center implementation would place this at
    // exactly 140. The peak (last of 3 points) should anchor well to the
    // right of center, clamped within the label's margin.
    expect(left).toBeGreaterThan(140);
  });

  it("clamps the peak label so it never overlaps the start/end date labels, even when the peak is the very first or last point", () => {
    const first = render(
      <LineChart data={points([90, 10, 10])} ariaLabel="Usage" animations={false} maxLabel="Max" />,
    );
    const leftAtStart = parseFloat(
      (document.querySelector(".chart__axis-max") as HTMLElement).style.left,
    );
    expect(leftAtStart).toBeGreaterThanOrEqual(280 * 0.18 - 0.5);
    first.unmount();

    render(<LineChart data={points([10, 10, 90])} ariaLabel="Usage" animations={false} maxLabel="Max" />);
    const leftAtEnd = parseFloat(
      (document.querySelector(".chart__axis-max") as HTMLElement).style.left,
    );
    expect(leftAtEnd).toBeLessThanOrEqual(280 * 0.82 + 0.5);
  });

  it("isolates the numeric peak value in <bdi> for safe rendering inside RTL text", () => {
    render(
      <LineChart data={points([10, 20, 30])} ariaLabel="Usage" animations={false} maxLabel="Max" />,
    );
    const bdi = document.querySelector(".chart__axis-max bdi");
    expect(bdi).toHaveTextContent("30.00");
  });
});
