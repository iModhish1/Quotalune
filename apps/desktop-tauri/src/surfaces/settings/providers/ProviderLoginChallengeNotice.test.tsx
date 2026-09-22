import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProviderLoginChallengeNotice } from "./ProviderLoginChallengeNotice";
const api = vi.hoisted(() => ({openExternalUrl:vi.fn().mockResolvedValue(undefined)}));
vi.mock("../../../lib/tauri",()=>api);

vi.mock("../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
beforeEach(() => { api.openExternalUrl.mockReset().mockResolvedValue(undefined); });

it("labels simulated codes and offers no clipboard or browser actions", () => {
  render(<ProviderLoginChallengeNotice challenge={{ providerId: "copilot", requestId: "qa", userCode: "QA-DEMO", verificationUri: "", simulated: true }} />);
  expect(screen.getByRole("status")).toHaveTextContent("ProviderQaTitle");
  expect(screen.queryByRole("button")).toBeNull();
  expect(api.openExternalUrl).not.toHaveBeenCalled();
});

it("rejects unrelated verification URLs", () => {
  render(<ProviderLoginChallengeNotice challenge={{ providerId: "copilot", requestId: "bad", userCode: "PUBLIC", verificationUri: "https://example.invalid/" }} />);
  expect(screen.getByRole("button", { name: "V2OpenVerification" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "V2OpenVerification" }));
  expect(api.openExternalUrl).not.toHaveBeenCalled();
});

it("does not expose raw browser or clipboard errors", async () => {
  const secretError = new Error("PRIVATE-path-and-token-fixture");
  const writeText = vi.fn().mockRejectedValue(secretError);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  api.openExternalUrl.mockRejectedValue(secretError);
  render(<ProviderLoginChallengeNotice challenge={{ providerId: "copilot", requestId: "error", userCode: "PUBLIC", verificationUri: "https://github.com/login/device" }} />);
  fireEvent.click(screen.getByRole("button", { name: "V2CopyCode" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("ConnectIssueError");
  fireEvent.click(screen.getByRole("button", { name: "V2OpenVerification" }));
  await waitFor(() => expect(api.openExternalUrl).toHaveBeenCalled());
  expect(await screen.findByRole("alert")).toHaveTextContent("ConnectIssueError");
  expect(document.body.textContent).not.toContain("PRIVATE");
});
it("shows the public code and generic verification page", () => {
  render(<ProviderLoginChallengeNotice challenge={{ providerId: "copilot", requestId: "request", userCode: "ABCD-EFGH", verificationUri: "https://github.com/login/device" }} />);
  expect(screen.getByRole("status")).toHaveTextContent("ABCD-EFGH");
  expect(screen.getByRole("status")).toHaveTextContent("https://github.com/login/device");
});
it("copies only the public code and opens verification only after a click", async () => {
  const writeText=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});
  render(<ProviderLoginChallengeNotice challenge={{providerId:"copilot",requestId:"copy",userCode:"SAFE-CODE",verificationUri:"https://github.com/login/device"}}/>);
  expect(api.openExternalUrl).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"V2CopyCode"}));
  await waitFor(()=>expect(writeText).toHaveBeenCalledWith("SAFE-CODE"));
  fireEvent.click(screen.getByRole("button",{name:"V2OpenVerification"}));
  await waitFor(()=>expect(api.openExternalUrl).toHaveBeenCalledWith("https://github.com/login/device"));
});
