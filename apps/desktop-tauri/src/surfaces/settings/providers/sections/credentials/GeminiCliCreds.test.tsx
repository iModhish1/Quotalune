import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocaleKey } from "../../../../../i18n/keys";
import { getGeminiCliSignedIn, openPath, openProviderDashboard } from "../../../../../lib/tauri";
import { GeminiCliCreds } from "./GeminiCliCreds";

vi.mock("../../../../../lib/tauri", () => ({
  getGeminiCliSignedIn: vi.fn(),
  openPath: vi.fn(),
  openProviderDashboard: vi.fn(),
}));

const t = (key: LocaleKey) => key;
const privatePath = "C:\\Users\\private-account\\.gemini\\oauth_creds.json";

describe("GeminiCliCreds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("keeps the actual credential path private while opening the right folder", async () => {
    vi.mocked(getGeminiCliSignedIn).mockResolvedValue({ signedIn: true, credentialsPath: privatePath });
    vi.mocked(openPath).mockResolvedValue(undefined);

    const { container } = render(<GeminiCliCreds providerId="gemini" t={t} />);
    expect(await screen.findByText("~/.gemini/oauth_creds.json")).toHaveAttribute("dir", "ltr");
    expect(container).not.toHaveTextContent("private-account");
    fireEvent.click(screen.getByRole("button", { name: "CredsOpenFolderAction" }));
    expect(openPath).toHaveBeenCalledWith(privatePath);
  });

  it("does not expose a private path returned in an opening error", async () => {
    vi.mocked(getGeminiCliSignedIn).mockResolvedValue({ signedIn: true, credentialsPath: privatePath });
    vi.mocked(openPath).mockRejectedValue(new Error(`Unable to open ${privatePath}`));

    const { container } = render(<GeminiCliCreds providerId="gemini" t={t} />);
    fireEvent.click(await screen.findByRole("button", { name: "CredsOpenFolderAction" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("CredsActionUnavailable");
    expect(container).not.toHaveTextContent("private-account");
  });

  it("shows a safe error when the credential status lookup fails", async () => {
    vi.mocked(getGeminiCliSignedIn).mockRejectedValue(new Error(`Unable to read ${privatePath}`));
    render(<GeminiCliCreds providerId="gemini" t={t} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("CredsActionUnavailable");
    expect(screen.queryByText(/private-account/)).not.toBeInTheDocument();
    expect(openProviderDashboard).not.toHaveBeenCalled();
  });
});
