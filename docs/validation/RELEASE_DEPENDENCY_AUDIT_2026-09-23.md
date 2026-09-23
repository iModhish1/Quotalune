# Release dependency audit — 2026-09-23

This is an internal validation record for source candidate `feature/v9-theme-runtime`, not a release approval or public release note.

| Check | Result | Scope |
|---|---|---|
| `pnpm audit --json` | 0 reported vulnerabilities | Frontend lockfile: 259 dependencies reported by pnpm. Registry advisory coverage only. |
| `cargo audit --json` before repair | 1 vulnerability: `RUSTSEC-2026-0285` in locked `rustls 0.23.39` | Workspace lockfile: 665 dependencies. |
| `cargo update -p rustls --precise 0.23.45` | Locked `rustls 0.23.45` and `rustls-webpki 0.103.15` | Minimal compatible lockfile update. [RustSec advisory](https://rustsec.org/advisories/RUSTSEC-2026-0285.html) lists `>=0.23.45` as patched. |
| `cargo audit --json` after repair | 0 reported vulnerabilities | Seven unmaintained and two unsound informational advisories remain. |
| `cargo test --workspace -- --test-threads=1` | Desktop 584 pass/1 ignored; core 1944 pass; CLI 1 pass; doc tests 0 | Full offline workspace suite after lockfile update. |

The initial parallel workspace test run had one Windows child-process timing fixture failure (`login::tests::timed_out_wrapper_cannot_leave_descendant_or_block_on_inherited_pipe`: PID file absent). The focused rerun passed, and the full serial rerun passed. This is evidence of fixture timing sensitivity under load, not proof that the underlying subprocess behavior is flawless.

Remaining informational RustSec records include unmaintained `fxhash`, `proc-macro-error`, and five `unic-*` crates, plus unsoundness notices for `glib` and `rand`. `glib` does not appear in the current Windows host dependency tree; target-specific reachability and exact feature conditions for the other notices require separate review. No informational notice is suppressed here.

Existing `LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.md` retain Peter Steinberger/Win-CodexBar and Adem Isler/codexcontrol provenance. This packet did **not** complete a per-crate license inventory, installer-bundled notice verification, whole-product credential-path audit, or native acceptance. Those release gates remain open.

## Local About access

The Inno `[Files]` manifest and portable archive already include all three committed legal files. The About page now embeds those exact source files at build time and exposes them in a collapsed, keyboard-accessible section. The Vite plugin admits only these three named files, rather than broadening development-server filesystem access. The focused About test verifies the upstream attributions and no browser invocation; the production bundle contains the derived-work notice. Full frontend 1652/1652, Rust workspace desktop 584+1 ignored/core 1944/CLI 1, locale parity 1972 keys, TypeScript/Vite build, Clippy, formatting and diff checks passed after this change. This proves local availability of the existing notices; it does not prove that every transitive dependency's license text is covered.

## License inventory and additional texts

`cargo metadata --locked` resolves 665 workspace package records, including build, development and target-specific dependencies; the one record without a license field is the local desktop package, which uses the repository MIT `LICENSE`. The installed `pnpm licenses list --json` groups packages primarily under MIT, ISC, Apache-2.0 and BSD terms; its production-only selection reports 14 package entries. These counts describe the tools' scopes and are not a compiled-binary bill of materials.

Windows runtime dependency tracing found `option-ext 0.2.0` (MPL-2.0), `webpki-roots 1.0.7` certificate data (CDLA-Permissive-2.0), and ICU4X 2.2.0 components (Unicode-3.0). Their license files were copied from the locked crates; the MPL text has one trailing space removed for repository whitespace policy, without changing its terms. They are now named in `THIRD_PARTY_NOTICES.md`, packaged under `licenses/` by both Inno and the portable archive, and embedded as plain text in the offline About disclosure. The portable archive test verifies all three entries; the About test verifies actual license text, and the production JS bundle contains all three texts. Mozilla's [MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) explains that a compiled unmodified MPL library requires a recipient-facing source location. The [CDLA 2.0 text](https://cdla.dev/wp-content/uploads/sites/52/2021/06/CDLA-Permissive-2.0.pdf) requires its agreement text to accompany shared data.

This covers these identified license exceptions, not a legal opinion or complete per-package attribution for all transitive dependencies. The full OSS acceptance gate remains open until the final installer and CLI assets are built and inspected from the final source.
