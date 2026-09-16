//! Dev-only deterministic tray fixture. In-memory only (never Settings,
//! settings.json, history or credentials), cleared by restart, and refused by
//! the backend outside the Dev channel — the same contract as
//! `surfaces::qa_fixture`.
use crate::commands::ProviderUsageSnapshot;
use quotalis_core::core::ProviderId;
use std::sync::Mutex;

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayQaFixture {
    pub provider_id: String,
    /// `available`, `unavailable` or `error`.
    pub data_state: String,
    pub used_percent: f64,
    pub secondary_used_percent: Option<f64>,
    pub plan: Option<String>,
    pub reset_minutes: Option<u32>,
    /// Local token total shown when a tray token period is configured.
    pub tokens: Option<u64>,
}

impl TrayQaFixture {
    fn validated(mut self) -> Result<Self, String> {
        let provider = ProviderId::from_cli_name(&self.provider_id)
            .filter(|p| p.cli_name() == self.provider_id)
            .ok_or_else(|| "Unknown provider".to_string())?;
        if !["available", "unavailable", "error"].contains(&self.data_state.as_str()) {
            return Err("Unknown tray fixture data state".into());
        }
        let valid = |v: f64| v.is_finite() && (0.0..=100.0).contains(&v);
        if !valid(self.used_percent) || !self.secondary_used_percent.is_none_or(valid) {
            return Err("Tray fixture percentages must be between 0 and 100".into());
        }
        self.provider_id = provider.cli_name().to_string();
        self.plan = self.plan.map(|plan| plan.chars().take(40).collect());
        Ok(self)
    }

    pub fn snapshot(&self) -> ProviderUsageSnapshot {
        let window = |used: f64| {
            serde_json::json!({
                "usedPercent": used,
                "remainingPercent": 100.0 - used,
                "windowMinutes": 300,
                "resetsAt": self.reset_minutes.map(|m| {
                    (chrono::Utc::now() + chrono::Duration::minutes(i64::from(m))).to_rfc3339()
                }),
            })
        };
        let mut secondary = window(self.secondary_used_percent.unwrap_or_default());
        secondary["windowMinutes"] = serde_json::json!(10080);
        let display_name = ProviderId::from_cli_name(&self.provider_id)
            .map(|p| p.display_name())
            .unwrap_or("");
        serde_json::from_value(serde_json::json!({
            "providerId": self.provider_id,
            "displayName": display_name,
            "sourceLabel": if self.data_state == "unavailable" { "unavailable" } else { "qa-fixture" },
            "errorState": if self.data_state == "error" { "unknown" } else { "ready" },
            "error": (self.data_state == "error").then_some("QA fixture error"),
            "planName": self.plan,
            "primaryLabel": "Session",
            "primary": window(self.used_percent),
            "secondaryLabel": self.secondary_used_percent.map(|_| "Weekly"),
            "secondary": self.secondary_used_percent.map(|_| secondary),
        }))
        .expect("tray QA fixture snapshot shape")
    }
}

static STATE: Mutex<Option<TrayQaFixture>> = Mutex::new(None);

pub fn active() -> Option<TrayQaFixture> {
    STATE.lock().ok().and_then(|state| state.clone())
}

fn store(
    dev_channel: bool,
    fixture: Option<TrayQaFixture>,
    target: &Mutex<Option<TrayQaFixture>>,
) -> Result<(), String> {
    if !dev_channel {
        return Err("Tray QA fixture is Dev-channel only.".to_string());
    }
    let fixture = fixture.map(TrayQaFixture::validated).transpose()?;
    *target.lock().map_err(|_| "Tray QA fixture unavailable")? = fixture;
    Ok(())
}

#[tauri::command]
pub fn get_tray_qa_fixture() -> Option<TrayQaFixture> {
    active()
}

#[tauri::command]
pub fn set_tray_qa_fixture(
    app: tauri::AppHandle,
    fixture: Option<TrayQaFixture>,
) -> Result<(), String> {
    store(crate::build_info::CHANNEL == "dev", fixture, &STATE)?;
    crate::tray_bridge::refresh_tray_presentation(&app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(state: &str) -> TrayQaFixture {
        TrayQaFixture {
            provider_id: "claude".into(),
            data_state: state.into(),
            used_percent: 100.0,
            secondary_used_percent: Some(0.0),
            plan: Some("Max".into()),
            reset_minutes: Some(90),
            tokens: Some(42),
        }
    }

    #[test]
    fn refused_outside_dev_without_writing() {
        let target = Mutex::new(None);
        assert!(store(false, Some(sample("available")), &target).is_err());
        assert!(target.lock().unwrap().is_none());
        assert!(store(true, Some(sample("available")), &target).is_ok());
        assert!(target.lock().unwrap().is_some());
        assert!(store(true, None, &target).is_ok());
        assert!(target.lock().unwrap().is_none());
    }

    #[test]
    fn rejects_invented_providers_states_and_percentages() {
        let target = Mutex::new(None);
        let mut bad = sample("available");
        bad.provider_id = "invented".into();
        assert!(store(true, Some(bad), &target).is_err());
        assert!(store(true, Some(sample("sparkly")), &target).is_err());
        let mut nan = sample("available");
        nan.used_percent = f64::NAN;
        assert!(store(true, Some(nan), &target).is_err());
        assert!(target.lock().unwrap().is_none());
    }

    #[test]
    fn synthetic_states_map_to_real_unavailable_and_error_signals() {
        let available = sample("available").snapshot();
        assert_eq!(available.primary.used_percent, 100.0);
        assert_eq!(available.primary.remaining_percent, 0.0);
        assert!(available.error.is_none() && available.primary.resets_at.is_some());
        assert_eq!(available.secondary.as_ref().unwrap().used_percent, 0.0);
        assert_eq!(sample("unavailable").snapshot().source_label, "unavailable");
        let error = sample("error").snapshot();
        assert!(error.error.is_some() && error.error_state.is_problem());
        let mut no_weekly = sample("available");
        no_weekly.secondary_used_percent = None;
        assert!(no_weekly.snapshot().secondary.is_none());
    }
}
