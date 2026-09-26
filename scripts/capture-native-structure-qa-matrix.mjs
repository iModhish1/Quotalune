#!/usr/bin/env node
// Wave 1E §27-28, extended Wave 1F §29-30: prepared, NOT executed this
// session -- CDP/native screenshot access is confirmed unavailable in
// this session's environment (see docs/validation/WAVE1_NATIVE_QA_HANDOFF.md).
// The next capable session runs this against the exact manifest at
// docs/validation/WAVE1_NATIVE_QA_MATRIX.json and records real PASS/FAIL
// per entry -- do not hand-wave a result without running it.
//
// Two lanes, matching the manifest's "lane" field:
//   native  -- drives the REAL production top-arc WebView2 via the same
//              update_surface_settings / set_catalog_theme IPC pattern
//              already proven in capture-native-surface-proof.mjs and
//              capture-native-theme-matrix.mjs. As of Wave 1F, manifest
//              entries with a "devControl" field additionally call the
//              real set_structure_qa_fixture command (surfaces/qa_fixture.rs)
//              instead of the fixed 6-provider set_surface_demo_mode
//              toggle, so this lane can now capture the SAME full
//              provider-count/name/reset/windows/data-state matrix the
//              fixture lane always could, but inside the real native
//              window/compositor -- see StructureQaController.tsx for the
//              human-drivable version of the same commands. Requires a
//              verified Dev build launched with a working
//              --remote-debugging-port (blocked for this session by the
//              hardened launcher; see handoff doc for the documented
//              workaround, if any is found by a session with real
//              desktop access).
//   fixture -- drives the Dev-only demo/ReelPreview.tsx proof-harness
//              route (`?window=demo&gen=reel&...`) in ANY CDP-capable
//              browser pointed at a running `npm run dev` (or built
//              `dist/`) server -- this does NOT require the hardened
//              Quotalis Dev launcher at all, only a normal Chromium
//              instance. Still not executed this session (see handoff
//              doc for why), but has no dependency on the blocked
//              launcher and should be the faster of the two to unblock.
//              Label any evidence from this lane BROWSER FIXTURE, never
//              NATIVE WINDOW PROOF -- it is not proof of native window
//              chrome, DPI scaling, or compositor behavior.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}
const lane = argumentsMap.get("--lane") ?? "native";
const port = Number(argumentsMap.get("--port") ?? (lane === "fixture" ? "9333" : "9223"));
const pid = Number(argumentsMap.get("--pid") ?? "0") || null;
const manifestPath = path.resolve(
  argumentsMap.get("--manifest") ?? "docs/validation/WAVE1_NATIVE_QA_MATRIX.json",
);
const outputDirectory = path.resolve(
  argumentsMap.get("--out") ?? ".local/historical-v9-native-captures/structures",
);
// Base URL for the fixture lane's dev server (unused for the native lane,
// which discovers its target by URL substring like the existing scripts).
const fixtureBaseUrl = argumentsMap.get("--base-url") ?? "http://localhost:5173/";

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (message) => {
      const payload = JSON.parse(String(message.data));
      if (payload.id == null) return;
      const pending = this.pending.get(payload.id);
      if (!pending) return;
      this.pending.delete(payload.id);
      if (payload.error) pending.reject(new Error(payload.error.message));
      else pending.resolve(payload.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  close() {
    this.socket.close();
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  return response.json();
}

async function withTarget(target, action) {
  const client = new CdpClient(target.webSocketDebuggerUrl);
  try {
    return await action(client);
  } finally {
    client.close();
  }
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

function pngDimensions(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("Capture was not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function captureAt(target, entry, afterLoad) {
  return withTarget(target, async (client) => {
    await client.send("Page.enable");
    if (afterLoad) await afterLoad(client);
    await delay(650);
    const runtime = JSON.parse(await evaluate(
      client,
      `(() => JSON.stringify({
        width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
        text: document.body.innerText,
      }))()`,
    ));
    const capture = await client.send("Page.captureScreenshot", {
      format: "png", fromSurface: true, captureBeyondViewport: true,
    });
    const buffer = Buffer.from(capture.data, "base64");
    const filePath = path.join(outputDirectory, entry.expectedFilename);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return {
      id: entry.id,
      file: entry.expectedFilename,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      physical: pngDimensions(buffer),
      runtime,
    };
  });
}

async function runNativeLane(entries) {
  const settingsTarget = (await targets()).find((target) => target.url === "http://tauri.localhost/");
  if (!settingsTarget) throw new Error("QuotaArc Settings WebView2 target was not found");
  const results = [];
  for (const entry of entries) {
    await withTarget(settingsTarget, (client) =>
      evaluate(
        client,
        `(async () => {
          const invoke = window.__TAURI_INTERNALS__.invoke;
          await invoke("set_catalog_theme", { slug: ${JSON.stringify(entry.theme)}, scope: "surface:top" });
          await invoke("update_surface_settings", { patch: {
            topArcEnabled: true, topArcForm: ${JSON.stringify(entry.structure)},
            topArcAnchor: ${JSON.stringify(entry.anchor)}, topArcScale: 100,
            topArcClickThrough: false, topArcHideFullscreen: false,
          }});
          ${
            entry.devControl
              // Wave 1F §29-30: entries with a real Dev control use the
              // native Structure QA fixture (set_structure_qa_fixture,
              // surfaces/qa_fixture.rs) instead of the fixed 6-provider
              // demo-mode dataset -- refused by the backend itself
              // outside the Dev channel, so this only ever does anything
              // on a verified Dev build.
              ? `await invoke("set_structure_qa_fixture", { fixture: ${JSON.stringify(fixtureFromState(entry.fixtureState))} });`
              : `await invoke("set_surface_demo_mode", { enabled: true });`
          }
          await invoke("show_top_arc_surface");
        })()`,
      ),
    );
    await delay(900);
    const target = (await targets()).find((candidate) => candidate.url.includes("window=top-arc"));
    if (!target) throw new Error(`Missing top-arc WebView2 target for entry ${entry.id}`);
    results.push(await captureAt(target, entry));
    console.log(`${entry.id}: captured (native)`);
  }
  return results;
}

async function runFixtureLane(entries) {
  const results = [];
  for (const entry of entries) {
    const url = new URL(fixtureBaseUrl);
    url.searchParams.set("window", "demo");
    url.searchParams.set("gen", "reel");
    url.searchParams.set("form", entry.structure);
    url.searchParams.set("anchor", entry.anchor);
    url.searchParams.set("catalog", entry.theme);
    for (const [key, value] of parseFixtureState(entry.fixtureState)) {
      url.searchParams.set(key, value);
    }
    // Each fixture entry gets a fresh tab so state never leaks between
    // captures (no reliance on a reset button / navigation history).
    const created = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.toString())}`, { method: "PUT" })).json();
    const result = await captureAt(created, entry);
    await fetch(`http://127.0.0.1:${port}/json/close/${created.id}`, { method: "PUT" });
    results.push(result);
    console.log(`${entry.id}: captured (fixture)`);
  }
  return results;
}

/** Parses the manifest's free-text fixtureState (e.g. "count=70", "data=loading",
 * "rtl=1 (layout direction only ...)") into ReelPreview.tsx query params. Only
 * the leading key=value tokens are used; trailing prose is ignored. */
function parseFixtureState(fixtureState) {
  const pairs = [];
  for (const token of fixtureState.split(/[,;]/)) {
    const match = token.trim().match(/^(\w+)=(\S+)/);
    if (match) pairs.push([match[1], match[2]]);
  }
  return pairs;
}

/** Wave 1F §29-30: parses the manifest's fixtureState into a
 * surfaces/qa_fixture.rs::StructureQaFixture payload for the native lane
 * (distinct from parseFixtureState above, which targets the browser
 * lane's URL query params) -- fills sensible defaults for any field the
 * entry's fixtureState doesn't mention. */
function fixtureFromState(fixtureState) {
  const pairs = Object.fromEntries(parseFixtureState(fixtureState));
  return {
    providerCount: Number(pairs.providerCount ?? pairs.count ?? 6),
    nameLength: pairs.nameLength ?? "normal",
    resetLength: pairs.resetLength ?? "normal",
    windows: Number(pairs.windows ?? 1),
    dataState: pairs.dataState ?? pairs.data ?? "available",
    pinned: pairs.pinned === "1" || pairs.pinned === "true",
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = manifest.entries.filter((entry) => entry.lane === lane);
if (entries.length === 0) throw new Error(`No manifest entries for lane "${lane}"`);

await mkdir(outputDirectory, { recursive: true });
const captures = lane === "native" ? await runNativeLane(entries) : await runFixtureLane(entries);

const evidence = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  lane,
  pid,
  manifestPath: path.relative(process.cwd(), manifestPath),
  captures,
};
await writeFile(
  path.join(outputDirectory, `evidence-${lane}.json`),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
console.log(`Captured ${captures.length}/${entries.length} "${lane}" lane entries.`);
