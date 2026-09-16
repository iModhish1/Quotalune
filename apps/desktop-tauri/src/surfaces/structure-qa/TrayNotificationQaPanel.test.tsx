import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const qa = vi.hoisted(() => ({
  setTrayQaFixture: vi.fn(),
  sendNotificationQaFixture: vi.fn(),
}));
vi.mock("../../lib/trayQa", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/trayQa")>()),
  ...qa,
}));
vi.mock("../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key, language: "english" }) }));

import { DEFAULT_TRAY_QA_FIXTURE, TrayNotificationQaPanel } from "./TrayNotificationQaPanel";

it("applies and clears the in-memory tray fixture with honest unavailable values", async () => {
  qa.setTrayQaFixture.mockResolvedValue(undefined);
  render(<TrayNotificationQaPanel providerIds={["claude", "codex"]} />);
  fireEvent.change(screen.getByLabelText("TrayQaDataState"), { target: { value: "unavailable" } });
  fireEvent.change(screen.getByLabelText("TrayQaWeekly"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("TrayQaUsed"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "TrayQaApply" }));
  await waitFor(() =>
    expect(qa.setTrayQaFixture).toHaveBeenCalledWith({
      ...DEFAULT_TRAY_QA_FIXTURE,
      dataState: "unavailable",
      usedPercent: 100,
      secondaryUsedPercent: null,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "TrayQaClear" }));
  await waitFor(() => expect(qa.setTrayQaFixture).toHaveBeenLastCalledWith(null));
});

it("sends the selected notification case and surfaces a backend refusal", async () => {
  qa.sendNotificationQaFixture.mockResolvedValueOnce(undefined).mockRejectedValueOnce("Notification QA fixture is Dev-channel only.");
  render(<TrayNotificationQaPanel providerIds={["claude", "codex"]} />);
  fireEvent.change(screen.getByLabelText("NotificationQaKind"), { target: { value: "authRequired" } });
  fireEvent.change(screen.getByLabelText("NotificationQaTitle TrayQaProvider"), { target: { value: "codex" } });
  fireEvent.click(screen.getByRole("button", { name: "NotificationQaSend" }));
  await waitFor(() => expect(qa.sendNotificationQaFixture).toHaveBeenCalledWith("authRequired", "codex"));
  expect(await screen.findByRole("status")).toHaveTextContent("NotificationQaSent");
  fireEvent.click(screen.getByRole("button", { name: "NotificationQaSend" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Dev-channel only");
});
