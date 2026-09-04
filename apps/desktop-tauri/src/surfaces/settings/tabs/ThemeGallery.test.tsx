import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ThemeGallery from "./ThemeGallery";

vi.mock("../../../components/CatalogUsageHero", () => ({
  default: ({ catalog }: { catalog: string }) => <div data-testid={`preview-${catalog}`} />,
}));

describe("ThemeGallery canonical foundation", () => {
  it("shows one active Obsidian Orbit foundation and archives the experimental themes", () => {
    render(<ThemeGallery />);

    expect(screen.getByText("Canonical surface theme")).toBeTruthy();
    expect(screen.getAllByText("Obsidian Orbit")).toHaveLength(2);
    expect(screen.getByText(/Fourteen experimental themes are archived/)).toBeTruthy();
    expect(screen.getByTestId("preview-01-obsidian-orbit")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Taskbar" })).toBeNull();
  });
});
