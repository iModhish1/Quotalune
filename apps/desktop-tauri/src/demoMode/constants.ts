/** Mirrors `quotalis_core::settings::{DEFAULT_DEMO_PROVIDER_COUNT,
 *  MIN_DEMO_PROVIDER_COUNT, MAX_DEMO_PROVIDER_COUNT}` -- kept in sync by
 *  hand (small, stable constants; see docs/validation/DEMO_MODE.md). */
export const DEFAULT_DEMO_PROVIDER_COUNT = 6;
export const MIN_DEMO_PROVIDER_COUNT = 1;
export const MAX_DEMO_PROVIDER_COUNT = 70;

/** The six real, recognizable registered providers Demo Mode defaults to
 *  (owner Phase 5.2 section 5) -- verified against
 *  `rust/src/core/provider.rs::ProviderId::cli_name()` before use, never
 *  invented. Order is the deterministic curated presentation order. */
export const DEFAULT_CURATED_PROVIDER_IDS: readonly string[] = [
  "codex",
  "claude",
  "gemini",
  "perplexity",
  "grok",
  "deepseek",
];
