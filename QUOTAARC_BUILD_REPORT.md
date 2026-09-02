# QUOTAARC_BUILD_REPORT

Date: 2026-09-02 · Version 0.1.0 · Repository: local clone (independent repo cloned from
nesszer/Win-CodexBar with full history; `upstream` remote retained)

---

## A. Executive summary

QuotaArc exists as a working, tested, packaged Windows desktop product. Phase 0 verified the
foundation (Win-CodexBar: MIT, active, 1,388 backend + 291 frontend tests green at import) before
any code moved. QuotaArc then re-branded the identity into one centralized module, added its own
Surface Engine (Edge Arc + Top Arc — the signature product surfaces), an original design system
and motion system, brand assets, a Tauri-native release pipeline (NSIS per-user installer
validated end-to-end on this machine, MSI bundles, portable zip), CI/CD, and the required
documentation set. Final gate: **1,390 backend + 366 shell + 297 frontend tests green, clippy
`-D warnings` clean, rustfmt clean, frontend build clean.**

Measured performance (release build, tray-only): 139 ms launch, 0% idle CPU over 30 s, 46.2 MB
main-process working set (162.3 MB with the WebView2 tree — reported honestly).

## B. What was inherited

- Provider engine: 67 providers (`rust/src/providers/`), Provider trait + factory, adaptive
  refresh, pace/forecast math, cost pricing, redaction, SQLite cost scanning.
- Credential security: DPAPI secure files, browser detection + opt-in cookie import, token
  accounts, multi-account Codex core (codexcontrol, MIT, NOTICE retained).
- Tauri 2 shell: tray bridge/menu, window shell, auto-refresh, proof harness, float bar.
- CLI (`quotaarc.exe`), settings model + RawSettings migration chain, locale system (8 languages),
  updater (GitHub releases + SHA-256 + silent-apply script), Inno Setup script (retained as
  reference).

## C. What was rewritten / restructured

- Identity: `rust/src/paths.rs` is now the single source of truth; all 17 scattered
  `join("CodexBar")` sites route through it; registry Run value, toast AUMID, HTTP user agent,
  installer naming, log stems all derived. `%APPDATA%\QuotaArc` etc. — zero collision with
  Win-CodexBar.
- Updater: pointed at `quotaarc/quotaarc`; installer-name handling updated to
  `QuotaArc-X.Y.Z-x64-Setup.exe`; tests pin the new naming.
- Packaging: Tauri NSIS (per-user) is primary; legacy Inno path superseded.
- CI: GitHub Actions replaces the CircleCI-only flow (PR gate + release workflow).
- Internal, deliberately retained: `CODEXBAR_*` env protocol, crate symbol names, proof-harness
  env vars — all invisible to users and documented as divergences to keep upstream commits
  portable.

## D. What was built from scratch

- **Surface Engine**: `surface_kit.rs` (shared native overlay toolkit incl. content-fullscreen
  probe) + `surfaces.rs` (Edge Arc, Top Arc lifecycle, settings patch/read commands, fullscreen
  watcher, tray toggles) + frontend surfaces (`EdgeArc`, `TopArc`) + Surfaces settings tab.
- **Design system**: tokens (dark-canonical + light), status semantics (color + label + stroke
  bias), ArcGauge, AnimatedNumber, Motion for React integration with Full/Reduced/Off,
  DesignSystemProvider. Component tests included.
- **Brand**: original capacity-arc mark (SVG sources), full icon pipeline (16–512 px + ICO),
  tray marks, BRAND/DESIGN_DECISION docs. Recognizable at 16×16.
- Product screenshots captured from live surfaces; hero placeholder staged for a final GIF.

## E. Upstream repositories used

nesszer/Win-CodexBar `5a128f24` (foundation, MIT) · steipete/CodexBar (root project, concepts) ·
codexcontrol (vendored, MIT, NOTICE) · CodeZeno, PILLAR, burnrate (concepts/patterns only).

## F. License status

MIT. Upstream copyright chain preserved (LICENSE, NOTICE, THIRD_PARTY_NOTICES.md,
docs/UPSTREAM_PROVENANCE.md). No GPL/AGPL code. No proprietary assets. cargo/pnpm audits clean on
shipped dependencies (dev-chain advisories and Linux-GTK unmaintained warnings documented in
docs/DEPENDENCY_AUDIT.md).

## G. Providers working

All 67 inherited providers compile and are registered (parse/auth logic covered by 1,390 backend
tests). Live validation requires per-provider credentials, which this environment does not have;
the seed harness validated the full data path with a synthetic snapshot. Claude/Codex live
validation is pending credentials (exact next action below).

## H. Surfaces working

- **Edge Arc** — working (E2E verified): edge snap, hover details, resize-driven layout.
- **Top Arc** — working (E2E verified): compact pill → expanded morph, topmost.
- **Tray** — working (inherited + new surface toggles).
- **Dashboard/Settings** — working (inherited + new Surfaces tab).
- **Float bar** — working (inherited, unchanged).

## I. Windows integration status

Verified on this machine (Win11 26200): per-user install/uninstall, DPI-scaled positioning,
always-on-top persistence, no-activate surfaces, skip-taskbar, content-fullscreen watcher.
Remaining hardening (Phase 5 backlog): scripted multi-monitor/DPI matrix, Explorer-restart
reassertion for the new surfaces, sleep/resume soak.

## J. Installer status

`QuotaArc_0.1.0_x64-setup.exe` (8.1 MB, NSIS per-user): silent install → launch → silent
uninstall all verified; registry entry correct; user data retained by policy. MSI: 8 language
bundles built. Portable zip built (11 MB).

## K. Auto update status

Inherited updater architecture retained and re-targeted (repo slug, installer naming, SHA-256
verification, relaunch script — unit tested). End-to-end update flow blocked on the first
published GitHub release; the updater degrades gracefully (reports check failure / no update)
until then.

## L. Test results

Backend 1,390 passed · Shell 366 passed · Frontend 297 passed (48 files) · clippy `-D warnings`
clean (both crates) · rustfmt clean · locale drift check OK (824 keys) · tsc + vite build clean.

## M. Performance results

See docs/PERFORMANCE.md. Headline: 139 ms launch · 0% idle CPU · 46.2 MB main / 162.3 MB tree
working set · installer 8.1 MB. Release-vs-release upstream A/B remains open (POLISH).

## N. Security results

No secrets in logs (central redactor, tested); DPAPI secure files; cookie import opt-in; CSP
retained; updater verifies SHA-256; no shell built from provider input; audits clean. Unsigned
binaries honestly labeled (docs/CODE_SIGNING.md).

## O. Screenshots / proof

`docs/images/top-arc-pill.png`, `docs/images/edge-arc-strip.png`, `docs/images/dashboard.png`
(captured from the running release build with seeded data this session).

## P. Known limitations

1. Installers unsigned (no certificate) — SmartScreen warning likely until signed.
2. Live provider validation not possible without credentials in this environment.
3. Onboarding first-run flow is the inherited tray-first experience, not the 6-screen premium
   flow from the brief.
4. Edge Arc/Top Arc lack free-drag positioning (edge/monitor anchoring only, by design).
5. No QuotaArc GitHub repository exists yet (creation requires the owner's account); updater and
   About links target `quotaarc/quotaarc` and resolve gracefully.
6. Taskbar Arc surface (taskbar-adjacent mode) not implemented — floating/edge modes cover v1.

## Q. Remaining work (prioritized)

- **BLOCKER**: none for a local release; for public release — create the GitHub repo
  (`quotaarc/quotaarc`), push, and cut a signed-or-labeled v0.1.0 tag.
- **CRITICAL**: configure code-signing certificate (Azure Trusted Signing or SignPath
  Foundation application); validate Claude + Codex live with real credentials.
- **HIGH**: onboarding first-run flow; Taskbar Arc; upstream `main` re-sync before release.
- **MEDIUM**: multi-monitor/DPI scripted matrix + Explorer-restart reassertion for surfaces;
  release-vs-release performance A/B; history retention UI (bounded retention, export, erase).
- **LOW**: dashboard screenshot polish for README hero/GIF; MSI per-user scope review for Intune.
- **POLISH**: Edge Arc drag-unlock mode; Top Arc notification state morphs; motion QA pass per
  docs/MOTION.md.

## R. Exact release command

```powershell
# Local: build the release candidate
pnpm --dir apps/desktop-tauri install --frozen-lockfile
pnpm --dir apps/desktop-tauri exec tauri build --bundles nsis,msi
# artifacts in target/release/bundle/{nsis,msi}

# Public release: push the repo, then tag — CI builds and publishes a draft
git remote add origin https://github.com/quotaarc/quotaarc.git
git push -u origin main
git tag v0.1.0 && git push origin v0.1.0   # → release workflow → draft release
```

## S. Exact user install experience

Download `QuotaArc-0.1.0-x64-Setup.exe` → double-click → install (no admin) → QuotaArc launches →
enable providers in Settings → Providers (credential status shown per provider) → turn on Edge
Arc / Top Arc in Settings → Surfaces or the tray menu. Uninstall via Windows Settings → Apps or
`uninstall.exe`; user data is kept unless deleted manually.

## T. Recommended next development wave

1. Publishing + signing (BLOCKER/CRITICAL above).
2. Onboarding flow (60-second setup: discover → select providers → pick surface → autostart →
   done), reusing the credential-detection commands.
3. History + intelligence UI: bounded retention, export/erase, forecast cards with confidence.
4. Taskbar Arc using the proven surface_kit + CodeZeno-derived positioning concepts.
5. Upstream re-sync (`git fetch upstream` + docs/UPSTREAM_SYNC.md process) to pull provider fixes.
