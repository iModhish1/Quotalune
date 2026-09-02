# DESIGN_DECISION — visual direction

Per the product brief, three visual directions were prototyped internally before locking the
QuotaArc style. All three were evaluated against the same arcs/pill components and the same
provider data, at 100% and 125% scale, dark themes.

| Direction | Idea | Readability | Distinctiveness | Windows fit | Motion potential | Performance | Brand |
|---|---|---|---|---|---|---|---|
| A — Precision Glass | Fully translucent panels, hairline chrome, Mica/Acrylic-forward | good on clean wallpapers; degrades on busy ones | medium | strong (native materials) | strong | medium (backdrop cost on low-end GPUs) | medium |
| B — Soft Instrument | Deep navy glass, desaturated status ramp, arc as the only ornament | excellent in all cases | high (arc grammar) | strong (dark-canonical, caption-pinned) | strong (springs) | excellent (no backdrop dependency) | high |
| C — Dark Arc | Near-black, single accent, ultra-minimal | good; risks feeling flat | medium | good | medium | excellent | medium |

## Decision

**B — Soft Instrument**, borrowing A's material tiering: surfaces render their own navy glass by
default (works everywhere), and the shell can raise Tier A native materials (Mica/Acrylic) where
reliably supported, falling back gracefully. This keeps the product's signature — the arc — as
the only loud element, satisfies "not gamer UI, not cheap neon, not generic dashboard", and
meets the performance bar because the core look never *requires* expensive backdrops.

Rejected: adopting upstream Win-CodexBar's macOS-flavored visual language (the brief explicitly
forbids a reskin), and any Apple Dynamic-Island look-alike geometry for the Top Arc.
