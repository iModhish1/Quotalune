# Upstream synchronization

QuotaArc inherits the provider/auth/shell engine from
[nesszer/Win-CodexBar](https://github.com/nesszer/Win-CodexBar) (MIT). This document defines how
we track and integrate upstream work without entangling it with QuotaArc product code.

## Topology

```
nesszer/Win-CodexBar (upstream remote)
        |
        v
upstream/main  ──fetch──>  upstream-sync (tracking branch)
        |
        v  rebase / merge review
QuotaArc main
```

## Workflow

1. `git fetch upstream`
2. `git checkout -b upstream-sync upstream/main` (or reset an existing one)
3. Rebase the integration commits or cherry-pick upstream commits onto a review branch.
4. Run the gate: `cargo test --manifest-path rust/Cargo.toml` and
   `pnpm --dir apps/desktop-tauri test`, then `pnpm --dir apps/desktop-tauri run tauri:build:debug`.
5. Integrate to `main` through a PR with the upstream commit range recorded in the PR body.

## Conflict isolation rules

QuotaArc code is arranged to keep the upstream diff surface small:

- **Never rename crate symbols** (`codexbar::*` modules). Product identity lives in:
  - `rust/src/paths.rs` (single source of truth for app directory/registry/product names)
  - `tauri.conf.json` (productName, identifier, window titles)
  - installer metadata and tray/UI strings (frontend i18n)
- **Provider modules** (`rust/src/providers/*`), **core auth**, **cookie handling**: upstream
  files are ported as-is; QuotaArc-specific behavior goes in wrapper layers, not in-place edits.
- **Surface Engine** (`src-tauri/src/surfaces/`, frontend `src/surfaces/`): QuotaArc-owned
  directories; upstream changes should never collide.
- Every intentional divergence from upstream gets a note in this file: why, what upstream
  capability it replaces, and whether future upstream commits can still be ported.

## Divergence ledger

| Divergence | Why | Replaces | Upstream-portable? |
|---|---|---|---|
| `rust/src/paths.rs` centralizes all app-dir resolution (17 call sites) | Config separation from Win-CodexBar (`%AppData%\QuotaArc`) | scattered `join("CodexBar")` | Yes — upstream edits to those files port normally; only the join literal differs |
| Tauri NSIS per-user packaging as primary (upstream: Inno Setup) | Brief requirement; Tauri-native bundler | Inno Setup script usage | Yes — Inno config retained as reference |
| Surface Engine (Edge Arc, Top Arc, Taskbar Arc, Floating HUD) | New product surfaces | upstream float bar becomes one surface backend | Yes — additive |
| Motion system (Motion for React) + design system | Premium product experience | upstream styling only | Yes — frontend-only |

## Remote setup (done at Phase 1)

```
git remote add upstream https://github.com/nesszer/Win-CodexBar.git
git remote add origin   https://github.com/<quotaarc-org>/quotaarc.git
```
