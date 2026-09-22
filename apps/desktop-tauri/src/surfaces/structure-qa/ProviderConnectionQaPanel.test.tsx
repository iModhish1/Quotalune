import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const qa = vi.hoisted(() => ({ setProviderConnectionQaFixture: vi.fn() }));
vi.mock("../../lib/providerConnection", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../lib/providerConnection")>()), ...qa }));
vi.mock("../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key, language: "english" }) }));

import { ProviderConnectionQaPanel } from "./ProviderConnectionQaPanel";

it("applies every scenario for a chosen provider, clears it, and surfaces a backend refusal", async () => {
  qa.setProviderConnectionQaFixture.mockResolvedValue(undefined);
  render(<ProviderConnectionQaPanel providerIds={["claude", "codex"]} />);
  const scenario = screen.getByLabelText("ProviderQaScenario") as HTMLSelectElement;
  expect(scenario.options.length).toBe(19);
  fireEvent.change(screen.getByLabelText("ProviderQaTitle TrayQaProvider"), { target: { value: "codex" } });
  fireEvent.change(scenario, { target: { value: "rateLimited" } });
  fireEvent.click(screen.getByRole("button", { name: "ProviderQaApply" }));
  await waitFor(() => expect(qa.setProviderConnectionQaFixture).toHaveBeenCalledWith({ providerId: "codex", scenario: "rateLimited" }));
  fireEvent.click(screen.getByRole("button", { name: "ProviderQaClear" }));
  await waitFor(() => expect(qa.setProviderConnectionQaFixture).toHaveBeenLastCalledWith(null));
  qa.setProviderConnectionQaFixture.mockRejectedValueOnce("Provider connection QA fixture is Dev-channel only.");
  fireEvent.click(screen.getByRole("button", { name: "ProviderQaApply" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Dev-channel only");
});
