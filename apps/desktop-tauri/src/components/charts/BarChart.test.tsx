import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarChart, type BarChartPoint } from "./BarChart";

function points(values: number[]): BarChartPoint[] {
  return values.map((value, i) => ({ label: `2026-09-0${i + 1}`, value }));
}

describe("BarChart", () => {
  it("shows unavailable for invalid values without inventing a zero axis", () => {
    render(<BarChart data={points([NaN, Infinity, -1])} ariaLabel="Cost" emptyMessage="Unavailable" />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(document.querySelector(".chart__axis")).toBeNull();
  });

  it("retains a real zero without drawing a positive-height bar", () => {
    render(<BarChart data={points([0])} ariaLabel="Cost" animations={false} />);
    expect(document.querySelector(".chart__bar")).toHaveAttribute("height", "0");
    expect(document.querySelector(".chart__axis-max")).toHaveTextContent("0.00");
  });

  it("shows the empty message when there is no data", () => {
    render(<BarChart data={[]} ariaLabel="Cost" emptyMessage="No data yet" />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("never truncates a caller-supplied axis label, regardless of length or script (regression: the same bug fixed in the sibling LineChart -- a hardcoded .slice(-5) would cut 'سبتمبر' into 'بتمبر')", () => {
    const arabicLabelPoints: BarChartPoint[] = [
      { label: "٤ سبتمبر", value: 10 },
      { label: "٧ سبتمبر", value: 20 },
    ];
    render(<BarChart data={arabicLabelPoints} ariaLabel="Cost" animations={false} />);
    expect(screen.getByText("٤ سبتمبر")).toBeInTheDocument();
    expect(screen.getByText("٧ سبتمبر")).toBeInTheDocument();
    expect(screen.queryByText("بتمبر")).not.toBeInTheDocument();
  });

  it("isolates axis labels in <bdi> for safe rendering inside RTL text", () => {
    render(<BarChart data={points([10, 20, 30])} ariaLabel="Cost" animations={false} />);
    const axis = document.querySelector(".chart__axis") as HTMLElement;
    expect(axis.querySelectorAll("bdi").length).toBeGreaterThanOrEqual(3);
  });

  it("positions axis labels as percentages of the chart's actual width, not raw pixels tied to a fixed design constant (regression: the same scale bug fixed in the sibling LineChart, which let a wide Arabic max-value label visually merge with the end-date label)", () => {
    render(<BarChart data={points([10, 20, 30])} ariaLabel="Cost" animations={false} />);
    const spans = Array.from(document.querySelectorAll(".chart__axis > span")) as HTMLElement[];
    for (const span of spans) {
      expect(span.style.left).toMatch(/%$/);
    }
  });
});
