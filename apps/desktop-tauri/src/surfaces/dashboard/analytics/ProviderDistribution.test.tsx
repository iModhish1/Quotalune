import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ProviderDistribution from "./ProviderDistribution";
vi.mock("../../../hooks/useLocale", () => ({useLocale: () => ({t: (key: string) => key})}));
const summary = (provider: string, usedPercent: number) => ({provider, accountId: "a", usedPercent, remainingPercent: 100-usedPercent, lastSampleAt: 1000, resetsAt: null});
it("renders zero and 42 percent without inventing total shares", () => {
 render(<ProviderDistribution providers={[summary("claude",42),summary("codex",0)]}/>);
 expect(screen.getByText("42%")).toBeInTheDocument();
 expect(screen.getByText("0%")).toBeInTheDocument();
 expect(screen.getByRole("table")).toBeInTheDocument();
});
it("fails closed for invalid observations", () => {
 render(<ProviderDistribution providers={[summary("claude",NaN)]}/>);
 expect(screen.getByText("DashboardDistributionEmpty")).toBeInTheDocument();
 expect(screen.queryByRole("table")).toBeNull();
});
