use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct SurfaceInteractions {
    pub hover_details: bool,
    pub wheel_cycle: bool,
    pub auto_fold: bool,
    pub fold_delay_ms: u16,
}
impl Default for SurfaceInteractions {
    fn default() -> Self {
        Self {
            hover_details: true,
            wheel_cycle: true,
            auto_fold: true,
            fold_delay_ms: 500,
        }
    }
}
impl SurfaceInteractions {
    pub fn normalized(mut self) -> Self {
        self.fold_delay_ms = self.fold_delay_ms.clamp(100, 3000);
        self
    }
    pub fn from_disk(value: serde_json::Value) -> Self {
        serde_json::from_value::<Self>(value)
            .unwrap_or_default()
            .normalized()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migrates_and_bounds_interaction_settings() {
        assert_eq!(
            SurfaceInteractions::from_disk(serde_json::Value::Null),
            SurfaceInteractions::default()
        );
        let value = serde_json::json!({"hoverDetails":false,"wheelCycle":false,"autoFold":false,"foldDelayMs":0});
        let config = SurfaceInteractions::from_disk(value);
        assert!(!config.hover_details && !config.wheel_cycle && !config.auto_fold);
        assert_eq!(config.fold_delay_ms, 100);
        assert_eq!(
            SurfaceInteractions::from_disk(serde_json::to_value(&config).unwrap()),
            config
        );
    }
}
