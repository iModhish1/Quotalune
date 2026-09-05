# Flow Surface Specification

## Objective

Replace the failed oversized orbital presentation with one compact adaptive
Windows overlay. The overlay has one native window and one React host; it can
render three user-selectable forms without duplicating data or opening multiple
competing windows.

## Forms

| Form | Default location | Compact envelope | Expanded envelope | Detail direction |
| --- | --- | ---: | ---: | --- |
| Flowline | left or right edge | 56 × 310 | 330 × 160 | toward work area |
| Horizon Fold | top or bottom edge | 350 × 58 | 270 × 150 | toward work area |
| Corner Petal | any corner or free position | 170 × 118 | 270 × 150 | toward work area |

The selected form owns only silhouette and atom reflow. All forms use the same
provider data, status labels, buttons and detail card. The work area remains
visible: compact forms are capped at 8% of work-area width and 42% of height;
the detail card is temporary and must open into free space.

## Interaction contract

```text
Hidden reveal tab → Peek → Compact → Hover → Expanded ↔ Pinned
                             │              │
                             └── idle ──────┴── auto-hide (unless pinned)
```

- In hidden state, a 6–10 px non-obstructive reveal tab remains reachable.
- Passing the pointer over the tab reveals the compact form; leaving it starts
  a configurable delay (default 900 ms) before collapse/hide.
- Hover is CSS-only. A native resize occurs only at compact ↔ expanded.
- Click/Enter opens details; Escape closes unpinned details; pinned details stay
  open until explicitly closed.
- A drag grip appears on hover. Dragging records free placement; native bounds
  are clamped to monitor work area before persistence.
- Reduced motion removes travel. There is no continuous animation loop.

## Settings contract

Presentation settings are persisted and broadcast live:

- enabled;
- form: `flowline | horizon | petal`;
- anchor: left/right/top/bottom/corners/free as valid for the selected form;
- scale: 75–125%;
- auto-hide enabled and delay (300–3000 ms);
- opacity and hide-while-fullscreen;
- Restore visible position.

The default is **Flowline**, right edge, 100% scale, auto-hide on, 900 ms.
The sole default material is **Obsidian Pulse**; other themes are deferred until
the forms have native proof.

## Ownership

- Rust: persisted presentation settings, one native surface window, work-area
  clamp, interaction-state acknowledgement, click-through/activation policy and
  all native resize/reposition operations.
- React: form rendering, pointer/focus state, CSS motion, provider selection and
  settings controls.
- The bridge carries intent and native acknowledgement revisions. React never
  computes native geometry; Rust never renders data semantics.

## Acceptance criteria

1. Only one auxiliary QuotaArc overlay exists at any time.
2. Every compact form leaves the desktop usable and auto-hides after pointer
   exit unless pinned.
3. Details always open toward available work area and remain fully visible.
4. Changing form, anchor, scale or hide behaviour updates the live overlay and
   survives restart.
5. Keyboard, pointer, reduced motion and unavailable providers behave
   accessibly.
6. Unit tests cover form normalization, state transitions, size limits and
   auto-hide intent; native proof covers all three forms at 100% and 150% DPI.
