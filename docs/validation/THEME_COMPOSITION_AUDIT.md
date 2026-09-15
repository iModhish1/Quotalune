# Theme Composition — architecture trace + Wave 1B implementation note

## Existing architecture (traced before writing any code, per §1)

Two appearance axes already have real, working, independently-persisted
state and live cross-window propagation:

- **`catalogTheme`** (Main Application / Structure Theme): `Settings.catalog_theme`
  (`rust/src/settings.rs`), set via the `set_catalog_theme` command
  (`apps/desktop-tauri/src-tauri/src/command_profiles.rs`), which already
  supports three real scopes — `global`, `profile`, and per-surface
  (`surface:<taskbar|top|edge|hud|quick|dashboard>`, stored in
  `Settings.surface_catalog_themes`). Resolution precedence is
  `surface > profile > global > default`, implemented once in
  `themeResolution.ts`'s `resolveCatalogTheme()` and reused by every themed
  surface (confirmed in `useStageRuntime.ts`, `useDashboardStructureTheme.ts`).
- **`theme`** (Light/Dark/System): `Settings.theme: ThemePreference`
  (`rust/src/settings/types.rs`), set via `update_settings`.

Both ride the same propagation path: any mutating command emits
`app.emit("quotalis:settings-updated", ())`; every open window's
`useSettings`/`useStageRuntime` instance listens for that event and
refetches, so changes apply live without restart. **This wave reuses that
exact event — no second event bus was added.**

Two more scopes already have their own independent persistence with no
theme linkage: **tray** (`tray_icon_mode`, `tray_scale_percent`,
`provider_tray_configs`) and **workspace background**
(`WorkspacePreferences.background`/`background_motion`/`background_intensity`).
**Logo finish** (`logo_variant`/`logo_scale_percent`) is also independently
persisted in `Settings`, mirrored to `localStorage` only as a same-webview
responsiveness cache (`logoAppearance.ts`) — Rust settings remain the
system of record. The closest existing match to a **"provider identity"**
appearance scope is `LimitPresentation.identity` (a 24-value card-skin
enum), already split into `global_limit_presentation` +
`provider_limit_presentation` per-provider overrides, and already
explicitly documented as decoupled from Structure Theme
(`ProviderIdentityGallery.tsx`'s own comment: "no per-theme recommended-
identity mapping currently exists").

**Key finding this trace produced**: none of those four scopes
(quotalisLogo/providerIdentity/tray/workspaceBackground) has ever had a
defined relationship to the Main Application theme — they are, and always
have been, independent flat settings. "Follow Global" for them is
therefore new semantics, not a rename of something that already existed,
and it needs *something* to follow: a theme's own recommendation for that
scope. That recommendation concept did not exist either. `floatingStructures`
is the one exception — it already has real Global-vs-Override semantics via
`surface_catalog_themes`, so it deliberately gets no new field at all (see
below).

## What was built this wave

1. **`CatalogTheme.recommendedAppearance`** (`themeCatalog.ts`) — an
   optional per-theme metadata block (`quotalisLogo`, `providerIdentity`,
   `trayStyle`, `workspaceBackground`). Populated for `CANONICAL_THEME` only;
   extending it across the rest of `THEME_CATALOG` is real design work
   (choosing an actual recommended finish per theme), left open rather than
   guessed.
2. **`rust/src/settings/appearance_composition.rs`** — `AppearanceSource`
   (`Global | Override`) and `AppearanceComposition` (one field per scope,
   `quotalisLogo`/`providerIdentity`/`tray`/`workspaceBackground` —
   `floatingStructures` intentionally absent, see above), added to `Settings`
   as `appearance_composition`, mirrored through `RawSettings`/`From<RawSettings>`.
   Default is **all-Override**, meaning a user who has never touched this
   field keeps exactly the appearance they already have — the "no
   reset-to-default" migration guarantee is satisfied by the field default
   itself rather than a one-shot marker-file migration (contrast
   `promote_tray_icon`, whose default genuinely changes behavior for
   upgrading users and does need a marker).
3. **`set_appearance_scope` command** (`command_profiles.rs`) — sets one
   scope to Global/Override, reuses `settings.save()` +
   `quotalis:settings-updated`, rejects `"floatingStructures"` and unknown
   ids rather than silently ignoring them.
4. **`appearanceComposition.ts`** (frontend mirror) — `resolveAppearanceScope()`
   (SOURCE vs RESOLVED, §16: Override → explicit value; Global → theme's
   recommendation, falling back to the explicit value when the theme has no
   opinion, never blanking), `appearanceScopeSummaryLabel()` (the "Following
   Main Application" vs. resolved-value summary line from §6's example),
   `setAppearanceScope()` invoke wrapper.
5. Bridge wiring: `appearance_composition` added to the settings snapshot
   DTO (`bridge.rs`) and the frontend `SettingsSnapshot` type (`bridge.ts`),
   so the current composition state round-trips to the frontend like every
   other setting.

Tests: 5 Rust unit tests (`appearance_composition.rs`) + 2 command-level
Rust tests (`command_profiles.rs`) + 9 TS unit tests
(`appearanceComposition.test.ts`) — data model, migration-default, scope
rejection, JSON round-trip, resolution (Override/Global/no-recommendation
fallback), and summary-label behavior.

## Legacy migration proof (Wave 1B FINAL §2–4)

The prior report's migration claim ("default-Override preserves current
appearance with zero migration code beyond serde defaults") was accepted by
reasoning alone, not proof. Added 5 real tests in
`rust/src/settings/tests.rs`'s `appearance_composition_legacy_migration_tests`
module, deserializing realistic pre-Wave-1B `settings.json` fixtures through
the actual `Settings`/`RawSettings` load path (not constructed via a
`Settings { .. }` literal, which would skip that boundary):

- **Fixture A** — a v0.11-style file with only a non-default `catalog_theme`.
- **Fixture B** — Light mode + a custom `catalog_theme`.
- **Fixture C** — Dark mode + a `surface_catalog_themes` override.
- **Fixture D** — pre-existing explicit `logo_variant`/`provider_tray_configs`/
  `workspace_preferences.background` values.

**§3's ownership-intent question, answered from source, not assumed**: did
any of `logo_variant`/`global_limit_presentation`/`provider_tray_configs`/
`workspace_preferences.background` ever behave as "follows `catalog_theme`"
pre-Wave-1B? No — grepping the full settings/resolution code (done in the
original architecture trace) found zero `catalog_theme`-conditional logic
touching any of them. There is no legacy "Follow Global" behavior to
preserve for these four scopes, because that coupling never existed. So
`AppearanceComposition::default()` (all-`Override`) is not an approximation
that happens to preserve today's appearance — it is the literally correct
migration, because `Override` means exactly "keep behaving the way this
field always behaved: independently of `catalog_theme`." Fixtures A–D each
assert this explicitly, and a 5th test round-trips all four fixtures through
save→reload and asserts nothing else in the ~90-field `Settings` struct is
lost or altered (via a full-value JSON comparison, with `enabled_providers`
sorted first since it round-trips through a `HashSet` and has no stable
serialization order — an unrelated, pre-existing property of that field
that would otherwise make the comparison spuriously flaky).

One real bug in the fixture itself was caught and fixed by running the
tests, not written around: an invented background id
(`"atmosphere-nebula"`) silently normalizes to `"cosmic"` via
`WorkspacePreferences::normalized()`'s real validation (it only accepts
`"atmosphere-"`/`"motion-"` + zero-padded `01`-`12`, a curated name, or
`"custom:<uuid-v4>"`) — the fixture was corrected to a real generated-
background id (`"atmosphere-05"`) so the assertion tests actual
preservation rather than a value that was already being reset by existing,
unrelated code.

## What is genuinely NOT built this wave — not to be claimed done

- **Apply Theme scope-selection sheet** (§7–10): no UI. This is the biggest
  remaining piece — a dialog with per-scope Current→New toggle rows, real
  previews per scope, Select All/Clear/Recommended/Cancel/Apply, wired to
  `setAppearanceScope`/`setCatalogTheme`.
- **Real scope previews** (§8): none rendered — needs actual mini-surface
  renders per scope, not built.
- **Standalone Light/Dark/System control placement** (§11) — the
  `theme`/`ThemePreference` setting itself already exists and is already
  independent of `catalogTheme` at the data layer (confirmed by the trace:
  they are unrelated fields, changing one never touches the other) and
  already propagates live via the same event; a dedicated, prominently
  discoverable UI control for it (vs. wherever it lives in Settings today)
  was not audited or built this wave.
- **Hard mix-and-match acceptance cases (§12–14)**: not native-tested this
  wave — no Dev build was produced.
- **RTL/Light native verification of the composition UI (§17–18)**: no UI
  exists yet to verify.
- **`recommendedAppearance` for the rest of the theme catalog**: only
  `CANONICAL_THEME` is populated.
- Reel/Notch geometry closure, shared loading-UX components, and native
  structure QA are tracked separately — not part of this document.

## Verdict

THEME COMPOSITION DATA MODEL: **real, tested, reuses the existing
resolver/event/persistence architecture with no parallel system.**
THEME COMPOSITION UI (Apply sheet, previews, RTL/Light native verification):
**not built — PARTIAL overall for theme composition as a whole.**
