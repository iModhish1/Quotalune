# Third-party notices

QuotaArc is MIT-licensed. It builds on the work of these projects; each is used under the terms
described below. This file must be updated whenever a new material dependency is adopted.

## Win-CodexBar — https://github.com/nesszer/Win-CodexBar

- License: MIT (upstream `LICENSE`, "Copyright (c) 2025 Peter Steinberger")
- Used: provider engine (`rust/src/providers/*`), credential security layer (DPAPI secure files,
  browser cookie import), Tauri shell infrastructure (tray, settings stores, updater, float
  bar), CLI, shared domain logic.
- Modifications: re-branded product identity via `rust/src/paths.rs` (QuotaArc directories,
  registry value, AUMID, installer naming), QuotaArc Surface Engine added alongside the
  inherited float bar, updater pointed at QuotaArc releases, locale strings re-branded.
- Attribution: retained in `LICENSE` and `NOTICE`. Provenance details: docs/UPSTREAM_SYNC.md.

## CodexBar (macOS) — https://github.com/steipete/CodexBar

- License: MIT. The root project of the family; the Windows port inherits its domain concepts.
- Used: concepts only (the macOS Swift code is not part of this tree).

## codexcontrol — https://github.com/ademisler/codexcontrol

- License: MIT ("Copyright (c) 2026 Adem Isler")
- Used: Windows multi-account Codex core ported to Rust under `rust/src/codex_accounts/`
  (inherited via Win-CodexBar; attribution retained in `NOTICE`).

## Reference projects (concepts only, no code copied)

- **CodeZeno/Claude-Code-Usage-Monitor** (MIT) — taskbar-widget behavior concepts.
- **warpirate/pillar-dynamic-island-for-windows** (MIT) — overlay window recipe concepts and the
  content-fullscreen heuristic approach.
- **jamesbrink/burnrate** (MIT) — multi-account and updater architecture patterns.

## Major runtime dependencies (carried by their own licenses)

- Tauri 2 (Apache-2.0 OR MIT), wry/WebView2, tauri-plugin-single-instance / dialog /
  global-shortcut
- Rust: tokio, reqwest (Apache-2.0 OR MIT), serde, clap, tracing, thiserror, chrono,
  rusqlite (bundled SQLite — public domain), aes-gcm, image
- Frontend: React (MIT), Motion for React (MIT), Vite (MIT), Vitest (MIT), TypeScript
  (Apache-2.0)

Brand assets under `assets/brand/` are original QuotaArc artwork. Provider names and marks
referenced by integrations belong to their respective owners; QuotaArc embeds no provider
artwork in its own brand.

## About creator assets

The owner's GitHub profile image is bundled from the iModhish1 account (GitHub
user 66481531) at the owner's request. The unmodified TAWAJUD AI mark comes from
https://tawajud.net/assets/logo-mark-256.png and accompanies the owner's employer
link. These identity assets and trademarks retain their respective owners'
rights; the application's MIT license does not relicense them. They are stored
locally so opening About does not make requests to these external services.
