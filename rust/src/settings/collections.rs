use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum CollectionView {
    #[default]
    Horizontal,
    Vertical,
    Grid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, deny_unknown_fields)]
pub struct ItemFields {
    pub name: bool,
    pub value: bool,
    pub reset: bool,
}
impl Default for ItemFields {
    fn default() -> Self {
        Self {
            name: false,
            value: true,
            reset: false,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct CollectionGroup {
    pub id: String,
    pub items: Vec<String>,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, deny_unknown_fields)]
pub struct CollectionLayout {
    pub version: u8,
    pub revision: u64,
    pub view: CollectionView,
    pub scale: u8,
    pub groups: Vec<CollectionGroup>,
    pub fields: BTreeMap<String, ItemFields>,
}
impl Default for CollectionLayout {
    fn default() -> Self {
        Self {
            version: 1,
            revision: 0,
            view: CollectionView::Horizontal,
            scale: 100,
            groups: vec![],
            fields: BTreeMap::new(),
        }
    }
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_:".contains(&b))
}
impl CollectionLayout {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 1 || !(75..=125).contains(&self.scale) || self.groups.len() > 64 {
            return Err("Unsupported collection layout version, scale or group count".into());
        }
        let mut groups = HashSet::new();
        let mut items = HashSet::new();
        for group in &self.groups {
            if !valid_id(&group.id) || !groups.insert(&group.id) || group.items.is_empty() {
                return Err("Invalid or duplicate collection group".into());
            }
            if !group.x.is_finite()
                || !group.y.is_finite()
                || group.x.abs() > 100_000.0
                || group.y.abs() > 100_000.0
            {
                return Err("Invalid collection position".into());
            }
            for item in &group.items {
                if !valid_id(item) || !items.insert(item) {
                    return Err("Provider items must have unique stable identities".into());
                }
            }
        }
        if items.len() > 64 || self.fields.keys().any(|id| !items.contains(id)) {
            return Err("Too many items or orphan display settings".into());
        }
        Ok(())
    }
    /// A malformed presentation field must not discard unrelated user settings.
    pub fn from_disk(value: serde_json::Value) -> Self {
        serde_json::from_value::<Self>(value)
            .ok()
            .filter(|layout| layout.validate().is_ok())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn layout() -> CollectionLayout {
        serde_json::from_value(serde_json::json!({"version":1,"revision":0,"view":"grid","scale":100,"groups":[{"id":"main","items":["claude","codex"],"x":-100,"y":20}],"fields":{"claude":{"name":true,"value":true,"reset":false}}})).unwrap()
    }
    #[test]
    fn round_trip_preserves_identity_order_and_fields() {
        let value = layout();
        assert!(value.validate().is_ok());
        let encoded = serde_json::to_string(&value).unwrap();
        let decoded: CollectionLayout = serde_json::from_str(&encoded).unwrap();
        assert_eq!(value, decoded);
    }
    #[test]
    fn rejects_duplicate_ownership_and_empty_groups() {
        let mut value = layout();
        value.groups.push(value.groups[0].clone());
        assert!(value.validate().is_err());
        value = layout();
        value.groups[0].items.clear();
        assert!(value.validate().is_err());
    }
    #[test]
    fn rejects_invalid_numbers_versions_and_orphan_fields() {
        let mut value = layout();
        value.scale = 0;
        assert!(value.validate().is_err());
        value = layout();
        value.groups[0].x = f64::NAN;
        assert!(value.validate().is_err());
        value = layout();
        value.version = 2;
        assert!(value.validate().is_err());
        value = layout();
        value.fields.insert("missing".into(), ItemFields::default());
        assert!(value.validate().is_err());
    }
    #[test]
    fn refuses_secret_and_unknown_fields() {
        assert!(
            serde_json::from_value::<CollectionLayout>(serde_json::json!({"token":"secret"}))
                .is_err()
        );
    }
    #[test]
    fn defaults_are_empty_and_safe() {
        assert!(CollectionLayout::default().validate().is_ok());
    }
    #[test]
    fn malformed_layout_does_not_discard_other_settings() {
        let settings: crate::settings::Settings = serde_json::from_value(
            serde_json::json!({"top_arc_scale":110,"collection_layout":{"version":"broken"}}),
        )
        .unwrap();
        assert_eq!(settings.top_arc_scale, 110);
        assert_eq!(settings.collection_layout, CollectionLayout::default());
    }
    #[test]
    fn settings_serialization_round_trips_the_layout() {
        let settings = crate::settings::Settings {
            collection_layout: layout(),
            ..crate::settings::Settings::default()
        };
        let restored: crate::settings::Settings =
            serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
        assert_eq!(restored.collection_layout, settings.collection_layout);
    }
}
