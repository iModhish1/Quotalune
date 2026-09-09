import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProviderLoginChallengeNotice } from "./ProviderLoginChallengeNotice";

vi.mock("../../../hooks/useLocale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
it("shows the public code and generic verification page", () => {
  render(<ProviderLoginChallengeNotice challenge={{ providerId: "copilot", requestId: "request", userCode: "ABCD-EFGH", verificationUri: "https://github.com/login/device" }} />);
  expect(screen.getByRole("status")).toHaveTextContent("ABCD-EFGH");
  expect(screen.getByRole("status")).toHaveTextContent("https://github.com/login/device");
});
