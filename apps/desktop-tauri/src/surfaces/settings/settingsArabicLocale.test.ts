import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = import.meta.dirname!;
const tabs = [
  "AdvancedTab.tsx", "DisplayTab.tsx", "UsageSpendTab.tsx",
  "AboutTab.tsx", "CollectionsTab.tsx", "ProfilesTab.tsx", "ProvidersTab.tsx",
  "AboutProductIdentity.tsx",
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

    expect(keys.length).toBeGreaterThan(tab.includes("ShortcutCapture") ? 3 : tab.includes("CollectionsTab") ? 1 : tab.includes("AboutProductIdentity") ? 8 : 10);
    for (const key of keys) {
      if (key === "AppName") continue; // The official product name is intentionally Latin script.
      expect(translations.get(key), `${tab}: ${key}`).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("covers every key referenced by the provider detail subtree", () => {
    const arabic = readFileSync(`${here}/../../../../../rust/src/locale/ar-SA.ftl`, "utf8");
    const translations = new Map(
      [...arabic.matchAll(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*)$/gm)]
        .map((match) => [match[1], match[2]]),
    );
    const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) return files(path);
        return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
      });
    const keys = new Set(files(`${here}/providers`).flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(/\bt\(\s*["']([A-Za-z][A-Za-z0-9]*)["']/g)]
        .map((match) => match[1]),
    ));

    expect(keys.size).toBeGreaterThan(200);
    for (const key of keys) expect(translations.has(key), key).toBe(true);
    // State maps and conditional actions reference locale keys without a direct t("Key") call.
    for (const key of [
      "ActionSwitchAccount", "DetailPaceOnTrack", "DetailPaceSlightlyAhead",
      "DetailPaceAhead", "DetailPaceFarAhead", "DetailPaceSlightlyBehind",
      "DetailPaceBehind", "DetailPaceFarBehind", "DetailUpdatedPrefix",
      "ProviderIssueAuthRequired", "ProviderIssueLocalRuntimeOffline",
      "ProviderUsageNotFetchedYet",
    ]) expect(translations.get(key), key).toMatch(/[\u0600-\u06FF]/);
    for (const key of ["QuickActions", "ActionRefresh", "DetailPaceTitle", "Plan", "LastUpdated"]) {
      expect(translations.get(key), key).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
