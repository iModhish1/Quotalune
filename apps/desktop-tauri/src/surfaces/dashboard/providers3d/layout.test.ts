import { describe, expect, it } from "vitest";
import { computeProviderLayout, PRIMARY_RING_CAPACITY, ringForProvider } from "./layout";

describe("computeProviderLayout", () => {
  it("returns an empty map for zero providers", () => {
    expect(computeProviderLayout([]).size).toBe(0);
  });

  it("centers a single provider, not orbiting an empty ring", () => {
    const positions = computeProviderLayout(["claude"]);
    expect(positions.size).toBe(1);
    const pos = positions.get("claude")!;
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.z).toBeGreaterThan(0);
  });

  it("is deterministic: same ids in a different order produce the same positions", () => {
    const a = computeProviderLayout(["claude", "codex", "cursor"]);
    const b = computeProviderLayout(["cursor", "claude", "codex"]);
    expect(a.get("claude")).toEqual(b.get("claude"));
    expect(a.get("codex")).toEqual(b.get("codex"));
    expect(a.get("cursor")).toEqual(b.get("cursor"));
  });

  it("is deterministic across repeated calls (no Math.random)", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const first = computeProviderLayout(ids);
    const second = computeProviderLayout(ids);
    for (const id of ids) {
      expect(first.get(id)).toEqual(second.get(id));
    }
  });

  it.each([2, 3, 6, 12])("places every one of %i providers on the primary ring", (count) => {
    const ids = Array.from({ length: count }, (_, i) => `provider-${i}`);
    const positions = computeProviderLayout(ids);
    expect(positions.size).toBe(count);
    for (const id of ids) {
      expect(ringForProvider(id, ids)).toBe("primary");
    }
  });

  it.each([13, 24, 70])(
    "splits %i providers across primary + secondary rings, never one giant ring",
    (count) => {
      const ids = Array.from({ length: count }, (_, i) => `provider-${i}`);
      const positions = computeProviderLayout(ids);
      expect(positions.size).toBe(count);
      const sorted = [...ids].sort();
      const primaryIds = sorted.slice(0, PRIMARY_RING_CAPACITY);
      const secondaryIds = sorted.slice(PRIMARY_RING_CAPACITY);
      expect(primaryIds.length).toBe(PRIMARY_RING_CAPACITY);
      expect(secondaryIds.length).toBe(count - PRIMARY_RING_CAPACITY);
      for (const id of primaryIds) expect(ringForProvider(id, ids)).toBe("primary");
      for (const id of secondaryIds) expect(ringForProvider(id, ids)).toBe("secondary");
    },
  );

  it("never assigns two providers the exact same position within one ring", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `provider-${i}`);
    const positions = computeProviderLayout(ids);
    const seen = new Set<string>();
    for (const pos of positions.values()) {
      const key = `${pos.x.toFixed(6)},${pos.y.toFixed(6)},${pos.z.toFixed(6)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("keeps every position within a bounded, finite distance from the core", () => {
    const ids = Array.from({ length: 70 }, (_, i) => `provider-${i}`);
    const positions = computeProviderLayout(ids);
    for (const pos of positions.values()) {
      const distance = Math.hypot(pos.x, pos.y, pos.z);
      expect(Number.isFinite(distance)).toBe(true);
      expect(distance).toBeLessThan(20);
    }
  });
});

describe("ringForProvider", () => {
  it("reports single for the one-provider case", () => {
    expect(ringForProvider("claude", ["claude"])).toBe("single");
  });

  it("reports secondary for an id not present in the input set", () => {
    expect(ringForProvider("missing", ["claude", "codex"])).toBe("secondary");
  });
});
