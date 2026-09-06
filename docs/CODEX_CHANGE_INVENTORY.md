# QuotaArc change inventory — recovered branch

## Reconciled range

Primary recovered range: `7ac06291..9da04c91`.

| Commit | Classification | Summary |
|---|---|---|
| `d4064b5c` | Claude-authored test | Adaptive identity/theme semantic contrast matrix |
| `24b78ed2` | Shared/pre-existing; two Claude fixes | Rust, locale, settings, collections and shell integration |
| `d37de9ab` | Mostly pre-existing; bounded Claude fix | Provider Display, 24×24 identity system, icon sizing, meter contrast |
| `4d84d983` | Mostly pre-existing docs/proof | Requirements, plans, reference review, native capture tooling |
| `9da04c91` | Claude-authored tooling fix | Detached Settings target selector and G3 evidence |

## Major file families

- `apps/desktop-tauri/src/design-system/`: structure/theme/presentation contracts, geometry, sizing, contrast and official mark.
- `apps/desktop-tauri/src/surfaces/`: tray, popout, notch, reel, flow, collection and Settings renderers.
- `apps/desktop-tauri/src/surfaces/settings/`: navigation, window actions, Provider Display, themes, surfaces and per-provider editors.
- `apps/desktop-tauri/src/i18n/`: locale keys, Arabic/RTL direction and locale wiring.
- `apps/desktop-tauri/src-tauri/` and `rust/`: persisted settings, native window coordination, placement, tray/notification/provider infrastructure.
- `scripts/`: native Settings capture and reopen verification.
- `tasks/`: master requirement ledger, ordered plan, backlog and evidence journal.

## Local-only evidence and recovery

- `.local/recovery/codex-handoff-20260906-202500/`: verified repository bundle and clean-tree snapshots.
- `.local/recovery/claude-freeze-20260906-231310/`: independent Claude freeze and provenance statement.
- `.local/proof/`: native/CDP screenshots and evidence JSON retained outside Git by project convention.

## Installed/runtime inventory

| Item | Version | Architecture | SHA-256 |
|---|---:|---|---|
| Installed Personal `QuotaArc.exe` | 0.9.0 | x64 | `8EE3E2A8ED79A6FB0267081B7BD5BBEF1405C341CE86BF318459BBE34B0B8794` |
| Existing release `target/release/QuotaArc.exe` | 0.9.0 | x64 | `E291C928459F4A9F45017397F6235938B2674A73787CAF850736FF55595E5744` |
| Existing Dev `target/debug/QuotaArcDev.exe` | 0.9.0 | x64 | `26FA9E2E26D1AB361090CC74847459F9DFE2AB80F0ED9A09F9D8D869B3A0FB4D` |

The different hashes are expected evidence that these are different builds; they must not be described as the reconciled release candidate.

