/** Display classification mirrored from rust/src/dashboard_data.rs. No pricing calculation. */
export type MonetaryQuantityKind = "spend" | "balance" | "credits" | "unknown";

/**
 * Mirrors `provider_cost_measurement_kind`'s QUANTITY dimension from
 * `rust/src/dashboard_data.rs` (Phase 4A.1 "24-provider classification
 * table", re-confirmed in Phase 4B/4C) -- kept as a small, explicitly-
 * sourced display-only table rather than a second independent business
 * rule. Codex's real measurement kind depends on which of its two code
 * paths produced a given reading (Phase 4A.1/4C), but its QUANTITY kind
 * is unconditionally Credits either way, so a single entry is correct
 * here even though the Rust side additionally branches on `period` for
 * the measurement (temporal) dimension, which this display layer does
 * not need.
 */
const PROVIDER_QUANTITY_KIND: Readonly<Record<string, MonetaryQuantityKind>> = {
  crossmodel: "balance",
  sub2api: "balance",
  devin: "balance",
  neuralwatt: "balance",
  opencodego: "balance",
  zenmux: "balance",
  codex: "credits",
  commandcode: "credits",
  aiand: "spend",
  bedrock: "spend",
  claude: "spend",
  cursor: "spend",
  deepinfra: "spend",
  deepseek: "spend",
  fireworks: "spend",
  litellm: "spend",
  llmproxy: "spend",
  minimax: "spend",
  mistral: "spend",
  openaiapi: "spend",
  openrouter: "spend",
  xai: "spend",
};

export function providerMonetaryQuantityKind(providerId: string): MonetaryQuantityKind {
  return PROVIDER_QUANTITY_KIND[providerId] ?? "unknown";
}
