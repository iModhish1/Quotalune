import { beforeEach, expect, it, vi } from "vitest";
import { startProviderLogin, triggerProviderLogin } from "./tauri";

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

it("filters phase events by both provider and request before cleanup", async () => {
  const receive = vi.fn();
  mocks.invoke.mockImplementation(async (_command, args) => {
    const phaseCallback = mocks.listen.mock.calls.find(
      ([eventName]) => eventName === "provider-login-phase",
    )?.[1];
    phaseCallback({
      payload: {
        providerId: "copilot",
        requestId: "stale-request",
        phase: "completed",
      },
    });
    phaseCallback({
      payload: {
        providerId: "copilot",
        requestId: args.loginRequestId,
        phase: "waiting",
      },
    });
  });

  const handle = startProviderLogin("copilot", { onPhase: receive });
  await handle.completion;

  expect(receive).toHaveBeenCalledOnce();
  expect(receive.mock.calls[0][0]).toMatchObject({
    requestId: handle.requestId,
    phase: "waiting",
  });
  expect(mocks.stop).toHaveBeenCalledOnce();
});

it("cancels the exact active request and removes both listeners", async () => {
  let finishLogin: (() => void) | undefined;
  mocks.invoke.mockImplementation((command) => {
    if (command === "trigger_provider_login") {
      return new Promise<void>((resolve) => {
        finishLogin = resolve;
      });
    }
    if (command === "cancel_provider_login") {
      finishLogin?.();
      return Promise.resolve(true);
    }
    return Promise.resolve();
  });

  const handle = startProviderLogin("copilot", {
    onChallenge: vi.fn(),
    onPhase: vi.fn(),
  });
  await vi.waitFor(() => {
    expect(mocks.invoke).toHaveBeenCalledWith("trigger_provider_login", {
      providerId: "copilot",
      loginRequestId: handle.requestId,
    });
  });

  await expect(handle.cancel()).resolves.toBe(true);
  await handle.completion;
  expect(mocks.invoke).toHaveBeenCalledWith("cancel_provider_login", {
    providerId: "copilot",
    loginRequestId: handle.requestId,
  });
  expect(mocks.stop).toHaveBeenCalledTimes(2);
});

it("cleans up a listener when the other listener setup fails", async () => {
  const stopChallenge = vi.fn();
  mocks.listen.mockImplementation((eventName) =>
    eventName === "provider-login-challenge"
      ? Promise.resolve(stopChallenge)
      : Promise.reject(new Error("phase listener denied")),
  );

  const handle = startProviderLogin("copilot", {
    onChallenge: vi.fn(),
    onPhase: vi.fn(),
  });

  await expect(handle.completion).rejects.toThrow("phase listener denied");
  expect(stopChallenge).toHaveBeenCalledOnce();
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("allows cancel to be retried after the cancellation IPC rejects", async () => {
  let finishLogin: (() => void) | undefined;
  let cancelAttempts = 0;
  mocks.invoke.mockImplementation((command) => {
    if (command === "trigger_provider_login") {
      return new Promise<void>((resolve) => {
        finishLogin = resolve;
      });
    }
    if (command === "cancel_provider_login") {
      cancelAttempts += 1;
      if (cancelAttempts === 1) return Promise.reject(new Error("IPC unavailable"));
      finishLogin?.();
      return Promise.resolve(true);
    }
    return Promise.resolve();
  });

  const handle = startProviderLogin("copilot", { onPhase: vi.fn() });
  await vi.waitFor(() =>
    expect(mocks.invoke).toHaveBeenCalledWith(
      "trigger_provider_login",
      expect.any(Object),
    ),
  );

  await expect(handle.cancel()).rejects.toThrow("IPC unavailable");
  await expect(handle.cancel()).resolves.toBe(true);
  await handle.completion;
  expect(cancelAttempts).toBe(2);
});
