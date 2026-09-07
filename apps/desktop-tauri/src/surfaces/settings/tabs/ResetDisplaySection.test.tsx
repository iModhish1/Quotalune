import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsSnapshot } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getSettingsSnapshot: vi.fn(),
  setResetPresentation: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import ResetDisplaySection from "./ResetDisplaySection";

function baseSnapshot(): Partial<SettingsSnapshot> {
  return {
    resetPresentation: {
      preset: "countdownOnly",
      modules: ["countdown"],
      order: ["countdown", "weekday", "date", "time", "timezone"],
      timezoneMode: "system",
      timezoneId: null,
      regionalFormat: "system",
      regionalLocale: null,
      clockFormat: "system",
      meridiemStyle: "auto",
      monthStyle: "short",
      weekdayStyle: "off",
      yearStyle: "auto",
      countdownDetail: "adaptive",
      numberingSystem: "latn",
    },
  };
}

describe("ResetDisplaySection", () => {
  beforeEach(() => {
    tauriMocks.getSettingsSnapshot.mockReset().mockResolvedValue(baseSnapshot());
    tauriMocks.setResetPresentation.mockReset().mockResolvedValue(undefined);
  });

  it("loads the persisted preset and shows a live preview from the production formatter", async () => {
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    const presetSelect = await screen.findByLabelText("Preset");
    expect((presetSelect as HTMLSelectElement).value).toBe("countdownOnly");

    // The English preview should show a compact countdown ("5d 13h" for
    // the fixed 5-day-13-hour sample), never a hardcoded string.
    await waitFor(() => {
      expect(screen.getByText("5d 13h")).toBeInTheDocument();
    });
  });

  it("shows a bidi-isolated Arabic preview alongside the English one", async () => {
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    await waitFor(() => {
      expect(screen.getByText("5 ي 13 س")).toBeInTheDocument();
    });
    const arabicValue = screen.getByText("5 ي 13 س");
    expect(arabicValue.tagName.toLowerCase()).toBe("bdi");
    expect(arabicValue.getAttribute("dir")).toBe("ltr");
  });

  it("switching to a named preset persists the matching module set", async () => {
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    const presetSelect = await screen.findByLabelText("Preset");
    fireEvent.change(presetSelect, { target: { value: "full" } });

    await waitFor(() => {
      expect(tauriMocks.setResetPresentation).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: "full",
          modules: ["countdown", "weekday", "date", "time", "timezone"],
        }),
      );
    });
  });

  it("switching to custom reveals module checkboxes and an order list", async () => {
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    fireEvent.change(await screen.findByLabelText("Preset"), { target: { value: "custom" } });

    await waitFor(() => {
      expect(screen.getByText("Modules shown")).toBeInTheDocument();
      expect(screen.getByText("Order")).toBeInTheDocument();
    });
  });

  it("toggling a module persists with preset forced to custom", async () => {
    tauriMocks.getSettingsSnapshot.mockResolvedValue({
      resetPresentation: {
        ...baseSnapshot().resetPresentation!,
        preset: "custom",
        modules: ["countdown", "date"],
      },
    });
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    const dateCheckbox = await screen.findByRole("checkbox", { name: "Date" });
    fireEvent.click(dateCheckbox);

    await waitFor(() => {
      expect(tauriMocks.setResetPresentation).toHaveBeenCalledWith(
        expect.objectContaining({ preset: "custom", modules: ["countdown"] }),
      );
    });
  });

  it("never allows removing the last enabled module", async () => {
    tauriMocks.getSettingsSnapshot.mockResolvedValue({
      resetPresentation: {
        ...baseSnapshot().resetPresentation!,
        preset: "custom",
        modules: ["countdown"],
      },
    });
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    const countdownCheckbox = await screen.findByRole("checkbox", { name: "Countdown" });
    fireEvent.click(countdownCheckbox);

    // No save call for an attempt to leave zero modules enabled.
    expect(tauriMocks.setResetPresentation).not.toHaveBeenCalled();
  });

  it("reorders modules via the Move Up / Move Down controls", async () => {
    tauriMocks.getSettingsSnapshot.mockResolvedValue({
      resetPresentation: {
        ...baseSnapshot().resetPresentation!,
        preset: "custom",
        modules: ["countdown", "date"],
        order: ["countdown", "date", "weekday", "time", "timezone"],
      },
    });
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    const moveDown = await screen.findByRole("button", { name: "Move Countdown down" });
    fireEvent.click(moveDown);

    await waitFor(() => {
      expect(tauriMocks.setResetPresentation).toHaveBeenCalledWith(
        expect.objectContaining({ order: ["date", "countdown", "weekday", "time", "timezone"] }),
      );
    });
  });

  it("reverts to the previous value and surfaces an error when the save fails", async () => {
    tauriMocks.setResetPresentation.mockRejectedValue(new Error("disk full"));
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    fireEvent.change(await screen.findByLabelText("Preset"), { target: { value: "full" } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("disk full");
    });
    // Reverted back to the last-known-good preset.
    expect((screen.getByLabelText("Preset") as HTMLSelectElement).value).toBe("countdownOnly");
  });
});
