# Quotalune name screening and migration — preliminary

Date: 2026-09-23. This is an internal working record, not a trademark opinion or release approval.

## Why the name changes

`Quotalis` is already used by multiple public GitHub repositories, including
[`mbogdan0/claude-quotalis`](https://github.com/mbogdan0/claude-quotalis),
a Claude quota browser extension. This is a particularly close product category.
The owner requested a distinct name before the next publication.

## Provisional product name

**Quotalune** (quota + lune). It preserves the quota-monitoring meaning and the
product's cosmic visual direction while differing audibly and visually from
Quotalis. The official product mark and its geometry remain unchanged.

Preliminary exact-string checks on 2026-09-23: general web search returned no
exact-match result for `Quotalune`; GitHub repository-name search returned zero;
the npm package lookup returned 404. These checks are narrow and may miss
unindexed uses, similar marks, unpublished applications and other countries.
USPTO/WIPO/Saudi trademark database clearance and similarity analysis were **not**
completed. Do not claim that the name is globally unused or legally cleared.
The [USPTO trademark search](https://www.uspto.gov/trademarks/search) is a
starting point, not a substitute for counsel in intended release markets.

## Compatibility contract for the text rebrand

- Change visible UI, notifications, About, installer display name and future
  release presentation together, then verify every surface in Dev.
- Keep the existing Windows installer `AppId`, stable AUMID, user-data roots,
  database paths, update ancestry and existing public URLs until each migration
  is separately audited. Do not replace or migrate the owner's Personal install.
- Do not rename code identifiers, locale keys or historical documentation merely
  for appearance; old names can be valid compatibility/provenance references.
- A public repository rename, update-channel change or new release requires
  separate verified CI, package and link-redirect evidence. Existing `v0.11.0`
  remains an immutable historical Quotalis release.

The candidate is **provisional** until formal clearance and product-wide
rebrand validation are complete. No public release may assert legal uniqueness.

## Local Dev verification — 2026-09-24

- Visible-name candidate commits: `3a602336` (UI, locales, notification and
  installer display) and `295d664b` (WebView document title).
- The production frontend build and locale parity passed (1,975 keys); frontend
  tests passed 1,652/1,652 across 230 files. Rust workspace tests passed with
  one pre-existing ignored desktop test: desktop 584, core 1,944, CLI 1.
  Clippy (`-D warnings`), fmt and Git whitespace checks passed. A concurrent
  Rust test run had five process-timeout fixture failures under load; the
  serial rerun passed. Do not treat that timing sensitivity as resolved.
- The fresh Dev binary at `target/debug/QuotalisDev.exe` passed its channel
  preflight (Dev app ID and `QuotaArc-Dev` data root) with SHA-256
  `b3b4c07887f5eca061993fa6157eae5d95bdf6547dc73e40b95dc19746dbbfd6`.
  Its Windows version fields report `Quotalune Dev` for ProductName and
  FileDescription, and `Quotalune` for CompanyName.
- The guarded desktop adapter launched this exact hash in its owned Job with
  no input. Native UIA inspection observed window title `Quotalune Dev` and
  WebView pane names `Quotalune` / `Quotalune - Web content`. The adapter
  exposes WebView pane nodes but no page controls; this does **not** prove
  screenshot quality, interaction correctness, notification appearance, or
  installer upgrade behavior. The existing Personal `Quotalis.exe` process
  was only identified read-only and was not touched.
- The global guarded Dev launcher was updated from an exact old window title
  to the exact new `Quotalune Dev` title. All ten launcher unit tests passed;
  its hash, PID, Job-ownership and Dev-channel identity checks remain in place.

Remaining release gates include formal trademark/similarity clearance,
complete native visual testing, installer upgrade/shortcut migration proof,
and the broader master-goal product/security checks. The public v0.11.0
release remains untouched.

## Release and screenshot preparation — 2026-09-24

- The current update classifier now accepts `Quotalune` installer names alongside
  `Quotalis` and `QuotaArc` and recognizes the new visible product/publisher
  names for Windows package-family detection. The 26 focused updater tests pass.
  The repository URL and executable identity remain unchanged for compatibility.
- A local **internal-only** Inno candidate was compiled, not installed or
  published: `target/installer-candidate/Quotalune-internal-candidate-Setup.exe`,
  SHA-256 `4af14d73235ca9e51afd520f3dec2101c30be63819fdfb85732d5550bd821152`.
  This is not a release artifact or installer-upgrade proof. The separate GUI
  and CLI executable layout was checked after a Windows case-insensitive output
  collision during manual build preparation.
- The guarded native Dev screenshot operation returned an all-black WebView2
  image. No screenshot from that operation is suitable for README or release
  media. No claim of complete page-by-page visual QA is made.
- The public `v0.11.0` release has not been deleted or renamed. Its historical
  files still display the old name. A future release needs explicit update,
  installer, download-link and screenshot verification before public changes.

## Canonical repository integration — 2026-09-24

- Read-back confirmed `iModhish1/Quotalis` is the public repository and its
  `main` is `dde6b262`. The local development repository only had an `upstream`
  remote pointing to `nesszer/Win-CodexBar`; it did not contain an `origin` for
  the owner's repository. No push to either remote was attempted.
- The local `v0.11.0` tag resolves to an unrelated upstream commit
  (`bc9e4acb`), while the owner's public `v0.11.0` tag resolves to
  `c1902e9a`. Never use the local tag for a new build, publication or rollback.
- The development HEAD and owner `main` had no common Git ancestor. A separate
  local `release/quotalune-integration` worktree connected the histories with
  an `ours` merge while preserving the current source tree and the owner's
  published commits as parents. The resulting owner-main comparison spans
  1,257 files, so it needs full diff/security/packaging review before any push.
- Public README and getting-started copy are being prepared in that local
  integration worktree. Historical `v0.11.0` binary names and links remain
  explicitly labeled as the earlier release; no new screenshots or public
  GitHub mutations have been made.
- The local candidate now uses version `0.12.0` consistently across Rust,
  Tauri, frontend metadata, lockfile and `version.env`; the changelog has an
  unreleased entry. Focused release-pipeline tests and locked offline Cargo
  metadata pass. This is version preparation, not a completed package build.
- Release-doctor previously treated any local `v0.12.0` tag as valid. The local
  tag actually belongs to upstream (`d2692874`), while the owner's repository
  has no such tag. Release-doctor now fails when the local tag is not the exact
  candidate HEAD; the mismatch was exercised and rejected. The upstream tag
  was preserved, not rewritten. A fresh owner checkout with an owner-created
  tag is required for the final release pipeline.

## Final cross-channel clearance — 2026-09-26

Re-verified from this machine immediately before applying the packaging
rename. Every lookup used a positive control in the same batch so a broken
or rate-limited endpoint could not be misread as "available".

### Current name: `Quotalis` — CONFLICTED

| Channel | Result |
| --- | --- |
| GitHub repository search (exact) | 5 repositories, including third-party work by `mbogdan0`, `josreb-cmd`, `brendanmyrden`, `mamass-dev` |
| Public web, exact phrase `"Quotalis"` | Active commercial result: *Quotalis — AI Search Visibility Monitoring*, with a published methodology page |
| Chrome Web Store | *Quotalis for Claude* extension listed |

This is third-party use in a closely adjacent category, not merely a
repository-name collision. The public repository rename is required, not
cosmetic.

### Proposed name: `Quotalune` — AVAILABLE

| Channel | Result | Control |
| --- | --- | --- |
| github.com exact paths (`Quotalune`, `quotalune`, `-desktop`, `-app`, `-cli`) | 404 / free | `Quotalis` returned 200 |
| GitHub repository search | 0 results | `quotalis` returned 5 |
| Similarity sweep (`quotaluna`, `quotallune`, `quota+lune`, `quotalune app`, `QuotaLune`) | 0 results each | — |
| Public web, exact phrase `"Quotalune"` | 0 organic results | `"Quotalis"` returned 6 |
| npm, crates.io, PyPI, NuGet, RubyGems, Packagist | 404 / free | `npm/monolog` returned 200 |
| Docker Hub, Hugging Face | HTTP 200 with empty result bodies (free) | `monolog` returned populated results |
| Apple App Store, Microsoft Store | 0 results | — |
| Domain registration, 12 TLDs via RDAP (`.com .app .dev .io .ai .net .org .co .studio .tech .xyz .sh`) | all unregistered | `google.com` returned 200 |

Domain availability is a point-in-time observation, not a reservation.

### Legal status

This is a name-screening record only. It is **not** a trademark clearance and
**not** a legal opinion. USPTO, WIPO and Saudi trademark registers were not
searched, and no similarity assessment against registered marks in the
intended release markets was performed. No public release may assert that
`Quotalune` is legally protected or globally unused. A professional
trademark search remains advisable before commercial expansion.

## Packaging identity rename — 2026-09-26

The stable shipping identity now carries the Quotalune brand end to end.

**Changed**

- `tauri.conf.json`: `mainBinaryName` `Quotalis` → `Quotalune`; bundled
  notification artwork renamed `quotalis-icon-128.png` →
  `quotalune-icon-128.png`.
- `paths.rs`: `USER_AGENT`, stable `INSTALLER_STEM`, and stable
  `CURRENT_EXE_NAME` now say `Quotalune`. The pinning test was renamed to
  `public_brand_is_quotalune_legacy_windows_identity_is_quotaarc`.
- Inno installer: ships `Quotalune.exe`, produces
  `Quotalune-<version>-x64-Setup.exe`, installs to
  `%LOCALAPPDATA%\Programs\Quotalune`, and registers the renamed toast
  artwork. Publisher/support/update URLs point at `iModhish1/Quotalune`.
- Release pipeline: required-asset contract, canonical-origin assertion
  (`imodhish1/quotalune`), build output paths, portable-archive contents and
  smoke-install expectations all use the Quotalune names.
- `updater.rs`: `is_stable_windows_binary_name` now recognises
  `Quotalune.exe` as current.

**Deliberately unchanged**

- `AppId=QuotaArcDesktop` (Inno upgrade-continuity key).
- Bundle identifier `app.quotaarc.desktop` and the toast AUMID — the
  documented Option A decision that keeps Start Menu pins and in-place
  upgrades working.
- `Quotalis.exe` retained inside the updater's stable-binary list so an
  in-place update launched from an already-installed Quotalis build still
  resolves its own install directory and uninstaller.
- Dev channel identity: `QuotalisDev.exe`, the `Quotalis-Dev` installer stem
  and `app.quotalis.desktop.dev`. These enforce Dev/Personal isolation and
  are never shipped; they are a safety contract, not a brand surface.
- CLI binary names (`quotalis.exe`, `quotalis-cli.exe`,
  `quotalis-desktop.exe`) and the `quotalis_core` crate name.
- Smoke-install refusal checks for existing `Quotalis` / `QuotaArc` installs,
  shortcuts and running processes — these must keep detecting an older
  install so the disposable smoke environment never overwrites the owner's
  Personal installation.

### Verification

- `cargo test -p quotalis_core paths::` — 5 passed.
- `cargo test -p quotalis_core updater::` — 25 passed.
- `cargo test -p quotalis_core notifications::` — 48 passed.
- `scripts/windows-portable.tests.ps1` — passed (exact archive entries,
  hashes, immutable output, safe cleanup).
- `git diff --check` — clean.

### Still required before publication

- Installer upgrade/shortcut migration proof on a real disposable Windows
  environment (the `DefaultDirName` change affects fresh installs only;
  upgrades reuse the previous directory via `UsePreviousAppDir`).
- Fresh build and installer packaging from the exact release HEAD.
- Complete native visual evidence. The previous native capture attempt
  returned an all-black WebView2 image, so the mandatory native gate is
  still open and the public release remains gated.
- Repository rename on GitHub, then CI verification on the renamed remote.
