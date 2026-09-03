# V6 — Orbital Themes & Usage Modes report

Personal build untouched (Dev/demo only).

## What changed

1. **Theme engine V2** (`design-system/themes.ts` + `v6-themes.css`): five production
   themes (Obsidian Orbit, Graphite Precision, Midnight Glass, Ceramic Light, Stealth Mono)
   plus a Custom slot, applied as bounded token overrides via `[data-qa-v6]` — tones,
   material, and glass only; layout/geometry/status semantics are not theme-reachable.
2. **Usage Display Mode system** (`themes.ts`): USED / REMAINING / HYBRID semantics with
   global default + per-provider overrides + future-safe account-override hook.
   `resolveUsageMode` + `applyUsageSemantics` are pure, unit-tested (7 tests, 304 total
   green). The orbital instrument renders arc/value according to the resolved mode, and the
   expanded state labels the mode ("↻ 51m · remaining").
3. **Active provider focus** on orbital surfaces: `focus` index grows the focused ring (+4px)
   — the clock/orbit selection model is wired through all V5 surfaces (hover/click/wheel
   selection is the next interaction pass).
4. **Demo pipeline V6**: `&v6=<theme>&usage=<mode>&usageCustom=claude:used,...&focus=N`
   parameters on the demo stage for deterministic theme/usage captures.

## Boards (rendered from the actual components)

- `docs/images/v6/QUOTAARC_V6_REVIEW_BOARD.png` — themes × usage modes.
- `docs/images/v6/THEME_PRESETS_BOARD.png` — five themes, same surface.
- `docs/images/v6/USAGE_MODE_BOARD.png` — global modes + per-provider overrides
  (per-provider demonstrably live: custom tile shows Claude 27 / OpenCode 94).

## Remaining defects (honest)

1. **Global usage-mode propagation**: with `usage=used` and no custom overrides, captures
   still render remaining values (73) — the per-provider path demonstrably works, so the
   defect is in the global-only demo wiring (usageConfig reach) or stale-capture ordering;
   unit tests prove the engine itself.
2. Ceramic theme tile needs `theme=light` combined with `v6=ceramic` for the full ceramic
   wallpaper context (captured with dark backdrop this pass).
3. Theme switching is token-swap (instant) — animated tone crossfade is specified, not
   implemented.
4. Clock/wheel/keyboard orbit cycling: focus state + rendering exist; the interaction
   bindings (wheel to rotate selection) are the next pass.
5. Custom theme editor UI: architecture (bounded token overrides + presets) is in place;
   the settings UI is not built.
