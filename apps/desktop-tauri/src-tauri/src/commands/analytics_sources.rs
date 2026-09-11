//! Analytics source registry bridge -- exposes
//! `quotalis_core::analytics_sources::analytics_source_registry()` to the
//! frontend so Settings -> Analytics -> Data Sources (and any
//! capability-driven Analytics UI) can show real, current source
//! availability without duplicating the capability map on the TS side.

use quotalis_core::analytics_sources::{AnalyticsSourceDescriptor, analytics_source_registry};

/// Real analytics source registry: what each source can prove, its
/// scope, and whether it currently has data on this machine. Cheap --
/// only directory/config existence checks, no file-content scanning.
#[tauri::command]
pub fn get_analytics_source_registry() -> Vec<AnalyticsSourceDescriptor> {
    analytics_source_registry()
}
