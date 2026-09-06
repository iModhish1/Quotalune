import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

if (!import.meta.dirname) {
  throw new Error("import.meta.dirname unavailable to vitest runner");
}

const stylesSource = readFileSync(
  `${import.meta.dirname}/../../../styles.css`,
  "utf8",
);

function ruleBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match).not.toBeNull();
  return match![1];
}

describe("provider detail sticky identity header", () => {
  it("uses an opaque surface so scrolled controls cannot paint through its text", () => {
    const header = ruleBlock(stylesSource, ".provider-detail-header-block");

    expect(header).toContain("position: sticky");
    expect(header).toContain("background: var(--provider-detail-sticky-bg)");
    expect(header).not.toContain("background: color-mix");
    expect(header).not.toContain("backdrop-filter");
  });
});
