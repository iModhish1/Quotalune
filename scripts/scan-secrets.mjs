#!/usr/bin/env node
// QuotaArc secret-scan gate: catches obvious API keys, private keys, tokens,
// and passwords in tracked files. Local gate for preflight + CI; a gitleaks
// run over full git history is required once before the first public release
// (docs/PUBLIC_RELEASE_READINESS.md).
//
// Usage: node scripts/scan-secrets.mjs [paths...]
// Exit 1 when a likely secret is found. Documented false positives go in the
// ALLOWLIST below with a reason — never whole directories.
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const RULES = [
  { name: "private-key-block", re: /-----BEGIN (RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { name: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b/ },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "generic-api-key-assignment", re: /\b(api[_-]?key|apikey|secret|password|passwd|auth[_-]?token|access[_-]?token)\b['"]?\s*[:=]\s*['"][A-Za-z0-9+/_-]{24,}['"]/i },
  { name: "bearer-token", re: /\bAuthorization['"]?\s*[:=]\s*['"]Bearer [A-Za-z0-9._-]{24,}['"]/i },
];

// Documented exclusions with reasons. Keep minimal.
const ALLOWLIST = [
  // Test fixtures with obviously synthetic values
  { re: /EXAMPLE|REDACTED|REDACT|<[^>]*>|YOUR[_-]?KEY|dummy/i, reason: "placeholder marker" },
  { re: /src\/design-system\/|\.test\.(ts|tsx)$/, reason: "component tests use synthetic strings only", isPath: true },
];

const SKIP_DIRS = new Set([
  "node_modules", ".git", "target", "dist", "dist-release",
  ".zcode", ".idea", ".vscode", "icons-build", "coverage",
]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".rs", ".js", ".mjs", ".json", ".md", ".yml", ".yaml",
  ".toml", ".css", ".html", ".sh", ".ps1", ".iss", ".xml", ".ftl", ".txt",
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walk(full);
    } else if (TEXT_EXT.has(path.extname(entry))) {
      yield full;
    }
  }
}

const targets = process.argv.slice(2);
const files = targets.length ? targets : [...walk(root)];
const findings = [];

for (const file of files) {
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const rule of RULES) {
      if (rule.re.test(lines[i])) {
        const allowlisted = ALLOWLIST.some((a) =>
          a.isPath ? a.re.test(file) : a.re.test(lines[i]),
        );
        if (!allowlisted) {
          findings.push({ file: path.relative(root, file), line: i + 1, rule: rule.name });
        }
      }
    }
  }
}

if (findings.length) {
  console.error("POTENTIAL SECRETS FOUND:");
  for (const f of findings) console.error(`  ${f.file}:${f.line} (${f.rule})`);
  process.exit(1);
}
console.log(`secret scan clean (${files.length} files)`);
