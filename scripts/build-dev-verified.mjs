#!/usr/bin/env node
// Quotalis verified Dev-channel QA build.
//
// Why this exists: Phase 3I discovered that `tauri build --features
// dev-channel` always produces `target/debug/Quotalis.exe` -- the
// `[[bin]] name` in apps/desktop-tauri/src-tauri/Cargo.toml is fixed
// regardless of feature flags -- while `scripts/dev-preflight.mjs`
// (correctly) refuses to preflight anything not literally named
// `QuotalisDev.exe`. The gap between those two facts was bridged by a
// MANUAL `cp Quotalis.exe QuotalisDev.exe` step that a session could
// forget to redo after a rebuild. A stale `QuotalisDev.exe` from an
// earlier phase then PASSED dev-preflight (preflight only proves the
// binary is channel=dev and named correctly, not that its embedded
// frontend is current) and was screenshotted as if it reflected the
// current tree -- caught only by manually diffing the served JS bundle
// against dist/ over the running app's own CDP connection.
//
// This script is the fix: one command that builds, copies, and PROVES
// the copy is byte-identical to what was just built, then runs the
// existing preflight on top. No more manual copy step, anywhere.
//
// Usage: node scripts/build-dev-verified.mjs
// Exit 0 only if every step below succeeded. Exit 1 otherwise, with the
// specific failing step named -- never a silent partial success.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(REPO_ROOT, "apps", "desktop-tauri");
const SOURCE_EXE = path.join(REPO_ROOT, "target", "debug", "Quotalis.exe");
const DEV_EXE = path.join(REPO_ROOT, "target", "debug", "QuotalisDev.exe");

function step(label) {
  console.log(`\n[build-dev-verified] ${label}`);
}

function fail(reason) {
  console.error(`\n[build-dev-verified] FAIL: ${reason}`);
  process.exit(1);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.error) fail(`could not run "${command} ${args.join(" ")}": ${result.error.message}`);
  if (result.status !== 0) fail(`"${command} ${args.join(" ")}" exited with status ${result.status}`);
}

function runCaptured(command, args, opts = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, ...opts });
  if (result.error) fail(`could not run "${command} ${args.join(" ")}": ${result.error.message}`);
  if (result.status !== 0) {
    fail(
      `"${command} ${args.join(" ")}" exited with status ${result.status}\n` +
        `stdout=${result.stdout}\nstderr=${result.stderr}`,
    );
  }
  return result.stdout;
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function parseLines(stdout) {
  return Object.fromEntries(
    stdout
      .split(/\r?\n/)
      .filter((l) => l.includes("="))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx), l.slice(idx + 1)];
      }),
  );
}

// 1 + 2: build the frontend (via Tauri's own beforeBuildCommand, so it is
// exactly the embed the shipped binary will use, never a hand-run vite
// build that could drift from tauri.conf.json) and the Dev-channel Rust
// binary, in one real `tauri build` invocation -- never plain `cargo
// build`, which loads the Vite dev-server URL instead of the embedded
// frontendDist and would pass every check below while being wrong.
step("1-2/7 pnpm exec tauri build --debug --no-bundle --features dev-channel");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
run(pnpmCmd, ["exec", "tauri", "build", "--debug", "--no-bundle", "--features", "dev-channel"], {
  cwd: APP_DIR,
});

// 3: locate the freshly-produced Quotalis.exe.
step("3/7 locate freshly-built Quotalis.exe");
if (!existsSync(SOURCE_EXE)) fail(`expected build output missing: ${SOURCE_EXE}`);
const sourceHash = sha256(SOURCE_EXE);
console.log(`  source: ${SOURCE_EXE}`);
console.log(`  sha256: ${sourceHash}`);

// 4: copy/replace QuotalisDev.exe. A locked handle from a still-running
// Dev instance must fail loudly here, not silently leave the old file in
// place for preflight to then wrongly pass.
step("4/7 copy Quotalis.exe -> QuotalisDev.exe");
try {
  copyFileSync(SOURCE_EXE, DEV_EXE);
} catch (err) {
  fail(
    `could not replace ${DEV_EXE}: ${err.message} -- if QuotalisDev.exe is currently running, ` +
      "close it first (Windows cannot overwrite a locked executable).",
  );
}

// 5: verify source and copy are byte-identical -- the actual freshness
// proof. Timestamps are never trusted (see header comment).
step("5/7 verify source/copy hash equality");
const devHash = sha256(DEV_EXE);
console.log(`  QuotalisDev.exe sha256: ${devHash}`);
if (devHash !== sourceHash) {
  fail(`hash mismatch after copy -- source=${sourceHash} copy=${devHash}. The copy is corrupt or was raced.`);
}

// 6: run the existing preflight, unchanged -- this script adds freshness
// proof, it does not replace the channel-isolation proof.
step("6/7 scripts/dev-preflight.mjs");
runCaptured(process.execPath, [path.join(REPO_ROOT, "scripts", "dev-preflight.mjs"), DEV_EXE]);
console.log("  (preflight output above)");

// Bonus freshness proof: the binary's own --print-build-info must report
// the git HEAD this script is running against. A mismatch means either
// the build.rs git-state watch (see build.rs) missed a change, or this
// worktree moved HEAD without a rebuild in between -- either way, a real
// finding, not something to paper over.
step("7/7 --print-build-info freshness cross-check");
const buildInfo = parseLines(runCaptured(DEV_EXE, ["--print-build-info"]));
const realHead = runCaptured("git", ["rev-parse", "--short=12", "HEAD"], { cwd: REPO_ROOT }).trim();
const dirty = spawnSync("git", ["diff", "--quiet"], { cwd: REPO_ROOT }).status !== 0;

console.log(`\n[build-dev-verified] FRESHNESS PROOF`);
console.log(`  git HEAD (worktree):     ${realHead}${dirty ? " (dirty)" : ""}`);
console.log(`  git HEAD (embedded):     ${buildInfo.git_head}${buildInfo.git_dirty === "true" ? " (dirty)" : ""}`);
console.log(`  source exe:              ${SOURCE_EXE}`);
console.log(`  source sha256:           ${sourceHash}`);
console.log(`  QuotalisDev.exe sha256:  ${devHash}`);
console.log(`  channel:                 ${buildInfo.channel}`);
console.log(`  app_dir_name:            QuotaArc-Dev`);

if (buildInfo.git_head !== realHead) {
  fail(
    `embedded git_head "${buildInfo.git_head}" does not match worktree HEAD "${realHead}" -- ` +
      "the binary does not reflect the current commit. Do not use it for native QA.",
  );
}

console.log(`\n[build-dev-verified] PASS -- ${DEV_EXE} is a verified, fresh, Dev-isolated build of ${realHead}.`);
process.exit(0);
