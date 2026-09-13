# P06-17 — About owner review

Status: implemented; owner visual approval pending. No new final installer,
portable release or GitHub publication is authorized before this review.
Source: a1582bde. This packet does not complete the broader product goal.

## Changes

- Original Quotalis mark and selected logo finish retained; no brand asset edited.
- Prominent Mohammed Modhish credit with product direction, design and desktop
  workflow contributions, and the requested WhatsApp icon/link.
- Runtime tools grouped by their actual role: Rust/SQLite, Tauri/WebView2,
  React/TypeScript, Apache ECharts/Motion. Verified active imports and manifests.
- Upstream Win-CodexBar, CodexBar and codexcontrol attribution retained alongside
  MIT/provider-mark notices. No invented endorsements, download counts or stars.
- Responsive sections and logical spacing; workflow guide stays expandable.
- Native visual inspection found a real missing-value defect: backend default
  update channel `local` was absent from the TypeScript union, selector and patch
  parser. Restored all three. Local builds explain manual updates, disable remote
  check/auto-download controls and cannot falsely display 'up to date'.

## Validation

- Frontend: 1,187 tests / 200 files pass, including a regression that failed on
  the missing local-channel label before the repair.
- Rust workspace: desktop 503 passed / 1 existing ignored; core 1,764 passed;
  CLI 1 passed; doc-tests 0. The ignored test reads real on-disk history.db.
- Workspace Clippy with -D warnings, cargo fmt check, TypeScript, Vite production
  assets, locale parity and git diff check pass. Locale parser slice: 21 passed.
- Current-tree secret scanner: 3,086 files clean before evidence documentation.
  This is not full Git-history or exhaustive security certification.
- Vite retains its existing >500 kB chunk warning; Cargo retains the workspace
  package-profile warning. Neither was hidden or reclassified as a new failure.
- Logs: .local/qa05/product06-about-review-*.log.

## Native inspection scope

Windows Quotalis Dev only, through desktop-visual-qa guarded UIA and PrintWindow.
No physical mouse/keyboard, Personal app, credentials or external messages used.
The original mark, owner block, technology/credit rows and workflow disclosure
were visually inspected. Disclosure expands and collapses through its native
accessibility pattern. Link destinations are covered by bridge tests; WhatsApp
was not opened or messaged during the visual pass.

English desktop screenshots are not proof of all widths/themes/Arabic native
rendering. Those broader QA gates remain open. New notification-center and other
P06 work remains active; no claim that the whole product is finished.

## Final Dev artifact and screenshots

Final runtime source: ff1e96b812fa (dirty documentation only).
Executable: target/debug/QuotalisDev.exe; Dev identity app.quotalis.desktop.dev;
SHA-256: b5714a6228aedc27ff4074ec30028db3982f993cbe75872dc6586ac430fd3ce5.
This is a Dev preview, not a new final download. All native QA sessions released
through desktop_qa_stop; successful runs quit the owned Dev instance normally.

Viewed final PrintWindow screenshots (1846 × 1088):
- .local/proof/product06-about-owner-review/01-about.png
- .local/proof/product06-about-owner-review/02-local-updates.png

The second confirms the Local value, visible manual-update explanation and
unavailable check/auto-download controls. The final spacing correction removed
an inherited narrow centered layout from the local-update explanation. The
workflow expand/collapse screenshots were captured and viewed on the preceding
Dev build; no workflow behavior changed in the final CSS-only correction.

Source audit references: NOTICE (codexcontrol), THIRD_PARTY_NOTICES.md (upstream
foundations), rust/Cargo.toml and rust/src/history.rs (SQLite), frontend package
manifest, components/analytics/charts/EChartsSurface.tsx and design-system/motion.ts.

Approval remains pending specifically because the owner requested a visual review
before final packaging/publication. Earlier local release candidates must not be
mistaken for builds of this About page or for approved final downloads.
