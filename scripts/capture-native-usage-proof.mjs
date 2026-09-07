#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const port = Number(args.get("--port") ?? "9223");
const pid = Number(args.get("--pid") ?? "0") || null;
const outputDirectory = path.resolve(
  args.get("--out") ?? "docs/images/v9/native/usage",
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
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
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

async function withPage(urlPredicate, action) {
  const target = (await targets()).find((candidate) => urlPredicate(candidate.url));
  if (!target) throw new Error("Required QuotaArc WebView2 target was not found");
  const client = new CdpClient(target.webSocketDebuggerUrl);
  try {
    return await action(client);
  } finally {
    client.close();
  }
}

const withSettings = (action) =>
  withPage((url) => url === "http://tauri.localhost/", action);
const withTaskbar = (action) =>
  withPage((url) => url.includes("window=taskbar-arc"), action);

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function settingsSnapshot() {
  const raw = await withSettings((client) =>
    evaluate(
      client,
      `(async () => {
        const snapshot = await window.__TAURI_INTERNALS__.invoke("get_settings_snapshot");
        return JSON.stringify({
          globalMode: snapshot.usageDisplayMode ?? "remaining",
          providerOverrides: snapshot.providerUsageOverrides ?? {}
        });
      })()`,
    ),
  );
  return JSON.parse(raw);
}

async function baseline() {
  await withSettings((client) =>
    evaluate(
      client,
      `window.__TAURI_INTERNALS__.invoke("set_usage_settings", {
        globalMode: "hybrid",
        providerOverrides: {}
      }).then(() => "ok")`,
    ),
  );
  await delay(350);
}

async function setUiConfig(globalMode, claudeOverride = "global") {
  await withSettings((client) =>
    evaluate(
      client,
      `(() => {
        const radio = document.querySelector(
          'input[name="global-usage-mode"][value="${globalMode}"]'
        );
        if (!radio) throw new Error("Global usage radio is missing");
        radio.click();
        return "clicked:${globalMode}";
      })()`,
    ),
  );
  await delay(450);

  await withSettings((client) =>
    evaluate(
      client,
      `(() => {
        const select = document.querySelector(
          'select[aria-label="Usage display mode for Claude"]'
        );
        if (!select) throw new Error("Claude override select is missing");
        const setValue = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value"
        ).set;
        setValue.call(select, "${claudeOverride}");
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return "changed:${claudeOverride}";
      })()`,
    ),
  );
  await delay(550);

  const expectedOverride = claudeOverride === "global" ? undefined : claudeOverride;
  const snapshot = await settingsSnapshot();
  if (snapshot.globalMode !== globalMode) {
    throw new Error(`UI failed to persist global ${globalMode}: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.providerOverrides.claude !== expectedOverride) {
    throw new Error(
      `UI failed to persist Claude ${claudeOverride}: ${JSON.stringify(snapshot)}`,
    );
  }
  return snapshot;
}

async function taskbarText() {
  return withTaskbar((client) => evaluate(client, "document.body.innerText"));
}

async function waitForTaskbar(expectedFragments) {
  const deadline = Date.now() + 7_000;
  let text = "";
  while (Date.now() < deadline) {
    text = await taskbarText();
    if (expectedFragments.every((fragment) => text.includes(fragment))) return text;
    await delay(150);
  }
  throw new Error(
    `Taskbar did not reach expected state ${JSON.stringify(expectedFragments)}:\n${text}`,
  );
}

async function ensureExpanded() {
  await withTaskbar((client) =>
    evaluate(
      client,
      `(() => {
        const expand = [...document.querySelectorAll("button")].find(
          (button) => button.getAttribute("aria-label") === "Expand quota instrument"
        );
        if (expand) expand.click();
        return expand ? "expanded" : "already-expanded";
      })()`,
    ),
  );
  await delay(450);
}

async function focusProvider(providerName) {
  await withTaskbar((client) =>
    evaluate(
      client,
      `(() => {
        const button = [...document.querySelectorAll("button")].find((candidate) =>
          candidate.getAttribute("aria-label")?.startsWith("${providerName}:")
        );
        if (!button) throw new Error("${providerName} taskbar node is missing");
        button.click();
        return button.getAttribute("aria-label");
      })()`,
    ),
  );
  await delay(250);
}

async function captureTaskbar(filePath) {
  const data = await withTaskbar(async (client) => {
    await client.send("Page.enable");
    const result = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    return result.data;
  });
  const buffer = Buffer.from(data, "base64");
  await writeFile(filePath, buffer);
  return {
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

const scenarios = [
  {
    id: "01-global-used",
    globalMode: "used",
    claudeOverride: "global",
    focus: "Claude",
    expected: ["73%", "21%", "58%", "–", "73 percent used"],
  },
  {
    id: "02-global-remaining",
    globalMode: "remaining",
    claudeOverride: "global",
    focus: "Claude",
    expected: ["27%", "79%", "42%", "–", "27 percent remaining"],
  },
  {
    id: "03-global-hybrid",
    globalMode: "hybrid",
    claudeOverride: "global",
    focus: "Claude",
    expected: ["73%", "21%", "58%", "27% REMAINING", "73 percent used"],
  },
  {
    id: "04-remaining-claude-used",
    globalMode: "remaining",
    claudeOverride: "used",
    focus: "Claude",
    expected: ["73%", "79%", "42%", "73 percent used"],
  },
  {
    id: "05-used-claude-remaining",
    globalMode: "used",
    claudeOverride: "remaining",
    focus: "Claude",
    expected: ["27%", "21%", "58%", "27 percent remaining"],
  },
  {
    id: "06-unavailable",
    globalMode: "remaining",
    claudeOverride: "global",
    focus: "DeepSeek",
    expected: ["DeepSeek", "–", "quota unavailable"],
  },
];

await mkdir(outputDirectory, { recursive: true });
await baseline();
await ensureExpanded();

const runtimeGeometry = JSON.parse(
  await withTaskbar((client) =>
    evaluate(
      client,
      `JSON.stringify({
        cssViewport: { width: innerWidth, height: innerHeight },
        devicePixelRatio,
        physicalCapture: {
          width: Math.round(innerWidth * devicePixelRatio),
          height: Math.round(innerHeight * devicePixelRatio)
        }
      })`,
    ),
  ),
);

const evidence = [];
for (const scenario of scenarios) {
  const snapshot = await setUiConfig(scenario.globalMode, scenario.claudeOverride);
  await ensureExpanded();
  await focusProvider(scenario.focus);
  const text = await waitForTaskbar(scenario.expected);
  const file = path.join(outputDirectory, `${scenario.id}.png`);
  const capture = await captureTaskbar(file);
  evidence.push({
    ...scenario,
    snapshot,
    taskbarText: text.split(/\r?\n/).filter(Boolean),
    screenshot: path.basename(file),
    ...capture,
  });
  console.log(`captured ${scenario.id}: ${capture.bytes} bytes`);
}

const manifest = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  source: {
    executable: "target/debug/QuotalisDev.exe",
    processId: pid,
    channel: "dev",
    proofMode: "settings:themes",
    fixture: ".local/proof/v9-providers.json",
    transport: "WebView2 DevTools attached to the native Tauri windows",
    interaction: "Settings radio/select DOM events; no renderer-state injection",
    runtimeGeometry,
  },
  fixtureContract: {
    codex: { used: 21, remaining: 79 },
    claude: { used: 73, remaining: 27 },
    gemini: { used: 58, remaining: 42 },
    deepseek: { unavailable: true },
  },
  scenarios: evidence,
};

await writeFile(
  path.join(outputDirectory, "evidence.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(`wrote ${path.join(outputDirectory, "evidence.json")}`);
