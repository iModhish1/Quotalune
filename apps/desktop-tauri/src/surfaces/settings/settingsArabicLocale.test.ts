import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = import.meta.dirname!;
const tabs = [
  "AdvancedTab.tsx", "DisplayTab.tsx", "UsageSpendTab.tsx",
  "AboutTab.tsx", "CollectionsTab.tsx", "ProfilesTab.tsx", "ProvidersTab.tsx",
  "../../../components/ShortcutCapture.tsx",
];

describe("Arabic settings coverage", () => {
  it.each(tabs)("translates every directly referenced key in %s", (tab) => {
    const source = readFileSync(`${here}/tabs/${tab}`, "utf8");
    const arabic = readFileSync(`${here}/../../../../../rust/src/locale/ar-SA.ftl`, "utf8");
    const keys = [...source.matchAll(/\bt\(\s*["']([A-Za-z][A-Za-z0-9]*)["']/g)]
      .map((match) => match[1]);
    const translations = new Map(
      [...arabic.matchAll(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*)$/gm)]
        .map((match) => [match[1], match[2]]),
    );

    expect(keys.length).toBeGreaterThan(tab.includes("ShortcutCapture") ? 3 : tab.includes("CollectionsTab") ? 1 : 10);
    for (const key of keys) {
      expect(translations.get(key), `${tab}: ${key}`).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
