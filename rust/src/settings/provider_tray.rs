use crate::core::ProviderId;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Independent native tray presentation. Empty limit means no measured arc.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct ProviderTrayConfig {
    pub enabled: bool,
    pub limit_id: String,
    pub style: String,
    pub show_as_used: bool,
    pub tooltip_limit_ids: Vec<String>,
    pub show_name: bool,
    pub show_plan: bool,
    pub token_range: String,
    pub precision: u8,
    pub color: String,
    pub stroke: u8,
}
impl Default for ProviderTrayConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            limit_id: String::new(),
            style: "ring".into(),
            show_as_used: false,
            tooltip_limit_ids: Vec::new(),
            show_name: true,
            show_plan: true,
            token_range: "none".into(),
            precision: 1,
            color: "provider".into(),
            stroke: 2,
        }
    }
}
impl ProviderTrayConfig {
    pub fn normalized(mut self) -> Self {
        self.limit_id = self.limit_id.chars().take(256).collect();
        let mut seen = HashSet::new();
        self.tooltip_limit_ids
            .retain(|s| !s.is_empty() && s.len() <= 256 && seen.insert(s.clone()));
        self.tooltip_limit_ids.truncate(3);
        if !["ring", "arc", "bar", "badge"].contains(&self.style.as_str()) {
            self.style = "ring".into();
        }
        if !["none", "today", "week", "month", "year", "lifetime"]
            .contains(&self.token_range.as_str())
        {
            self.token_range = "none".into();
        }
        if !["provider", "identity", "silver"].contains(&self.color.as_str()) {
            self.color = "provider".into();
        }
        self.precision = self.precision.min(2);
        self.stroke = self.stroke.clamp(1, 4);
        self
    }
}
pub fn normalize_provider_tray(
    configs: HashMap<String, ProviderTrayConfig>,
) -> HashMap<String, ProviderTrayConfig> {
    configs
        .into_iter()
        .filter(|(id, _)| ProviderId::from_cli_name(id).is_some_and(|p| p.cli_name() == id))
        .map(|(id, c)| (id, c.normalized()))
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounds_tooltip_and_rejects_unknown_choices() {
        let c = ProviderTrayConfig {
            tooltip_limit_ids: vec!["a".into(), "a".into(), "b".into(), "c".into(), "d".into()],
            style: "bad".into(),
            token_range: "bad".into(),
            precision: 255,
            stroke: 0,
            ..Default::default()
        }
        .normalized();
        assert_eq!(c.tooltip_limit_ids, vec!["a", "b", "c"]);
        assert_eq!(c.style, "ring");
        assert_eq!(c.token_range, "none");
        assert_eq!(c.precision, 2);
        assert_eq!(c.stroke, 1);
    }
    #[test]
    fn unknown_provider_does_not_get_an_icon() {
        assert!(
            normalize_provider_tray(HashMap::from([(
                "invented".into(),
                ProviderTrayConfig::default()
            )]))
            .is_empty()
        );
    }
    #[test]
    fn roundtrip_keeps_distinct_provider_choices() {
        let v: HashMap<String, ProviderTrayConfig> = HashMap::from([(
            "codex".into(),
            ProviderTrayConfig {
                enabled: true,
                limit_id: "primary:Session:300".into(),
                ..Default::default()
            },
        )]);
        assert_eq!(
            v,
            serde_json::from_str(&serde_json::to_string(&v).unwrap()).unwrap()
        );
    }
}
