import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsSnapshot } from "../../../types/bridge";
import ProviderDisplayTab from "./ProviderDisplayTab";

vi.mock("../../../hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));
vi.mock("./ProviderIdentityGallery", () => ({ default: () => <div>identity-library</div> }));
vi.mock("./UsageDisplaySection", () => ({ default: () => <div>provider-rules</div> }));

const settings = { providerAccentColors: {} } as SettingsSnapshot;

describe("ProviderDisplayTab", () => {
  it("keeps provider identities and per-provider rules in one dedicated page without rendering both heavy panels", () => {
    render(<ProviderDisplayTab settings={settings} providerCatalog={[]} set={vi.fn()} saving={false} />);

    expect(screen.getByText("identity-library")).toBeInTheDocument();
    expect(screen.queryByText("provider-rules")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /UsageDisplay/ }));

    expect(screen.queryByText("identity-library")).not.toBeInTheDocument();
    expect(screen.getByText("provider-rules")).toBeInTheDocument();
  });
});
