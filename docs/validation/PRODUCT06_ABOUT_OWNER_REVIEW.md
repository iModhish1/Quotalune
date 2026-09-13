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

## Owner supersession and second layout — 2026-09-13

The owner rejected the preceding layout and explicitly removed the second
approval wait in objectives c84e5c07, 8d55a534 and ae46db11. Product/version and
updates now lead. The final creator footer includes the bundled owner avatar,
purple name, WhatsApp, Telegram, project and employer links. The original
Quotalis mark is unchanged. The employer mark was downloaded without redrawing
from https://tawajud.net/assets/logo-mark-256.png; blue/violet tokens were read
from the site's home stylesheet. The GitHub avatar is bundled, not fetched when
the user opens About. Viewing the page sends no avatar request to GitHub.

Creator effects are finite 3.6-second CSS hover/focus responses; press has visual
feedback. No video, RAF or permanent timer. App animation-off, shared motion
reduced/off and OS reduced motion suppress the effect. Native screenshots alone
do not prove hover animation; that interaction remains separately unverified.

Fresh Dev d65afde8e0e83642f464dd109f9279ceb0de5b0eef69dc4fa2cc779d854f01f9
was opened through the guarded adapter. About's initial viewport and footer were
captured and inspected. They showed correct content order but exposed inherited
button padding/background around the avatar/company. More specific scoped CSS
corrects those defects; a rebuilt final capture is required below. No Personal
data or physical input was used, and the owned Dev process exited normally.

Current checks: frontend 1188/1188 across 200 files; Rust desktop 503 passed and
one existing Personal-database manual check ignored; core 1774; CLI 1; doctests 0.
TypeScript and production frontend build pass. Secret scan: 3095 files clean.
The notification-center backend checkpoint and installer IconUri correction are
separate from About acceptance. Publication now additionally requires actual
Windows toast-header icon evidence under the owner's latest instruction.

Final scoped-CSS Dev build:
`ffa084cbb76abe6d596ddcf2d1525f6e098fdf3f7b9d5d0702c47d1af3185e82`.
Native About HWND 1641764/PID 13196 was inspected, captured and visually reviewed:
`window-1641764-d4d9bb93929d4265bb23240a7f285579.png` (engineering; restored scroll) and
`window-1641764-6ad09a54fe7c4daab1d4a32bb2057175.png` (footer), under the global
Desktop-Visual-QA screenshots directory. The footer image confirms centered round
avatar, no inherited gray button plate, original company mark beside its link,
creator text and three readable contact/project buttons. The engineering capture
is not a top-of-page capture: native scroll position persisted across launches.
The product/update top is covered by the preceding d65afde8 screenshot (its layout
did not change in the final footer CSS correction). Captures are English/dark
at this host scale, not proof of the entire theme/RTL/narrow matrix.

Clippy with warnings denied passed after replacing a test-only usize→i64 cast
with a checked conversion; fmt and diff whitespace checks pass. The final native
binary predates only that test-only conversion and documentation changes.
