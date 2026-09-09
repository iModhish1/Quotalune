import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProviderLoginChallengeNotice } from "./ProviderLoginChallengeNotice";
const api = vi.hoisted(() => ({openExternalUrl:vi.fn().mockResolvedValue(undefined)}));
vi.mock("../../../lib/tauri",()=>api);

vi.mock("../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
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
