# Upstream provenance

Full decision matrix and verification: see `docs/FOUNDATION_AUDIT.md`. This
file is the per-source provenance ledger required before any code is reused.

| Source | Exact commit at import | License | What we took | Modification |
|---|---|---|---|---|
| nesszer/Win-CodexBar | `5a128f24` (main, 2026-08-31) | MIT | Whole-tree foundation: provider engine, credential layer, settings, Tauri shell, CLI, tray, float bar, installer scripts, locale system | Rebrand via `rust/src/paths.rs`; Surface Engine added; updater retargeted; NSIS-primary packaging; identity strings re-localized |
| steipete/CodexBar | n/a (macOS, not imported) | MIT | Concepts only | — |
| ademisler/codexcontrol | vendored inside Win-CodexBar (`rust/src/codex_accounts/`) | MIT | Inherited multi-account Codex core (attribution in `NOTICE`) | None |
| CodeZeno/Claude-Code-Usage-Monitor | n/a | MIT | Concepts only (taskbar behavior study) | — |
| warpirate/pillar-dynamic-island-for-windows | n/a | MIT | Concepts only (overlay recipe, fullscreen heuristic approach) | — |
| jamesbrink/burnrate | n/a | MIT | Patterns only (keyring/updater architecture study) | — |

History preservation: the QuotaArc repository was cloned from
nesszer/Win-CodexBar **with full git history**; the upstream remote is
retained (`git remote -v`). QuotaArc commits begin at
`docs: Phase 0 foundation audit…`. Any future code copied from another
project must be recorded here before it lands.
