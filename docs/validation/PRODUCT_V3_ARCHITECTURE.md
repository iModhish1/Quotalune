# Product V3 architecture and acceptance ledger

Starting revision: `4f3e493e2150f813e96181460e05be63d6b46f1f`.
Status: implementation checkpoint delivered; **NOT PASSED**. See `PRODUCT_V3_VALIDATION.md` and the failed channel-isolation condition in `PRODUCT_V3_CHANNEL_INCIDENT.md`.

## Audited boundaries

The old Dashboard mixed physical quota monitoring, deep-history diagnostics and configuration, while its provider instruments mounted every provider. Current snapshots, historical physical-limit observations, provider-reported money and local session tokens are distinct contracts. V3 reuses those contracts and their eligibility rules. The existing catalog, original provider glyphs, Structure Theme resolver and reset presentation remain authoritative.

## Destinations

Dashboard expands to Overview and Analytics. Overview presents the bounded provider rail, actual live summary, attention and reset horizon. Analytics owns range/provider controls and Overview, Usage, Activity, Resets, Providers, History and Data quality sections. Selecting a provider scopes both current analytics and history. Detailed history and diagnostic tables are progressively disclosed, not shown on operational startup.

Saved section visibility/order applies to operational modules that belong in Overview. Range/chart style remain Analytics preferences. Old cross-destination arrangements must not put diagnostic tables back on Overview. Quota template continues to apply to detailed quota instruments. Compact workspace density also scales the rail.

## Rail and actions

A clamped moving window mounts at most seven provider instruments. Source order is stable. Arrow/Home/End/Page keys, wheel and pointer drag update one logical focus. Edges release wheel scrolling to the page; Ctrl-wheel remains browser zoom. Clicking opens a native modal dialog with focus restoration, actual physical windows and detected plan. Provider-specific Analytics and Providers navigation use IDs, not labels. External status/account actions appear only when the backend declares their URLs. Refresh uses the existing all-provider command and is disabled in Demo.

## Truth and capabilities

Quota percentages remain independent by provider, observed account and physical limit. No aggregate quota percentage, cost conversion or cumulative quota was introduced. Existing trend calculations retain reset boundaries and missing-history handling. Local Activity uses the actual Codex Workspaces index (30-day scope); daily/weekly/cumulative token counts are additive tokens, never quota. It does not infer activity from polling. Tools, skills, conversation turns and cross-provider local activity are unavailable rather than invented. Demo never reads the live local-activity index.

## Controls and surfaces

Shared Select uses a portal listbox with search, keyboard navigation, Escape and focus return. MultiSelect reuses this implementation and enforces minimum selection for table columns. Theme colors are resolved onto the shared workspace so portals do not depend on a Dashboard being mounted. Tables use opaque sticky headers. Original logos are unchanged.

## Notifications

Source changes in `c70a2655` preserve the stable internal Windows AUMID, update visible branding and icon resource resolution, remove cross-channel registry deletion and register channel-specific activation. Native toast icon/activation acceptance remains pending. A Dev-only explicit proof hook can generate four test cases. Personal installation, registry and data must not be touched.

## Final evidence and open acceptance

The validation report records native rail interactions, six requested scales (70 resolves to 68 registered providers), mounted themes, RTL/narrow/reduced-motion, source-backed activity, direct notification URI routing, benchmark results and green engineering gates. Native visible toast icon/clicks, exact 70-item native proof, largest-history transfer performance and the full three-pass page matrix remain open. Earlier non-isolated builds touched Personal; subsequent isolation repairs do not erase that failed requirement.
