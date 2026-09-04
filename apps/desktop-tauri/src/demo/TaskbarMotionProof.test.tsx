import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TaskbarMotionProof from "./TaskbarMotionProof";

describe("TaskbarMotionProof", () => {
  it("focuses a provider through the production stage", () => {
    const { container } = render(<TaskbarMotionProof catalog="01-obsidian-orbit" />);

    fireEvent.click(screen.getByRole("button", { name: /Claude:/i }));

    expect(container.firstElementChild).toHaveAttribute("data-proof-focus", "1");
    expect(screen.getByRole("button", { name: /Claude:/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("expands and collapses through the production core control", () => {
    const { container } = render(<TaskbarMotionProof catalog="01-obsidian-orbit" />);

    fireEvent.click(screen.getByRole("button", { name: "Expand quota instrument" }));
    expect(container.firstElementChild).toHaveAttribute("data-proof-state", "expanded");
    expect(screen.getByRole("button", { name: "Collapse quota instrument" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse quota instrument" }));
    expect(container.firstElementChild).toHaveAttribute("data-proof-state", "idle");
  });
});
