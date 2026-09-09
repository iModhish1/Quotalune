import { beforeEach, expect, it, vi } from "vitest";
import { triggerProviderLogin } from "./tauri";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), stop: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
beforeEach(() => { vi.clearAllMocks(); mocks.listen.mockResolvedValue(mocks.stop); });

it("subscribes before login and delivers only this request's public challenge", async () => {
  const receive = vi.fn();
  mocks.invoke.mockImplementation(async (_command, args) => {
    const callback = mocks.listen.mock.calls[0][1];
    callback({ payload: { providerId: "copilot", requestId: "other", userCode: "WRONG" } });
    callback({ payload: { providerId: "copilot", requestId: args.loginRequestId, userCode: "ABCD-EFGH", verificationUri: "https://github.com/login/device" } });
  });
  await triggerProviderLogin("copilot", receive);
  expect(receive).toHaveBeenCalledTimes(1);
  expect(receive.mock.calls[0][0].userCode).toBe("ABCD-EFGH");
  expect(mocks.stop).toHaveBeenCalledOnce();
});

it("removes the challenge listener on failed login", async () => {
  mocks.invoke.mockRejectedValue(new Error("denied"));
  await expect(triggerProviderLogin("copilot", vi.fn())).rejects.toThrow("denied");
  expect(mocks.stop).toHaveBeenCalledOnce();
});
