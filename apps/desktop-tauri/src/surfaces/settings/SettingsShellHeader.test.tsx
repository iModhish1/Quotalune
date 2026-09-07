import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SettingsShellHeader from "./SettingsShellHeader";

describe("SettingsShellHeader", () => {
  it("uses the official Quotalis mark and names the active page", () => {
    render(<SettingsShellHeader section="Surfaces"><button>Window action</button></SettingsShellHeader>);

    expect(screen.getByRole("img", { name: "Quotalis" })).toHaveAttribute("data-quotaarc-mark", "official");
    expect(screen.getByRole("heading", { name: "Surfaces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Window action" })).toBeInTheDocument();
  });
});
