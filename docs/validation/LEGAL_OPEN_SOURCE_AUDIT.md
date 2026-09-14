# Legal / Open-Source Provenance Audit — 2026-09-14

Scope: a file-by-file search of every tracked file for `QuotaArc`, `CodexBar`,
`Win-CodexBar`, `codexcontrol`, `Peter Steinberger`, `Adem Isler`, `MIT`,
`Apache`, `license`, `copyright`, classifying each occurrence rather than
blindly replacing every match. Starting HEAD `1361dd59`; this audit's fixes
land at `cd7dcc3c`.

## LICENSE / NOTICE / THIRD_PARTY_NOTICES.md — already sound

- `LICENSE`: MIT, dual copyright line "QuotaArc Contributors" (project) +
  "Peter Steinberger (CodexBar)" (upstream). The upstream line is correct and
  legally required — **KEEP**. The project-owned line still says "QuotaArc"
  — **VISIBLE CURRENT-BRAND BUG**, see Recommendation below (not changed in
  this pass: a copyright-line edit is a real legal decision the owner should
  make explicitly, not something to auto-apply).
- `NOTICE`: correctly attributes `codexcontrol` (Adem Isler, MIT) for the
  ported `rust/src/codex_accounts/` core, with the full upstream license text
  reproduced. **KEEP as-is** — accurate and complete.
- `THIRD_PARTY_NOTICES.md`: accurately lists Win-CodexBar (Peter Steinberger,
  MIT), CodexBar macOS (concepts only), codexcontrol, three concept-only
  reference projects, and major runtime dependencies with correct licenses.
  `docs/UPSTREAM_SYNC.md` (referenced from this file) **exists** and is
  current — no stale reference to fix. The file describes the present
  product as "QuotaArc" throughout (its own header sentence and the
  Win-CodexBar "Modifications" bullet) — **VISIBLE CURRENT-BRAND BUG**
  (prose, not compatibility-load-bearing), not changed in this pass for the
  same reason as the LICENSE line: see Recommendation.

## Compatibility identifiers — verified load-bearing, correctly preserved

These are genuinely required for existing-install continuity (confirmed
against real installed state during the Personal Promotion work) and must
**not** be renamed:

- Bundle identifier / AUMID: `app.quotaarc.desktop` (Personal),
  `app.quotaarc.desktop.dev` / `app.quotalis.desktop.dev` (Dev) —
  `rust/src/paths.rs`, `tauri.conf.json`, `tauri.dev.conf.json`.
- Data directory: `%APPDATA%\QuotaArc` / `%LOCALAPPDATA%\QuotaArc` (Personal).
- Inno installer `AppId=QuotaArcDesktop` and registry Run value name
  (`rust/installer/quotalis.iss`, `rust/src/paths.rs::REGISTRY_RUN_VALUE`).
- `codexbar_launch_<pid>.log` startup-log filename (`rust/src/main.rs`) —
  still the real, current filename; a message describing it accurately is
  **not** a bug even though it contains the string "codexbar".

## Real, fixed findings — visible current-brand bugs (see commit `cd7dcc3c`)

Found by grepping every `"...QuotaArc..."` string literal in `.rs` files and
every `label={...QuotaArc...}` prop in `.tsx` files, then checking each by
hand for whether it renders to a real user:

1. **`apps/desktop-tauri/src-tauri/src/commands/bridge.rs`** — three Claude
   authentication error messages shown directly in the Providers UI said
   "...refresh Claude in QuotaArc." / "...before QuotaArc can read usage."
2. **`rust/src/host/session.rs`** — the SSH/RDP native-window-blocked error
   messages said "QuotaArc can't render its native window..." **and** told
   the user to run `quotaarc-cli usage -p claude` — a command that does not
   exist. The real installed CLI binary is `quotalis-cli.exe`
   (`rust/installer/quotalis.iss`). This is a functional correctness bug,
   not only cosmetic: a user following the old instruction verbatim would
   get "command not found".
3. **`rust/src/cli/serve/mod.rs`** — the CLI's own `--serve` startup banner
   said "QuotaArc server listening on...".
4. **`GeneralTab.tsx`** (Settings → General → logo appearance) — the
   screen-reader `alt` text for each logo-finish preview said e.g. "silver
   QuotaArc logo".
5. **`LogoProof.tsx`, `ThemeMarkProof.tsx`, `ReelPreview.tsx`** — three
   internal demo/proof-harness pages (used only for automated visual QA
   capture, not reachable from real product navigation) had the same
   visible-heading/alt-text pattern.

All fixed to "Quotalis". Verified with the real project test suite after the
edit (not just a visual read): frontend 202 files / 1251 tests, Rust desktop
504 passed / 1 existing ignored, core 1774, CLI 1, doctests 0 — all passed,
matching the pre-existing baseline exactly (no regression). Clippy
(`-D warnings`), `cargo fmt --check`, the production frontend build, locale
parity (1694 keys) and the project's secret scanner (4159 files) all passed
after the change.

## Internal technical debt — not fixed, not user-visible (classified only)

- The shared logo React component is literally named `QuotaArcMark`
  (`components/QuotaArcMark.tsx`/`.css`), imported by ~20 files. Its actual
  rendered output already correctly says "Quotalis" everywhere it matters
  (every real `label`/`aria-label` prop passed to it in production code was
  already "Quotalis" before this audit, confirmed by grep). Renaming the
  component/file itself is a pure internal-identifier change with no
  user-visible effect and non-trivial blast radius (~20 import sites) for
  zero functional or legal benefit — **SAFE TO RENAME, not prioritized**.
  Tracked as existing A05 in `tasks/MASTER_REQUIREMENTS.md`.
- Brand asset filenames (`assets/quotaarc-void-mark.svg`,
  `assets/quotaarc-orbit-glyph.svg`, `assets/brand/quotaarc-icon.svg`,
  `assets/brand/tray-mark-dark.svg`, `assets/brand/tray-mark-light.svg`) —
  internal filenames, never shown to users, only their SVG *comments*
  mention "QuotaArc" (comments don't render). **SAFE TO RENAME, not
  prioritized.**
- Dozens of `// QuotaArc ...` / `/* QuotaArc ... */` source comments across
  `design-system/*.ts(x)`, `App.tsx`, `lib/*Bridge.ts`, `surface_coordinator.rs`,
  etc. — never compiled into user-visible output. **INTERNAL TECHNICAL
  DEBT, not prioritized.**
- Two `tracing::warn!`/`tracing::info!` log lines in
  `apps/desktop-tauri/src-tauri/src/surfaces.rs` ("restoring QuotaArc
  surfaces at startup", "failed to reconcile QuotaArc surfaces") — internal
  diagnostic log text, not shown in any UI. **INTERNAL TECHNICAL DEBT, not
  prioritized.**
- One `tracing::warn!` in `rust/src/settings.rs` ("Failed to repair QuotaArc
  start-at-login command") — this one is actually **COMPATIBILITY CONTRACT —
  KEEP**: it's describing the literal registry Run value name, which is
  genuinely still "QuotaArc" by design (see above), so the log text is
  accurate, not stale.

## Historical documentation — correctly left alone

- `design/prototypes/direction-a.html`, `-b.html`, `-c.html` — three
  standalone design-exploration mockups from an earlier phase, not part of
  the shipped app, not referenced by any build target. Editing their
  "QuotaArc" text would misrepresent what that historical exploration
  actually said. **HISTORICAL DOCUMENTATION — KEEP.**
- Everything under `docs/validation/*.md` describing already-closed phases
  (Product V3, SHELL-01 through 04, QA-05, PRODUCT-06, the Personal
  Promotion reports) — these are dated evidence records of what actually
  happened at the time; rewriting "QuotaArc" out of them would falsify the
  historical record they exist to preserve. **HISTORICAL DOCUMENTATION —
  KEEP**, matching `AGENTS.md`'s own instruction never to reinterpret
  historical completion claims as current work.

## Recommendation — not auto-applied (owner decision)

Two prose-only "VISIBLE CURRENT-BRAND BUG" items remain, deliberately not
auto-changed in this pass because they involve either a legal copyright line
or a public-facing document already reviewed once by the owner:

1. `LICENSE`'s project-owned copyright line: `Copyright (c) 2026 QuotaArc
   Contributors` → the master prompt's own suggested form is
   `Copyright (c) 2026 Mohammed Modhish and Quotalis Contributors` (or
   `Copyright (c) 2026 Quotalis Contributors` if contributor-authorship
   makes the personal-name form inaccurate). **This is a real legal
   decision; recommend the owner confirm the exact wording before it's
   applied**, since a copyright holder's name is not the kind of string a
   grep-and-replace pass should silently change.
2. `THIRD_PARTY_NOTICES.md`'s "QuotaArc" → "Quotalis" prose updates (header
   sentence, the Win-CodexBar "Modifications" bullet's product-name
   mentions) — safe, mechanical, low-risk; can be done in the same pass as
   item 1 once the copyright-line wording is confirmed, so both legal-facing
   documents get exactly one coherent update instead of two.
