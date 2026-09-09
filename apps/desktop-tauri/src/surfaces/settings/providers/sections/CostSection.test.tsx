import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CostSection } from "./CostSection";
import type { CostSnapshotBridge } from "../../../../types/bridge";
vi.mock("../../../../hooks/useLocale", () => ({useLocale: () => ({t:(key: string)=>key})}));
const cost: CostSnapshotBridge = {used:12, limit:100, remaining:88, currencyCode:"EUR",period:"Monthly",resetsAt:null,formattedUsed:"$12",formattedLimit:"$100"};
it("displays a balance in its actual currency, not a formatted spend string", () => {
  render(<CostSection providerId="sub2api" cost={cost} t={k=>k}/>);
  expect(screen.getByText("12 EUR")).toBeInTheDocument();
  expect(screen.queryByText("$12")).toBeNull();
  expect(screen.queryByText("DashboardMetricSpend")).toBeNull();
});
it("does not assign money units to provider credits", () => {
  render(<CostSection providerId="codex" cost={cost} t={k=>k}/>);
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.queryByText("12 EUR")).toBeNull();
});
it("fails closed for an unclassified provider", () => {
  render(<CostSection providerId="unknown" cost={cost} t={k=>k}/>);
  expect(screen.getByText("DashboardValueUnavailable")).toBeInTheDocument();
  expect(screen.queryByText("12 EUR")).toBeNull();
});
