# Claude Execution Sequence — after Continuation Wave 1 (2026-09-14)

This records the remaining work sequence so a future session does not need
to ask the owner which wave to pick — matching the owner's explicit
instruction not to stop and ask.

## Wave 1 remainder (not closed this wave, carries forward — not silently dropped)

Real work completed this wave: legal quick-close, structure registry audit,
one verified Pin/Close consistency fix across all three structure render
paths, and a partial loading-state audit. **Not** completed, and not to be
treated as done by a future session:

- Safe-area token/function system for structures (owner §7).
- Reproducing and fixing the owner's specific screenshot defect categories:
  detached-looking provider/logo orbs, huge empty structure surfaces,
  clipped reset text/provider icons, excessive anchor↔panel gap, hard
  clipping vs. shape-safe geometry, progress ring outside safe bounds.
- Theme composition: the Apply-scopes dialog (application structure,
  Light/Dark/System, floating structures, logo finish, provider identity,
  tray, background — each independently toggleable with current→new
  preview), per-scope persistence (follow-global vs. explicit-override),
  and the Light/Dark-independence regression cases the owner specified
  (e.g. Ceramic Pearl structure theme + Dark app mode simultaneously).
- Unified shared loading-visual-language component set (skeleton/shimmer/
  inline-spinner), migrated across the surfaces listed in
  `docs/validation/LOADING_STATE_MATRIX.md`.
- Native visual QA: fresh isolated Dev build, screenshots of all 14
  structures × state family × Light/Dark × RTL, with real iteration
  (screenshot → critique → fix → re-screenshot), performance measurement
  (idle/hover/drag/theme-switch, ResizeObserver/listener counts).
- Structure large-provider fixtures (1/3/6/12/24/70) and state-machine
  documentation/tests.

## Wave 2: Tray Studio + Notifications

Build on the already-substantial SHELL-04 tray work (per-provider icons,
style library, tooltip) — verify/extend to a genuinely first-class Tray
Studio destination if not already one; close the native Windows toast-
header icon proof that SHELL-04/P06-05 left open (environment-blocked at
the time); extend granular per-provider/per-limit notification subscriptions
per P06-16's objective attachments.

## Wave 3: Provider onboarding + CLI/cookie/OAuth UX

P06-03's remaining scope: independent account instances, ordinal badges,
reordering, account-specific tray identities, actual OAuth flow
verification (currently UNVERIFIED per `OAUTH_AUTH_UX_AUDIT_0_10_1.md`).
CLI-dependency setup UX (detect/prompt/curated-allowlist-install) per the
master prompt's §26 — not yet built. Cookie-provider setup instructions
audit per §27.

## Wave 4: Backgrounds + IA/Appearance final polish

SHELL-02/03/04 already delivered 28 bundled backgrounds, custom import/
persist/delete, and reduced-motion/low-CPU budgets. Remaining: more
original premium batches per the owner's explicit "genuinely premium, not
gradients" bar (subjective, needs owner visual review), and any IA/
Appearance consolidation gaps found once Wave 1's remaining structure/theme
work lands (Appearance Studio location for the theme-composition Apply
dialog belongs here, per owner §23).

## Wave 5: GitHub/public presentation + legal bundle + release candidate

v0.11.0 is already published — this wave is for the **next** release once
Waves 1–4 land: full dependency-license/advisory sweep (`cargo audit`/
license inventory, pnpm license inventory — not run this session), a real
local v0.12.0 release candidate build (installer/portable/CLI/SHA256SUMS,
not published), and the full owner-requested report set not yet created
(`PROVIDER_CONNECTION_MATRIX.md`, `CONTROL_INTERACTION_MATRIX.md`,
`STRUCTURE_VISUAL_QA_MATRIX.md`, `UI_PRODUCT_FINAL_AUDIT.md`,
`GITHUB_PUBLICATION_PLAN.md`, `CLAUDE_TO_CODEX_FINAL_HANDOFF.md`) — each
needs its own real implementation evidence first, not empty templates.
