import { describe, expect, it } from "vitest";
import type { AnalyticsSourceDescriptor, AnalyticsSourceId } from "../../types/bridge";
import { analyticsSourceLabel } from "./sourceLabels";

describe("analyticsSourceLabel", () => {
  it("maps every backend source ID to a locale key without using English backend copy", () => {
    const ids: AnalyticsSourceId[] = [
      "providerCurrentState", "providerHistory", "providerReportedMonetary",
      "codexLocalActivity", "claudeLocalActivity",
    ];
    for (const id of ids) {
      const source = { id, label: "backend English label" } as AnalyticsSourceDescriptor;
      expect(analyticsSourceLabel(source, (key) => `translated:${key}`))
        .toMatch(/^translated:AnalyticsSource/);
    }
  });

  it("leaves a future source's backend label available until it is mapped", () => {
    const source = { id: "futureSource", label: "future source" } as unknown as AnalyticsSourceDescriptor;
    expect(analyticsSourceLabel(source, (key) => key)).toBe("future source");
  });
});
