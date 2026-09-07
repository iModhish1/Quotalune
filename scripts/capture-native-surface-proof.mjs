#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}

const port = Number(argumentsMap.get("--port") ?? "9223");
const pid = Number(argumentsMap.get("--pid") ?? "0") || null;
const theme = argumentsMap.get("--theme") ?? "10-celestial-ice";
const outputDirectory = path.resolve(
  argumentsMap.get("--out") ?? "docs/images/v9/native/surfaces",
);

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

async function configureSurfaces() {
  const settingsTarget = (await targets()).find((target) => target.url === "http://tauri.localhost/");
  if (!settingsTarget) throw new Error("QuotaArc Settings WebView2 target was not found");
  return withTarget(settingsTarget, (client) =>
    evaluate(
      client,
      `(async () => {
        const invoke = window.__TAURI_INTERNALS__.invoke;
        const outcomes = {};
        const run = async (key, command = key, args = {}) => {
          try { outcomes[key] = { status: "fulfilled", value: await invoke(command, args) }; }
          catch (error) { outcomes[key] = { status: "rejected", reason: String(error) }; }
        };
        await run("set_catalog_theme_taskbar", "set_catalog_theme", { slug: ${JSON.stringify(theme)}, scope: "surface:taskbar" });
        await run("set_catalog_theme_top", "set_catalog_theme", { slug: ${JSON.stringify(theme)}, scope: "surface:top" });
        await run("set_catalog_theme_edge", "set_catalog_theme", { slug: ${JSON.stringify(theme)}, scope: "surface:edge" });
        await run("update_surface_settings", "update_surface_settings", { patch: {
          taskbarArcEnabled: true, taskbarArcOpacity: 100, taskbarArcClickThrough: false, taskbarArcHideFullscreen: false,
          topArcEnabled: true, topArcOpacity: 100, topArcScale: 100, topArcClickThrough: false, topArcHideFullscreen: false,
          edgeArcEnabled: true, edgeArcSide: "right", edgeArcOpacity: 100, edgeArcScale: 100, edgeArcClickThrough: false, edgeArcHideFullscreen: false
        }});
        await run("show_taskbar_arc_surface");
        await run("show_top_arc_surface");
        await run("show_edge_arc_surface");
        await run("get_surface_settings");
        return JSON.stringify(outcomes);
      })()`,
    ),
  );
}

function pngDimensions(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("Capture was not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function captureSurface(definition, target) {
  return withTarget(target, async (client) => {
    await client.send("Page.enable");
    await evaluate(
      client,
      `(() => {
        const labels = ${JSON.stringify(definition.expandLabels)};
        const button = [...document.querySelectorAll("button")].find((candidate) => labels.includes(candidate.getAttribute("aria-label")));
        if (button) button.click();
        return button?.getAttribute("aria-label") ?? "already-expanded";
      })()`,
    );
    await delay(650);
    const runtime = JSON.parse(await evaluate(
      client,
      `(() => {
        const stage = document.querySelector("[data-geometry]");
        return JSON.stringify({
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          text: document.body.innerText,
          theme: stage?.getAttribute("data-theme"),
          geometry: stage?.getAttribute("data-geometry"),
          state: stage?.getAttribute("data-state"),
          motion: stage?.getAttribute("data-motion")
        });
      })()`,
    ));
    const capture = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    });
    const buffer = Buffer.from(capture.data, "base64");
    const fileName = `${definition.id}-${theme}.png`;
    const filePath = path.join(outputDirectory, fileName);
    await writeFile(filePath, buffer);
    return {
      id: definition.id,
      targetUrl: target.url,
      file: fileName,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      physical: pngDimensions(buffer),
      runtime,
    };
  });
}

await mkdir(outputDirectory, { recursive: true });
const configuration = JSON.parse(await configureSurfaces());
await delay(1_500);

const definitions = [
  { id: "taskbar", token: "window=taskbar-arc", expandLabels: ["Expand quota instrument"] },
  { id: "top", token: "window=top-arc", expandLabels: ["Expand top orbital notch"] },
  { id: "edge", token: "window=edge-arc", expandLabels: ["Expand right edge orbit"] },
];
const availableTargets = await targets();
const captures = [];
for (const definition of definitions) {
  const target = availableTargets.find((candidate) => candidate.url.includes(definition.token));
  if (!target) {
    throw new Error(
      `Missing ${definition.id} WebView2 target. Configuration outcomes: ${JSON.stringify(configuration)}`,
    );
  }
  captures.push(await captureSurface(definition, target));
}

const evidence = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  pid,
  executable: "target/debug/QuotalisDev.exe",
  runtime: "fresh native Tauri WebView2 compositor",
  theme,
  configuration,
  captures,
};
await writeFile(
  path.join(outputDirectory, "evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(evidence, null, 2));
