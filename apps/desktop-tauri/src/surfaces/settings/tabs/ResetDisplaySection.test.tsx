import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsSnapshot } from "../../../types/bridge";

const tauriMocks = vi.hoisted(() => ({
  getSettingsSnapshot: vi.fn(),
  setResetPresentation: vi.fn(),
  setResetPresentationSurfaceOverride: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../../lib/tauri", () => tauriMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import ResetDisplaySection from "./ResetDisplaySection";

/** The Preset field is now a QuotalisSelect (a button + portal-rendered
 *  option list), not a native <select> -- this drives it the same way a
 *  real user would: click the trigger (found by its accessible name,
 *  same `getByLabelText` query that worked for the native <select>'s
 *  htmlFor/label pairing, since QuotalisSelect's trigger button carries
 *  the same text as an aria-label), then click the matching option. The
 *  option panel is rendered via a document.body portal, so it must be
 *  queried at the document level, never `within()` a specific row. */
async function chooseQuotalisOption(triggerLabel: string, optionName: string) {
  fireEvent.click(await screen.findByLabelText(triggerLabel));
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
}

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
    tauriMocks.setResetPresentationSurfaceOverride.mockReset().mockResolvedValue(undefined);
  });

  it("loads the persisted preset and shows a live preview from the production formatter", async () => {
    render(<ResetDisplaySection />);
    await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());

    const presetTrigger = await screen.findByLabelText("Preset");
    expect(presetTrigger).toHaveTextContent("Countdown Only");

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

    await chooseQuotalisOption("Preset", "Full");

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

    await chooseQuotalisOption("Preset", "Custom");

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

    await chooseQuotalisOption("Preset", "Full");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("disk full");
    });
    // Reverted back to the last-known-good preset.
    expect(screen.getByLabelText("Preset")).toHaveTextContent("Countdown Only");
  });

  describe("surface overrides", () => {
    it("defaults to Global scope with no per-surface controls shown", async () => {
      render(<ResetDisplaySection />);
      await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());
      expect(screen.getByRole("button", { name: "Global" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByText("Taskbar")).not.toBeInTheDocument();
    });

    it("lists the real surface registry when switching to Customize by surface, all Following Global", async () => {
      render(<ResetDisplaySection />);
      await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "Customize by surface" }));

      for (const surface of ["Taskbar", "Top", "Edge", "HUD", "Quick Panel", "Dashboard", "Provider Display", "Tray"]) {
        expect(screen.getByText(surface)).toBeInTheDocument();
      }
      expect(screen.getAllByText("Follow Global")).toHaveLength(8);
    });

    it("customizing a surface seeds it from the global config and persists a real override", async () => {
      render(<ResetDisplaySection />);
      await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "Customize by surface" }));

      const taskbarRow = screen.getByText("Taskbar").closest(".reset-display__surface-row") as HTMLElement;
      fireEvent.click(within(taskbarRow).getByRole("button", { name: "Customize" }));

      // Editing a surface presets its own field set (idPrefix scoped) --
      // change its preset to prove a real, independent persisted override.
      // The trigger is scoped to this row, but QuotalisSelect's option
      // panel portals to document.body, so the option click must be
      // queried at the document level, not within(taskbarRow).
      fireEvent.click(within(taskbarRow).getByLabelText("Preset"));
      fireEvent.click(await screen.findByRole("option", { name: "Full" }));

      await waitFor(() => {
        expect(tauriMocks.setResetPresentationSurfaceOverride).toHaveBeenCalledWith(
          "taskbar",
          expect.objectContaining({ preset: "full" }),
        );
      });
      // The global config is untouched by a surface-scoped edit.
      expect(tauriMocks.setResetPresentation).not.toHaveBeenCalled();
    });

    it("Reset to Global clears a surface override", async () => {
      tauriMocks.getSettingsSnapshot.mockResolvedValue({
        ...baseSnapshot(),
        resetPresentationOverrides: { taskbar: { ...baseSnapshot().resetPresentation!, preset: "full" } },
      });
      render(<ResetDisplaySection />);
      await waitFor(() => expect(tauriMocks.getSettingsSnapshot).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "Customize by surface" }));

      const taskbarRow = screen.getByText("Taskbar").closest(".reset-display__surface-row") as HTMLElement;
      expect(within(taskbarRow).getByText("Custom")).toBeInTheDocument();

      fireEvent.click(within(taskbarRow).getByRole("button", { name: "Reset to Global" }));

      await waitFor(() => {
        expect(tauriMocks.setResetPresentationSurfaceOverride).toHaveBeenCalledWith("taskbar", null);
      });
    });
  });
});
