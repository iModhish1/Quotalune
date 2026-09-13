import { expect, it } from "vitest";
import { resolveThemePreference } from "./useTheme";

it("uses explicit profile choices, including Auto, ahead of the saved global choice", () => {
  expect(resolveThemePreference({theme:"dark",activeProfileTheme:"light"})).toBe("light");
  expect(resolveThemePreference({theme:"light",activeProfileTheme:"auto"})).toBe("auto");
});

it("returns to the global preference when the profile override clears or is absent", () => {
  expect(resolveThemePreference({theme:"dark",activeProfileTheme:null})).toBe("dark");
  expect(resolveThemePreference({theme:"auto"})).toBe("auto");
});
