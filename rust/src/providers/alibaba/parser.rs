use chrono::{DateTime, TimeZone, Utc};

use crate::core::{ProviderError, RateWindow, UsageSnapshot};

pub(crate) fn parse_response(json: &serde_json::Value) -> Result<UsageSnapshot, ProviderError> {
    let top_code = json.get("code").and_then(|v| v.as_str()).unwrap_or("");
    if !top_code.is_empty() && top_code != "200" {
        if top_code == "401" || top_code == "403" {
            return Err(ProviderError::AuthRequired);
        }
        let msg = json
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or(top_code);
        return Err(ProviderError::Other(format!("API error: {msg}")));
    }

    if let Some(ret) = json.pointer("/data/DataV2/ret").and_then(|v| v.as_array()) {
        let joined: String = ret
            .iter()
            .filter_map(|v| v.as_str())
            .collect::<Vec<_>>()
            .join(";");
        if joined.contains("No Authority")
            || joined.contains("10032390")
            || joined.contains("NeedLogin")
        {
            return Err(ProviderError::AuthRequired);
        }
    }

    let instances = json
        .pointer("/data/DataV2/data/data/codingPlanInstanceInfos")
        .and_then(|v| v.as_array())
        .ok_or_else(|| {
            ProviderError::Parse("codingPlanInstanceInfos not found in response".into())
        })?;

    let instance = instances
        .iter()
        .find(|i| i.get("status").and_then(|s| s.as_str()) == Some("VALID"))
        .or_else(|| instances.first())
        .ok_or_else(|| ProviderError::Parse("no Coding Plan instance in response".into()))?;

    let quota = instance
        .get("codingPlanQuotaInfo")
        .filter(|value| value.is_object())
        .ok_or_else(|| ProviderError::Parse("codingPlanQuotaInfo missing".into()))?;

    let plan_name = instance
        .get("instanceName")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let ms_to_dt = |key: &str| -> Option<DateTime<Utc>> {
        quota
            .get(key)
            .and_then(|v| v.as_i64())
            .and_then(|ms| Utc.timestamp_opt(ms / 1000, 0).single())
    };

    let quota_pair = |used_key: &str, total_key: &str| -> Option<(f64, String)> {
        let used = quota.get(used_key).and_then(|v| v.as_f64())?;
        let total = quota.get(total_key).and_then(|v| v.as_f64())?;
        let percent = used / total * 100.0;
        if !used.is_finite()
            || !total.is_finite()
            || used < 0.0
            || total <= 0.0
            || !percent.is_finite()
        {
            return None;
        }
        // Quota field names do not establish a token unit. Retain reported
        // counts without assigning an unproven unit or truncating fractions.
        Some((percent.clamp(0.0, 100.0), format!("{used} / {total}")))
    };
    let window = |used_key, total_key, minutes, reset: Option<DateTime<Utc>>| {
        let pair = quota_pair(used_key, total_key);
        let mut window = RateWindow::with_details(
            pair.as_ref().map_or(0.0, |(percent, _)| *percent),
            if pair.is_some() || reset.is_some() {
                minutes
            } else {
                None
            },
            reset,
            pair.as_ref().map(|(_, detail)| detail.clone()),
        );
        // Shared bridge, history and verification gates treat this placeholder
        // as unknown. A reported zero with a valid denominator remains known.
        window.is_informational = pair.is_none();
        window
    };
    let five_hour = window(
        "per5HourUsedQuota",
        "per5HourTotalQuota",
        Some(300),
        ms_to_dt("per5HourQuotaNextRefreshTime"),
    );
    let weekly = window(
        "perWeekUsedQuota",
        "perWeekTotalQuota",
        Some(7 * 24 * 60),
        ms_to_dt("perWeekQuotaNextRefreshTime"),
    );
    let monthly_reset = ms_to_dt("perBillMonthQuotaNextRefreshTime");
    let monthly = window(
        "perBillMonthUsedQuota",
        "perBillMonthTotalQuota",
        RateWindow::monthly_window_minutes(monthly_reset),
        monthly_reset,
    );

    let mut usage = UsageSnapshot::new(five_hour)
        .with_secondary(weekly)
        .with_tertiary(monthly);
    if let Some(plan) = plan_name {
        usage = usage.with_login_method(plan);
    }
    Ok(usage)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_response() -> serde_json::Value {
        serde_json::json!({
            "code": "200",
            "data": {
                "DataV2": {
                    "data": {
                        "data": {
                            "codingPlanInstanceInfos": [{
                                "instanceName": "Coding Plan Pro",
                                "status": "VALID",
                                "codingPlanQuotaInfo": {
                                    "per5HourUsedQuota": 0,
                                    "per5HourTotalQuota": 6000,
                                    "per5HourQuotaNextRefreshTime": 1780731422000_i64,
                                    "perWeekUsedQuota": 2019,
                                    "perWeekTotalQuota": 45000,
                                    "perWeekQuotaNextRefreshTime": 1780848000000_i64,
                                    "perBillMonthUsedQuota": 25,
                                    "perBillMonthTotalQuota": 90000,
                                    "perBillMonthQuotaNextRefreshTime": 1783267200000_i64
                                }
                            }]
                        }
                    }
                }
            }
        })
    }

    #[test]
    fn parses_real_response_shape() {
        let usage = parse_response(&sample_response()).unwrap();

        assert!((usage.primary.used_percent - 0.0).abs() < 0.01);
        assert!(!usage.primary.is_informational, "reported zero is known");
        assert_eq!(usage.primary.window_minutes, Some(300));
        assert!(usage.primary.resets_at.is_some());
        assert_eq!(usage.primary.reset_description.as_deref(), Some("0 / 6000"));

        let weekly = usage.secondary.unwrap();
        assert!((weekly.used_percent - 4.487).abs() < 0.01);

        let monthly = usage.tertiary.unwrap();
        assert!((monthly.used_percent - 0.028).abs() < 0.01);
        // perBillMonthQuotaNextRefreshTime 1783267200000 = 2026-07-05 → 30-day cycle.
        assert_eq!(monthly.window_minutes, Some(30 * 24 * 60));

        assert_eq!(usage.login_method.as_deref(), Some("Coding Plan Pro"));
    }

    #[test]
    fn picks_valid_instance_over_first() {
        let json = serde_json::json!({
            "code": "200",
            "data": { "DataV2": { "data": { "data": {
                "codingPlanInstanceInfos": [
                    {
                        "instanceName": "Expired",
                        "status": "EXPIRED",
                        "codingPlanQuotaInfo": {
                            "per5HourUsedQuota": 100, "per5HourTotalQuota": 100,
                            "perWeekUsedQuota": 100, "perWeekTotalQuota": 100,
                            "perBillMonthUsedQuota": 100, "perBillMonthTotalQuota": 100
                        }
                    },
                    {
                        "instanceName": "Coding Plan Pro",
                        "status": "VALID",
                        "codingPlanQuotaInfo": {
                            "per5HourUsedQuota": 0, "per5HourTotalQuota": 6000,
                            "perWeekUsedQuota": 10, "perWeekTotalQuota": 45000,
                            "perBillMonthUsedQuota": 25, "perBillMonthTotalQuota": 90000
                        }
                    }
                ]
            }}}}
        });
        let usage = parse_response(&json).unwrap();
        assert_eq!(usage.login_method.as_deref(), Some("Coding Plan Pro"));
        assert!(usage.primary.used_percent < 1.0);
    }

    #[test]
    fn missing_or_invalid_quota_pair_is_unavailable_not_zero() {
        for (used, total) in [
            (serde_json::Value::Null, serde_json::json!(6000)),
            (serde_json::json!(0), serde_json::Value::Null),
            (serde_json::json!(-1), serde_json::json!(6000)),
            (serde_json::json!(0), serde_json::json!(0)),
            (serde_json::json!(1), serde_json::json!(-1)),
            (serde_json::json!(1e308), serde_json::json!(1e-308)),
        ] {
            let mut json = sample_response();
            let quota = json
                .pointer_mut("/data/DataV2/data/data/codingPlanInstanceInfos/0/codingPlanQuotaInfo")
                .unwrap();
            quota["per5HourUsedQuota"] = used;
            quota["per5HourTotalQuota"] = total;
            let usage = parse_response(&json).unwrap();
            assert!(usage.primary.is_informational);
            assert!(usage.primary.reset_description.is_none());
            assert!(
                usage.primary.resets_at.is_some(),
                "independent reset evidence survives"
            );
            assert!(
                !usage.secondary.unwrap().is_informational,
                "valid weekly evidence survives"
            );
        }
    }

    #[test]
    fn empty_quota_has_no_plan_or_invented_billing_duration() {
        let mut json = sample_response();
        let instance = json
            .pointer_mut("/data/DataV2/data/data/codingPlanInstanceInfos/0")
            .unwrap();
        instance.as_object_mut().unwrap().remove("instanceName");
        instance["codingPlanQuotaInfo"] = serde_json::json!({});
        let usage = parse_response(&json).unwrap();
        assert!(usage.login_method.is_none());
        assert!(usage.primary.is_informational);
        assert!(usage.secondary.unwrap().is_informational);
        let monthly = usage.tertiary.unwrap();
        assert!(monthly.is_informational);
        assert!(monthly.window_minutes.is_none());
        assert!(monthly.resets_at.is_none());
    }

    #[test]
    fn quota_shape_must_be_an_object_and_counts_keep_their_precision() {
        let mut json = sample_response();
        let quota = json
            .pointer_mut("/data/DataV2/data/data/codingPlanInstanceInfos/0/codingPlanQuotaInfo")
            .unwrap();
        quota["per5HourUsedQuota"] = serde_json::json!(3.5);
        quota["per5HourTotalQuota"] = serde_json::json!(10);
        let usage = parse_response(&json).unwrap();
        assert_eq!(usage.primary.used_percent, 35.0);
        assert_eq!(usage.primary.reset_description.as_deref(), Some("3.5 / 10"));
        *json
            .pointer_mut("/data/DataV2/data/data/codingPlanInstanceInfos/0/codingPlanQuotaInfo")
            .unwrap() = serde_json::Value::Null;
        assert!(matches!(
            parse_response(&json),
            Err(ProviderError::Parse(_))
        ));
    }

    #[test]
    fn no_authority_response_maps_to_auth_required() {
        let json = serde_json::json!({
            "code": "200",
            "data": { "DataV2": { "ret": ["10032390::No Authority"], "data": {} } }
        });
        assert!(matches!(
            parse_response(&json),
            Err(ProviderError::AuthRequired)
        ));
    }
}
