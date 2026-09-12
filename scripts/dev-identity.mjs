import path from "node:path";

// Diagnostics must cover both Rust paths and Tauri's OS-level identity.
export function devIdentityError(stdout) {
  const fields = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator);
    if (fields.has(key)) return `duplicate diagnostic field: ${key}`;
    fields.set(key, line.slice(separator + 1));
  }
  const expected = {
    channel: "dev",
    exe: "QuotalisDev.exe",
    app_dir_name: "QuotaArc-Dev",
    tauri_identifier: "app.quotalis.desktop.dev",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (fields.get(key) !== value) {
      return `binary reports ${key}=${JSON.stringify(fields.get(key))}, expected ${JSON.stringify(value)}`;
    }
  }
  return null;
}

export function reportedDevBuildMatches(output, expectedPath) {
  const lines = output.replace(/\u001b\[[0-9;]*m/g, "");
  const artifacts = [...lines.matchAll(/Built application at:\s*(.+)/g)];
  return artifacts.length === 1 && path.resolve(artifacts[0][1].trim()) === path.resolve(expectedPath);
}
