# QuotaArc unfinished work — reconciled 2026-09-06

This list distinguishes an implemented slice from a fully accepted product requirement. Green automated tests do not close native interaction or multi-monitor gates.

## Release-blocking verification

- Run and archive all current quality gates from the final release commit.
- Test physical 100%, 125% and 200% DPI; only 150% physical evidence is currently available.
- Exercise OS-level mouse, keyboard, resize, snap, maximize, restore and full-screen behavior. CDP DOM input is not equivalent.
- Verify every Settings destination and the tray/menu/popout surfaces at compact, default and wide sizes in dark, light, Arabic RTL and English LTR.
- Confirm the installed candidate starts from a useful default size and remains manually resizable.
- Confirm install/upgrade preserves real settings, provider order, accounts and history; verify rollback from the backup.

## Product work still open

- Native Collections: detached provider windows, drop-to-group, split/reorder, 0/1/2/3/6/12 behavior, persistence and monitor-loss recovery.
- Full structure acceptance: distinguish silhouettes, remove unjustified dead space, validate hit regions and ensure all legacy structures meet the newer design standard.
- Full native footprint validation for every structure × anchor × compact/expanded state.
- Complete native details/pin/Escape/keyboard interaction matrix for all structures.
- Notification customization for every independent usage window, credit/reset event and reorderable rule.
- Authentication UX and supported OAuth actions for each provider without implying unsupported flows.
- Final reference-library evaluation and provenance/licence record for all imported concepts.
- Final default black/silver identity approval and native icon legibility at all taskbar/tray sizes.
- App-wide Arabic copy review and remaining non-Settings surfaces.
- Accessibility acceptance: keyboard traversal, focus visibility, screen-reader labels and native contrast sampling.
- Performance/idle-resource measurement with all optional surfaces enabled.

## Explicitly not complete

- Public release or publishing.
- Full native 24 structure-theme × 24 provider-identity × DPI sweep.
- Multi-monitor/taskbar-orientation acceptance.
- A production installer built from the reconciled final commit.
- Controlled Personal upgrade from that installer.

## Recommended order

1. Close deterministic build/test/security gates.
2. Build isolated Dev candidate and run native compact/default/wide smoke matrix.
3. Repair any release blockers in atomic commits.
4. Choose and apply the release version consistently.
5. Build NSIS, MSI and portable artifacts.
6. Back up Personal data and binary, install the candidate, verify preservation and rollback readiness.
7. Generate the manifest, machine-readable handoff state and verified evidence ZIP.

