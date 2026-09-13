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
}

impl Default for ProviderInstancePresentation {
    fn default() -> Self {
        Self {
            order: Vec::new(),
            badge_position: "end".into(),
            show_account_numbers: true,
        }
    }
}

impl ProviderInstancePresentation {
    pub fn normalized(mut self) -> Self {
        let mut seen = HashSet::new();
        self.order
            .retain(|id| valid_provider_instance_id(id) && seen.insert(id.clone()));
        self.order.truncate(512);
        if !["start", "end"].contains(&self.badge_position.as_str()) {
            self.badge_position = "end".into();
        }
        self
    }
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
}
