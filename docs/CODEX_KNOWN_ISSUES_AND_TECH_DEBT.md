# QuotaArc known issues and technical debt — 2026-09-06

## Required before claiming release readiness

1. Physical DPI coverage is incomplete (150% only).
2. OS-level pointer/keyboard interaction evidence is incomplete; much recent proof uses CDP.
3. Native Collections rendering and drag/group ownership are incomplete.
4. The installed Personal executable is stale relative to HEAD.
5. Package metadata is reconciled at 0.10.0, but installer artifacts must still be produced from the final commit.
6. Multi-monitor, taskbar orientation and monitor-loss recovery need native acceptance.

## Design and UX debt

- Some catalog structures are implemented but still require qualitative silhouette and space-efficiency review.
- Native pairwise theme/identity review samples representative combinations; exhaustive native inspection is impractical and remains partially automated.
- Adaptive provider identity previews in Settings approximate the structure background because a live structure context is not always present.
- The app must continue auditing text wrapping and protected spacing at narrow widths and Arabic RTL.

## Engineering debt

- The recovered frontend commit is very large because historical work accumulated uncommitted. Future work should remain atomic.
- `docs/V9_CONTINUATION.md` describes an older milestone and can mislead continuation unless read with the current master requirements and this handoff.
- Provenance below `7ac06291` is historical/shared and cannot be assigned reliably from the common Git author identity.
- Local proof artifacts are gitignored; the release evidence archive must copy the selected proof explicitly.

## Security and data safety

- Never include credentials, OAuth tokens, provider databases or raw user settings in the handoff ZIP.
- Backups that contain Personal data remain local and outside the shareable archive.
- Installer testing must be an in-place upgrade with a verified rollback copy; no uninstall-first workflow.
