import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Wave 1F §22-30: the `?window=structure-qa` Dev-only route needs real
// Tauri IPC/locale (unlike `?window=demo`), so App.tsx wraps it in the
// real LocaleProvider -- this test only asserts App routes to the
// controller for that query param, not the controller's own internal
// behavior (see StructureQaController.test.tsx for that).

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ label: "main" }),
}));
const tauriMocks = vi.hoisted(() => ({
  getLocaleStrings: vi.fn().mockResolvedValue({ language: "english", entries: {} }),
  setUiLanguage: vi.fn(),
}));
vi.mock("./lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("./surfaces/structure-qa/StructureQaController", () => ({
  default: () => <div data-testid="surface-structure-qa" />,
}));
vi.mock("./demo/DemoStage", () => ({
  default: () => <div data-testid="surface-demo-stage" />,
}));

import App from "./App";

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("App: ?window=structure-qa routing", () => {
  it("mounts the Dev-only Structure QA controller for ?window=structure-qa", async () => {
    window.history.pushState({}, "", "/?window=structure-qa");
    render(<App />);
    expect(await screen.findByTestId("surface-structure-qa")).toBeInTheDocument();
    expect(screen.queryByTestId("surface-demo-stage")).not.toBeInTheDocument();
  });

  it("does not mount it for the unrelated ?window=demo route", async () => {
    window.history.pushState({}, "", "/?window=demo");
    render(<App />);
    expect(await screen.findByTestId("surface-demo-stage")).toBeInTheDocument();
    expect(screen.queryByTestId("surface-structure-qa")).not.toBeInTheDocument();
  });
});
