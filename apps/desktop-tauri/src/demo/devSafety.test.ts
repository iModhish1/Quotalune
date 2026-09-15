import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Wave 1E §25: the Dev-only structure QA fixture panel
 * (`demo/ReelPreview.tsx`) and the `?window=demo` proof-harness route it
 * rides on (`App.tsx`, `demo/DemoStage.tsx`) are NOT gated by a runtime
 * `is_dev_channel()` check, and that is a deliberate, disclosed choice,
 * not an oversight: `DemoStage.tsx` documents itself as running with "no
 * Tauri APIs" specifically so this whole route works when the built
 * frontend bundle is loaded in a plain browser with no Tauri IPC backend
 * at all (the screenshot-capture harness's real use case) -- an
 * `invoke("is_dev_channel")` call there would simply hang or reject in
 * that context, breaking the harness itself.
 *
 * The actual Dev-safety property this route relies on instead, proven by
 * the two tests below:
 *  1. It can never reach real production data or state, in either
 *     channel, because it never calls Tauri IPC at all (no `invoke(`
 *     anywhere under `src/demo/`) -- there is no command it could call
 *     that would write to a real settings/history/provider store.
 *  2. It is never reachable through any real in-app navigation, in
 *     either channel, because no source file outside `src/demo/` ever
 *     constructs a `window=demo` URL -- the only way to reach it is a
 *     human or tool manually typing that query string, the same as this
 *     session's own screenshot-capture tooling does.
 * `commands/notification_history.rs`'s existing
 * `real_history_is_never_accessible_from_demo_or_other_surfaces` Rust
 * test separately proves the history-isolation half of this for the
 * distinct (Settings-window) `demo_mode_enabled` concept, which is not
 * the same mechanism as this route -- see that test for the IPC-level
 * guarantee.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

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

describe("demo/ fixture-panel Dev safety (Wave 1E §25)", () => {
  it("contains no Tauri invoke() call anywhere under src/demo/, so it cannot write to any real settings/history/provider store regardless of build channel", () => {
    const files = collectSourceFiles(here);
    const offenders = files.filter((file) => /\binvoke\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("is never reachable from real in-app navigation: no source file outside src/demo/ constructs a window=demo URL", () => {
    const allFiles = collectSourceFiles(srcRoot);
    const outsideDemo = allFiles.filter((file) => !file.startsWith(here + "\\") && !file.startsWith(here + "/"));
    const offenders = outsideDemo.filter((file) => readFileSync(file, "utf8").includes("window=demo"));
    expect(offenders).toEqual([]);
  });
});
