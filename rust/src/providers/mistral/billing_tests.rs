use super::*;
use serde_json::{Value, json};

fn complete_fixture() -> Value {
    json!({
        "currency": "EUR",
        "currency_symbol": "€",
        "start_date": "2026-04-01T00:00:00Z",
        "end_date": "2026-04-30T23:59:59Z",
        "prices": [
            {"billing_metric": "fixture-model", "billing_group": "input", "price": "0.000002"},
            {"billing_metric": "fixture-model", "billing_group": "output", "price": "0.000006"}
        ],
        "completion": {"models": {"fixture-model": {
            "input": [{"billing_metric": "fixture-model", "billing_group": "input", "value": 1200, "value_paid": 1000}],
            "output": [{"billing_metric": "fixture-model", "billing_group": "output", "value_paid": 500}],
            "cached": []
        }}},
        "ocr": {"models": {}},
        "connectors": {"models": {}},
        "audio": {"models": {}},
        "libraries_api": {"pages": {"models": {}}, "tokens": {"models": {}}},
        "fine_tuning": {"training": {}, "storage": {}}
    })
}

fn result(value: Value) -> ProviderFetchResult {
    parse_response(&value.to_string()).unwrap()
}

#[test]
fn complete_provider_billing_preserves_spend_and_tokens_without_quota_or_plan() {
    let result = result(complete_fixture());
    let cost = result.cost.unwrap();
    assert!((cost.used - 0.005).abs() < 0.000001);
    assert_eq!(cost.currency_code, "EUR");
    assert_eq!(cost.currency_symbol.as_deref(), Some("€"));
    assert_eq!(cost.resets_at, parse_date("2026-04-30T23:59:59Z"));
    assert!(result.usage.primary.is_informational);
    assert!(
        result.usage.primary.resets_at.is_none(),
        "billing end is not a quota reset"
    );
    assert!(
        result.usage.login_method.is_none(),
        "model count is not a plan"
    );
    let detail = result.usage.primary.reset_description.unwrap();
    assert!(detail.contains("1000 input tokens"));
    assert!(detail.contains("500 output tokens"));
    assert!(detail.contains("0 cached tokens"));
    assert!(detail.contains("1 observed completion model(s)"));
}

#[test]
fn missing_billing_evidence_does_not_become_zero_euros_or_quota() {
    let result = result(json!({"completion": {"models": {"fixture-model": {
        "input": [{"value_paid": 1000}], "output": [{"value_paid": 500}]
    }}}}));
    assert!(result.cost.is_none(), "unpriced usage is not zero spend");
    assert!(
        result.usage.primary.is_informational,
        "billing is not a quota"
    );
    assert!(
        result.usage.login_method.is_none(),
        "model count is not a plan"
    );
    let detail = result.usage.primary.reset_description.unwrap();
    assert!(detail.contains("1000 input"));
    assert!(detail.contains("500 output"));
    assert!(!detail.contains("0 cached"));
}

#[test]
fn empty_billing_response_is_unknown_not_no_usage() {
    let result = result(json!({}));
    assert!(result.cost.is_none());
    assert!(result.usage.primary.is_informational);
    assert!(result.usage.login_method.is_none());
    let detail = result.usage.primary.reset_description.unwrap();
    assert!(!detail.contains("No usage"));
    assert!(!detail.contains("0 input"));
}

#[test]
fn partial_category_or_lane_coverage_cannot_produce_a_monthly_total() {
    for key in [
        "completion",
        "ocr",
        "connectors",
        "audio",
        "libraries_api",
        "fine_tuning",
    ] {
        let mut body = complete_fixture();
        body.as_object_mut().unwrap().remove(key);
        assert!(result(body).cost.is_none(), "missing {key} is not zero");
    }
    let mut body = complete_fixture();
    body["completion"]["models"]["fixture-model"]
        .as_object_mut()
        .unwrap()
        .remove("cached");
    let result = result(body);
    assert!(result.cost.is_none());
    assert!(
        !result
            .usage
            .primary
            .reset_description
            .unwrap()
            .contains("0 cached")
    );
}

#[test]
fn missing_invalid_or_ambiguous_rates_do_not_hide_unpriced_rows() {
    for price in [
        Value::Null,
        json!("NaN"),
        json!("1e309"),
        json!("-0.1"),
        json!("1e308"),
    ] {
        let mut body = complete_fixture();
        body["prices"][0]["price"] = price;
        let result = result(body);
        assert!(result.cost.is_none());
        assert!(
            result
                .usage
                .primary
                .reset_description
                .unwrap()
                .contains("1000 input")
        );
    }
    for replacement in [Value::Null, json!([])] {
        let mut body = complete_fixture();
        body["prices"] = replacement;
        let result = result(body);
        assert!(result.cost.is_none());
        assert!(
            result
                .usage
                .primary
                .reset_description
                .unwrap()
                .contains("2026-04-30")
        );
    }
    let mut body = complete_fixture();
    body["prices"].as_array_mut().unwrap().push(json!({
        "billing_metric": "fixture-model", "billing_group": "input", "price": "3"
    }));
    assert!(result(body).cost.is_none(), "conflicting duplicate rate");
}

#[test]
fn incomplete_or_negative_billed_quantities_are_not_zero() {
    for quantity in [Value::Null, json!(-1)] {
        let mut body = complete_fixture();
        body["completion"]["models"]["fixture-model"]["output"][0]["value_paid"] = quantity;
        let result = result(body);
        assert!(result.cost.is_none());
        let detail = result.usage.primary.reset_description.unwrap();
        assert!(detail.contains("1000 input"));
        assert!(!detail.contains("output tokens"));
    }
}

#[test]
fn reported_currency_is_required_but_a_symbol_is_optional() {
    for currency in [
        Value::Null,
        json!(""),
        json!("  "),
        json!("XXX"),
        json!("not-currency"),
    ] {
        let mut body = complete_fixture();
        body["currency"] = currency;
        assert!(result(body).cost.is_none());
    }
    let mut body = complete_fixture();
    body["currency"] = json!(" eur ");
    body.as_object_mut().unwrap().remove("currency_symbol");
    let cost = result(body).cost.unwrap();
    assert_eq!(cost.currency_code, "EUR");
    assert!(cost.currency_symbol.is_none());
}

#[test]
fn explicit_empty_usage_and_zero_prices_remain_known_zero_spend() {
    let mut empty = complete_fixture();
    empty["completion"]["models"] = json!({});
    empty.as_object_mut().unwrap().remove("prices");
    assert_eq!(result(empty).cost.unwrap().used, 0.0);

    let mut free = complete_fixture();
    for price in free["prices"].as_array_mut().unwrap() {
        price["price"] = json!("0");
    }
    let free = result(free);
    assert_eq!(free.cost.unwrap().used, 0.0);
    let detail = free.usage.primary.reset_description.unwrap();
    assert!(detail.contains("1000 input"));
    assert!(
        !detail.contains("No usage"),
        "free activity is still activity"
    );

    let mut zero = complete_fixture();
    for lane in ["input", "output"] {
        zero["completion"]["models"]["fixture-model"][lane][0]["value_paid"] = json!(0);
    }
    assert_eq!(result(zero).cost.unwrap().used, 0.0);
}

#[test]
fn overflowing_token_totals_do_not_wrap_or_replace_other_lanes() {
    let mut body = complete_fixture();
    let entry = json!({"billing_metric": "fixture-model", "billing_group": "input", "value_paid": i64::MAX});
    body["completion"]["models"]["fixture-model"]["input"] = json!([entry, entry]);
    let detail = result(body).usage.primary.reset_description.unwrap();
    assert!(!detail.contains("input tokens"));
    assert!(detail.contains("500 output tokens"));
}

#[test]
fn unrecognized_billing_fields_do_not_silently_disappear_from_totals() {
    let mut body = complete_fixture();
    body["new_charge_category"] = json!({"value": 42});
    assert!(result(body).cost.is_none());
    let mut body = complete_fixture();
    body["completion"]["models"]["fixture-model"]["new_lane"] = json!([{"value": 42}]);
    assert!(result(body).cost.is_none());
}

#[test]
fn unrecognized_nested_charge_categories_preserve_tokens_but_not_a_partial_total() {
    for parent in [
        "completion",
        "ocr",
        "connectors",
        "audio",
        "libraries_api",
        "fine_tuning",
    ] {
        let mut body = complete_fixture();
        body[parent]["new_charge_category"] = json!({"value": 42});
        let result = result(body);
        assert!(result.cost.is_none(), "unknown charge in {parent}");
        assert!(
            result
                .usage
                .primary
                .reset_description
                .unwrap()
                .contains("1000 input tokens")
        );
    }
    for nested in ["pages", "tokens"] {
        let mut body = complete_fixture();
        body["libraries_api"][nested]["new_charge_category"] = json!({"value": 42});
        assert!(
            result(body).cost.is_none(),
            "unknown library charge in {nested}"
        );
    }
}

#[test]
fn malformed_responses_return_generic_parse_errors() {
    let error = parse_response(r#"{"completion":"fixture-sensitive-value"}"#).unwrap_err();
    assert!(matches!(error, ProviderError::Parse(_)));
    assert!(!error.to_string().contains("fixture-sensitive-value"));
}
