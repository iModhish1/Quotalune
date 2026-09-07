# Wave 6 continuation checkpoint

Written per the owner's explicit context-limit protocol: finish a coherent
slice, test it, commit it, record exact state here, continue from this file
in the next session — do not ask the owner to re-scope.

## Branch / HEAD

- Branch: `feature/v9-theme-runtime`
- HEAD: `41880bd2` — "feat(theme): resolveVisualComposition — the pure Follow/Independent resolver"
- Prior checkpoints this phase: `ab3be623` (DEMO watermark overlap fix,
  owner-reported live), `6522e5b3` (structure→provider-icon color bleed
  fix), `c93c6df8` (visual ownership investigation doc)
- Prior phase checkpoints: `3d6e11a5` (flaky test fix), `6ba4ae62` (Phase 3
  navigation), `4596468e`+`fcd0938d` (Phase 1/2 Profiles), `f902cec8`
  (Collections)

## Execution order (owner's 21-phase spec, Phase 4 message numbering)

1. ~~Profiles page~~ — DONE
2. ~~Main navigation normalization~~ — DONE
3. **Structure Theme × Provider/Icon Presentation composition — IN PROGRESS (this checkpoint)**
4. Follow Structure / Independent mode — partially done (resolver exists, not wired to any UI or persisted setting yet)
5. Visual theme-bleed investigation — DONE (docs/validation/VISUAL_THEME_OWNERSHIP.md) + the confirmed real bleeds are FIXED
6. Theme Composer — NOT STARTED
7. Full UI density audit — NOT STARTED
8. Density/layout corrections — NOT STARTED
9. Before/after proof — NOT STARTED (beyond the ad hoc before/after screenshots already sent for the bleed fix and DEMO-badge fix)
10. Bounded Fable concept pass — NOT STARTED (explicitly gated until Phase 4 passes)
11. New Structure Themes — NOT STARTED
12. New Icon/Provider Presentation Themes — NOT STARTED
13. Theme combination matrix — NOT STARTED
14. Light-theme validation — NOT STARTED
15. Motion ownership — NOT STARTED
16. Performance — NOT STARTED
17. Full Dev/native QA — NOT STARTED (native spot-checks done for each fix, not the full named-surface sweep)
18. Version decision — NOT STARTED
19. Personal backup — NOT STARTED
20. Personal promotion — NOT STARTED
21. Final verification — NOT STARTED

## What's actually done and verified this session (Phase 4, not asserted)

### 1. Visual ownership investigation (`docs/validation/VISUAL_THEME_OWNERSHIP.md`, commit `c93c6df8`)

Full evidence-based trace of Structure/Provider Presentation/Provider
Identity/Semantic State ownership, done via a dedicated research agent
before touching any code. Headline findings:
- **Three coexisting systems**, not two: Structure Theme (24
  `CatalogTheme` entries, `--surface-*`), Provider Presentation identity
  (a SEPARATE 24-entry enum, `--pi-*`, same count by coincidence not
  design), Provider Identity (brand glyph, `PROVIDER_ICON_REGISTRY`). No
  code path links the two 24-entry catalogs.
- **"Adaptive" already IS "Follow Structure"** at the token level — a
  real, working, one-way `--pi-*` → `--surface-*` fallback for
  text/muted/track, documented in its own source comments. Not a UI-label
  gap; the remaining work is making it explicit/persisted/labeled.
- **4 genuine, undocumented structure→provider bleeds found** (not the
  intended adaptive fallback) — see below, now fixed.
- **1 real dual-source-of-truth defect found, NOT fixed** (deliberately
  deferred — see "Tracked follow-up" below): the edge/glow ring around a
  provider node reads a structure-owned 7-entry color map
  (`theme.providerColors`) while the glyph inside it reads the canonical
  `PROVIDER_ICON_REGISTRY.brandColor` — two independently-maintained
  values for "the same provider's color" that can disagree. Not a CSS
  bleed (confirmed no cascade path), but a real "ring doesn't match
  glyph" defect class. Retiring `theme.providerColors` in favor of the
  canonical registry touches every orbit-stage component
  (`EdgeOrbitStage`/`TaskbarStage`/`TopOrbitStage`) and deserves its own
  dedicated, tested change.

### 2. Structure→provider-icon color bleed fix (commit `6522e5b3`)

The actual root cause of the owner's reported visual bleed, for
Notch/Reel/Flow-Surface-structure users. `surfaceMaterial.ts` emitted
`--surface-icon-filter`/`--surface-provider-filter` (grayscale +
overexposed brightness), consumed by `surfaceMaterial.css` to recolor
every `.provider-icon` inside those hosts, and `NotchSurface.css` (+ the
Collections demo) separately overwrote the Provider Identity's own
`--provider-brand` with a hardcoded white — both with `!important`,
directly contradicting `surfaceMaterial.ts`'s own header comment
("provider data stays independent"). Removed both properties and the
three consuming CSS rules; the existing circular backing chip behind each
icon already provides contrast.

**Tests**: new regression test in `surfaceMaterial.test.ts` asserting no
theme ever re-emits an icon/provider filter token.

**Native proof**: switched the live Top Arc to the Notch structure
("seam" form), enabled the 6-provider demo, expanded the gauge, read
computed styles directly — provider icons went from
`color:#fff, --provider-brand:#fff!important, filter:grayscale(1)
brightness(3)` to their real brand colors (`#cc7c5e` Claude, `#49a3b0`,
`#ab87ea`) with `filter:none`. Screenshot sent.

### 3. DEMO watermark overlap fix (commit `ab3be623`, owner-reported live)

The owner spotted this directly while reviewing the Themes tab mid-session
("there is a demo word every where... overlap of layers and elements").
Root cause: `StructurePreview.tsx` (used by ThemeGallery's 24 cards and
the Surfaces tab's structure picker) passes `demoMode` unconditionally to
get synthetic fixture data — necessary — but `demoMode` also
independently triggers a "DEMO" watermark in each of `FlowSurface.tsx`,
`NotchSurface.tsx`, `ReelSurface.tsx` (three separate implementations),
meant for real live surfaces with the "Temporary demo" toggle on, not for
a Settings preview card whose own copy already says it doesn't affect the
real desktop. At small card scale, the label collided with the
structure's icon/menu row.

Fix: `showDemoBadge` prop (default `true`, preserves live-surface
behavior), threaded through all three components; `StructurePreview`
passes `showDemoBadge={false}`.

**Native proof**: reloaded the live Themes tab — DEMO badge count went
from 24+ to 0; confirmed 0 on the Surfaces tab picker too. Screenshot
sent (before/after).

### 4. `resolveVisualComposition()` pure resolver (commit `41880bd2`)

`apps/desktop-tauri/src/design-system/visualComposition.ts`. Centralizes
"which Provider Presentation identity actually applies, and why" — does
NOT replace or duplicate either existing 24-entry catalog. "Follow
Structure" = `identity === "adaptive"` (the real existing mechanism, made
explicit). "Independent" = any other identity. Precedence (provider
override → explicit/global → default "adaptive") mirrors the existing
`resolveLimitPresentation`. Deliberately does NOT invent a per-structure
"recommended presentation" table (no such curated data exists — see
"Deliberate scope decisions" below). Pure, no mutable state, 13 tests
covering default/explicit/override/invalid-fallback/purity/all-24-
identities.

**Not yet wired into any UI or persisted setting** — see "Exact next
step" below.

## Deliberate scope decisions (not oversights — explained so a future session doesn't "fix" them unnecessarily)

- The resolver's `structureThemeId` field is carried through for
  provenance/display only. It does NOT drive a per-theme "recommended
  provider presentation" (e.g. the owner's illustrative "Solar Ember →
  Precision Bezel-like treatment" example) because no such curated
  mapping exists in the current theme metadata, confirmed during the
  investigation. Inventing one without real design curation would be
  exactly the "do not write assumptions" the owner warned against.
  Building a real one is design work (plausibly the bounded Fable pass,
  or dedicated curation) — tracked as future work, not done here.
- The resolver does not re-derive Provider Identity (brand glyph/color)
  or Semantic State — both already have working, non-buggy mechanisms
  (`PROVIDER_ICON_REGISTRY`, `usageTone.ts`) that duplicating here would
  only risk drifting from, not improve.
- The dual provider-color-source defect (structure's `theme.providerColors`
  vs. canonical `PROVIDER_ICON_REGISTRY.brandColor`) found during
  investigation was NOT fixed this session — it's a real defect, but
  fixing it correctly means touching every orbit-stage component and
  deserves its own dedicated, tested slice rather than folding it into
  this one.

## Tests (this session's Phase 4 work only)

- Frontend: `npx vitest run` → **686/686 passing** (672 at Phase-3
  checkpoint → 673 after the bleed-fix regression test → 686 after the
  13 new resolver tests).
- Frontend typecheck: `npx tsc --noEmit` → clean.
- No Rust changes this phase (all three fixes + the resolver are
  frontend-only).

## Native proof this session

- Structure→provider-icon bleed fix: real Dev binary, Notch structure
  form, 6-provider demo, computed-style read before/after. Screenshot
  sent.
- DEMO watermark fix: real Dev binary, Themes tab reload, DOM query for
  "DEMO" text nodes before/after (24+ → 0), plus Surfaces tab structure
  picker (0). Screenshot sent.
- **Not yet done**: native QA for the resolver itself (it isn't wired to
  any UI yet, so there's nothing live to click) — that's the next slice.

## Exact next step (continuing Phase 4)

1. **Wire `resolveVisualComposition()` into the UI.** Start with
   `apps/desktop-tauri/src/surfaces/settings/tabs/ProviderIdentityGallery.tsx`
   (currently shows "adaptive" as an unlabeled 24th gallery entry among
   equals) — reframe it per the owner's explicit instruction (section 12):
   show it as "Follow Structure — Recommended" with a plain-language
   explainer ("Uses the provider presentation recommended by the active
   Structure Theme"), not a normal equal-weight theme card. Add a
   provenance line near the gallery ("Provider Presentation: Following
   [structure name]" / "Independent — [identity name]" / "[Provider]:
   [identity] — Provider Override") using
   `resolveVisualComposition()`'s output.
2. **Persist an explicit `presentationSource`?** Re-read section 2's
   instruction ("This must be an actual persisted setting, not only a UI
   label") against the finding that `presentationSource` is fully
   *derivable* from the existing `identity` field (`adaptive` ⟺
   followStructure). Two honest options: (a) derive it purely in the
   resolver as already built (no new persisted field, `identity` alone is
   the source of truth — simpler, no migration needed since there's
   nothing to migrate) or (b) add an explicit Rust
   `presentation_source: "followStructure" | "independent"` field
   alongside `identity` for UI clarity even though it's redundant with
   `identity !== "adaptive"`. Recommend (a) unless native QA in the next
   session reveals a real UX reason (b) is needed — adding a redundant
   persisted field that must be kept in sync with `identity` is exactly
   the kind of duplication the owner's own instructions (section 7, "do
   not duplicate resolver logic") warn against. Decide and document the
   decision explicitly before building either way.
3. Only after 1-2: Theme Composer UI (section 11), migration tests
   (section 16 — likely trivial/no-op under option (a) since nothing
   needs migrating), visual proof boards (section 14), combination matrix
   (section 13), light-theme validation (section 14 cont'd), motion
   ownership (section 15... overlapping numbering with the owner's
   Phase-6/7/etc. list — reconcile against the ORIGINAL 21-phase list from
   two messages ago when picking this up), performance (section 16 of
   original list), full native QA sweep (section 18), THEN Fable/new
   themes (sections 19-20 original list / 10-12 this message).
4. Files to start from: `ProviderIdentityGallery.tsx`,
   `providerPresentationIdentity.ts` (already read this session),
   `command_profiles.rs`'s `set_provider_limit_presentation`/
   `set_global_limit_presentation` (already read — this IS the provider
   override precedence mechanism section 7 asks to preserve/expose).

## Personal status (must not be touched until the version-decision/backup/promotion phases)

- Personal is on **0.10.1**. Not touched this session.
- Version bump to **0.11.0** remains the working assumption.

## Process notes for the next session

- Dev binary + vite dev server pattern unchanged from prior checkpoints.
  All three Phase-4 fixes this session were frontend-only — no Rust
  rebuild was needed, only a `Page.reload` on the relevant CDP target
  (vite HMR serves the change immediately).
- `StructurePreview.tsx` is the shared preview component for ThemeGallery
  AND the Surfaces tab's structure picker AND (likely) other preview
  spots not yet checked this session — if a future preview-context bug
  surfaces, check there first.
- Scratch CDP verification scripts live in `.local/` (not committed).

## Overall verdict so far

**NOT PASSED** — Phase 4 is genuinely in progress with real, verified
fixes for the owner's actual reported symptoms (both the original bleed
report AND the live DEMO-overlap report caught mid-session), plus the
core resolver built and tested, but not yet wired to any UI, and the
much larger remaining scope (Theme Composer, visual proof boards,
combination matrix, motion/performance, native QA sweep, then Fable/new
themes/density audit/Personal promotion) is untouched. Continuing per the
owner's explicit "do not stop, do not ask to re-scope" instruction.
