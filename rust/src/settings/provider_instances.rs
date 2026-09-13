use crate::core::ProviderId;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Presentation keys never replace the provider's canonical identity.
pub fn valid_provider_instance_id(id: &str) -> bool {
    ProviderId::from_cli_name(id).is_some_and(|provider| provider.cli_name() == id)
        || id.strip_prefix("codex:").is_some_and(|suffix| {
            uuid::Uuid::parse_str(suffix).is_ok_and(|id| id.to_string() == suffix)
        })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct ProviderInstancePresentation {
    pub order: Vec<String>,
    pub badge_position: String,
    pub show_account_numbers: bool,
    pub reset_position: String,
    pub show_reset_badge: bool,
    pub visible_count: u8,
    pub anchor_id: Option<String>,
}

impl Default for ProviderInstancePresentation {
    fn default() -> Self {
        Self {
            order: Vec::new(),
            badge_position: "end".into(),
            show_account_numbers: true,
            reset_position: "bottom-center".into(),
            show_reset_badge: true,
            visible_count: 4,
            anchor_id: None,
        }
    }
}

impl ProviderInstancePresentation {
    pub fn normalized(mut self) -> Self {
        let mut seen = HashSet::new();
        self.order
            .retain(|id| valid_provider_instance_id(id) && seen.insert(id.clone()));
        self.order.truncate(512);
        if !valid_badge_position(&self.badge_position) {
            self.badge_position = "end".into();
        }
        if !valid_badge_position(&self.reset_position) {
            self.reset_position = "bottom-center".into();
        }
        if ![3, 4].contains(&self.visible_count) {
            self.visible_count = 4;
        }
        if self
            .anchor_id
            .as_deref()
            .is_some_and(|id| !valid_provider_instance_id(id))
        {
            self.anchor_id = None;
        }
        self
    }
}

fn valid_badge_position(value: &str) -> bool {
    [
        "start",
        "end",
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "top-center",
        "bottom-center",
        "middle-left",
        "middle-right",
    ]
    .contains(&value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presentation_cannot_alias_or_inject_provider_keys() {
        let account = "codex:550e8400-e29b-41d4-a716-446655440000";
        let value = ProviderInstancePresentation {
            order: vec![
                account.into(),
                "claude".into(),
                account.into(),
                "codex:../../auth.json".into(),
                "claude:550e8400-e29b-41d4-a716-446655440000".into(),
            ],
            badge_position: "absolute".into(),
            show_account_numbers: false,
            ..Default::default()
        }
        .normalized();
        assert_eq!(value.order, vec![account, "claude"]);
        assert_eq!(value.badge_position, "end");
        assert!(!value.show_account_numbers);
        let json = serde_json::to_string(&value).unwrap();
        assert_eq!(
            serde_json::from_str::<ProviderInstancePresentation>(&json).unwrap(),
            value
        );
    }

    #[test]
    fn missing_preferences_keep_numbered_accounts() {
        let value: ProviderInstancePresentation = serde_json::from_str("{}").unwrap();
        assert_eq!(value, ProviderInstancePresentation::default());
    }

    #[test]
    fn carousel_and_all_physical_positions_survive_roundtrip() {
        for position in [
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
        ] {
            let value = ProviderInstancePresentation {
                badge_position: position.into(),
                reset_position: position.into(),
                visible_count: 3,
                anchor_id: Some("claude".into()),
                ..Default::default()
            }
            .normalized();
            let restored: ProviderInstancePresentation =
                serde_json::from_str(&serde_json::to_string(&value).unwrap()).unwrap();
            assert_eq!(restored.normalized(), value);
        }
        let invalid = ProviderInstancePresentation {
            visible_count: 70,
            anchor_id: Some("../auth.json".into()),
            reset_position: "outside".into(),
            ..Default::default()
        }
        .normalized();
        assert_eq!(invalid.visible_count, 4);
        assert_eq!(invalid.anchor_id, None);
        assert_eq!(invalid.reset_position, "bottom-center");
    }
}
