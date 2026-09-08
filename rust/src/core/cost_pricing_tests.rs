use super::codex_routed_pricing;
use super::*;

#[test]
fn test_normalize_codex_model() {
    assert_eq!(CostUsagePricing::normalize_codex_model("gpt-5"), "gpt-5");
    assert_eq!(
        CostUsagePricing::normalize_codex_model("openai/gpt-5"),
        "gpt-5"
    );
    assert_eq!(
        CostUsagePricing::normalize_codex_model("gpt-5-codex"),
        "gpt-5"
    );
    assert_eq!(
        CostUsagePricing::normalize_codex_model(""),
        CostUsagePricing::CODEX_UNATTRIBUTED_MODEL
    );
    assert_eq!(
        CostUsagePricing::normalize_codex_model("unknown"),
        CostUsagePricing::CODEX_UNATTRIBUTED_MODEL
    );
}

#[test]
fn unattributed_codex_usage_stays_unpriced() {
    assert!(
        CostUsagePricing::codex_cost_usd(CostUsagePricing::CODEX_UNATTRIBUTED_MODEL, 1_000, 0, 500)
            .is_none()
    );
    assert!(CostUsagePricing::is_codex_unattributed_model("unknown"));
    assert!(CostUsagePricing::is_codex_unattributed_model("  "));
}

#[test]
fn test_normalize_claude_model() {
    assert_eq!(
        CostUsagePricing::normalize_claude_model("claude-sonnet-4-5"),
        "claude-sonnet-4-5"
    );
    assert_eq!(
        CostUsagePricing::normalize_claude_model("anthropic.claude-sonnet-4-5"),
        "claude-sonnet-4-5"
    );
}

#[test]
fn test_codex_cost() {
    let cost = CostUsagePricing::codex_cost_usd("gpt-5", 1000, 0, 500).unwrap();
    assert!((cost - 0.00625).abs() < 1e-10);
}

#[test]
fn test_claude_cost() {
    assert!(
        CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 1000, 0, 0, 500).is_some()
    );
}

#[test]
fn test_opus_4_8_cost() {
    let cost = CostUsagePricing::claude_cost_usd("claude-opus-4-8", 1_000, 0, 0, 500).unwrap();
    assert!((cost - 0.0175).abs() < 1e-10);
}

#[test]
fn test_fable_5_cost() {
    let cost = CostUsagePricing::claude_cost_usd("claude-fable-5", 1_000, 0, 0, 500).unwrap();
    assert!((cost - 0.035).abs() < 1e-10);
}

#[test]
fn test_claude_input_cost_per_token() {
    assert_eq!(
        CostUsagePricing::claude_input_cost_per_token("claude-opus-4-8"),
        Some(5e-6)
    );
    assert_eq!(
        CostUsagePricing::claude_input_cost_per_token("claude-fable-5"),
        Some(1e-5)
    );
    assert_eq!(
        CostUsagePricing::claude_input_cost_per_token("totally-unknown-model"),
        None
    );
}

#[test]
fn test_format_model_name() {
    assert_eq!(
        CostUsagePricing::format_model_name("claude-3.5-sonnet"),
        "Sonnet 3.5"
    );
    assert_eq!(
        CostUsagePricing::format_model_name("claude-opus-4"),
        "Opus 4"
    );
    assert_eq!(CostUsagePricing::format_model_name("gpt-5"), "GPT-5");
}

#[test]
fn test_gpt54_mini_cost() {
    let cost = CostUsagePricing::codex_cost_usd("gpt-5.4-mini", 1000, 0, 500).unwrap();
    assert!((cost - 0.003).abs() < 1e-10);
}

#[test]
fn test_gpt54_nano_cost() {
    let cost = CostUsagePricing::codex_cost_usd("gpt-5.4-nano", 1000, 0, 500).unwrap();
    assert!((cost - 0.000825).abs() < 1e-10);
}

#[test]
fn test_normalize_gpt54_codex() {
    assert_eq!(
        CostUsagePricing::normalize_codex_model("gpt-5.4-mini-codex"),
        "gpt-5.4-mini"
    );
}

#[test]
fn test_gpt55_pricing() {
    assert_eq!(
        CostUsagePricing::normalize_codex_model("openai/gpt-5.5-2026-04-23"),
        "gpt-5.5"
    );
    assert_eq!(
        CostUsagePricing::normalize_codex_model("gpt-5.5-pro-2026-04-23"),
        "gpt-5.5-pro"
    );
    let cost = CostUsagePricing::codex_cost_usd("gpt-5.5", 1000, 500, 500).unwrap();
    assert!((cost - 0.01775).abs() < 1e-10);
}

#[test]
fn test_format_gpt54_mini() {
    assert_eq!(
        CostUsagePricing::format_model_name("gpt-5.4-mini"),
        "GPT-5.4 Mini"
    );
}

#[test]
fn test_opus_4_7_cost() {
    assert!(CostUsagePricing::claude_cost_usd("claude-opus-4-7", 1000, 0, 0, 500).is_some());
}

#[test]
fn test_sonnet_4_6_cost() {
    assert!(CostUsagePricing::claude_cost_usd("claude-sonnet-4-6", 1000, 0, 0, 500).is_some());
}

#[test]
fn test_gpt5_pro_cost() {
    let cost = CostUsagePricing::codex_cost_usd("gpt-5-pro", 1000, 0, 500).unwrap();
    assert!((cost - 0.075).abs() < 1e-10);
}

#[test]
fn test_gpt56_standard_pricing() {
    for (model, expected) in [
        ("gpt-5.6-sol", 0.0332),
        ("gpt-5.6-terra", 0.01328),
        ("gpt-5.6-luna", 0.001328),
    ] {
        let cost = CostUsagePricing::codex_cost_usd(model, 1_000, 400, 1_000);
        assert!((cost.unwrap() - expected).abs() < 1e-10, "{model}");
    }
}

#[test]
fn test_gpt56_long_context_pricing() {
    for (model, expected) in [
        ("gpt-5.6-sol", 45.272001),
        ("gpt-5.6-terra", 18.1088004),
        ("gpt-5.6-luna", 1.81088004),
    ] {
        let cost = CostUsagePricing::codex_cost_usd(model, 272_001, 272_001, 1_000_000);
        assert!((cost.unwrap() - expected).abs() < 1e-10, "{model}");
    }
}

#[test]
fn test_gpt56_context_threshold_is_exclusive() {
    for (model, expected) in [
        ("gpt-5.6-sol", 0.136),
        ("gpt-5.6-terra", 0.0544),
        ("gpt-5.6-luna", 0.00544),
    ] {
        let cost = CostUsagePricing::codex_cost_usd(model, 272_000, 272_000, 0);
        assert!((cost.unwrap() - expected).abs() < 1e-10, "{model}");
    }
}

#[test]
fn test_normalize_gpt56_aliases() {
    for model in [
        "gpt-5.6",
        "openai/gpt-5.6",
        "gpt-5.6-codex",
        "gpt-5.6-2099-01-01",
        "openai/gpt-5.6-codex-2099-01-01",
    ] {
        assert_eq!(
            CostUsagePricing::normalize_codex_model(model),
            "gpt-5.6-sol",
            "{model}"
        );
    }
}

#[test]
fn test_codex_display_label() {
    assert_eq!(
        CostUsagePricing::codex_display_label("gpt-5.3-codex-spark"),
        Some("Research Preview")
    );
    assert_eq!(CostUsagePricing::codex_display_label("gpt-5.4"), None);
}

#[test]
fn test_codex_fast_multiplier() {
    assert_eq!(
        CostUsagePricing::codex_api_fast_multiplier("gpt-5.6-sol"),
        Some(2.0)
    );
    assert_eq!(
        CostUsagePricing::codex_api_fast_multiplier("gpt-5.6-terra"),
        Some(2.0)
    );
    assert_eq!(
        CostUsagePricing::codex_api_fast_multiplier("gpt-5.6-luna"),
        Some(2.0)
    );
    assert_eq!(
        CostUsagePricing::codex_api_fast_multiplier("gpt-5.4"),
        Some(2.0)
    );
    assert_eq!(
        CostUsagePricing::codex_api_fast_multiplier("gpt-5.5"),
        Some(2.5)
    );
    assert_eq!(
        CostUsagePricing::codex_api_fast_multiplier("gpt-5.6-sol-fast"),
        Some(2.0)
    );
    assert_eq!(CostUsagePricing::codex_api_fast_multiplier("unknown"), None);
}

#[test]
fn test_codex_fast_cost_is_double_standard() {
    let standard = CostUsagePricing::codex_cost_usd("gpt-5.6-sol", 1000, 0, 500).unwrap();
    let fast = CostUsagePricing::codex_fast_cost_usd("gpt-5.6-sol", 1000, 0, 500).unwrap();
    assert!((fast - standard * 2.0).abs() < 1e-10);
}

#[test]
fn test_codex_fast_cost_none_above_long_context_threshold() {
    // Input above 272_000 → None (Fast not offered)
    assert_eq!(
        CostUsagePricing::codex_fast_cost_usd("gpt-5.6-sol", 272_001, 0, 100),
        None
    );
}

#[test]
fn test_codex_fast_cost_usd_suffixed_models_resolve_to_base() {
    // gpt-5.5-fast → base gpt-5.5 → 2.5x multiplier
    let base = CostUsagePricing::codex_cost_usd("gpt-5.5", 1000, 0, 500).unwrap();
    let fast = CostUsagePricing::codex_fast_cost_usd("gpt-5.5-fast", 1000, 0, 500).unwrap();
    assert!(
        (fast - base * 2.5).abs() < 1e-10,
        "gpt-5.5-fast should be gpt-5.5 × 2.5"
    );

    // gpt-5.6-sol-priority → base gpt-5.6-sol → 2.0x multiplier
    let sol_base = CostUsagePricing::codex_cost_usd("gpt-5.6-sol", 1000, 400, 1000).unwrap();
    let sol_fast =
        CostUsagePricing::codex_fast_cost_usd("gpt-5.6-sol-priority", 1000, 400, 1000).unwrap();
    assert!(
        (sol_fast - sol_base * 2.0).abs() < 1e-10,
        "gpt-5.6-sol-priority should be gpt-5.6-sol × 2.0"
    );
}

#[test]
fn test_codex_fast_cost_usd_base_model_unsuffixed() {
    // Unsuffixed base models still resolve to themselves.
    assert_eq!(
        CostUsagePricing::codex_fast_base_model("gpt-5.6-terra"),
        "gpt-5.6-terra"
    );
    assert_eq!(
        CostUsagePricing::codex_fast_base_model("gpt-5.5"),
        "gpt-5.5"
    );
    // Unknown models return normalized original.
    assert_eq!(
        CostUsagePricing::codex_fast_base_model("my-custom-model"),
        "my-custom-model"
    );
}

// ── Upstream 0.50.1 #2946: provider-qualified routed model pricing ──────────

#[test]
fn codex_routed_provider_detects_known_routes() {
    assert_eq!(
        codex_routed_pricing::codex_routed_provider("deepseek/deepseek-chat"),
        Some("deepseek")
    );
    assert_eq!(
        codex_routed_pricing::codex_routed_provider("kimi/kimi-k2"),
        Some("kimi")
    );
    assert_eq!(
        codex_routed_pricing::codex_routed_provider("opencode/gpt-5"),
        Some("opencode")
    );
    // Case-insensitive prefix.
    assert_eq!(
        codex_routed_pricing::codex_routed_provider("DeepSeek/deepseek-chat"),
        Some("deepseek")
    );
}

#[test]
fn codex_routed_provider_returns_none_for_unknown_and_unrouted() {
    assert!(codex_routed_pricing::codex_routed_provider("acme/model-x").is_none());
    assert!(codex_routed_pricing::codex_routed_provider("gpt-5").is_none());
    assert!(codex_routed_pricing::codex_routed_provider("deepseek-chat").is_none());
    assert!(codex_routed_pricing::codex_routed_provider("openai/gpt-5").is_none());
}

#[test]
fn codex_routed_model_with_unknown_prefix_stays_unpriced() {
    // An unknown provider/ prefix must NOT fall back to the OpenAI catalog
    // (upstream 0.50.1 #2946: unknown prefixes are left unpriced, not guessed).
    assert!(CostUsagePricing::codex_cost_usd("acme/secret-model", 1_000, 0, 500).is_none());
}

#[test]
fn codex_routed_model_strips_prefix_for_lookup() {
    // A known route prefix produces a clean model id for models.dev lookup.
    // A nonexistent sub-model returns None (cleanly unpriced) rather than
    // falling back to the OpenAI catalog.
    assert!(
        CostUsagePricing::codex_cost_usd("deepseek/nonexistent-model-xyz", 1_000, 0, 500).is_none()
    );
    assert!(
        CostUsagePricing::codex_cost_usd("kimi/nonexistent-model-xyz", 1_000, 0, 500).is_none()
    );
}

// ── Upstream 0.53: Claude first-party models.dev routing ───────────────

#[test]
fn claude_bare_models_route_to_first_party_vendors() {
    assert_eq!(
        CostUsagePricing::claude_models_dev_target("gpt-5")
            .unwrap()
            .0,
        "openai"
    );
    assert_eq!(
        CostUsagePricing::claude_models_dev_target("gemini-2.5-pro")
            .unwrap()
            .0,
        "google"
    );
    assert_eq!(
        CostUsagePricing::claude_models_dev_target("deepseek-chat")
            .unwrap()
            .0,
        "deepseek"
    );
    assert_eq!(
        CostUsagePricing::claude_models_dev_target("claude-sonnet-4-6")
            .unwrap()
            .0,
        "anthropic"
    );
}

#[test]
fn claude_explicit_unknown_vendor_fails_closed() {
    assert!(CostUsagePricing::claude_models_dev_target("acme/secret-model").is_none());
    assert_eq!(
        CostUsagePricing::claude_models_dev_target("openai/gpt-5").unwrap(),
        ("openai", "gpt-5".to_string())
    );
}

#[test]
fn gpt56_historical_terra_luna_rates_change_at_2026_07_30() {
    use chrono::NaiveDate;

    let before = NaiveDate::from_ymd_opt(2026, 7, 29).unwrap();
    let after = NaiveDate::from_ymd_opt(2026, 7, 30).unwrap();

    let terra_before =
        CostUsagePricing::codex_cost_usd_at_date("gpt-5.6-terra", 100, 10, 5, before).unwrap();
    let terra_after =
        CostUsagePricing::codex_cost_usd_at_date("gpt-5.6-terra", 100, 10, 5, after).unwrap();
    let luna_before =
        CostUsagePricing::codex_cost_usd_at_date("gpt-5.6-luna", 100, 10, 5, before).unwrap();
    let luna_after =
        CostUsagePricing::codex_cost_usd_at_date("gpt-5.6-luna", 100, 10, 5, after).unwrap();

    let terra_before_expected = 90.0 * 2.5e-6 + 10.0 * 2.5e-7 + 5.0 * 1.5e-5;
    let terra_after_expected = 90.0 * 2e-6 + 10.0 * 2e-7 + 5.0 * 1.2e-5;
    let luna_before_expected = 90.0 * 1e-6 + 10.0 * 1e-7 + 5.0 * 6e-6;
    let luna_after_expected = 90.0 * 2e-7 + 10.0 * 2e-8 + 5.0 * 1.2e-6;

    assert!((terra_before - terra_before_expected).abs() < 1e-12);
    assert!((terra_after - terra_after_expected).abs() < 1e-12);
    assert!((luna_before - luna_before_expected).abs() < 1e-12);
    assert!((luna_after - luna_after_expected).abs() < 1e-12);
    assert!(terra_before > terra_after);
    assert!(luna_before > luna_after);
}

#[test]
fn gpt56_historical_pricing_keeps_sol_unchanged() {
    use chrono::NaiveDate;

    let before = NaiveDate::from_ymd_opt(2026, 7, 29).unwrap();
    let current = CostUsagePricing::codex_cost_usd("gpt-5.6-sol", 100, 10, 5).unwrap();
    let historical =
        CostUsagePricing::codex_cost_usd_at_date("gpt-5.6-sol", 100, 10, 5, before).unwrap();
    assert!((historical - current).abs() < f64::EPSILON);
}

#[test]
fn gpt56_historical_long_context_uses_pre_cut_rates() {
    use chrono::NaiveDate;

    let before = NaiveDate::from_ymd_opt(2026, 7, 29).unwrap();
    let terra =
        CostUsagePricing::codex_cost_usd_at_date("gpt-5.6-terra", 300_000, 30_000, 1_000, before)
            .unwrap();
    let expected = 270_000.0 * 5e-6 + 30_000.0 * 5e-7 + 1_000.0 * 2.25e-5;
    assert!((terra - expected).abs() < 1e-10);
}

// ── Phase 4: golden pricing corpus + anti-unit-error tests ──────────────
// docs/architecture/PRICING_CATALOG.md "Golden test corpus" section.
// Every rate in CODEX_PRICING/CLAUDE_PRICING is USD per SINGLE token
// (e.g. 1.25e-6 == $1.25 per 1,000,000 tokens). These tests exist
// specifically to catch a stray *1000, /1000, or /1_000_000 slipping
// into a future edit -- they assert the *linear scaling* of cost with
// token count against the known per-token rate, at three different
// magnitudes, not just one hardcoded expected total.

#[test]
fn golden_codex_input_only() {
    // gpt-5: input 1.25e-6 $/token, output 1e-5, cache_read 1.25e-7.
    let cost = CostUsagePricing::codex_cost_usd("gpt-5", 1_000, 0, 0).unwrap();
    assert!((cost - 1_000.0 * 1.25e-6).abs() < 1e-12);
}

#[test]
fn golden_codex_output_only() {
    let cost = CostUsagePricing::codex_cost_usd("gpt-5", 0, 0, 1_000).unwrap();
    assert!((cost - 1_000.0 * 1e-5).abs() < 1e-12);
}

#[test]
fn golden_codex_cached_input_only() {
    // `cached_input_tokens` is a SUBSET of `input_tokens` (billed at the
    // cache-read discount instead of the full input rate), not an
    // additional category on top -- verified against
    // `codex_cost_from_rates`'s `cached_input_tokens.min(input_tokens)`
    // clamp. All 1,000 input tokens being cache hits means the full
    // 1,000 bill at the cache-read rate, zero at the full input rate.
    let cost = CostUsagePricing::codex_cost_usd("gpt-5", 1_000, 1_000, 0).unwrap();
    assert!((cost - 1_000.0 * 1.25e-7).abs() < 1e-12);
}

#[test]
fn golden_codex_mixed_tokens() {
    // 2,000 total input tokens, 500 of which are cache hits: 1,500 bill
    // at the full input rate, 500 at the cache-read rate, plus 300
    // output tokens.
    let cost = CostUsagePricing::codex_cost_usd("gpt-5", 2_000, 500, 300).unwrap();
    let expected = 1_500.0 * 1.25e-6 + 500.0 * 1.25e-7 + 300.0 * 1e-5;
    assert!((cost - expected).abs() < 1e-12);
}

#[test]
fn golden_codex_cached_tokens_never_exceed_input_tokens() {
    // A malformed/adversarial input where reported cached tokens exceed
    // reported total input tokens must not bill more cached tokens than
    // actually exist -- the clamp caps cached at input_tokens, so this
    // is priced identically to cached == input_tokens (all-cache-hit).
    let over_reported = CostUsagePricing::codex_cost_usd("gpt-5", 100, 500, 0).unwrap();
    let all_cached = CostUsagePricing::codex_cost_usd("gpt-5", 100, 100, 0).unwrap();
    assert!((over_reported - all_cached).abs() < 1e-12);
    assert!((over_reported - 100.0 * 1.25e-7).abs() < 1e-12);
}

#[test]
fn golden_codex_zero_tokens_is_zero_not_unavailable() {
    // Zero usage is a real, known-zero cost -- distinct from "unavailable"
    // (unknown model). A model IS in the catalog, so this must be Some(0.0).
    let cost = CostUsagePricing::codex_cost_usd("gpt-5", 0, 0, 0).unwrap();
    assert_eq!(cost, 0.0);
}

#[test]
fn golden_codex_unknown_model_is_none_never_a_guessed_price() {
    assert!(CostUsagePricing::codex_cost_usd("gpt-99-does-not-exist", 1_000, 0, 500).is_none());
}

#[test]
fn golden_claude_input_only() {
    // claude-haiku-4-5-20251001: input 1e-6, output 5e-6, cache_write
    // 1.25e-6, cache_read 1e-7 $/token; no tiering (threshold_tokens: None).
    let cost =
        CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 1_000, 0, 0, 0).unwrap();
    assert!((cost - 1_000.0 * 1e-6).abs() < 1e-12);
}

#[test]
fn golden_claude_output_only() {
    let cost =
        CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 0, 0, 0, 1_000).unwrap();
    assert!((cost - 1_000.0 * 5e-6).abs() < 1e-12);
}

#[test]
fn golden_claude_cache_read_and_cache_write() {
    let cost =
        CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 0, 500, 200, 0).unwrap();
    let expected = 500.0 * 1e-7 + 200.0 * 1.25e-6;
    assert!((cost - expected).abs() < 1e-12);
}

#[test]
fn golden_claude_mixed_all_four_categories() {
    let cost = CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 1_000, 300, 100, 400)
        .unwrap();
    let expected = 1_000.0 * 1e-6 + 300.0 * 1e-7 + 100.0 * 1.25e-6 + 400.0 * 5e-6;
    assert!((cost - expected).abs() < 1e-12);
}

#[test]
fn golden_claude_zero_tokens_is_zero_not_unavailable() {
    let cost = CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 0, 0, 0, 0).unwrap();
    assert_eq!(cost, 0.0);
}

#[test]
fn golden_claude_unknown_model_is_none_never_a_guessed_price() {
    assert!(
        CostUsagePricing::claude_cost_usd("claude-does-not-exist-9999", 1_000, 0, 0, 500).is_none()
    );
}

#[test]
fn golden_claude_alias_normalization_only_for_asserted_equivalence() {
    // normalize_claude_model strips a "anthropic." vendor prefix (an
    // identity alias, not a pricing-equivalence claim) -- already covered
    // by test_normalize_claude_model above. This test instead asserts
    // that a genuinely different, non-aliased model ID is NOT silently
    // collapsed onto a similarly-named one.
    assert!(CostUsagePricing::claude_cost_usd("claude-haiku-5", 1_000, 0, 0, 0).is_none());
}

/// Anti-1000x regression: cost must scale EXACTLY linearly with token
/// count across three widely-separated magnitudes (1 / 1,000 / 1,000,000
/// tokens). A `* 1000`, `/ 1000`, or `/ 1_000_000` unit slip anywhere in
/// the pricing pipeline breaks this ratio even though a single hardcoded
/// test case at one magnitude could still pass by coincidence.
#[test]
fn anti_1000x_codex_input_scales_linearly_across_magnitudes() {
    let per_token = 1.25e-6; // gpt-5 input rate
    let one = CostUsagePricing::codex_cost_usd("gpt-5", 1, 0, 0).unwrap();
    let thousand = CostUsagePricing::codex_cost_usd("gpt-5", 1_000, 0, 0).unwrap();
    let million = CostUsagePricing::codex_cost_usd("gpt-5", 1_000_000, 0, 0).unwrap();

    assert!((one - per_token).abs() < 1e-15);
    assert!((thousand - per_token * 1_000.0).abs() < 1e-12);
    assert!((million - per_token * 1_000_000.0).abs() < 1e-9);
    // The million-token cost must equal exactly the per-token rate scaled
    // by 1e6 -- i.e. $1.25 for gpt-5 input at 1M tokens, not $1,250 (a
    // stray *1000) nor $0.00125 (a stray /1000).
    assert!((million - 1.25).abs() < 1e-9);
}

#[test]
fn anti_1000x_claude_output_scales_linearly_across_magnitudes() {
    let per_token = 5e-6; // claude-haiku-4-5 output rate
    let one = CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 0, 0, 0, 1).unwrap();
    let thousand =
        CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 0, 0, 0, 1_000).unwrap();
    let million =
        CostUsagePricing::claude_cost_usd("claude-haiku-4-5-20251001", 0, 0, 0, 1_000_000).unwrap();

    assert!((one - per_token).abs() < 1e-15);
    assert!((thousand - per_token * 1_000.0).abs() < 1e-12);
    // $5.00 for 1M output tokens at claude-haiku-4-5's rate -- not $5,000
    // (stray *1000) nor $0.000005 (stray /1_000_000 applied twice).
    assert!((million - 5.0).abs() < 1e-9);
}
