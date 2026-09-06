#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const port = Number(args.get("--port") ?? "9223");
const output = path.resolve(
  args.get("--out") ?? ".local/proof/settings-reopen/evidence.json",
);

class CdpClient {
  constructor(url) {
    this.id = 1;
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
    const id = this.id++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }
  close() {
    this.socket.close();
  }
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  return response.json();
}

async function connect(target) {
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  return client;
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime.evaluate failed",
    );
  }
  return result.result.value;
}

async function invoke(client, command, payload = {}) {
  return evaluate(
    client,
    `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(payload)})`,
  );
}

function mainTarget(all) {
  const candidates = all.filter(
    (target) =>
      target.type === "page" &&
      /^http:\/\/(?:tauri\.localhost|localhost:\d+)\/?(?:index\.html)?$/.test(
        target.url,
      ),
  );
  if (candidates.length !== 1) {
    throw new Error(`Expected one main target, found ${candidates.length}`);
  }
  return candidates[0];
}

function detachedTarget(all) {
  const candidates = all.filter(
    (target) =>
      target.type === "page" && /[?&]window=settings(?:&|$)/.test(target.url),
  );
  if (candidates.length !== 1) {
    throw new Error(`Expected one detached Settings target, found ${candidates.length}`);
  }
  return candidates[0];
}

async function windowState(client) {
  const raw = await evaluate(
    client,
    `Promise.all([
      window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible',{label:'settings'}),
      window.__TAURI_INTERNALS__.invoke('plugin:window|outer_position',{label:'settings'}),
      window.__TAURI_INTERNALS__.invoke('plugin:window|outer_size',{label:'settings'}),
      window.__TAURI_INTERNALS__.invoke('plugin:window|inner_size',{label:'settings'}),
      window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized',{label:'settings'}),
      window.__TAURI_INTERNALS__.invoke('plugin:window|is_resizable',{label:'settings'}),
      window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximizable',{label:'settings'}),
    ]).then(([visible,position,outerSize,innerSize,maximized,resizable,maximizable]) =>
      JSON.stringify({visible,position,outerSize,innerSize,maximized,resizable,maximizable,
        activeTab:document.querySelector('.settings-body')?.dataset.tab ?? null}))`,
  );
  return JSON.parse(raw);
}

const main = await connect(mainTarget(await targets()));
let detached;
try {
  await invoke(main, "open_settings_window", { tab: "general" });
  await delay(500);
  detached = await connect(detachedTarget(await targets()));
  const before = await windowState(detached);
  if (!before.visible) throw new Error("Detached Settings did not become visible");

  await invoke(detached, "close_settings_window");
  await delay(350);
  const hidden = await windowState(detached);
  if (hidden.visible) throw new Error("Detached Settings did not hide on close");

  await invoke(main, "open_settings_window", { tab: "advanced" });
  await delay(500);
  const after = await windowState(detached);

  const sameBounds =
    before.position.x === after.position.x &&
    before.position.y === after.position.y &&
    before.outerSize.width === after.outerSize.width &&
    before.outerSize.height === after.outerSize.height;
  const passed =
    after.visible &&
    after.resizable &&
    after.maximizable &&
    !after.maximized &&
    after.activeTab === "advanced" &&
    sameBounds;

  const evidence = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    transport: "WebView2 DevTools invoking the native Tauri window API",
    before,
    hidden,
    after,
    sameBounds,
    passed,
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (!passed) throw new Error(`Settings reopen gate failed: ${JSON.stringify(evidence)}`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  detached?.close();
  main.close();
}
