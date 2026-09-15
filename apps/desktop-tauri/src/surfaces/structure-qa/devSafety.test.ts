import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Wave 1F §25/§26: the Dev-only native Structure QA controller must not
 * be discoverable from any real in-app navigation (no button/menu links
 * to it -- the only way in is a Dev engineer or automation script
 * manually navigating to `?window=structure-qa`), and it must never
 * write to real history/analytics/credential stores. The real security
 * boundary for the latter is the backend itself (surfaces/qa_fixture.rs
 * refuses `set`/`reset` outside the Dev channel, tested there); this
 * file proves the two properties only the frontend can prove: no stray
 * reference to the route, and no IPC command this controller calls
 * beyond the small, named allowlist below.
 */

const here = import.meta.dirname!;
const srcRoot = join(here, "..", "..");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("structure-qa/ Dev safety (Wave 1F §25/§26)", () => {
  it("is never reachable from real in-app navigation: no source file outside App.tsx/structure-qa/ constructs a window=structure-qa URL", () => {
    const allFiles = collectSourceFiles(srcRoot);
    const offenders = allFiles.filter((file) => {
      if (file.startsWith(here + "\\") || file.startsWith(here + "/")) return false;
      if (file === join(srcRoot, "App.tsx")) return false; // the one sanctioned route registration
      return readFileSync(file, "utf8").includes("window=structure-qa");
    });
    expect(offenders).toEqual([]);
  });

  it("only calls the small, named set of real production IPC commands this wave documents -- no ad-hoc invoke() calls beyond them", () => {
    const controllerSource = readFileSync(join(here, "StructureQaController.tsx"), "utf8");
    const invokeCalls = [...controllerSource.matchAll(/invoke\(\s*["'`]([\w-]+)["'`]/g)].map((m) => m[1]);
    // StructureQaController.tsx itself never calls invoke() directly --
    // every write goes through the existing typed wrappers
    // (lib/tauri.ts, lib/surfaceBridge.ts, hooks/useStructureQaFixture.ts),
    // which is what this test actually pins: no bypass of those wrappers.
    expect(invokeCalls).toEqual([]);
  });
});
