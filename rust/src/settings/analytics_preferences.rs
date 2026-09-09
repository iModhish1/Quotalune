use serde::{Deserialize, Serialize};

pub const ANALYTICS_SECTIONS: [&str; 7] = [
    "limits",
    "attention",
    "overview",
    "resets",
    "quality",
    "comparison",
    "history",
];

/// Global presentation only. Values never alter metric contracts or history.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct AnalyticsPreferences {
    pub section_order: Vec<String>,
    pub hidden_sections: Vec<String>,
    pub chart_style: String,
    pub quota_template: String,
    pub default_range: String,
    pub provider_filter_scope: String,
}

impl Default for AnalyticsPreferences {
    fn default() -> Self {
        Self {
            section_order: ANALYTICS_SECTIONS.iter().map(|s| (*s).into()).collect(),
            hidden_sections: vec![],
            chart_style: "precision".into(),
            quota_template: "precision".into(),
            default_range: "last7Days".into(),
            provider_filter_scope: "history".into(),
        }
    }
}

impl AnalyticsPreferences {
    pub fn normalized(mut self) -> Self {
        let mut seen = std::collections::HashSet::new();
        self.section_order
            .retain(|id| ANALYTICS_SECTIONS.contains(&id.as_str()) && seen.insert(id.clone()));
        for id in ANALYTICS_SECTIONS {
            if seen.insert(id.to_string()) {
                self.section_order.push(id.into());
            }
        }
        seen.clear();
        self.hidden_sections
            .retain(|id| ANALYTICS_SECTIONS.contains(&id.as_str()) && seen.insert(id.clone()));
        if !matches!(
            self.chart_style.as_str(),
            "precision" | "minimal" | "detailed"
        ) {
            self.chart_style = "precision".into();
        }
        if !matches!(
            self.quota_template.as_str(),
            "precision" | "compact" | "dual" | "rail"
        ) {
            self.quota_template = "precision".into();
        }
        if !matches!(
            self.default_range.as_str(),
            "today" | "last7Days" | "last30Days" | "thisMonth" | "last3Months" | "thisYear"
        ) {
            self.default_range = "last7Days".into();
        }
        if !matches!(self.provider_filter_scope.as_str(), "history" | "all") {
            self.provider_filter_scope = "history".into();
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn settings_round_trip_and_malformed_siblings_preserve_valid_preferences() {
        let settings: crate::settings::Settings = serde_json::from_str(r#"{"analytics_preferences":{"chartStyle":42,"quotaTemplate":"rail","sectionOrder":["history"],"hiddenSections":["attention"]}}"#).unwrap();
        let prefs = settings.analytics_preferences.as_ref().unwrap();
        assert_eq!(prefs.chart_style, "precision");
        assert_eq!(prefs.quota_template, "rail");
        assert_eq!(prefs.section_order[0], "history");
        let serialized = serde_json::to_string(&settings).unwrap();
        let restored: crate::settings::Settings = serde_json::from_str(&serialized).unwrap();
        assert_eq!(
            restored.analytics_preferences,
            settings.analytics_preferences
        );
        let legacy: crate::settings::Settings = serde_json::from_str("{}").unwrap();
        assert!(legacy.analytics_preferences.is_none());
    }
    #[test]
    fn normalizes_unknown_and_duplicate_sections_without_losing_valid_order() {
        let prefs = AnalyticsPreferences {
            section_order: vec!["quality".into(), "quality".into(), "unknown".into()],
            hidden_sections: vec!["attention".into(), "attention".into(), "unknown".into()],
            ..Default::default()
        }
        .normalized();
        assert_eq!(prefs.section_order[0], "quality");
        assert_eq!(prefs.section_order.len(), ANALYTICS_SECTIONS.len());
        assert_eq!(prefs.hidden_sections, vec!["attention"]);
    }
    #[test]
    fn unknown_presentation_values_fail_back_to_defaults() {
        let prefs = AnalyticsPreferences {
            chart_style: "unknown".into(),
            quota_template: "unknown".into(),
            default_range: "custom".into(),
            provider_filter_scope: "guess".into(),
            ..Default::default()
        }
        .normalized();
        assert_eq!(prefs, AnalyticsPreferences::default());
    }
}
