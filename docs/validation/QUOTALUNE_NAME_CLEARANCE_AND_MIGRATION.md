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
