#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const THEMES = [
  ["01-obsidian-orbit", "Obsidian Orbit"],
  ["02-aurora-bloom", "Aurora Bloom"],
  ["03-solar-ember", "Solar Ember"],
  ["04-porcelain-halo", "Porcelain Halo"],
  ["05-noir-constellation", "Noir Constellation"],
  ["06-halo-spine", "Halo Spine"],
  ["07-eclipse-dial", "Eclipse Dial"],
  ["08-prism-zenith", "Prism Zenith"],
  ["09-quantum-orchid", "Quantum Orchid"],
  ["10-celestial-ice", "Celestial Ice"],
  ["11-emerald-singularity", "Emerald Singularity"],
  ["12-crimson-nova", "Crimson Nova"],
  ["13-lunar-titanium", "Lunar Titanium"],
  ["14-sapphire-observatory", "Sapphire Observatory"],
  ["15-astral-dune", "Astral Dune"],
];

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}
const port = Number(argumentsMap.get("--port") ?? "9223");
const pid = Number(argumentsMap.get("--pid") ?? "0") || null;
const outputDirectory = path.resolve(
  argumentsMap.get("--out") ?? "docs/images/v9/native/themes",
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

async function findTaskbarTarget() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  const targets = await response.json();
  const target = targets.find((candidate) => candidate.url.includes("window=taskbar-arc"));
  if (!target) throw new Error("Native Taskbar Arc WebView2 target was not found");
  return target;
}

async function waitForTheme(client, slug) {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const current = await evaluate(
      client,
      `document.querySelector("[data-geometry]")?.getAttribute("data-theme") ?? null`,
    );
    if (current === slug) return;
    await delay(80);
  }
  throw new Error(`Taskbar did not settle on ${slug}`);
}

function pngDimensions(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("Capture was not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

await mkdir(outputDirectory, { recursive: true });
const target = await findTaskbarTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
const captures = [];
try {
  await client.send("Page.enable");
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll("button")].find((candidate) => candidate.getAttribute("aria-label") === "Expand quota instrument");
      if (button) button.click();
      return button ? "expanded" : "already-expanded";
    })()`,
  );
  await delay(650);

  for (const [slug, name] of THEMES) {
    await evaluate(
      client,
      `window.__TAURI_INTERNALS__.invoke("set_catalog_theme", { slug: ${JSON.stringify(slug)}, scope: "surface:taskbar" })`,
    );
    await waitForTheme(client, slug);
    await delay(360);

    const runtime = JSON.parse(await evaluate(
      client,
      `(() => {
        const stage = document.querySelector("[data-geometry]");
        return JSON.stringify({
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          theme: stage?.getAttribute("data-theme"),
          geometry: stage?.getAttribute("data-geometry"),
          state: stage?.getAttribute("data-state"),
          motion: stage?.getAttribute("data-motion"),
          text: document.body.innerText
        });
      })()`,
    ));
    if (runtime.theme !== slug || runtime.state !== "expanded") {
      throw new Error(`Invalid settled runtime for ${slug}: ${JSON.stringify(runtime)}`);
    }
    const capture = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    });
    const buffer = Buffer.from(capture.data, "base64");
    const fileName = `${slug}.png`;
    await writeFile(path.join(outputDirectory, fileName), buffer);
    captures.push({
      slug,
      name,
      file: fileName,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      physical: pngDimensions(buffer),
      runtime,
    });
    console.log(`${slug}: ${runtime.geometry} / ${runtime.motion}`);
  }
} finally {
  client.close();
}

const geometries = new Set(captures.map((capture) => capture.runtime.geometry));
const motions = new Set(captures.map((capture) => capture.runtime.motion));
const evidence = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  pid,
  executable: "target/debug/QuotalisDev.exe",
  runtime: "native Tauri Taskbar WebView2 at persisted surface scope",
  interaction: "set_catalog_theme IPC + settings-updated runtime reload",
  themeCount: captures.length,
  geometryCount: geometries.size,
  motionCount: motions.size,
  captures,
};
await writeFile(
  path.join(outputDirectory, "evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
console.log(`Captured ${captures.length} native themes, ${geometries.size} geometries, ${motions.size} motion characters.`);
