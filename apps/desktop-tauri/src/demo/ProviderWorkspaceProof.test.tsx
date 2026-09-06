import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ProviderWorkspaceProof from "./ProviderWorkspaceProof";

it("renders a responsive provider workspace and keeps each usage window independent", () => {
  render(<ProviderWorkspaceProof />);
  expect(screen.getByRole("listbox", { name: "Providers" })).toBeInTheDocument();
  expect(screen.getByText("Session", { selector: ".provider-usage-bar__label" })).toBeInTheDocument();
  expect(screen.getByText("5-hour", { selector: ".provider-usage-bar__label" })).toBeInTheDocument();
  expect(screen.getByText("Weekly", { selector: ".provider-usage-bar__label" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: /Claude/ }));
  expect(screen.getByText("Claude", { selector: ".provider-detail-title" })).toBeInTheDocument();
});
