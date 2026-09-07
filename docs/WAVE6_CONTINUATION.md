# Wave 6 continuation checkpoint

Written per the owner's explicit context-limit protocol: finish a coherent
slice, test it, commit it, record exact state here, continue from this file
in the next session — do not ask the owner to re-scope.

## Branch / HEAD

- Branch: `feature/v9-theme-runtime`
- HEAD: `4596468e` — "Add a real first-class Profiles page (Wave 6 Phase 2)"
- Prior checkpoint: `f902cec8` — "Make Collections a first-class Settings destination"

## Execution order (owner's 21-phase spec)

1. ~~Profiles page~~ — **DONE** (this checkpoint)
2. ~~Main navigation normalization~~ — **NOT STARTED**
3. Structure Theme vs Icon/Provider Presentation UX — NOT STARTED
4. Follow Structure / Independent mode — NOT STARTED
5. Visual theme-bleed investigation — NOT STARTED
6. Theme Composer — NOT STARTED
7. Full UI density audit — NOT STARTED
8. Density/layout corrections — NOT STARTED
9. Before/after proof — NOT STARTED
10. Bounded Fable concept pass — NOT STARTED
11. New Structure Themes — NOT STARTED
12. New Icon/Provider Presentation Themes — NOT STARTED
13. Theme combination matrix — NOT STARTED
14. Light-theme validation — NOT STARTED
15. Motion ownership — NOT STARTED
16. Performance — NOT STARTED
17. Full Dev/native QA — NOT STARTED
18. Version decision — NOT STARTED
19. Personal backup — NOT STARTED
20. Personal promotion — NOT STARTED
21. Final verification — NOT STARTED

(Numbering matches the owner's message verbatim; "Collections" from the
prior checkpoint is phase 0/already-accepted-complete, not renumbered here.)

## What's actually done and verified (not asserted)

### Phase 1 — Collections (checkpoint `f902cec8`, accepted complete, not touched this session)

- `MainRoute::Collections` → `settings_tab() == "collections"`, first-class
  tab, no more "Configure collections (experimental)" disclosure.
- Native-verified: clicked "Collections" in the real sidebar, confirmed
  direct render, screenshot sent to owner.

### Phase 2 — Profiles page (checkpoint `4596468e`, this session)

- `MainRoute::Profiles` → `settings_tab() == "profiles"`, mirrors the
  Collections routing pattern.
- New Tauri command `set_account_profile_membership` (thin extension of
  the existing `account_ids` field — no second membership model).
- New `ProfilesTab.tsx`/`.css`: list, switch active, create, rename inline,
  duplicate, delete (guarded — last profile cannot be deleted), assign
  theme/structure theme, toggle per-profile surfaces, toggle account
  membership. Reuses `useProfileStore` from `ProfileSwitcher.tsx` — no
  duplicate store logic.
- Tray: "Profiles" submenu now ends with a real "Manage Profiles..." item
  (previously a documented dead end — the submenu comment literally said
  "No dedicated manage profiles page exists in the main app yet").
- **Not done**: reordering profiles has no UI (backend `reorder_profiles`
  command exists but is unused by the new page — not required by the
  owner's capability list, skipped deliberately, not an oversight).
- **Not done**: per-profile usage thresholds (`highUsageThreshold`,
  `criticalUsageThreshold`) have no editable UI — no backend command
  exists to update them (`update_profile` doesn't take them), and the
  owner's instruction was explicit: "Do not invent unsupported profile
  fields." Left read-only-by-omission (not displayed at all, since a
  read-only threshold with no way to change it would be confusing UI
  clutter). If the owner wants these editable, `update_profile` needs a
  new `high_usage_threshold`/`critical_usage_threshold` parameter first.
- **Not done**: per-provider presentation override *within* a profile —
  out of scope for Phase 2, belongs to Phase 3/4 (Structure vs
  Icon/Provider Presentation UX).

## Tests (all currently green)

- Frontend: `npx vitest run` → **672/672 passing** (120 → 121 files; new
  `ProfilesTab.test.tsx` adds 11).
- Frontend typecheck: `npx tsc --noEmit` → clean.
- Rust shell crate: `cargo test --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml`
  → **445/445 passing** (442 → 445; 3 new: `profiles_submenu_lists_each_
  profile_and_ends_with_manage_profiles`, `membership_toggle_adds_and_
  removes_without_duplicating`, `membership_toggle_rejects_unknown_
  account_or_profile`).
- Rust shared crate: `cargo test --manifest-path rust/Cargo.toml` →
  **1474/1474 passing** (unchanged — `rust/src/profiles.rs` itself wasn't
  touched this session, only its Tauri-layer consumers).
- `cargo clippy --all-targets -- -D warnings`: clean, both crates.
- `cargo fmt --all -- --check`: clean, both crates (fmt found and this
  session fixed real formatting drift in the new Rust code before commit).
- Locale-drift check (`node apps/desktop-tauri/scripts/check-locale-drift.mjs`):
  **970/970 keys matched** (967 → 970; 3 new keys: `TabProfiles`,
  `ProfilesPageHelper`, `TrayManageProfiles` — English only; the other 8
  locales fall back to English for these per existing, accepted policy).
- Secret scan / skip-focus scan / `git diff --check`: clean on both commits
  this session.

## Native proof (real Dev binary + WebView2 IPC via CDP, not unit tests only)

- Collections: clicked "Collections" in the real sidebar → renders the
  live `CollectionSettings` editor directly, `stillHasExperimentalDisclosure:
  false`. Screenshot sent to owner.
- Profiles: clicked "Profiles" in the real sidebar → created "Native QA
  Profile" through the actual create-profile form → clicked the real
  "Switch" button → confirmed the "Active" badge moved to the new profile.
  Screenshot sent to owner. **Cleanup performed**: test profile deleted,
  "Default" restored active, `topArcEnabled` restored to `true` (it was
  temporarily set `false` via IPC only to force the main workspace to
  auto-open for the test — same technique used for the Collections proof —
  and was verified restored via `get_surface_settings` before/after).
- **Still not done** (and cannot be done in this sandbox): a physical
  mouse click on the actual Windows system tray icon. This is the
  pre-existing, owner-accepted "EXTERNAL MANUAL VERIFICATION REQUIRED"
  limitation from the tray-integration wave — it does not block anything
  else in this sequence. The tray→Profiles routing itself (`"manage_
  profiles"` menu id → `MenuAction::OpenMainRoute(MainRoute::Profiles)`)
  is verified at the Rust unit-test level.

## Known defects found and fixed this session (not pre-existing bugs left in place)

1. Missing Collections tab icon in `Settings.tsx`'s `TabIcons` record —
   caught by `tsc` immediately after wiring the new tab; fixed.
2. Stale `TrayShowWindow` locale key: deleted from the locale macro and
   `en-US.ftl` during the earlier tray-restructuring wave, but the
   translated lines were left behind in all 7 other locale files, which
   Fluent's completeness check rejects. Removed the 7 stale lines.
3. `cargo fmt` formatting drift in the new Rust code (a multi-line
   `ProviderAccount::new(...)` call and a multi-line `.map()` closure) —
   caught by `cargo fmt --check`, fixed by running `cargo fmt`.
4. Accessible-name collision in the new `ProfilesTab`: the "Rename X"
   trigger button and the resulting rename `<input>` both carried the
   aria-label `"Rename X"`, which the test suite itself caught
   (`getByLabelText` found two matches). Fixed by renaming the input's
   label to `"New name for X"`.

## Exact next step (Phase 3 — main navigation normalization)

Files to start from:
- `apps/desktop-tauri/src/surfaces/settings/settingsTabs.ts` — current
  `TAB_META` order: general, providers, providerDisplay, collections,
  profiles, notifications, menuBar, menu, usageSpend, surfaces, themes,
  advanced, about. This is the thing to reorganize/re-group.
- `apps/desktop-tauri/src/surfaces/Settings.tsx` — sidebar rendering +
  `TabIcons` record.
- The owner's target destination set: Provider Display, Dashboard,
  Collections, Profiles, Providers, Themes, Usage, Notifications,
  Settings/Advanced. Note "Dashboard" is not currently a `SettingsTabId`
  at all — need to check whether `SurfaceMode::PopOut`/the flyout window
  is what "Dashboard" refers to, or whether it needs to become a real tab.
  Investigate `apps/desktop-tauri/src/surfaces/PopOutPanel.tsx` and
  `SurfaceMode` before assuming.
- Also apply the density complaint (large empty margins, oversized
  cards) while touching navigation — the owner was explicit these two
  are linked ("While normalizing navigation: inspect the actual layout
  ... reduce ... unnecessary outer padding ... huge section gaps").
  Consider whether to fold this into Phase 3 or keep it strictly for
  Phase 7/8 (full density audit) — the owner's spec lists both a
  navigation-density note under Phase 3 AND a full separate audit later;
  do the full audit (Phase 7) as the systemic fix, but don't ignore
  egregious cases spotted while doing Phase 3.

## Personal status (must not be touched until Phase 19-20)

- Personal is on **0.10.1**. Not touched this session. No backup taken
  this session (not needed yet — Dev-profile-only native verification).
- Version bump to **0.11.0** is the working assumption per the owner's
  semver guidance, to be confirmed at Phase 18.

## Process note for the next session

- The Dev debug binary (`target/debug/QuotaArc.exe`) was running under
  `QuotaArc-Dev` profile with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`
  for native verification. A local `pnpm run dev` (vite on port 1420) must
  also be running for the debug binary's `devUrl` to resolve — the debug
  binary does NOT embed `frontendDist` the way a release build does.
- The Dev profile's `topArcEnabled` is normally `true` (a Quota Island
  surface is configured). This means a plain launch does NOT auto-open
  the main workspace (`unattended_by_compact_surface` is false — see
  `main.rs::launch_behavior`), which is correct product behavior, not a
  bug — but it means native verification of "does X route open in the
  main workspace" requires either using the actual tray/menu path or
  temporarily toggling `topArcEnabled` false via `update_surface_settings`
  IPC, relaunching, and restoring it afterward. Always restore it —
  verified via `get_surface_settings` before/after both times this
  session.
- Scratch CDP verification scripts from this session live in `.local/`
  (e.g. `.local/native-verify-profiles.mjs`) — not committed, safe to
  delete or reuse as a template for the next phase's native checks.

## Overall verdict so far

**NOT PASSED** — 2 of 21 phases complete and verified. Continuing per the
owner's explicit "do not stop, do not ask to re-scope" instruction.
