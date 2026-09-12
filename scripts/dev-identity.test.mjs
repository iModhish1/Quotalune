import assert from "node:assert/strict";
import { test } from "node:test";
import { devIdentityError, reportedDevBuildMatches } from "./dev-identity.mjs";
import path from "node:path";

const valid = "channel=dev\nexe=QuotalisDev.exe\napp_dir_name=QuotaArc-Dev\ntauri_identifier=app.quotalis.desktop.dev\n";
test("complete Dev identity accepts LF and Windows CRLF", () => {
  assert.equal(devIdentityError(valid), null);
  assert.equal(devIdentityError(valid.replaceAll("\n", "\r\n")), null);
});
test("old diagnostics cannot certify single-instance isolation", () => {
  assert.match(devIdentityError(valid.split("tauri_identifier=")[0]), /tauri_identifier/);
});
for (const [before, after] of [
  ["channel=dev", "channel=stable"],
  ["exe=QuotalisDev.exe", "exe=Quotalis.exe"],
  ["app_dir_name=QuotaArc-Dev", "app_dir_name=QuotaArc"],
  ["tauri_identifier=app.quotalis.desktop.dev", "tauri_identifier=app.quotaarc.desktop"],
  ["tauri_identifier=app.quotalis.desktop.dev", "tauri_identifier=app.quotaarc.desktop.dev"],
]) {
  test(`reject mismatched ${after}`, () => {
    assert.notEqual(devIdentityError(valid.replace(before, after)), null);
  });
}
test("empty diagnostics fail closed", () => {
  assert.notEqual(devIdentityError(""), null);
});
test("conflicting or repeated fields cannot hide a mixed binary", () => {
  assert.match(devIdentityError(`channel=stable\n${valid}`), /duplicate/);
  assert.match(devIdentityError(`${valid}channel=dev\n`), /duplicate/);
});

const expectedArtifact = path.resolve("target/debug/QuotalisDev.exe");
test("accept the one canonical artifact reported by Tauri", () => {
  assert.equal(reportedDevBuildMatches(`Built application at: ${expectedArtifact}\n`, expectedArtifact), true);
});
test("an alternate Cargo target cannot certify a stale default output", () => {
  assert.equal(reportedDevBuildMatches(`Built application at: ${path.resolve("alternate/debug/QuotalisDev.exe")}\n`, expectedArtifact), false);
});
test("missing or ambiguous artifact output fails closed", () => {
  assert.equal(reportedDevBuildMatches("Build completed", expectedArtifact), false);
  const line = `Built application at: ${expectedArtifact}\n`;
  assert.equal(reportedDevBuildMatches(line + line, expectedArtifact), false);
});
test("ANSI-colored Windows build output preserves artifact identity", () => {
  assert.equal(reportedDevBuildMatches(`\u001b[32mBuilt application at:\u001b[0m ${expectedArtifact}\r\n`, expectedArtifact), true);
});
