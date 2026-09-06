# Collections — implementation note and validation (0.10.1)

## What "Collections" actually means in this source (not inferred from the name)

Before writing any code, the existing model was inspected directly:
`rust/src/settings/collections.rs`, `apps/desktop-tauri/src/surfaces/collections/collectionModel.ts`,
`apps/desktop-tauri/src-tauri/src/collection_settings.rs`,
`apps/desktop-tauri/src/demo/CollectionsStudio.tsx`, and
`apps/desktop-tauri/src/surfaces/settings/tabs/CollectionSettings.tsx`.

Conclusion: **Collections is not a CRUD list of named, switchable presets** (that
model does not exist anywhere in source). It is a single persisted
`CollectionLayout`:

```
CollectionLayout {
  version, revision,            // schema version + optimistic-concurrency counter
  view: horizontal|vertical|grid,
  scale: 75..125,
  groups: [{ id, items: [provider_id...], x, y }],   // provider clusters + canvas position
  fields: { provider_id -> { name, value, reset } }, // per-provider visible fields
}
```

A "collection" (lowercase, as used in `collectionModel.ts`'s `Collection` type)
is one *group* within that single layout — a cluster of provider IDs the user
detached/merged via drag, with its own canvas position. There is no separate
"Profile" concept to confuse this with: Profiles (`rust/src/settings.rs`'s
profile switching) are a completely different, unrelated axis (which account
context is active), already kept separate in source, and this work does not
touch them.

## State before this work

- **Rust**: fully implemented — persistence, `validate()` (id format, group/item
  uniqueness, group count ≤ 64, item count ≤ 64, finite/bounded x/y, orphan-field
  rejection, unknown-field rejection), optimistic-concurrency `advance_revision`
  (rejects stale saves), a `quotaarc:collections-changed` broadcast event on
  save. 6 Rust tests in `collections.rs` + 2 in `collection_settings.rs`, all
  already passing.
- **Frontend editor**: fully implemented — `CollectionsStudio.tsx` (mounted via
  `CollectionSettings.tsx` in Settings) supports detach/merge-by-drag, move
  earlier/later (keyboard-reachable, no drag required), 3 view modes, a
  75–125% scale slider, per-provider field visibility, pagination for groups
  with >3 items, Escape-to-cancel, and offline-placeholder providers so a saved
  group never silently loses a member whose live snapshot disappeared. 4 tests,
  already passing.
- **The one real gap, confirmed by grep across the whole frontend+backend
  source**: nothing outside the Settings editor and the two Rust get/set
  commands ever read `collection_layout`. `collectionLayout()`'s own doc
  comment says it plainly: *"Logical design dimensions; DOM and native-window
  proof remain separate."* The editor's own UI copy said so too: *"desktop
  collection rendering is not enabled yet."* A save had nowhere to go.

## What this wave implements

A new, independent, real native window — **not** a rewrite of the existing
model, and **not** a fabrication of unsupported complexity (no new "Collection"
CRUD concept, no separate-OS-window-per-group lifecycle invented beyond what
the schema already supports):

- `apps/desktop-tauri/src-tauri/src/shell/collections_window.rs` — a detached
  `QuotaArc Collections` window, modeled directly on `settings_window.rs`'s
  geometry pattern (full x/y/width/height persisted via `geometry_store`,
  restored against whichever monitor still contains it, falls back to the
  primary monitor otherwise — i.e. monitor-loss recovery is handled the same
  way Settings already handles it). Hide-not-close, matching every other
  detached window in this app. 7 new Rust tests (label/key stability, default
  centering, honoring a valid stored geometry, clamping an off-monitor stored
  position, minimum-size floor, and corrupt/non-finite scale-factor handling).
- Three new Tauri commands (`open_collections_window`, `close_collections_window`,
  `toggle_collections_window`) and one new tray menu entry ("Collections"),
  wired the same way the existing "Pop Out Dashboard" flyout is wired.
- `apps/desktop-tauri/src/surfaces/collections/CollectionsNativeView.tsx` — the
  window's content. Deliberately **read-only** (editing stays in Settings,
  this only displays the saved result): loads `getCollectionLayout()`, renders
  every group using the *exact same* `collectionLayout()` sizing math the
  editor's preview already used, resolves live provider data via the same
  `useStageRuntime` hook `CollectionSettings.tsx` uses, keeps a saved-but-
  offline provider visible instead of dropping it, and subscribes to
  `quotaarc:collections-changed` so saving a new layout in Settings updates
  the native window immediately without a restart. 6 new frontend tests.
- Updated `CollectionsStudio.tsx`'s own copy (and its test) to stop claiming
  "rendering pending"/"not enabled yet", since it no longer is.

## What this wave explicitly does NOT implement (concrete, not vague)

- **One separate OS window per group.** All groups in the saved layout render
  inside the single Collections window's canvas at their stored x/y
  (canvas-relative, exactly as `CollectionsStudio`'s own preview already
  worked) rather than each group becoming its own top-level native window.
  The schema (`CollectionGroup.x/y`) doesn't require separate OS windows to be
  meaningful — this is a legitimate, considerably lower-risk reading of
  "native collection rendering" that reuses the already-built, already-tested
  canvas layout rather than inventing a dynamic multi-window spawn/destroy
  lifecycle from scratch. Making each group independently draggable as its own
  OS-level window (with its own persisted position, monitor-loss recovery
  *per group*, and creation/destruction as groups are detached/merged) remains
  a real, separately-scoped follow-up if the product actually wants that.
- **Drag-to-reposition groups from the native window.** `CollectionsNativeView`
  is read-only; repositioning groups still happens in the Settings editor's
  canvas (which already supports it) and is reflected here on save.
- **A dedicated `docs/validation/` native screenshot** of this specific window
  — see the native-proof section below for what was and wasn't captured.

## Test gate

- Rust shell: `cargo test --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml`
  → 434 passed (427 pre-existing + 7 new), 0 failed, 0 ignored.
- Frontend: `pnpm vitest run` → 120 files / 659 tests passed (119/652
  pre-existing + 1 App-routing test + 6 `CollectionsNativeView` tests, with
  `CollectionsStudio.test.tsx`'s stale-copy assertion updated to match).
- `tsc --noEmit`: clean.
- `cargo clippy --all-targets -- -D warnings` (shell crate): clean.
- Production frontend build: passes; `CollectionsNativeView` code-splits into
  its own lazy chunk, confirming it isn't bundled into every window.
- No skipped/focused tests introduced.

## Native proof

A fresh Dev binary was built and the Collections window was opened and
inspected live (see `.local/proof/collections/` for the screenshot and
`git`-visible evidence in this session's transcript for exact commands/PIDs
used) — not claimed without running it.
