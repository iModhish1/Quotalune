#!/usr/bin/env node
// Quotalis Dev-isolation preflight gate.
//
// Why this exists: Product V3's native validation session built a binary
// named QuotalisDev.exe WITHOUT the Rust `dev-channel` Cargo feature
// compiled in, then trusted the filename alone -- that binary silently
// resolved Personal's own data/settings paths and mutated them before the
// mistake was caught (see docs/validation/PRODUCT_V3_CHANNEL_INCIDENT.md).
// A filename or build-config check from the OUTSIDE cannot prove what a
// compiled binary will actually do; only asking the binary itself can.
//
// `main.rs` exposes a pure, side-effect-free `--print-channel` diagnostic:
// no logging init, no settings load, no registry/notification
// registration, no window -- just three lines of self-reported truth,
// printed and exited before any of that runs. This script invokes exactly
// that, and refuses to let a caller proceed to a real launch unless every
// invariant holds.
//
// Usage: node scripts/dev-preflight.mjs <path-to-exe>
// Exit 0 only if the binary is genuinely Dev-isolated. Exit 1 otherwise,
// with the specific reason -- never a silent pass.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { devIdentityError } from "./dev-identity.mjs";

const target = process.argv[2];

function fail(reason) {
  console.error(`[dev-preflight] FAIL: ${reason}`);
  process.exit(1);
}

if (!target) {
  fail("usage: node scripts/dev-preflight.mjs <path-to-exe>");
}
if (!existsSync(target)) {
  fail(`binary does not exist: ${target}`);
}

const exeName = path.basename(target);
if (exeName.toLowerCase() !== "quotalisdev.exe") {
  fail(`refusing to preflight a binary not named QuotalisDev.exe (got "${exeName}") -- ` +
    `Dev-only tooling must never target any other filename, Personal's included.`);
}

const result = spawnSync(target, ["--print-channel"], {
  encoding: "utf8",
  timeout: 10_000,
  windowsHide: true,
});

if (result.error) {
  fail(`could not execute binary: ${result.error.message}`);
}
if (result.status !== 0) {
  fail(
    `binary did not exit 0 for --print-channel (status=${result.status}). ` +
      "Either the binary predates this flag (rebuild it) or it refused an unsafe launch. " +
      `stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`,
  );
}

const identityError = devIdentityError(result.stdout);
if (identityError) fail(`${identityError}. Rebuild with BOTH dev-channel and tauri.dev.conf.json.`);

console.log(`[dev-preflight] PASS: ${target}`);
console.log(`  channel=dev  exe=QuotalisDev.exe  app_dir_name=QuotaArc-Dev  tauri_identifier=app.quotalis.desktop.dev`);
process.exit(0);
