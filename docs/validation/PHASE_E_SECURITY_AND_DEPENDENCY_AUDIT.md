# Phase E — security and dependency audit

Date: 2026-09-26. Source: `ad906634` on `release/quotalune-integration`.
Covers the master-goal release security audit and dependency/OSS license audit.

## 1. Rust dependency advisories

`cargo audit` against a lockfile of 665 dependencies, advisory database
commit `e2111519ba6d14a5da59a7b2e5c8083ae8a37c01` (updated 2026-09-25).

- **Vulnerabilities: 0**
- **Unsoundness advisories: 2**
- **Unmaintained advisories: 7**

No ignore file exists anywhere in the repository, so nothing is being
suppressed by configuration. The "9 allowed warnings" that `cargo audit`
prints are its own informational categories, not a project allowlist.

### Unsoundness advisories

| Advisory | Crate | Reachable in the shipped Windows binary? | Path |
| --- | --- | --- | --- |
| RUSTSEC-2024-0429 | `glib` 0.18.5 | No | Not resolvable for the current target. `cargo tree -i glib@0.18.5` reports "nothing to print"; it is a GTK/Linux transitive dependency and never compiles into a Windows build. |
| RUSTSEC-2026-0097 | `rand` 0.7.3 | Not by our code | `phf_generator` → `phf_codegen` → `selectors` → `kuchikiki` → `tauri-utils` → `tauri-build`. A build-time Tauri transitive, not a direct dependency and not used by application code. |

### Unmaintained advisories

All seven trace to the same Tauri transitive chain and none is direct:

| Advisory | Crate | Path |
| --- | --- | --- |
| RUSTSEC-2025-0057 | `fxhash` 0.2.1 | `selectors` → `kuchikiki` → `tauri-utils` |
| RUSTSEC-2024-0370 | `proc-macro-error` 1.0.4 | Not resolvable for the current target |
| RUSTSEC-2025-0081 | `unic-char-property` 0.9.0 | `unic-ucd-ident` → `urlpattern` → `tauri-utils` |
| RUSTSEC-2025-0075 | `unic-char-range` 0.9.0 | same `urlpattern` chain |
| RUSTSEC-2025-0080 | `unic-common` 0.9.0 | same `urlpattern` chain |
| RUSTSEC-2025-0100 | `unic-ucd-ident` 0.9.0 | same `urlpattern` chain |
| RUSTSEC-2025-0098 | `unic-ucd-version` 0.9.0 | same `urlpattern` chain |

"Unmaintained" means the author stopped publishing releases. It is not a
security vulnerability and carries no known exploit. The practical risk is that
a future upstream advisory against these crates would go unpatched, which is a
supply-chain maintenance concern rather than a present vulnerability.

### Disposition

No action is taken on these nine, deliberately:

- None is a security vulnerability; `cargo audit` reports zero.
- None is a direct dependency of this project, so we cannot patch them
  independently.
- The only remediation path is a `tauri-utils` / `kuchikiki` update, which is
  upstream. Adopting a newer major than the one the current release is built
  and tested against would be a larger change than the risk warrants, and would
  need its own test cycle.

This is a recorded, justified acceptance, not an oversight. Re-run
`cargo audit` before each release; if any advisory is reclassified from
`unsound`/`unmaintained` to `vulnerability`, this disposition no longer holds.

## 2. Frontend dependency advisories

`pnpm audit` in `apps/desktop-tauri`:

| Severity | Count |
| --- | --- |
| critical | 0 |
| high | 0 |
| moderate | 0 |
| low | 0 |
| info | 0 |

Across 259 dependencies (16 runtime, 243 dev, 64 optional).

## 3. Secret scan

`node scripts/scan-secrets.mjs` — clean across 1366 tracked files.

## 4. Scope limits of this audit

This document covers dependency advisories and secret scanning. It is not a
claim that the whole-product security review is complete. Still to be recorded
elsewhere or by further work:

- credential-path audit against every supported onboarding method
- CLI subprocess execution audit
- cookie-domain and collection minimisation audit
- installer and Dev/Personal isolation audit
- external URL allowlist audit
- fixture isolation audit

Those remain tracked as open work. This audit does not close them.