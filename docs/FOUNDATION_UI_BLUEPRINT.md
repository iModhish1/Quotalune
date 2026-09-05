# QuotaArc Foundation UI Blueprint

## Status

**Design gate — awaiting visual approval.** This document is the contract for the
next implementation wave. No new theme, legacy overlay migration, or visual
polish work may begin until the reference boards and this contract are approved.

## Objective

Build a Windows-first quota companion that is quiet at rest, useful in one
glance, and detailed only when asked. It must feel like a deliberate native
desktop tool rather than a screen-sized visualisation.

The single canonical interaction is **Quota Island**: a small movable status
surface. Future themes may change materials, colours, and bounded motion tokens;
they may not change its information hierarchy, geometry, interaction model, or
window behaviour.

## Product rules

1. The compact island is a status affordance, never a dashboard.
2. The expanded island is a short provider list, never a radial chart or a hero
   canvas.
3. One native island may be expanded at a time.
4. The user can drag the island, choose an anchor, and recover it through a
   keyboard shortcut or the tray menu.
5. Real quota data is the only data shown. Missing data is explicitly unavailable.
6. A theme is a token pack. It cannot add layout branches, visual geometry, or
   a second rendering implementation.

## Canonical composition

### Compact — the resting object

`264 × 44 logical px` is the default envelope; responsive bounds are `240–320 ×
44`. It shows, in one line:

- a small provider mark;
- provider name and the resolved percentage;
- one thin linear progress indicator;
- an unobtrusive expansion affordance.

The visual treatment is a charcoal solid surface, a one-pixel hairline, an
8–10 px radius, one restrained elevation shadow, and a single teal accent. It
uses no orbital rings, large SVG fields, animated glow, decorative backgrounds,
or visualised provider topology.

### Expanded — the requested detail

`368 × 300 logical px` is the default envelope. It opens directly below the
compact island and contains a compact header plus a single vertical list. A row
has a provider mark, name, percentage, status label, reset detail, and a 3 px
linear indicator. Five rows fit without scrolling; additional providers scroll
inside the panel, never by growing the native window beyond its envelope.

## Geometry and scale limits

All surface coordinates are logical pixels and become physical pixels only at
the native window boundary.

| State | Default envelope | Hard cap against monitor work area | Result |
| --- | ---: | ---: | --- |
| Compact | 264 × 44 | 25% width, 10% height | Never blocks work |
| Expanded | 368 × 300 | 32% width, 42% height | Enough detail, no desktop takeover |
| Pinned expanded | same as expanded | same as expanded | Stable while working |

The island is clamped to the selected monitor's work area with at least 32 px
always reachable. Position persistence stores monitor identity, the selected
anchor or free position, and a normalized safe-area coordinate. DPI scaling and
monitor changes must preserve the semantic location, not a stale physical pixel
coordinate.

## Interaction model

```text
Hidden ──show──> Compact ──pointer/keyboard──> Hover
                    │                              │
                    └────────open──────────────> Opening ──> Expanded
                                                          │        │
                                                      close│        ├─pin─> Pinned
                                                          ▼        │           │
                                                       Compact <───┴─unpin─────┘
```

- Hover changes only composited opacity/colour; it never resizes a window.
- Open and close use one bounded transform-and-opacity transition (120–160 ms).
- Drag begins only from a dedicated grip area, has no animation while moving,
  and persists atomically after a short debounce.
- `Escape` closes an unpinned panel. Arrow keys move provider focus inside an
  expanded panel. Enter/Space opens the compact island. The tray and a recovery
  shortcut can always restore a hidden or off-screen island.
- `prefers-reduced-motion` removes travel and resolves state changes instantly.

## Runtime boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| Rust island coordinator | native bounds, monitor placement, window mode, one-expanded invariant, persisted placement | React layout decisions |
| `QuotaIsland` React composition | semantic DOM, rows, keyboard focus, token application | native coordinates, settings mutation logic |
| Quota semantics resolver | normalized provider snapshot and display mode | visual formatting rules beyond its stable DTO |
| Theme token registry | colours, material, type scale, bounded motion values | geometry variants, window sizes, provider ordering |
| Settings/tray controller | intent commands and recovery actions | a duplicate visual renderer |

The renderer consumes a stable `QuotaSnapshot`; it never calculates usage
semantics. Rust is the only authority for placement, monitor recovery, and
expanded-window exclusivity.

## Theme protocol after the foundation gate

Every theme must conform to one `ThemeTokens` object:

```ts
type ThemeTokens = {
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  hairline: string;
  accent: string;
  providerColors: Record<string, string>;
  radius: 8 | 10;
  shadow: 'quiet' | 'none';
  motion: { openMs: 120 | 160; easing: 'standard' | 'gentle' };
};
```

No theme can supply SVG ornaments, alternate layouts, unbounded blur, a distinct
state machine, or a changed sizing rule. A new theme proves itself by applying
this exact contract to the same canonical capture sequence.

## Accessibility and performance non-negotiables

- Expanded state receives focus and restores the prior focus when closed.
- All values have text equivalents; colour never carries status alone.
- Compact and expanded controls meet keyboard and screen-reader requirements.
- No requestAnimationFrame loop, canvas scene, continuous SVG filter, or
  permanently running animation is allowed.
- The performance gate is measured after a 30-second settle on a release build,
  comparing hidden, compact, and expanded state rather than startup activity.

## Visual acceptance gate (G0)

Before implementation begins, the approved concept must demonstrate:

- a compact island visibly smaller than one fifth of a 1920 px desktop;
- an expanded panel that remains a one-column utility, not a decorative canvas;
- free placement and anchor placement without clipping;
- a six-step movement storyboard with a restrained 120–160 ms open/close;
- no rings, oversized radial gauges, neon fog, unbounded blur, or fake macOS
  notch treatment.

## Capability map and build order

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| canonical-composition | semantic compact/expanded component and token contract | — |
| island-coordinator | placement, monitor clamp, state exclusivity, persistence | canonical-composition contract |
| motion-accessibility | focus, keyboard, reduced motion, safe animation | canonical-composition, island-coordinator |
| settings-controls | placement and canonical token selection | island-coordinator |
| theme-protocol | token-only variants and visual regression fixtures | canonical-composition, settings-controls |

Build order: `canonical-composition` → `island-coordinator` →
`motion-accessibility` → `settings-controls` → `theme-protocol`.

## Explicit non-goals for this wave

- Rebuilding the old 15-theme catalog or its orbital geometry.
- Adding a new dashboard layout.
- Copying macOS source code or faking a macOS notch on Windows.
- Declaring completion from demo artwork without a fresh native Windows build.

