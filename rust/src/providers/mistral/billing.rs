//! Pure interpretation of Mistral's admin billing response.
//!
//! The amount is reconstructed only from provider-returned billed quantities
//! and rates. Missing coverage is not zero and never invokes local pricing.

use std::collections::HashMap;

use chrono::{DateTime, TimeZone, Utc};
use serde::Deserialize;

use crate::core::{CostSnapshot, ProviderError, ProviderFetchResult, RateWindow, UsageSnapshot};

#[derive(Deserialize)]
struct BillingResponse {
    completion: Option<ModelUsageCategory>,
    ocr: Option<ModelUsageCategory>,
    connectors: Option<ModelUsageCategory>,
    audio: Option<ModelUsageCategory>,
    libraries_api: Option<LibrariesUsageCategory>,
    fine_tuning: Option<FineTuningCategory>,
    #[serde(rename = "start_date")]
    _start_date: Option<String>,
    end_date: Option<String>,
    currency: Option<String>,
    currency_symbol: Option<String>,
    prices: Option<Vec<MistralPrice>>,
    #[serde(flatten)]
    unrecognized: HashMap<String, serde_json::Value>,
}

type Models = HashMap<String, ModelUsageData>;
type Prices = HashMap<(String, String), Option<f64>>;

#[derive(Deserialize)]
struct ModelUsageCategory {
    models: Option<Models>,
    #[serde(flatten)]
    unrecognized: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct LibrariesUsageCategory {
    pages: Option<ModelUsageCategory>,
    tokens: Option<ModelUsageCategory>,
    #[serde(flatten)]
    unrecognized: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct FineTuningCategory {
    training: Option<Models>,
    storage: Option<Models>,
    #[serde(flatten)]
    unrecognized: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct ModelUsageData {
    input: Option<Vec<UsageEntry>>,
    output: Option<Vec<UsageEntry>>,
    cached: Option<Vec<UsageEntry>>,
    #[serde(flatten)]
    unrecognized: HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct UsageEntry {
    billing_metric: Option<String>,
    billing_group: Option<String>,
    value: Option<i64>,
    value_paid: Option<i64>,
}

impl UsageEntry {
    fn quantity(&self) -> Option<i64> {
        // Preserve the existing provider billing contract; do not substitute
        // total activity for an explicitly reported billed quantity.
        self.value_paid.or(self.value).filter(|value| *value >= 0)
    }
}

#[derive(Deserialize)]
struct MistralPrice {
    billing_metric: Option<String>,
    billing_group: Option<String>,
    price: Option<String>,
}

fn price_index(prices: Option<Vec<MistralPrice>>) -> Prices {
    let mut result = Prices::new();
    for price in prices.into_iter().flatten() {
        let (Some(metric), Some(group)) = (price.billing_metric, price.billing_group) else {
            continue;
        };
        let value = price
            .price
            .and_then(|raw| raw.parse::<f64>().ok())
            .filter(|value| value.is_finite() && *value >= 0.0);
        result
            .entry((metric, group))
            .and_modify(|previous| {
                if *previous != value {
                    *previous = None;
                }
            })
            .or_insert(value);
    }
    result
}

fn model_cost(model: &ModelUsageData, prices: &Prices) -> Option<f64> {
    if !model.unrecognized.is_empty() {
        return None;
    }
    [
        model.input.as_deref(),
        model.output.as_deref(),
        model.cached.as_deref(),
    ]
    .into_iter()
    .try_fold(0.0, |mut total, entries| {
        // Explicit empty lanes are known zero. An omitted lane cannot
        // establish that it contributed no charges to a complete total.
        for entry in entries? {
            let key = (entry.billing_metric.clone()?, entry.billing_group.clone()?);
            let rate = prices.get(&key).copied().flatten()?;
            let amount = (entry.quantity()? as f64) * rate;
            total += amount;
            if !total.is_finite() {
                return None;
            }
        }
        Some(total)
    })
}

fn category_models(category: Option<&ModelUsageCategory>) -> Option<&Models> {
    category?.models.as_ref()
}

fn complete_category_models(category: Option<&ModelUsageCategory>) -> Option<&Models> {
    category_models(category.filter(|value| value.unrecognized.is_empty()))
}

fn complete_cost(billing: &BillingResponse, prices: &Prices) -> Option<f64> {
    if !billing.unrecognized.is_empty() {
        return None;
    }
    let libraries = billing.libraries_api.as_ref();
    let fine_tuning = billing.fine_tuning.as_ref();
    if libraries.is_some_and(|value| !value.unrecognized.is_empty())
        || fine_tuning.is_some_and(|value| !value.unrecognized.is_empty())
    {
        return None;
    }
    [
        complete_category_models(billing.completion.as_ref()),
        complete_category_models(billing.ocr.as_ref()),
        complete_category_models(billing.connectors.as_ref()),
        complete_category_models(billing.audio.as_ref()),
        complete_category_models(libraries.and_then(|value| value.pages.as_ref())),
        complete_category_models(libraries.and_then(|value| value.tokens.as_ref())),
        fine_tuning.and_then(|value| value.training.as_ref()),
        fine_tuning.and_then(|value| value.storage.as_ref()),
    ]
    .into_iter()
    .try_fold(0.0, |mut total, models| {
        // No public schema establishes omitted categories as zero. Keep
        // incomplete responses useful for tokens, but do not publish a partial
        // billing sum as the entire month's Spend.
        for model in models?.values() {
            total += model_cost(model, prices)?;
            if !total.is_finite() {
                return None;
            }
        }
        Some(total)
    })
}

fn token_total(
    models: Option<&Models>,
    lane: fn(&ModelUsageData) -> Option<&[UsageEntry]>,
) -> Option<i64> {
    models?.values().try_fold(0_i64, |mut total, model| {
        for entry in lane(model)? {
            total = total.checked_add(entry.quantity()?)?;
        }
        Some(total)
    })
}

fn parse_date(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
        .or_else(|| {
            chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d")
                .ok()
                .and_then(|date| date.and_hms_opt(0, 0, 0))
                .map(|date| Utc.from_utc_datetime(&date))
        })
}

pub(super) fn parse_response(body: &str) -> Result<ProviderFetchResult, ProviderError> {
    let mut billing: BillingResponse = serde_json::from_str(body).map_err(|_| {
        ProviderError::Parse("Mistral billing response has an unsupported shape".into())
    })?;
    let prices = price_index(billing.prices.take());
    let amount = complete_cost(&billing, &prices);
    let currency = billing
        .currency
        .as_deref()
        .map(str::trim)
        .filter(|value| value.len() == 3 && value.bytes().all(|byte| byte.is_ascii_alphabetic()))
        .map(str::to_ascii_uppercase)
        .filter(|value| value != "XXX");
    let cost = amount.zip(currency).map(|(amount, currency)| {
        let mut cost = CostSnapshot::new(amount, currency, "Monthly");
        cost.currency_symbol = billing
            .currency_symbol
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned);
        // Retain the reported period boundary; do not add an inferred second
        // or turn billing-period metadata into a physical quota reset.
        cost.resets_at = billing.end_date.as_deref().and_then(parse_date);
        cost
    });

    let models = category_models(billing.completion.as_ref());
    let mut details = vec![match &cost {
        Some(cost) => format!("{:.4} {} monthly spend", cost.used, cost.currency_code),
        None => "Monthly spend unavailable".to_string(),
    }];
    if let Some(end) = billing.end_date.as_deref().and_then(parse_date) {
        details.push(format!("Billing period ends {}", end.to_rfc3339()));
    }
    for (label, tokens) in [
        ("input", token_total(models, |model| model.input.as_deref())),
        (
            "output",
            token_total(models, |model| model.output.as_deref()),
        ),
        (
            "cached",
            token_total(models, |model| model.cached.as_deref()),
        ),
    ] {
        if let Some(tokens) = tokens {
            details.push(format!("{tokens} {label} tokens"));
        }
    }
    if let Some(models) = models {
        details.push(format!("{} observed completion model(s)", models.len()));
    }
    let mut result = ProviderFetchResult::new(
        UsageSnapshot::new(RateWindow::informational(details.join(" • "))),
        "web",
    );
    result.cost = cost;
    Ok(result)
}

#[cfg(test)]
#[path = "billing_tests.rs"]
mod tests;
