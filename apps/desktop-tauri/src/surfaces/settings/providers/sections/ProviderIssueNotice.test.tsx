import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderDetail } from "../../../../types/bridge";
import { ProviderIssueNotice } from "./ProviderIssueNotice";

const detail = {
  id: "cursor",
  displayName: "Cursor",
  errorState: "needsAuthentication",
} as ProviderDetail;

describe("ProviderIssueNotice", () => {
  it("renders a categorized notice without rendering the raw diagnostic", () => {
    // Raw diagnostic text only ever lives on lastError; the notice must
    // classify from the backend's errorState and never echo the text.
    const raw =
      "cookie=super-secret; authentication required at https://private.example.test";
    const shownDetail = { ...detail, lastError: raw } as ProviderDetail;
    const t = vi.fn((key: string) => ({
      ProviderIssueAuthRequired: "Sign-in required",
      ProviderIssuePrivacySafeDetail: "Details are hidden here to protect account data.",
    })[key] ?? key);

    render(<ProviderIssueNotice detail={shownDetail} t={t} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Cursor: Sign-in required");
    expect(status).toHaveTextContent(
      "Details are hidden here to protect account data.",
    );
    expect(status).not.toHaveTextContent(/super-secret|private\.example\.test/i);
    expect(status).not.toHaveTextContent(/cookie=/i);
  });

  it("falls back to the unknown state when the bridge omits errorState", () => {
    const t = vi.fn((key: string) => ({
      ProviderIssueUnknown: "Usage unavailable",
      ProviderIssuePrivacySafeDetail: "Details are hidden here to protect account data.",
    })[key] ?? key);

    render(
      <ProviderIssueNotice
        detail={{ ...detail, errorState: null } as ProviderDetail}
        t={t}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cursor: Usage unavailable",
    );
  });

  it("Wave 1F §12: shows the shared timeout message when lastError is exactly 'Timeout', still without echoing raw diagnostic text for any other error", () => {
    const t = vi.fn((key: string) => ({
      ProviderIssueUnknown: "Usage unavailable",
      QuotalisLoadingTimeout: "This took too long to respond",
      ProviderIssuePrivacySafeDetail: "Details are hidden here to protect account data.",
    })[key] ?? key);

    const { rerender } = render(
      <ProviderIssueNotice detail={{ ...detail, errorState: "unknown", lastError: "Timeout" } as ProviderDetail} t={t} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("This took too long to respond");
    expect(screen.queryByText("Details are hidden here to protect account data.")).not.toBeInTheDocument();

    // A different, non-"Timeout" error string still gets the generic,
    // privacy-safe detail line -- exact-match only, not a substring/regex
    // that could misclassify an unrelated error mentioning "timeout".
    rerender(
      <ProviderIssueNotice detail={{ ...detail, errorState: "unknown", lastError: "connection timeout while reading response" } as ProviderDetail} t={t} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Details are hidden here to protect account data.");
    expect(screen.queryByText("This took too long to respond")).not.toBeInTheDocument();
  });
});
