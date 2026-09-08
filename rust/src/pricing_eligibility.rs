//! Phase 4B: a deterministic, PURE eligibility model for whether Quotalis
//! could ever locally estimate a monetary cost for a given observation --
//! it decides ELIGIBILITY only, and computes no money whatsoever. Nothing
//! in this module is wired into any command, selector, or UI; it exists to
//! make the capability rules in
//! `docs/validation/QUOTALIS_PROVIDER_CAPABILITY_MATRIX.md` executable and
//! testable ahead of any future Phase 4C runtime work.
//!
//! Core rule (owner Phase 4B section 7): a provider observation is
//! eligible for local cost estimation ONLY if ALL of the following hold --
//! billing channel is priceable AND matches the pricing record's own
//! channel; canonical model is known; every required billable token/
//! request category the pricing record needs is actually present on the
//! observation; currency/pricing unit is known; and an applicable,
//! verified pricing record exists. No fallback model, no averaged
//! provider price, no quota-to-cost conversion -- any missing input fails
//! the whole check closed.

use std::fmt;

/// Which billing/entitlement channel a real observation (or a pricing
/// record) belongs to. Distinct channels are NOT interchangeable even
/// when the provider/model names look related -- e.g. a ChatGPT/Codex
/// subscription quota observation is a fundamentally different channel
/// from OpenAI's own direct API token billing, even though both run on
/// the same underlying models.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BillingChannel {
    /// A consumer/CLI subscription plan's included usage (flat monthly
    /// fee, quota-limited) -- e.g. ChatGPT Plus/Pro/Team, Claude Pro/Max.
    SubscriptionQuota,
    /// A genuine API key's own per-token/per-request metered billing.
    DirectApi,
    /// A prepaid credit balance with a provider-defined (not necessarily
    /// 1:1-USD) unit.
    PrepaidCredits,
    /// A cash-denominated prepaid balance the provider reports directly.
    ProviderBalance,
    /// A proxy/aggregator in front of many upstream models -- pricing
    /// may be gateway-specific, markup-adjusted, or dynamic; the
    /// upstream vendor's own official price does not automatically apply.
    GatewayReseller,
    /// A CLI-specific entitlement with no clean subscription/API-key
    /// distinction established yet.
    CliEntitlement,
    /// Not yet established from real evidence.
    Unknown,
}

impl fmt::Display for BillingChannel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::SubscriptionQuota => "SubscriptionQuota",
            Self::DirectApi => "DirectApi",
            Self::PrepaidCredits => "PrepaidCredits",
            Self::ProviderBalance => "ProviderBalance",
            Self::GatewayReseller => "GatewayReseller",
            Self::CliEntitlement => "CliEntitlement",
            Self::Unknown => "Unknown",
        };
        write!(f, "{s}")
    }
}

/// What a real (or hypothetical, for testing) monetary/usage observation
/// actually has available, per the owner's explicit "structurally
/// available vs. actually populated" distinction -- every field here
/// must describe what a LIVE adapter really produces, never a
/// theoretical type capability.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservationCapabilities {
    pub billing_channel: BillingChannel,
    /// A model name existing alone is NOT proof of priceability (owner
    /// section 8) -- this field only says whether a canonical model
    /// identifier is known for this specific observation.
    pub canonical_model_known: bool,
    pub has_input_tokens: bool,
    pub has_output_tokens: bool,
    pub has_cached_input_tokens: bool,
    pub has_cache_write_tokens: bool,
    pub has_request_count: bool,
    pub currency_or_unit_known: bool,
}

/// What a candidate pricing record requires to price a given billing
/// channel/model, and whether that record itself has been verified
/// against an official source.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PricingRequirements {
    /// The channel this pricing record actually prices -- e.g. an
    /// official API per-token price list prices `DirectApi`, never
    /// `SubscriptionQuota`, even for the identical model name.
    pub priceable_channel: BillingChannel,
    pub requires_input_tokens: bool,
    pub requires_output_tokens: bool,
    pub requires_cached_input_tokens: bool,
    pub requires_cache_write_tokens: bool,
    pub requires_request_count: bool,
    /// True only for a pricing record whose freshness state is
    /// "Verified" against an official source with a real verification
    /// date (see PRICING_PROVENANCE.md) -- "Unverified"/"Potentially
    /// stale"/"Unavailable" records must all set this `false`.
    pub pricing_verified: bool,
}

/// Why a candidate observation/pricing-record pair is NOT eligible for
/// local cost estimation. Each variant names exactly one failed
/// precondition so a test (or a future UI) can say precisely why.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IneligibilityReason {
    /// The pricing record's channel does not match the observation's
    /// channel -- e.g. a SubscriptionQuota observation paired with a
    /// DirectApi pricing record. Checked FIRST and independently of
    /// every other field, including when provider/model names match.
    BillingChannelMismatch,
    /// No canonical model identifier is known for this observation.
    ModelUnknown,
    /// The pricing record needs a token/request category the
    /// observation does not actually have.
    MissingBillableCategory,
    /// The observation's currency/unit could not be established.
    CurrencyOrUnitUnknown,
    /// The candidate pricing record itself has not been verified against
    /// an official source.
    PricingUnverified,
}

impl fmt::Display for IneligibilityReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::BillingChannelMismatch => "billing channel mismatch",
            Self::ModelUnknown => "canonical model unknown",
            Self::MissingBillableCategory => "required billable category missing",
            Self::CurrencyOrUnitUnknown => "currency/unit unknown",
            Self::PricingUnverified => "pricing record unverified",
        };
        write!(f, "{s}")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Eligibility {
    Eligible,
    NotEligible(IneligibilityReason),
}

/// Decide ONLY whether local cost estimation is eligible for this
/// observation/pricing-record pair -- never computes a dollar amount.
/// Checks run in a fixed, documented order so the FIRST failing
/// precondition is always the one reported (owner section 39: billing-
/// channel mismatch must fail closed even when every other field would
/// otherwise line up).
pub fn can_locally_estimate_cost(
    observation: &ObservationCapabilities,
    pricing: &PricingRequirements,
) -> Eligibility {
    if observation.billing_channel != pricing.priceable_channel {
        return Eligibility::NotEligible(IneligibilityReason::BillingChannelMismatch);
    }
    if !observation.canonical_model_known {
        return Eligibility::NotEligible(IneligibilityReason::ModelUnknown);
    }
    if pricing.requires_input_tokens && !observation.has_input_tokens {
        return Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory);
    }
    if pricing.requires_output_tokens && !observation.has_output_tokens {
        return Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory);
    }
    if pricing.requires_cached_input_tokens && !observation.has_cached_input_tokens {
        return Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory);
    }
    if pricing.requires_cache_write_tokens && !observation.has_cache_write_tokens {
        return Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory);
    }
    if pricing.requires_request_count && !observation.has_request_count {
        return Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory);
    }
    if !observation.currency_or_unit_known {
        return Eligibility::NotEligible(IneligibilityReason::CurrencyOrUnitUnknown);
    }
    if !pricing.pricing_verified {
        return Eligibility::NotEligible(IneligibilityReason::PricingUnverified);
    }
    Eligibility::Eligible
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fully-equipped DirectApi observation with every category
    /// present, paired with a verified DirectApi pricing record that
    /// needs input+output tokens -- the one case that should succeed.
    fn eligible_pair() -> (ObservationCapabilities, PricingRequirements) {
        (
            ObservationCapabilities {
                billing_channel: BillingChannel::DirectApi,
                canonical_model_known: true,
                has_input_tokens: true,
                has_output_tokens: true,
                has_cached_input_tokens: true,
                has_cache_write_tokens: true,
                has_request_count: true,
                currency_or_unit_known: true,
            },
            PricingRequirements {
                priceable_channel: BillingChannel::DirectApi,
                requires_input_tokens: true,
                requires_output_tokens: true,
                requires_cached_input_tokens: false,
                requires_cache_write_tokens: false,
                requires_request_count: false,
                pricing_verified: true,
            },
        )
    }

    #[test]
    fn everything_required_present_is_eligible() {
        let (obs, pricing) = eligible_pair();
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::Eligible
        );
    }

    /// Owner section 39, required hard regression: a SubscriptionQuota
    /// observation can never use a DirectApi pricing record, even when
    /// every other field (model, tokens, currency, verification) lines
    /// up perfectly.
    #[test]
    fn billing_channel_mismatch_fails_even_with_everything_else_present() {
        let (mut obs, pricing) = eligible_pair();
        obs.billing_channel = BillingChannel::SubscriptionQuota;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::BillingChannelMismatch)
        );
    }

    #[test]
    fn model_missing_is_not_eligible() {
        let (mut obs, pricing) = eligible_pair();
        obs.canonical_model_known = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::ModelUnknown)
        );
    }

    /// Owner section 8: a model ID existing alone (with only quota%
    /// otherwise available) does not enable token-cost estimation --
    /// modeled here as missing input tokens even though the model IS
    /// known, proving the model-known check alone is not sufficient.
    #[test]
    fn model_known_but_token_categories_missing_is_not_eligible() {
        let (mut obs, pricing) = eligible_pair();
        obs.has_input_tokens = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory)
        );
    }

    #[test]
    fn missing_required_output_tokens_is_not_eligible() {
        let (mut obs, pricing) = eligible_pair();
        obs.has_output_tokens = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory)
        );
    }

    #[test]
    fn required_cached_input_category_missing_is_not_eligible() {
        let (mut obs, mut pricing) = eligible_pair();
        pricing.requires_cached_input_tokens = true;
        obs.has_cached_input_tokens = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory)
        );
    }

    #[test]
    fn required_cache_write_category_missing_is_not_eligible() {
        let (mut obs, mut pricing) = eligible_pair();
        pricing.requires_cache_write_tokens = true;
        obs.has_cache_write_tokens = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory)
        );
    }

    #[test]
    fn required_request_count_missing_is_not_eligible() {
        let (mut obs, mut pricing) = eligible_pair();
        pricing.requires_request_count = true;
        obs.has_request_count = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::MissingBillableCategory)
        );
    }

    #[test]
    fn currency_unknown_is_not_eligible() {
        let (mut obs, pricing) = eligible_pair();
        obs.currency_or_unit_known = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::CurrencyOrUnitUnknown)
        );
    }

    #[test]
    fn unverified_pricing_is_not_eligible() {
        let (obs, mut pricing) = eligible_pair();
        pricing.pricing_verified = false;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::PricingUnverified)
        );
    }

    /// Owner section 40: Credits + an API price record is NOT eligible
    /// unless an official conversion/billing-semantics match is proven --
    /// modeled here as a straightforward channel mismatch, since no
    /// Quotalis provider today has PrepaidCredits classified as
    /// equivalent to DirectApi.
    #[test]
    fn credits_channel_never_matches_direct_api_pricing_by_default() {
        let (mut obs, pricing) = eligible_pair();
        obs.billing_channel = BillingChannel::PrepaidCredits;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::BillingChannelMismatch)
        );
    }

    /// Owner section 40: a Balance observation must not use an upstream
    /// API price record by default either.
    #[test]
    fn balance_channel_never_matches_direct_api_pricing_by_default() {
        let (mut obs, pricing) = eligible_pair();
        obs.billing_channel = BillingChannel::ProviderBalance;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::BillingChannelMismatch)
        );
    }

    /// A gateway/reseller observation must not silently accept the
    /// upstream vendor's own official DirectApi price record -- the
    /// gateway's own billing (if any) is a distinct channel.
    #[test]
    fn gateway_reseller_channel_never_matches_upstream_direct_api_pricing() {
        let (mut obs, pricing) = eligible_pair();
        obs.billing_channel = BillingChannel::GatewayReseller;
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::BillingChannelMismatch)
        );
    }

    /// Real-shaped case: a SubscriptionQuota pricing record with no
    /// required token categories still requires currency/unit and
    /// verification to be known -- an empty requirement set is not a
    /// free pass.
    #[test]
    fn subscription_quota_pricing_still_requires_currency_and_verification() {
        let obs = ObservationCapabilities {
            billing_channel: BillingChannel::SubscriptionQuota,
            canonical_model_known: true,
            has_input_tokens: false,
            has_output_tokens: false,
            has_cached_input_tokens: false,
            has_cache_write_tokens: false,
            has_request_count: false,
            currency_or_unit_known: false,
        };
        let pricing = PricingRequirements {
            priceable_channel: BillingChannel::SubscriptionQuota,
            requires_input_tokens: false,
            requires_output_tokens: false,
            requires_cached_input_tokens: false,
            requires_cache_write_tokens: false,
            requires_request_count: false,
            pricing_verified: true,
        };
        assert_eq!(
            can_locally_estimate_cost(&obs, &pricing),
            Eligibility::NotEligible(IneligibilityReason::CurrencyOrUnitUnknown)
        );
    }
}
