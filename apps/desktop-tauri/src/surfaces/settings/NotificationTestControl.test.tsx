import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import NotificationTestControl from "./NotificationTestControl";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key }), useOptionalLocale: () => null }));

describe("explicit native notification test", () => {
  beforeEach(() => { vi.mocked(invoke).mockReset(); });
  it("sends no notification on mount and submits only an identity after a click", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    render(<NotificationTestControl catalog={[]}/>);
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "NotificationTestSend" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("NotificationTestRequested"));
    expect(invoke).toHaveBeenCalledExactlyOnceWith("send_test_notification", { providerId: null });
  });
  it("reports rejection without showing native error or account content", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("private backend detail"));
    render(<NotificationTestControl catalog={[]}/>);
    fireEvent.click(screen.getByRole("button", { name: "NotificationTestSend" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("NotificationTestFailed"));
    expect(screen.queryByText(/private backend detail/)).toBeNull();
  });
});
