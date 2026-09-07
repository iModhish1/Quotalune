#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { findTextCollisions } from "./text-collision.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const port = Number(args.get("--port") ?? "9223");
const pid = Number(args.get("--pid") ?? "0") || null;
const requestedTheme = args.get("--theme") ?? null;
const hasRequestedScroll = args.has("--scroll");
const requestedScroll = Math.max(0, Number(args.get("--scroll") ?? "0") || 0);
const requestedProvider = args.get("--provider") ?? null;
const requestedNavigation = args.get("--navigation") ?? null;
const requestedWindowState = args.get("--window-state") ?? null;
const requestedLanguage = args.get("--language") ?? null;
const requestedPreviewState = args.get("--preview-state") ?? null;
if (requestedWindowState && !["restored", "maximized", "fullscreen"].includes(requestedWindowState)) {
  throw new Error(`Unsupported window state '${requestedWindowState}'`);
}
if (requestedNavigation && !["side", "top", "bottom"].includes(requestedNavigation)) {
  throw new Error(`Unsupported navigation '${requestedNavigation}'`);
}
const navigationStorageKey = "quotaarc.settings.navigation.v1";
if (requestedTheme && !["dark", "light"].includes(requestedTheme)) {
  throw new Error(`Unsupported theme '${requestedTheme}'`);
}
if (requestedPreviewState && !["normal", "warning", "critical", "exhausted"].includes(requestedPreviewState)) {
  throw new Error(`Unsupported preview state '${requestedPreviewState}'`);
}
const outputDirectory = path.resolve(
  args.get("--out") ?? "docs/images/native/settings-tabs",
);

const allTabs = [
  "general",
  "providers",
  "providerDisplay",
  "notifications",
  "menuBar",
  "menu",
  "usageSpend",
  "surfaces",
  "themes",
  "advanced",
  "about",
];
const tabs = args.get("--tabs")?.split(",").filter(Boolean) ?? allTabs;
for (const tab of tabs) {
  if (!allTabs.includes(tab)) throw new Error(`Unsupported settings tab '${tab}'`);
}

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

async function settingsTarget() {
  const response = await fetch(`http://127.0.0.1:${port}/json`);
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  const targets = await response.json();
  // Settings now opens as its own detached window (?window=settings) rather
  // than replacing the main index.html content; prefer that when present so
  // this script keeps working across that architecture change, and fall
  // back to the bare index target for the older single-window shape.
  const pages = targets.filter((target) => target.type === "page");
  const detached = pages.filter((target) =>
    /[?&]window=settings(?:&|$)/.test(target.url),
  );
  const candidates =
    detached.length > 0
      ? detached
      : pages.filter((target) =>
          /^http:\/\/(?:tauri\.localhost|localhost:\d+)\/?(?:index\.html)?$/.test(
            target.url,
          ),
        );
  if (candidates.length !== 1) {
    throw new Error(
      `Expected one Settings WebView2 target, found ${candidates.length}: ${JSON.stringify(
        targets.map(({ title, type, url }) => ({ title, type, url })),
      )}`,
    );
  }
  return candidates[0];
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
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

async function waitForSettings(client) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(
      client,
      `Boolean(document.querySelector('.settings.settings-studio'))`,
    );
    if (ready) return;
    await delay(100);
  }
  throw new Error("Settings shell did not become ready");
}

async function selectTab(client, tab) {
  const selected = await evaluate(
    client,
    `(() => {
      const button = document.querySelector(${JSON.stringify(`#settings-tab-${tab}`)});
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    })()`,
  );
  if (!selected) throw new Error(`Settings tab '${tab}' is missing`);
  await delay(300);
  const active = await evaluate(
    client,
    `document.querySelector('.settings-body')?.dataset.tab ?? null`,
  );
  if (active !== tab) throw new Error(`Settings tab '${tab}' did not activate`);
}

async function measure(client, tab) {
  const raw = await evaluate(
    client,
    `JSON.stringify((() => {
      const shell = document.querySelector('.settings.settings-studio');
      const body = document.querySelector('.settings-body');
      const navigation = document.querySelector('.settings-tabs');
      const windowActionButtons = [...document.querySelectorAll('.settings-fullscreen')];
      const windowActions = windowActionButtons.map(node=>node.textContent?.trim()??'');
      const windowState = {
        maximized: windowActionButtons.find(node=>node.dataset.windowAction==='maximize')?.dataset.active==='true',
        fullscreen: windowActionButtons.find(node=>node.dataset.windowAction==='fullscreen')?.dataset.active==='true',
      };
      const activeNavigationTab = navigation?.querySelector('[role="tab"][aria-selected="true"]');
      const viewport = { width: innerWidth, height: innerHeight, devicePixelRatio };
      const rect = (node) => {
        const value = node?.getBoundingClientRect();
        return value ? {
          x: Math.round(value.x), y: Math.round(value.y),
          width: Math.round(value.width), height: Math.round(value.height),
          right: Math.round(value.right), bottom: Math.round(value.bottom),
        } : null;
      };
      const bodyRect = body?.getBoundingClientRect();
      const offenders = bodyRect ? [...body.querySelectorAll('*')]
        .filter((node) => {
          const style = getComputedStyle(node);
          if (style.position === 'fixed') return false;
          const value = node.getBoundingClientRect();
          return value.right > bodyRect.right + 1 || value.left < bodyRect.left - 1;
        })
        .slice(0, 20)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className : '',
          rect: rect(node),
        })) : [];
      const internalHorizontalOverflow = body
        ? [...body.querySelectorAll('.provider-detail, .provider-detail-overview, .provider-detail-workspace')]
          .filter((node) => node.scrollWidth > node.clientWidth + 1)
          .map((node) => ({
            className: typeof node.className === 'string' ? node.className : '',
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
          }))
        : [];
      const textRects = [];
      if (body) {
        const visibleTextRect = (value, element) => {
          let left = Math.max(value.left, 0);
          let top = Math.max(value.top, 0);
          let right = Math.min(value.right, innerWidth);
          let bottom = Math.min(value.bottom, innerHeight);
          for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
            const ancestorStyle = getComputedStyle(ancestor);
            const ancestorRect = ancestor.getBoundingClientRect();
            if (/hidden|clip|auto|scroll/.test(ancestorStyle.overflowX)) {
              left = Math.max(left, ancestorRect.left);
              right = Math.min(right, ancestorRect.right);
            }
            if (/hidden|clip|auto|scroll/.test(ancestorStyle.overflowY)) {
              top = Math.max(top, ancestorRect.top);
              bottom = Math.min(bottom, ancestorRect.bottom);
            }
            if (ancestor === body) break;
          }
          if (right - left <= 0.5 || bottom - top <= 0.5) return null;
          const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
          if (!hit || !(hit === element || element.contains(hit) || hit.contains(element))) return null;
          return { left, top, right, bottom };
        };
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        let textNode;
        let sourceIndex = 0;
        while ((textNode = walker.nextNode())) {
          const label = textNode.textContent?.replace(/\s+/g, ' ').trim();
          const element = textNode.parentElement;
          if (!label || !element || element.closest('[aria-hidden="true"], [hidden], [inert], .sr-only, .visually-hidden')) continue;
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
          const group = element.closest('.settings-tabs') ? 'navigation' : 'body';
          const source = 'text-' + sourceIndex++;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          for (const value of range.getClientRects()) {
            if (value.width <= 0 || value.height <= 0) continue;
            const visibleRect = visibleTextRect(value, element);
            if (!visibleRect) continue;
            textRects.push({
              label: label.slice(0, 96),
              source,
              group,
              rect: visibleRect,
            });
          }
          range.detach();
        }
      }
      return {
        tab: ${JSON.stringify(tab)},
        title: document.querySelector('.settings-shell-brand h1')?.textContent?.trim() ?? '',
        viewport,
        windowActions,
        windowState,
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
        },
        shell: rect(shell),
        navigation: {
          rect: rect(navigation),
          activeRect: rect(activeNavigationTab),
          clientWidth: navigation?.clientWidth ?? 0,
          scrollWidth: navigation?.scrollWidth ?? 0,
          scrollLeft: navigation?.scrollLeft ?? 0,
          clientHeight: navigation?.clientHeight ?? 0,
          scrollHeight: navigation?.scrollHeight ?? 0,
          activeFullyVisible: Boolean(navigation && activeNavigationTab && (() => {
            const navRect = navigation.getBoundingClientRect();
            const activeRect = activeNavigationTab.getBoundingClientRect();
            return activeRect.left >= navRect.left - 1 && activeRect.right <= navRect.right + 1;
          })()),
        },
        body: {
          rect: rect(body),
          clientWidth: body?.clientWidth ?? 0,
          scrollWidth: body?.scrollWidth ?? 0,
          clientHeight: body?.clientHeight ?? 0,
          scrollHeight: body?.scrollHeight ?? 0,
          scrollLeft: body?.scrollLeft ?? 0,
          scrollTop: body?.scrollTop ?? 0,
          gridTemplateColumns: body ? getComputedStyle(body).gridTemplateColumns : '',
        },
        sectionCount: body?.querySelectorAll('.settings-section').length ?? 0,
        sectionMetrics: body ? [...body.children].map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: typeof node.className === 'string' ? node.className : '',
          rect: rect(node),
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
        })) : [],
        controlCount: body?.querySelectorAll('button, input, select, textarea').length ?? 0,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || (body?.scrollWidth ?? 0) > (body?.clientWidth ?? 0) + 1,
        internalHorizontalOverflow,
        textRects,
        offenders,
      };
    })())`,
  );
  const metrics = JSON.parse(raw);
  metrics.textCollisions = findTextCollisions(metrics.textRects, 1);
  delete metrics.textRects;
  return metrics;
}

async function capture(client, file) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const buffer = Buffer.from(result.data, "base64");
  await writeFile(file, buffer);
  return {
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

await mkdir(outputDirectory, { recursive: true });
const target = await settingsTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
const evidence = [];
let originalTheme = null;
let originalNavigation = null;
let originalWindowState = null;
let originalLanguage = null;

async function readWindowState() {
  return evaluate(client, `(() => { const buttons=[...document.querySelectorAll('.settings-fullscreen')]; return {labels:buttons.map(node=>node.textContent?.trim()??''),maximized:buttons.find(node=>node.dataset.windowAction==='maximize')?.dataset.active==='true',fullscreen:buttons.find(node=>node.dataset.windowAction==='fullscreen')?.dataset.active==='true',width:innerWidth,height:innerHeight}; })()`);
}

async function ensureWindowState(state) {
  let current=await readWindowState();
  const click=async index=>{
    const clicked=await evaluate(client, `(() => { const button=document.querySelectorAll('.settings-fullscreen')[${index}]; if(!(button instanceof HTMLButtonElement))return false; button.click(); return true; })()`);
    if(!clicked)throw new Error(`Native window action ${index} is unavailable`);
    await delay(900);
    current=await readWindowState();
  };
  if(state!=="fullscreen" && current.fullscreen)await click(1);
  if(state==="restored" && current.maximized)await click(0);
  if(state==="maximized" && !current.maximized)await click(0);
  if(state==="fullscreen" && !current.fullscreen)await click(1);
  return current;
}

async function selectLanguage(language) {
  await selectTab(client,"general");
  const result=await evaluate(client, `(() => { const wanted=${JSON.stringify(language)}; const select=[...document.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value===wanted)); if(!(select instanceof HTMLSelectElement))return null; const previous=select.value; if(previous!==wanted){select.value=wanted;select.dispatchEvent(new Event('change',{bubbles:true}));} return previous; })()`);
  if(result==null)throw new Error(`Language '${language}' is unavailable`);
  await delay(1200);
  return result;
}

try {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await waitForSettings(client);
  originalWindowState = await readWindowState();
  if (requestedWindowState) await ensureWindowState(requestedWindowState);
  if (requestedLanguage) originalLanguage=await selectLanguage(requestedLanguage);
  originalNavigation = await evaluate(
    client,
    `localStorage.getItem(${JSON.stringify(navigationStorageKey)})`,
  );
  if (requestedNavigation) {
    await evaluate(
      client,
      `localStorage.setItem(${JSON.stringify(navigationStorageKey)}, ${JSON.stringify(requestedNavigation)})`,
    );
    await client.send("Page.reload", { ignoreCache: true });
    await waitForSettings(client);
    const appliedNavigation = await evaluate(
      client,
      `document.querySelector('.settings.settings-studio')?.dataset.navigation ?? null`,
    );
    if (appliedNavigation !== requestedNavigation) {
      throw new Error(`Navigation '${requestedNavigation}' did not apply after reload`);
    }
  }
  originalTheme = await evaluate(
    client,
    `document.documentElement.dataset.theme ?? null`,
  );
  if (requestedTheme) {
    await evaluate(
      client,
      `(() => {
        document.documentElement.dataset.theme = ${JSON.stringify(requestedTheme)};
        document.documentElement.style.colorScheme = ${JSON.stringify(requestedTheme)};
      })()`,
    );
  }

  for (const tab of tabs) {
    await selectTab(client, tab);
    if(requestedPreviewState && tab==="providerDisplay"){
      const applied=await evaluate(client,`(() => { const wanted=${JSON.stringify(requestedPreviewState)}; const select=[...document.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value==='exhausted')&&[...node.options].some(option=>option.value===wanted)); if(!(select instanceof HTMLSelectElement))return false; select.value=wanted; select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
      if(!applied)throw new Error(`Provider preview state '${requestedPreviewState}' is unavailable`);
      await delay(100);
    }
    if (requestedProvider && tab === "providerDisplay") {
      const rulesOpened=await evaluate(client,`(() => { const button=document.querySelectorAll('.provider-display-page__switcher button')[1]; if(!(button instanceof HTMLButtonElement))return false; button.click(); return true; })()`);
      if(!rulesOpened)throw new Error("Provider display rules view is unavailable");
      await delay(100);
      const opened = await evaluate(
        client,
        `(() => {
          const wanted=${JSON.stringify(requestedProvider)}.toLocaleLowerCase();
          const disclosure=[...document.querySelectorAll('.usage-display__provider-details')]
            .find(node=>node.querySelector('summary span')?.textContent?.toLocaleLowerCase().includes(wanted));
          if (!(disclosure instanceof HTMLDetailsElement)) return false;
          disclosure.open=true;
          disclosure.scrollIntoView({block:'center'});
          return true;
        })()`,
      );
      if (!opened) throw new Error(`Provider disclosure '${requestedProvider}' is missing`);
      await delay(100);
    }
    if (hasRequestedScroll || !requestedProvider) {
      await evaluate(
        client,
        `(() => {
          const body=document.querySelector('.settings-body');
          if(!body)return [];
          const scrollables=[body,...body.querySelectorAll('*')].filter(node=>{
            const style=getComputedStyle(node);
            return node.scrollHeight>node.clientHeight+1 && /auto|scroll/.test(style.overflowY);
          });
          for(const node of scrollables)node.scrollTop=${requestedScroll};
          return scrollables.map(node=>({className:typeof node.className==='string'?node.className:'',scrollTop:node.scrollTop}));
        })()`,
      );
    }
    await delay(100);
    const metrics = await measure(client, tab);
    const screenshot = `${String(evidence.length + 1).padStart(2, "0")}-${tab}.png`;
    const captureResult = await capture(client, path.join(outputDirectory, screenshot));
    evidence.push({ ...metrics, screenshot, ...captureResult });
    console.log(
      `${tab}: ${metrics.viewport.width}x${metrics.viewport.height}, ` +
        `body ${metrics.body.clientWidth}x${metrics.body.clientHeight}, ` +
        `scroll ${metrics.body.scrollWidth}x${metrics.body.scrollHeight}, ` +
        `overflow=${metrics.horizontalOverflow}`,
    );
  }
} finally {
  if (requestedWindowState && originalWindowState) {
    const originalState=originalWindowState.fullscreen?"fullscreen":originalWindowState.maximized?"maximized":"restored";
    await ensureWindowState(originalState).catch(() => {});
  }
  if (requestedNavigation) {
    await evaluate(
      client,
      `(() => {
        const key=${JSON.stringify(navigationStorageKey)};
        const original=${JSON.stringify(originalNavigation)};
        if (original == null) localStorage.removeItem(key);
        else localStorage.setItem(key, original);
      })()`,
    ).catch(() => {});
    await client.send("Page.reload", { ignoreCache: true }).catch(() => {});
    await waitForSettings(client).catch(() => {});
  }
  if (requestedTheme) {
    await evaluate(
      client,
      `(() => {
        const original = ${JSON.stringify(originalTheme)};
        if (original) document.documentElement.dataset.theme = original;
        else delete document.documentElement.dataset.theme;
        document.documentElement.style.colorScheme = original || '';
      })()`,
    ).catch(() => {});
  }
  if (requestedLanguage && originalLanguage) {
    await selectLanguage(originalLanguage).catch(() => {});
  }
  client.close();
}

const failures = evidence.filter(
  (entry) =>
    entry.horizontalOverflow ||
    !entry.shell ||
    !entry.body.rect ||
    entry.body.rect.width <= 0 ||
    entry.body.rect.height <= 0,
);
const densityFailures = evidence
  .filter(
    (entry) =>
      (entry.viewport.width >= 900 && entry.tab === "advanced") ||
      (entry.viewport.width >= 1180 && ["general", "notifications"].includes(entry.tab)),
  )
  .filter((entry) => entry.body.gridTemplateColumns.trim().split(/\s+/).length < 2)
  .map((entry) => entry.tab);
const internalOverflowFailures = evidence
  .filter((entry) => entry.internalHorizontalOverflow.length > 0)
  .map((entry) => entry.tab);
const textCollisionFailures = evidence
  .filter((entry) => entry.textCollisions.length > 0)
  .map((entry) => entry.tab);
const navigationFailures = requestedNavigation && requestedNavigation !== "side"
  ? evidence
      .filter((entry) => !entry.navigation.rect || entry.navigation.rect.height > 72 || !entry.navigation.activeFullyVisible)
      .map((entry) => entry.tab)
  : [];
const viewportFailures=evidence.length===0?[]:evidence
  .filter(entry=>entry.viewport.width!==evidence[0].viewport.width||entry.viewport.height!==evidence[0].viewport.height)
  .map(entry=>entry.tab);
const windowStateFailures=requestedWindowState?evidence.filter(entry=>{
  if(requestedWindowState==="fullscreen")return !entry.windowState.fullscreen;
  if(requestedWindowState==="maximized")return !entry.windowState.maximized;
  return entry.windowState.maximized||entry.windowState.fullscreen;
}).map(entry=>entry.tab):[];

const manifest = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  source: {
    executable: "target/debug/Quotalis.exe",
    processId: pid,
    proofMode: "settings:general",
    appearance: requestedTheme ?? originalTheme ?? "unresolved",
    navigation: requestedNavigation ?? "persisted",
    windowState: requestedWindowState ?? "persisted",
    language: requestedLanguage ?? "persisted",
    previewState: requestedPreviewState ?? "normal",
    originalViewport: originalWindowState?{width:originalWindowState.width,height:originalWindowState.height}:null,
    transport: "WebView2 DevTools attached to the native Tauri Settings window",
    target: { title: target.title, url: target.url },
  },
  acceptance: {
    tabCount: evidence.length,
    expectedTabCount: tabs.length,
    horizontalOverflowFailures: failures.map((entry) => entry.tab),
    internalOverflowFailures,
    textCollisionFailures,
    densityFailures,
    navigationFailures,
    viewportFailures,
    windowStateFailures,
    passed:
      evidence.length === tabs.length &&
      failures.length === 0 &&
      internalOverflowFailures.length === 0 &&
      textCollisionFailures.length === 0 &&
      densityFailures.length === 0 &&
      navigationFailures.length === 0 &&
      viewportFailures.length === 0 &&
      windowStateFailures.length === 0,
  },
  tabs: evidence,
};

await writeFile(
  path.join(outputDirectory, "evidence.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

if (!manifest.acceptance.passed) {
  throw new Error(`Settings capture gate failed: ${JSON.stringify(manifest.acceptance)}`);
}

console.log(`wrote ${path.join(outputDirectory, "evidence.json")}`);
