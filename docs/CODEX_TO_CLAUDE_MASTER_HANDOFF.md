# QuotaArc forensic handoff — 2026-09-06

## Executive state

- Repository: `N:\QuotaArc\quotaarc`
- Branch: `feature/v9-theme-runtime`
- Reconciled HEAD: `9da04c91ed33accdaab0e1d5b677ccd60bea66f4`
- Baseline before the recovered work: `7ac06291`
- Working tree at reconciliation: clean (no staged, modified, or untracked files).
- Personal installation: `%LOCALAPPDATA%\QuotaArc\QuotaArc.exe`, version 0.9.0, SHA-256 `8EE3E2A8ED79A6FB0267081B7BD5BBEF1405C341CE86BF318459BBE34B0B8794`.
- Personal was running as PID 27112 during the inventory. It predates the reconciled source and must not be used as proof of HEAD behavior.

The recoverable repository state is preserved under `.local/recovery/codex-handoff-20260906-202500/`. Its bundle was verified successfully and contains complete reachable history. The clean-tree result is corroborated independently by `.local/recovery/claude-freeze-20260906-231310/`.

## Provenance reconciliation

Git author metadata is not sufficient because the recent commits share the project engineering identity. Attribution below uses the Claude freeze statement, repository snapshots, task evidence, and the accessible Codex task history.

### Claude-authored deltas

- `d4064b5c`: adaptive provider-identity/theme contrast regression coverage.
- `24b78ed2`: two Clippy repairs only; the remainder was pre-existing in-flight Rust/shared work.
- `d37de9ab`: `meterFill.ts`, its tests, four integration call sites, and a small number of matrix assertions; the rest was pre-existing frontend work.
- `4d84d983`: ignore rule and evidence additions; most task documents and proof assets were pre-existing.
- `9da04c91`: repaired detached Settings target discovery in the native capture script and recorded its evidence.

### Recovered pre-existing/Codex work

The large body of work already present before the Claude session includes the Provider Display workspace, independent usage-window selection/order, 24 structure themes, 24 provider-display identities, Arabic/RTL infrastructure, official-logo variants, window resizing fixes, 14 structures and nine anchor positions, shared hover/wheel/fold behavior, collections model/preview, and contrast/runtime matrices. Because the original edits were uncommitted when Claude began, individual line authorship cannot be proven reliably; this is classified as recovered pre-existing work rather than falsely assigned.

### Historical implementation chain

Important earlier checkpoints include `37dda0ef` (native high-DPI proof), `b227acba`/`7257e461` (Rust-authoritative sizing/coordinator), `99ca702c` (0.9.0 Personal build), `a0a897b4` (surface docking), `4eacbffa`/`78e8f54d` (new compact structures), `12dbfe0e` (collection layout model), and `7ac06291` (Settings resizing/navigation bounds).

## What is implemented at HEAD

- Official About mark is the shared product mark, with selectable finish and prominence.
- Settings is resizable/maximizable/full-screen capable and its navigation modes are bounded.
- Dedicated Provider Display page separates provider presentation from app and structure themes.
- Each actual usage window is independently selectable and orderable; canonical labels remain distinct.
- Limit presentation supports multiple shapes, content modes, directions, global defaults and per-provider overrides.
- Provider glyph optical sizing is centralized and used across compact surfaces.
- 24 structure identities and 24 provider identities share contrast-protected rendering.
- Arabic locale, RTL direction and right-side navigation behavior are present.
- Hover identifies the hovered provider; wheel navigation is independently controlled; fold delay is persisted.
- Four edges, four corners and free placement are modeled for all catalog structures.
- Collections have a persisted model/editor and live preview, but native detached-item rendering is not complete.

## Evidence already present

- `.local/proof/provider-display/provider-display-visual-evidence.json`
- `.local/proof/settings-current-11-dark/evidence.json`
- `.local/proof/settings-current-11-light/evidence.json`
- `.local/proof/provider-display-page-dark/evidence.json`
- `.local/proof/provider-display-rules-light/evidence.json`
- `.local/proof/provider-display-arabic-rtl/evidence.json`
- `.local/proof/structure-review/`

These are local proof artifacts, not substitutes for the remaining physical DPI and OS-input acceptance gates.

## Missing historical documents

The requested `docs/V9_CLAUDE_HANDOFF_STATE.md` and `docs/WORK_RECONCILIATION_REPORT.md` were not present. `docs/V9_CONTINUATION.md` exists but is an older checkpoint and is not authoritative for current product scope. This document supersedes it for the 2026-09-06 reconciliation without deleting history.

## Safe continuation contract

1. Preserve the clean baseline and recovery bundle.
2. Run the complete frontend, Rust, Clippy, formatting, locale, build and artifact gates.
3. Do not install over Personal until its application-data roots and installed binary are backed up.
4. Treat the Personal UI as stale until a candidate built from the final commit is installed.
5. Do not claim public-release readiness while the explicit open gates in `CODEX_UNFINISHED_WORK.md` remain.

