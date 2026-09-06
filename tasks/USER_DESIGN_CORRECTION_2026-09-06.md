# User correction — authoritative scope, 2026-09-06

The user rejects treating provider color palettes as full themes. Keep palettes
as a separate optional feature. Full themes must draw from the supplied libraries:
- Downloads/QuotaArc-15-Legendary-Themes-v2 (system/motion boards)
- Downloads/QuotaArc-Theme-Library (50-theme data and visual indices)
- Downloads/QuotaArc-50-Themes-Concept-Library.zip (a file, not directory)
- Downloads/Themes (generated concept boards)

All four paths exist and were inventoried; ZIP entries inspected read-only.
Viewed Obsidian system board, visual-index-01-10, and Aurora Bloom concept board.
This is NOT a claim to have inspected every image. Full theme work must cover
material, light, ornament, interaction/motion and typography independently of
provider palette, structure and position; respect compact footprint constraints.

Additional required work (OPEN unless explicitly verified):
- Independent session/weekly visibility per provider, discoverable beside provider
  configuration, with helper text and preview. Existing detail selector is only
  all/session/weekly/both; no independent off/off setting yet.
- Unify official logo from About: src/assets/quotaarc-void-mark.svg. Reuse its
  bright silver interior across UI/native/tray/installer; archive replaced assets
  only after references and license obligations are checked. No logo cleanup done.
- One configurable-size reveal identity across structures, derived from this logo.
- Recompose six older structures to newer precision/quality, not cosmetic variants.
- Arabic: professional full translation except proper names, RTL layout with right
  sidebar, mixed Latin names/numbers handled correctly; do not merely add a locale
  menu entry without the translations.
- Repair light app theme separately from surface themes; reorganize general app
  preferences, notification, provider and surface options with adjacent helper text.

Immediate source fixes: Select width now reserves the longest option (old 128px
  ceiling caused screenshot truncation); reset text distinguishes inactive session
  status from countdown. 18 focused tests and frontend build passed.
Remaining visual/native verification is not replaced by these tests.
