# Quotalis Rebrand Audit — Step 1: Internal Crate + Runtime Event Rename

Date: 2026-09-08. Repo: `N:\QuotaArc\quotaarc`, branch `feature/v9-theme-runtime`.

This document is the occurrence inventory and classification the owner
required before any rename, per their rebrand spec section 1. It covers
**only what this pass actually changed** (the internal Rust crate name and
the runtime event namespace) plus a classification of every other
`codexbar`/`CodexBar`/`Win-CodexBar` occurrence found in active source, so
the remaining rebrand work (public UI branding, executable/installer/
bundle-ID/data-migration) has a real starting inventory rather than being
re-discovered from scratch next pass.

**Public product branding (QuotaArc → Quotalis) is explicitly NOT done
this pass** — see "Deferred" below. This pass is scoped to exactly what
the owner asked to go first: "Proceed with the internal crate rename
first, then the controlled Quotalis rebrand and migration."

## Methodology

Every occurrence was found via `grep` across `rust/`, `apps/desktop-tauri/`
(excluding `target/`, `node_modules/`, and `.local/recovery/*` — which are
literal backups of a real user's `%APPDATA%\QuotaArc` data files, not
source, and were not touched or read further than confirming they are
data). Occurrences were grouped by **pattern**, not read file-by-file one
at a time — 172 files matched the case-insensitive search; grouping by
exact substring (`codexbar::`, `"codexbar:`, `CREDENTIAL_TARGET: &str =
"codexbar-`, etc.) made every occurrence in a group verifiably identical
in kind, which is what makes a scripted, pattern-scoped rename safe here
(as opposed to a blind whole-word find/replace, which the owner explicitly
ruled out).

## A/C/D — Renamed this pass (verified safe: compiler-checked or
in-process-only, zero persisted-data risk)

| Pattern | Count | Before → After |
|---|---|---|
| Rust crate path (`codexbar::...`) | 338 occurrences / 44 files | `codexbar::` → `quotalis_core::` |
| Cargo package name | 1 | `rust/Cargo.toml`: `name = "codexbar"` → `name = "quotalis_core"` |
| Cargo dependency reference | 1 | `apps/desktop-tauri/src-tauri/Cargo.toml`: `codexbar = { path = "../../../rust" }` → `quotalis_core = { path = "../../../rust" }` (+ the `dev-channel = ["codexbar/dev-channel"]` feature forward) |
| Runtime event `codexbar:settings-updated` | 16 (9 Rust emitters, 7 TS listeners/emitters/doc-comments) | → `quotalis:settings-updated` |
| Runtime event `codexbar:deepseek-pricing` | 1 (`useDeepSeekPricingStatus.ts`) | → `quotalis:deepseek-pricing` |
| Tracing log target | 3 (`geometry_store.rs`) | `"codexbar::geometry"` → `"quotalis_core::geometry"` |
| Tauri tray icon id | 4 (`tray_bridge.rs`) | `"codexbar-main"` → `"quotalis-main"` (in-process Tauri object id, never persisted or shown to the user) |
| TS doc-comment crate-path mirrors | 5 (`surfaceSizing.ts`, `surfaceSizing.test.ts`, `bridge.ts`) | `codexbar::X` → `quotalis_core::X` in comments describing the Rust type each TS type mirrors |
| `rust/src/lib.rs` crate doc comment | 1 | `"Shared library surface for CodexBar."` → `"Shared library surface for Quotalis (crate: \`quotalis_core\`)."` |
| Live user-facing error strings (bridge.rs) | 3 | `"...refresh Claude in Win-CodexBar."` / `"...before Win-CodexBar can read usage."` → `"...QuotaArc."` / `"...before QuotaArc can read usage."` — see note below |

**Note on the 3 bridge.rs strings**: these were already a live bug
independent of this rebrand — the product's current public name is
**QuotaArc**, not "Win-CodexBar" (the open-source upstream project this
codebase's structure originated from), so a Claude auth-error toast was
already telling real users to go to the wrong app name today. Fixed to
say the *current* active product name (QuotaArc). These will be updated
again to say "Quotalis" in the public-branding pass (section 9 of the
owner's spec), not invented as "Quotalis" prematurely while every other
active UI surface still says QuotaArc.

Every one of the above is either compiler-checked (the crate-path/Cargo
changes — `cargo check`/`cargo test`/`cargo clippy` would fail immediately
on a missed reference) or in-process-only with no persisted/serialized
form (event names, tray icon id, tracing target) — none of these can
orphan real user data.

**Verification**: `cargo check --workspace`, `cargo test --workspace`
(1974 tests: 454 + 1519 + 1 passed, 0 failed), `cargo clippy --workspace
--all-targets -- -D warnings` (clean), `cargo fmt --all -- --check`
(clean, after `cargo fmt --all` re-wrapped a handful of lines that grew
past 100 columns because `quotalis_core::` is 3 characters longer than
`codexbar::`), `npx vitest run` (810 tests passed), `npx tsc --noEmit`
(clean), `npm run build` (succeeded), secret scan (clean, 1306 files),
locale-drift check (clean, 981 keys), `git diff --check` (clean).

## B/K/L/M/O — Classified, NOT renamed this pass (genuine upstream
attribution / historical / test-fixture references — must be preserved)

- `rust/Cargo.toml`: `repository = "https://github.com/Finesssee/Win-CodexBar"`, `authors = ["CodexBar Contributors"]` — real upstream repository/author credit. **Preserve.**
- `rust/README.md`, `rust/CHANGELOG.md`, `rust/src/providers/codebuddy/README.md` — historical documentation referencing "Win-CodexBar" as the upstream project. **Preserve**, do not rewrite history.
- `rust/src/paths.rs` doc comment: `"Win-CodexBar (\`%AppData%\QuotaArc\` vs \`%AppData%\CodexBar\`)"` — describes a real legacy-path distinction the code already handles. **Preserve.**
- `rust/src/cli/serve/dashboard/snapshot.rs` doc comment: `"Documented divergences (Win-CodexBar architecture)"` — describes an intentional behavioral difference from the upstream architecture. **Preserve** (technical provenance, not branding).
- `apps/desktop-tauri/src-tauri/src/commands/tests.rs` / `commands/bridge.rs` tests validating the literal `https://github.com/Finesssee/Win-CodexBar` URL — **Preserve** (tests the real upstream URL, not a rename target).

## E/F/G/H/I/J/N — NOT started this pass (the owner's own spec gates all
of these behind a dedicated audit + explicit go-ahead; none are silently
skipped, all are real remaining work)

These require their own careful pass, not a mechanical rename, because
each one risks either breaking a real installed user's data/experience or
needs an install/update-path decision the owner has to make explicitly:

- **Public product branding (QuotaArc → Quotalis) in the UI** — window titles, tray labels, Settings/About text, notifications, `package.json`/`tauri.conf.json` `productName`. Owner spec section 9; large, its own pass.
- **OS-keychain credential store target strings** — 30 `const ..._CREDENTIAL_TARGET: &str = "codexbar-<provider>"` constants across `rust/src/providers/*/mod.rs`. **High risk if renamed naively**: these are the literal Windows Credential Manager service names under which a real user's already-stored provider credentials live. Renaming the string without a read-old-write-new migration would make the app unable to find a real user's existing stored credentials. Matches the owner's own section 4/8 "do not break legacy data" / "preserve DPAPI" instructions. Deferred to a dedicated migration pass.
- **`rust/src/secure_file.rs` format tag** — `const FORMAT: &str = "codexbar.secure-file"`. This string is embedded in the on-disk encrypted-file format for stored secrets. Renaming it would break decoding of a real user's already-encrypted files. Deferred, same reasoning as above.
- **Legacy executable-name constants** — `"codexbar.exe"`, `"codexbar-desktop.exe"`, `"codexbar-cli.exe"` in `rust/src/settings.rs`, `rust/src/updater.rs`, `apps/desktop-tauri/src-tauri/src/tray_visibility.rs` (+ their tests). These are **already-correct migration-compatibility code** — they exist specifically to recognize a legacy install for update-detection/tray-icon matching. Category N. **Must not be touched** — renaming them would break detection of the actual legacy exe, the opposite of what they're for.
- **CLI command name and help text** — `#[command(name = "codexbar")]` (`rust/src/cli/mod.rs`) plus ~9 files' worth of `codexbar usage` / `codexbar account add` / `codexbar guard` example text in help/error strings. Real, active product-facing text, but lower risk than the two items above (no persisted data). Deferred only for triage/time reasons, not a safety concern — a reasonable next slice.
- **Executable names, bundle identifier, installer (NSIS/MSI), Start Menu shortcut, updater identity, install directory, versioning** — owner spec sections 11/12/13/14/15/16/17/18, every one of which the owner's own instructions say to audit first and not touch yet ("Do NOT rename binaries until installer/single-instance/startup/updater references have all been audited", "Do NOT casually change app.quotaarc.desktop", "Do NOT update installed Personal QuotaArc during the initial rename work"). **Not started.**
- **Local data path migration** (`%APPDATA%\QuotaArc` → `%APPDATA%\Quotalis`) — no migration code exists yet; none was needed this pass since the public identity (and therefore the data directory name, which is derived from it) has not changed. Owner spec sections 5-8. **Not started.**

## Result

- `codexbar`/`codexbar::` as an active Rust import path: **0 remaining**
  (was 338 across 44 files).
- `"codexbar:*"` runtime events: **0 remaining** (was 17).
- Rust crate package name: **`quotalis_core`** (was `codexbar`).
- Remaining `codexbar`/`CodexBar` occurrences in active source: **~124**
  Rust lines (credential targets, legacy exe-name migration constants,
  CLI help text) + upstream-attribution/historical references — every one
  individually classified above, none silently missed, none touched
  without a documented reason.

## Next step

Per the owner's own sequencing: public UI branding (QuotaArc → Quotalis)
is the next controlled pass, followed by the credential-store/secure-file
migration design (the two genuinely risky items), then
executable/installer/bundle-ID/Start-Menu/updater work, only after each
has its own audit. This document is the starting inventory for that work
— it does not need to be re-discovered.
