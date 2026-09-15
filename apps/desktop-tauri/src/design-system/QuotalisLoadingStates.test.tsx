import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuotalisAsyncState, QuotalisRefreshingBadge, QuotalisSkeleton } from "./QuotalisLoadingStates";

describe("QuotalisAsyncState", () => {
  it("renders a distinct message and DOM shape for loading/noData/unavailable/error/timeout — never the same UI twice", () => {
    const rendered: Record<string, string> = {};
    for (const status of ["loading", "noData", "unavailable", "error", "timeout"] as const) {
      const { container, unmount } = render(<QuotalisAsyncState status={status} />);
      rendered[status] = container.innerHTML;
      unmount();
    }
    const values = Object.values(rendered);
    expect(new Set(values).size).toBe(values.length);
  });

  it("loading renders the skeleton, not a text message", () => {
    render(<QuotalisAsyncState status="loading" skeletonRows={2} />);
    expect(document.querySelectorAll(".quotalis-skeleton__bar")).toHaveLength(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("noData and unavailable use distinct default messages and never say 0%/$0/reset-now", () => {
    render(<QuotalisAsyncState status="noData" />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
    const { unmount } = render(<QuotalisAsyncState status="unavailable" />);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/0%|\$0|reset now/i)).not.toBeInTheDocument();
    unmount();
  });

  it("error and timeout are distinct from each other and from noData/unavailable, and offer Retry only when onRetry is given", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<QuotalisAsyncState status="error" onRetry={onRetry} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<QuotalisAsyncState status="timeout" onRetry={onRetry} />);
    expect(screen.getByText("This took too long to respond")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("does not render a Retry button for noData or unavailable even if onRetry is passed (neither is a retryable failure)", () => {
    const onRetry = vi.fn();
    render(<QuotalisAsyncState status="noData" onRetry={onRetry} />);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    const { unmount } = render(<QuotalisAsyncState status="unavailable" onRetry={onRetry} />);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    unmount();
  });

  it("error and timeout use role=alert; noData/unavailable use role=status (not equally urgent)", () => {
    const { unmount: unmountError } = render(<QuotalisAsyncState status="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    unmountError();
    render(<QuotalisAsyncState status="noData" />);
    expect(screen.getByRole("status")).toHaveTextContent("No data yet");
  });

  it("a caller-supplied message overrides the default without changing which status renders", () => {
    render(<QuotalisAsyncState status="unavailable" message="Not supported for this provider" />);
    expect(screen.getByText("Not supported for this provider")).toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });
});

describe("QuotalisSkeleton", () => {
  it("renders the requested number of shimmer bars, hidden from assistive tech", () => {
    const { container } = render(<QuotalisSkeleton rows={4} />);
    expect(container.querySelectorAll(".quotalis-skeleton__bar")).toHaveLength(4);
    expect(container.querySelector(".quotalis-skeleton")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("QuotalisRefreshingBadge", () => {
  it("is a small additive status badge, not a full-state replacement (renders alongside whatever the caller already has)", () => {
    render(
      <div>
        <span>real cached value</span>
        <QuotalisRefreshingBadge />
      </div>,
    );
    expect(screen.getByText("real cached value")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Updating…");
  });

  it("accepts a custom label", () => {
    render(<QuotalisRefreshingBadge label="Refreshing usage…" />);
    expect(screen.getByText("Refreshing usage…")).toBeInTheDocument();
  });
});
