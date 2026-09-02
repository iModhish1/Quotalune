# Dependency audit

Date: 2026-09-02 · Tooling: cargo-audit 0.11.x (Rust Advisory DB), `pnpm audit` (GitHub advisories)

## Rust (`rust/Cargo.toml`, workspace)

`cargo audit`: **0 vulnerabilities**. Advisory warnings only:

| Crate | Version | Finding | Assessment |
|---|---|---|---|
| `atk`, `atk-sys`, `gdk` (GTK stack) | 0.18.x | unmaintained | Linux-only Tauri dependencies; not compiled into Windows targets we ship. Watch for Tauri's GTK stack refresh. |
| `fxhash` | 0.2.1 | unmaintained | Transitive; tiny scope. No action available at this layer. |

Key direct dependencies are on current stable majors: tokio 1, reqwest 0.12
(rustls), clap 4, thiserror 2, tracing 0.1, chrono 0.4, chrono-tz 0.10,
rusqlite 0.32 (bundled SQLite), aes-gcm 0.10, image 0.25.

## Frontend (`apps/desktop-tauri`)

- Production dependencies: **0 known vulnerabilities** (`pnpm audit --prod`).
- The full-tree report shows 14 advisories (1 critical, 9 high) **all inside
  the dev/build chain** (`vite` → `@vitejs/plugin-react` → `babel` tooling),
  none reachable from shipped code. These track upstream tooling releases;
  upgrading deliberately (not blindly) is the standing policy.

Direct runtime deps: react 18.3, react-dom 18.3, @tauri-apps/api 2.10,
motion 13 (Motion for React). Dev: vite 6, vitest 3, TypeScript 5.6,
@testing-library. Lockfile: `pnpm-lock.yaml`, frozen-lockfile in CI.

## Policy

- Prefer official/current APIs; check maintenance status, license, and known
  Windows issues before adding a significant dependency.
- No deprecated packages were introduced for QuotaArc. The one flagged area
  (GTK Linux crates) is inherited from the Tauri ecosystem, unused on
  Windows, and blocked on upstream — documented here rather than silently
  ignored.
- No GPL/AGPL dependencies in the shipped tree.
