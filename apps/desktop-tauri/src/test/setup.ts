import "@testing-library/jest-dom/vitest";


// ── Tauri runtime stub (jsdom has no __TAURI_INTERNALS__) ────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;
if (!w.__TAURI_INTERNALS__) {
  const callbacks = new Map<number, (result: unknown) => void>();
  let nextId = 1;
  w.__TAURI_INTERNALS__ = {
    transformCallback: (callback: (result: unknown) => void, once?: boolean) => {
      const id = nextId++;
      callbacks.set(id, (result) => {
        callbacks.delete(id);
        callback(result);
      });
      return id;
    },
    invoke: () => Promise.resolve(),
    metadata: { currentWindow: { label: "test" }, currentWebview: { label: "test" } },
  };
}
