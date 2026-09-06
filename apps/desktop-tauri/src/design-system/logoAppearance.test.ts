import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGO_APPEARANCE_STORAGE_KEY,
  LOGO_SIZES,
  logoScale,
  logoSizeFromPercent,
  logoSizePercent,
  readLogoAppearance,
  subscribeLogoAppearance,
  writeLogoAppearance,
} from "./logoAppearance";

describe("logo appearance", () => {
  beforeEach(() => localStorage.removeItem(LOGO_APPEARANCE_STORAGE_KEY));

  it("defaults to the prominent official silver finish", () => {
    expect(readLogoAppearance()).toEqual({ variant: "silver", size: "prominent" });
  });

  it("persists a validated finish and notifies live marks", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLogoAppearance(listener);
    writeLogoAppearance({ variant: "aurora", size: "balanced" });
    expect(readLogoAppearance()).toEqual({ variant: "aurora", size: "balanced" });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("repairs invalid stored values and keeps scale bounded", () => {
    localStorage.setItem(LOGO_APPEARANCE_STORAGE_KEY, JSON.stringify({ variant: "unknown", size: 400 }));
    expect(readLogoAppearance()).toEqual({ variant: "silver", size: "prominent" });
    expect([logoScale("compact"), logoScale("balanced"), logoScale("prominent")]).toEqual([0.9, 1, 1.16]);
    expect(LOGO_SIZES.map(logoSizePercent)).toEqual([90, 100, 116]);
    expect([90, 100, 125].map(logoSizeFromPercent)).toEqual(["compact", "balanced", "prominent"]);
  });
});
