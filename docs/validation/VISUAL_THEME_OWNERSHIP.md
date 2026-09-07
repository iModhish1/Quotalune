# Visual theme ownership — Structure vs Provider Presentation vs Provider Identity vs Semantic State

Wave 6 Phase 4. Evidence-based, not assumed — every claim below cites a
file:line. Produced by tracing the actual CSS variables, React props, the
theme registry, the provider-presentation registry, SVG fill/stroke
handling, `color-mix()`, `currentColor` inheritance, opacity, and motion
ownership, per the owner's explicit instruction not to stop at
variable-name inspection.

## Headline finding: there are THREE coexisting systems, not two

1. **Structure Theme** (`CatalogTheme`, `--surface-*` namespace) — 24
   entries, window/panel visual skin.
2. **Provider Presentation identity** (`LimitPresentation.identity`,
   `--pi-*` namespace) — a *separate* 24-entry enum. Same count as #1 by
   coincidence, not by design — no code path links a structure theme slug
   to a provider-presentation identity.
3. **Provider Identity** (brand glyph/color, `PROVIDER_ICON_REGISTRY`) —
   the actual Claude/Codex/Gemini icon + brand color, independent of both
   #1 and #2, with its own optical-normalization layer.

Plus a fourth, informally-scoped custom property, `--provider-color`, set
ad hoc by different call sites from different sources (see bleed #8
below) — a naming/ownership ambiguity, not a fourth real system.

## STRUCTURE ownership

Owner: `CatalogTheme.identity` / `CatalogTheme.material`
([themeCatalog.ts:11-34](../../apps/desktop-tauri/src/design-system/themeCatalog.ts)),
materialized by `surfaceMaterialStyle()`
([surfaceMaterial.ts:6-35](../../apps/desktop-tauri/src/design-system/surfaceMaterial.ts))
into inline `--surface-*` custom properties.

| Concern | CSS var | Source field |
|---|---|---|
| Window/panel background, geometry | `--surface-core`, `--surface-raised`, `--surface-detail-radius`, `--surface-edge-style`, `--surface-rim-size` | `theme.core`, `theme.bg[0]`, `theme.identity.detailRadius/edgeStyle/rimSize` |
| Structural material/finish | `--surface-finish`, `--surface-sheen`, `--surface-ornament` | `theme.material.finish/sheen`, `theme.identity.ornament` |
| Panel relief/elevation | `--surface-relief` | `theme.identity.relief` |
| Large ornament / macro glow | `--surface-accent-halo`, `--surface-inlay` | `theme.identity.accentHalo/inlay` |
| Connectors | `--surface-connector` | `theme.identity.connector ?? theme.coreEdge` |
| Text on structure | `--surface-text`, `--surface-muted` | `theme.material.text/muted` |
| Meter track (binary light/dark only, NOT per-theme) | `--surface-meter` | hardcoded `theme.material.light ? '#c0c9cf' : '#38424b'` |
| App mark (logo, not provider icons) | `--surface-mark-*` | `theme.identity.mark*` |
| Selection precedence (surface/profile/global) | `resolveCatalogTheme()` | [themeResolution.ts:25-36](../../apps/desktop-tauri/src/design-system/themeResolution.ts) |
| Persistence | `catalog_theme`, `active_profile_catalog_theme`, `surface_catalog_themes` | `rust/src/settings.rs:586-597` |

Structure also owns a **second, structure-scoped provider-color source**:
`theme.providerColors` (default `CANONICAL_PROVIDER_COLORS`, only 7
entries) via `providerColor(theme, providerId)`
([themeCatalog.ts:70-78,172-174](../../apps/desktop-tauri/src/design-system/themeCatalog.ts)),
used to color the edge/glow **ring** around a provider icon in
`EdgeOrbitStage.tsx:153,161` (and the Taskbar/Top equivalents) — see bleed
#12 below.

## PROVIDER PRESENTATION ownership

Owner: `LimitPresentation` (`shape`/`content`/`direction`/`identity`) +
`ProviderPresentationIdentity` token maps.

- Type: `LimitPresentation` —
  [limitPresentation.ts:1-6](../../apps/desktop-tauri/src/design-system/limitPresentation.ts).
- 24-value identity enum:
  [limitPresentation.ts:7-11](../../apps/desktop-tauri/src/design-system/limitPresentation.ts)
  — `adaptive, precision, glass, pearl, prism, mono, signal, luxe, frost,
  ember, jade, rose, cobalt, bronze, paper, ultraviolet, midnight,
  aerogel, porcelain, champagne, terracotta, cyberlime, graphite, royal`.
- Token source: `PROVIDER_PRESENTATION_IDENTITY_TOKENS`
  ([providerPresentationIdentity.ts:18-40](../../apps/desktop-tauri/src/design-system/providerPresentationIdentity.ts))
  → `--pi-text`, `--pi-muted`, `--pi-track`, plus semantic tones via
  `providerPresentationSemanticTokens()` (lines 42-46).
- Applied inline: `UsageWindowList.tsx:35-42` (`identityStyle`), rendered
  as `data-provider-identity=<id>` (line 45).
- CSS: `UsageWindowList.css:7-12,22,40-41`,
  `UsageWindowIdentityContrast.css:1-58` (per-identity contrast plates;
  first 8 duplicated in both files, remaining 16 only in the latter).
- Meter contrast nudge: `meterFill.ts:43-49,68-70`
  (`resolveMeterTrack`/`providerMeterFillColor`).
- Settings UI: `ProviderIdentityGallery.tsx` (24-entry `NAMES` map,
  lines 11-15), `ProviderDisplayTab.tsx` (identities/rules switcher).
- Persistence: `LimitPresentation` — `rust/src/settings.rs:22-28`,
  validated by `is_valid()` (lines 45-77, same 24 strings — **string-typed
  on the Rust side, not a Rust enum, so TS/Rust drift is possible** if one
  side adds a value without the other), stored in
  `provider_limit_presentation`/`global_limit_presentation`
  (lines 576-581).

`--pi-progress` (the actual meter *fill* color) is owned by semantic
state, not identity — see below; it defaults to
`var(--provider-color, #9dbdc9)`, and `--provider-color` is the informally
-scoped fourth property mentioned above.

## PROVIDER IDENTITY ownership (brand glyph — Claude/Codex/Gemini)

- Canonical registry: `PROVIDER_ICON_REGISTRY`
  ([providerIcons.ts:88-152](../../apps/desktop-tauri/src/components/providers/providerIcons.ts))
  — per-provider `{id, brandColor, fallbackLetter, svgPath}`. Explicitly
  tied to `rust/src/native_ui/provider_icons.rs` as the source of truth
  (comment, lines 1-3).
- SVG normalization: `tint()` rewrites hardcoded white fills/strokes to
  `currentColor` (lines 67-75) so brand glyphs take color from CSS.
- Render: `ProviderIcon.tsx:24-52` sets `--provider-brand: entry.brandColor`
  inline on the icon's own span, `color: var(--provider-brand,
  var(--accent))` (`styles.css:2136,2149`).
- Optical normalization: `QaProviderIcon`
  ([v2.tsx:97-146](../../apps/desktop-tauri/src/design-system/v2.tsx)),
  per-provider scale table (lines 104-115) inside a fixed 20×20
  interaction box.
- Sizing: `providerIconSizing.ts:1-6` — geometric only, no color input.

**Confirmed dual-source-of-truth risk**: `PROVIDER_ICON_REGISTRY.brandColor`
(the canonical glyph color) and `theme.providerColors` (the structure
theme's ring/glow color, only 7 entries, default `CANONICAL_PROVIDER_COLORS`)
are two independently-maintained "provider color" values that can
legitimately disagree — e.g. Claude is `#e0a884` in one map and `#cc7c5e`
in the other. This is not a CSS bleed (no shared variable, no override),
but it is a real "why does the ring not match the glyph" defect class.

## SEMANTIC STATE ownership

- Tone computation: `usageTone.ts` → `data-usage-tone` attribute
  (`UsageWindowList.tsx:62`).
- Tone → color (`UsageWindowList.css:7-10`):
  - normal → `--pi-progress: var(--provider-color, #9dbdc9)`
  - warning → `--pi-progress: var(--pi-warning, color-mix(in srgb,
    currentColor 72%, #ffd166))`
  - critical → `--pi-progress: var(--pi-critical, color-mix(in srgb,
    currentColor 72%, #ff5d73))`
  - exhausted → `--pi-progress: var(--pi-exhausted, currentColor)`
- `--pi-warning/-critical/-exhausted` come from identity tokens when
  present; when absent (`adaptive`), the `color-mix(...currentColor...)`
  default applies, and `currentColor` resolves through `--pi-text` →
  (for `adaptive`) `--surface-text` — a second-order structure→semantic
  coupling (bleed #9 below).
- Preview states in Settings UI: `normal|warning|critical|exhausted`
  (`ProviderIdentityGallery.tsx:21-22`).
- `selected`/`focused` are NOT part of either `--surface-*` or `--pi-*` —
  they're plain local component CSS (`[data-selected]`, `aria-pressed`),
  correctly out of scope for cross-boundary bleed.

## The "Adaptive" / Follow-Structure mechanism — exact current behavior

`adaptive` is a real `ProviderPresentationIdentity` value whose token
entry is deliberately empty (`adaptive: {}`,
`providerPresentationIdentity.ts:19`). Traced mechanism:

1. `identityTokens.text/muted/track` are all `undefined` for `adaptive`.
2. React omits `undefined` values from the inline style object
   (`UsageWindowList.tsx:35-42`) — no `--pi-text/-muted/-track` set
   inline.
3. `UsageWindowList.css:41`'s base rule (lower specificity than the
   `[data-provider-identity=X]` overrides the other 23 identities use)
   unconditionally sets:
   ```css
   --pi-text: var(--surface-text, #eef4f8);
   --pi-muted: var(--surface-muted, #b1bcc7);
   --pi-track: var(--surface-meter, #38424b);
   ```
   This is the literal, **one-way** fallback: `--pi-*` reads `--surface-*`.
   Confirmed one-directional — nothing in `--surface-*` ever references
   `--pi-*`.
4. Documented in source:
   `UsageWindowIdentityContrast.css:1-3` — *"Fixed identities carry their
   own contrast plate so they remain legible on every dark or light
   structure theme. Adaptive intentionally inherits the current structure
   tokens instead."*
5. `meterFill.ts:43-48` mirrors this in TS for non-CSS contexts, but as a
   **hardcoded 2-way branch** on `theme?.material?.light`, not a live read
   of arbitrary structure fields — so even "inheritance" is binary
   light/dark, not truly per-structure-theme.

**Conclusion**: "Adaptive" already IS "Follow Structure" at the token
level — it's not a UI-only label problem, it's a real (if narrow —
text/muted/track only, not any other structure property) mechanism that
already exists and works one-way, exactly as intended by its own code
comments. The remaining work for Phase 4 is: (a) surface this clearly in
the UI as "Follow Structure" rather than an unlabeled 24th gallery entry,
(b) persist an explicit `presentationSource` setting rather than relying
on the string `"adaptive"` alone to carry that meaning, and (c) fix the
bleeds below, which are real and separate from this intended mechanism.

## The ~24-identity system — clarified

**Not one system, two, coincidentally both sized 24:**

- **A. Structure Theme catalog** — 24 `CatalogTheme` entries: 1 canonical
  + 8 inline spreads + 15 from `createLibraryThemes()`
  ([themeCatalogExpansion.ts:27-61](../../apps/desktop-tauri/src/design-system/themeCatalogExpansion.ts)).
  Full window/panel visual skins, no provider semantics.
- **B. Provider Presentation identity enum** — 24
  `ProviderPresentationIdentity` values (listed above). First 8
  ("legacy") duplicated in two CSS files; remaining 16 only in
  `UsageWindowIdentityContrast.css`. Re-declared and validated
  server-side as strings in Rust (drift risk noted above).

These are **not linked by any code path**. A structure theme and a
provider-presentation identity are selected, stored, and resolved
completely independently, in different Rust settings fields, different
TS modules, different CSS namespaces.

**Phase 4 must preserve both systems intact — 24 structure themes, 24
provider presentation identities — and add the Follow/Independent model
as a UX and persistence layer on top, not a replacement.**

## Confirmed bleed sources (file:line, severity, disposition)

### Genuine, undocumented structure→provider leaks (real bugs — fix in Phase 4)

1. **`surfaceMaterial.css:24`** — `.notch-host .provider-icon,
   .notch-host .notch-detail .provider-icon { filter:
   var(--surface-icon-filter); color: var(--surface-text) !important }`.
   `--surface-icon-filter` = `grayscale(1) brightness(3)` (dark) /
   `grayscale(1) brightness(.25)` (light)
   (`surfaceMaterial.ts:31`). **The structure theme's light/dark flag
   completely desaturates and recolors provider brand icons, with
   `!important`, inside the Notch surface.** This is likely the single
   biggest contributor to the owner's "provider presentation gets
   overridden by structure" complaint for anyone using the Notch
   structure form.
2. **`surfaceMaterial.css:25`** — same pattern for `.reel-host
   .provider-icon, .flow-surface .provider-icon` via
   `--surface-provider-filter` (`surfaceMaterial.ts:32`) — `none` (dark) /
   `grayscale(1) brightness(.3)` (light). Same class of bug, narrower
   blast radius (light themes only).
3. **`NotchSurface.css:17`** — `.notch-gauge .provider-icon,
   .notch-detail .provider-icon { color: #fff !important;
   --provider-brand: #fff !important; filter: grayscale(1) brightness(3) }`.
   **Worse than #1**: this doesn't just filter on top, it directly
   overwrites the Provider Identity's own `--provider-brand` custom
   property with a hardcoded white, from a structure-surface-scoped rule.
4. **`demo/CollectionsStudio.css`** (`.collections-dot .provider-icon`) —
   same `color:white!important;filter:grayscale(1) brightness(3)`
   pattern, confined to the Collections demo surface. Lower priority
   (demo-only), same fix.

### Documented/intended, but worth making more explicit at the UI layer

5. **`UsageWindowList.css:41` / `meterFill.ts:43-48`** — the `adaptive`
   → `--surface-*` fallback described above. Intended, but the two
   implementations (CSS and TS) aren't backed by a shared constant, so
   they can drift if one is edited without the other — add a regression
   test pinning both to the same behavior.
6. **`color-mix(in srgb, currentColor ...)` in `UsageWindowList.css:8-9,12,22`**
   — for `adaptive`, warning/critical tint is a mix of the *structure
   theme's* text color with a hardcoded semantic hex, a second-order,
   non-obvious structure→semantic coupling. Same disposition as #5:
   intended (falls out of #5 correctly), but should be covered by an
   explicit test so a future change to `--surface-text` can't silently
   shift semantic-state legibility.

### Real, but not a CSS bleed — a dual-source-of-truth defect

7. **`EdgeOrbitStage.css:89,99,118`** + `EdgeOrbitStage.tsx:153,161`** —
   the edge/glow ring around a provider node is colored from
   `theme.providerColors` (structure-owned, 7-entry map), while the icon
   glyph inside it is colored from `PROVIDER_ICON_REGISTRY.brandColor`
   (provider-identity-owned, distinct value). Confirmed the ring's
   `color` does NOT actually cascade into `.provider-icon` (which sets
   its own `color` explicitly, no `inherit`), so this is not a literal
   CSS leak — but the ring and the glyph inside it can show two different
   "brand colors" for the same provider depending on which structure
   theme is active. Should be fixed by making `EdgeOrbitStage` (and the
   Taskbar/Top equivalents) read `PROVIDER_ICON_REGISTRY.brandColor`
   instead of `theme.providerColors` for the ring, or by deleting
   `theme.providerColors`/`CANONICAL_PROVIDER_COLORS` entirely in favor
   of the canonical registry — the latter is the more correct fix
   (single source of truth) but is a larger, riskier change; tracked as
   follow-up, not fixed in this Phase-4 slice (see continuation doc).

### Checked and confirmed safely scoped (no action needed)

8. `surfaceMaterial.css:26` — explicit `.flow-surface
   .flow-surface__provider-gauge{filter:none}` carve-out; evidence the
   coupling in #2 is managed, not accidental.
9. `QuotaArcMark.css:17` `mix-blend-mode` — scoped to the app's own
   logo/mark, never `.provider-icon`.
10. `EdgeOrbitStage.css` / `TaskbarStage.css` / `TopOrbitStage.css`
    `mix-blend-mode:screen/multiply` on `.qa-edge-orbit__texture` — a
    separate background SVG layer, not a filter/color rule on
    `.provider-icon` itself. Low-risk, flagged for visual QA rather than
    a confirmed defect.
11. `EdgeOrbitStage.css:118` `.qa-edge-orbit__icon{color:
    var(--qa-edge-node-color)}` — superficially looks like a leak, but
    `.provider-icon` never inherits `color` (sets its own explicitly), so
    this ancestor rule is not actually consumed by the glyph.
12. `backdrop-filter` usage in `FloatBar.css`, `v2.css`, `FlowSurface.css`
    — affects content behind translucent panel chrome, not descendant
    provider icons rendered inside/above it. No leak path found; flagged
    as a regression-test candidate for future refactors that might change
    the icon's position relative to the filtered element.
13. `UsageWindowList.css:1,6` — duplicate/dead hardcoded track color,
    superseded by the `--pi-track` reassignment at line 41. Cleanup
    candidate, not an architecture risk.

## What this means for Phase 4's build

- Fix items 1-4 (the genuine, undocumented leaks) — these directly cause
  the owner's reported "provider presentation visually interferes with
  Structure Theme" symptom for Notch/Reel/Flow-Surface/Collections-demo
  users.
- Leave items 5-6 as-is (intended, already correct) but add regression
  tests pinning the exact fallback behavior so it can't silently drift.
- Track item 7 (the dual provider-color source) as a real defect for a
  follow-up slice — fixing it correctly likely means retiring
  `theme.providerColors`/`CANONICAL_PROVIDER_COLORS` in favor of
  `PROVIDER_ICON_REGISTRY`, which touches every orbit-stage component and
  deserves its own dedicated, tested change rather than folding it into
  the Follow/Independent UX work.
- Build the persisted `presentationSource` ("Follow Structure" /
  "Independent") setting and the pure `resolveVisualComposition()`
  resolver on top of the EXISTING `LimitPresentation`/`adaptive`
  mechanism — not a replacement for it. "Follow Structure" = the existing
  `adaptive` behavior, explicitly labeled; "Independent" = any of the
  other 23 identities, explicitly chosen and persisted as such.
