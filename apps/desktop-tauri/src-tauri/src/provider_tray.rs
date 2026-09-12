//! Native provider icons, separate from the main application icon.
use crate::commands::{ProviderUsageSnapshot, RateWindowSnapshot};
use quotalis_core::{
    core::ProviderId,
    settings::{ProviderTrayConfig, Settings, TrayIconMode},
};
use std::{
    collections::{BTreeMap, HashSet},
    sync::{LazyLock, Mutex},
};
use tauri::{
    AppHandle,
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
static OWNED: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));
pub struct Limit<'a> {
    pub id: String,
    pub label: String,
    pub window: &'a RateWindowSnapshot,
}
pub fn limits(s: &ProviderUsageSnapshot) -> Vec<Limit<'_>> {
    let mut result = Vec::new();
    for (lane, label, w) in [
        ("primary", s.primary_label.as_deref(), Some(&s.primary)),
        (
            "secondary",
            s.secondary_label.as_deref(),
            s.secondary.as_ref(),
        ),
        ("tertiary", s.tertiary_label.as_deref(), s.tertiary.as_ref()),
        ("model", Some("Model"), s.model_specific.as_ref()),
    ] {
        if let Some(w) = w
            && !w.is_informational
        {
            let label = label.unwrap_or(lane);
            result.push(Limit {
                id: format!(
                    "{lane}:{label}:{}",
                    w.window_minutes.map(|m| m.to_string()).unwrap_or_default()
                ),
                label: label.into(),
                window: w,
            });
        }
    }
    for e in &s.extra_rate_windows {
        if !e.window.is_informational {
            result.push(Limit {
                id: format!(
                    "extra:{}:{}",
                    e.id,
                    e.window
                        .window_minutes
                        .map(|m| m.to_string())
                        .unwrap_or_default()
                ),
                label: e.title.clone(),
                window: &e.window,
            });
        }
    }
    result
}
fn healthy(s: &ProviderUsageSnapshot) -> bool {
    s.error.is_none()
        && !s.error_state.is_problem()
        && s.source_label != "unavailable"
        && s.source_label != "disabled"
}
fn value(s: &ProviderUsageSnapshot, c: &ProviderTrayConfig, id: &str) -> Option<f64> {
    if !healthy(s) {
        return None;
    }
    limits(s)
        .into_iter()
        .find(|l| l.id == id)
        .map(|l| {
            if c.show_as_used {
                l.window.used_percent
            } else {
                l.window.remaining_percent
            }
        })
        .filter(|v| v.is_finite() && *v >= 0.0 && *v <= 100.0)
}
fn shorten(s: &str, budget: usize) -> String {
    let mut used = 0;
    s.chars()
        .filter(|c| !c.is_control())
        .take_while(|c| {
            used += c.len_utf16();
            used <= budget
        })
        .collect()
}
fn tooltip(
    id: &str,
    s: Option<&ProviderUsageSnapshot>,
    c: &ProviderTrayConfig,
    settings: &Settings,
) -> String {
    use quotalis_core::locale::{LocaleKey, get_text};
    let t = |key| get_text(settings.ui_language, key);
    let mut header = Vec::new();
    if c.show_name {
        header.push(shorten(
            ProviderId::from_cli_name(id)
                .map(|p| p.display_name())
                .unwrap_or(id),
            14,
        ));
    }
    if c.show_plan
        && let Some(plan) = s.and_then(|s| s.plan_name.as_deref())
    {
        header.push(shorten(plan, 12));
    }
    let header = header.join(" · ");
    let token = if c.token_range != "none" {
        Some(crate::provider_tray_tokens::label(
            id,
            &c.token_range,
            settings.ui_language,
        ))
    } else {
        None
    };
    let ids = if c.tooltip_limit_ids.is_empty() {
        vec![c.limit_id.clone()]
    } else {
        c.tooltip_limit_ids.clone()
    };
    let count = ids.len().min(3);
    let reserved = header.encode_utf16().count()
        + usize::from(!header.is_empty())
        + token.as_ref().map_or(0, |s| s.encode_utf16().count() + 1);
    let per_line = (127usize.saturating_sub(reserved + count.saturating_sub(1))) / count.max(1);
    let mut lines = Vec::new();
    if !header.is_empty() {
        lines.push(header);
    }
    for key in ids.iter().take(3) {
        let label = s
            .and_then(|s| {
                limits(s)
                    .into_iter()
                    .find(|l| l.id == *key)
                    .map(|l| l.label)
            })
            .unwrap_or_else(|| t(LocaleKey::TrayStudioLimit));
        let reading = s
            .and_then(|s| value(s, c, key))
            .map(|v| {
                format!(
                    "{:.*}% {}",
                    usize::from(c.precision),
                    v,
                    t(if c.show_as_used {
                        LocaleKey::TrayStudioUsedShort
                    } else {
                        LocaleKey::TrayStudioLeftShort
                    })
                )
            })
            .unwrap_or_else(|| "—".into());
        let label_budget = per_line.saturating_sub(reading.encode_utf16().count() + 1);
        lines.push(format!("{} {}", shorten(&label, label_budget), reading));
    }
    if let Some(token) = token {
        lines.push(token);
    }
    lines.join("\n")
}
fn accent(id: &str, c: &ProviderTrayConfig, settings: &Settings) -> [u8; 3] {
    if c.color == "silver" {
        return [194, 209, 228];
    }
    if c.color == "identity" {
        return match settings.logo_variant.as_str() {
            "arctic" => [70, 204, 255],
            "aurora" => [133, 112, 255],
            "ember" => [255, 126, 47],
            "violet" => [173, 92, 255],
            _ => [216, 223, 232],
        };
    }
    quotalis_core::tray::provider::provider_accent(id)
}
/// Tauri tray calls synchronously dispatch to the main thread. Never acquire
/// OWNED on a worker before that dispatch: locale/reorder calls also run here.
pub fn update(app: &AppHandle, _settings: &Settings, snapshots: &[ProviderUsageSnapshot]) {
    let handle = app.clone();
    let snapshots = snapshots.to_vec();
    if let Err(error) = app.run_on_main_thread(move || {
        // A queued older update must not re-pin after a newer settings change.
        let settings = Settings::load();
        reconcile_on_main_thread(&handle, &settings, &snapshots);
    }) {
        tracing::warn!(%error,"Could not schedule provider tray update");
    }
}
fn reconcile_on_main_thread(
    app: &AppHandle,
    settings: &Settings,
    snapshots: &[ProviderUsageSnapshot],
) {
    let mut wanted: BTreeMap<String, ProviderTrayConfig> = settings
        .provider_tray_configs
        .iter()
        .filter(|(_, c)| c.enabled)
        .map(|(id, c)| (id.clone(), c.clone()))
        .collect();
    if settings.tray_icon_mode == TrayIconMode::PerProvider {
        for p in &settings.enabled_providers {
            let id = p.as_str();
            if !settings.provider_tray_configs.contains_key(id) {
                let key = snapshots
                    .iter()
                    .find(|s| s.provider_id == id)
                    .and_then(|s| limits(s).first().map(|l| l.id.clone()))
                    .unwrap_or_default();
                wanted.insert(
                    id.into(),
                    ProviderTrayConfig {
                        enabled: true,
                        limit_id: key,
                        ..Default::default()
                    },
                );
            }
        }
    }
    let Ok(mut owned) = OWNED.lock() else {
        return;
    };
    let target: HashSet<_> = wanted
        .keys()
        .map(|id| format!("quotalis-provider-{id}"))
        .collect();
    for id in owned.difference(&target) {
        drop(app.remove_tray_by_id(id));
    }
    owned.retain(|id| target.contains(id));
    for (id, c) in wanted {
        let key = format!("quotalis-provider-{id}");
        let s = snapshots.iter().find(|s| s.provider_id == id);
        crate::provider_tray_tokens::request(app, &id, &c.token_range);
        let percent = s.and_then(|s| value(s, &c, &c.limit_id));
        let (pixels, w, h) = quotalis_core::tray::provider::render_provider_icon(
            &id,
            percent,
            &c.style,
            accent(&id, &c, settings),
            c.stroke,
        );
        let icon = Image::new_owned(pixels, w, h);
        let tip = tooltip(&id, s, &c, settings);
        if let Some(tray) = app.tray_by_id(&key) {
            let _ = tray.set_icon(Some(icon));
            let _ = tray.set_tooltip(Some(tip));
        } else {
            let provider = id.clone();
            match TrayIconBuilder::with_id(&key)
                .icon(icon)
                .tooltip(tip)
                .on_tray_icon_event(move |tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            if let Err(error) =
                                crate::shell::settings_window::open_or_focus_provider(
                                    tray.app_handle(),
                                    "providers",
                                    ProviderId::from_cli_name(&provider),
                                )
                            {
                                tracing::warn!(%error,"Could not open tray provider");
                            }
                        }
                        // Refresh the tooltip date/coverage at hover, even in manual-refresh mode.
                        TrayIconEvent::Enter { .. } => {
                            crate::tray_bridge::refresh_tray_presentation(tray.app_handle())
                        }
                        _ => {}
                    }
                })
                .build(app)
            {
                Ok(_) => {
                    owned.insert(key);
                }
                Err(error) => tracing::warn!(%error,provider=%id,"Provider tray creation failed"),
            }
        }
    }
}
/// Dev proof reports registration, never claims Windows chose a visible placement.
pub(crate) fn registered_icons(app: &AppHandle) -> Vec<(String, bool)> {
    OWNED
        .lock()
        .map(|ids| {
            let mut values: Vec<_> = ids
                .iter()
                .map(|id| (id.clone(), app.tray_by_id(id).is_some()))
                .collect();
            values.sort();
            values
        })
        .unwrap_or_default()
}
#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> ProviderUsageSnapshot {
        serde_json::from_value(serde_json::json!({"providerId":"codex","sourceLabel":"oauth","errorState":"ready","primaryLabel":"Session","primary":{"usedPercent":21.25,"remainingPercent":78.75,"windowMinutes":300}})).unwrap()
    }
    #[test]
    fn exact_limit_only_and_errors_fail_closed() {
        let mut s = sample();
        let c = ProviderTrayConfig::default();
        assert_eq!(value(&s, &c, "primary:Session:300"), Some(78.75));
        assert_eq!(value(&s, &c, "primary:Weekly:10080"), None);
        s.error = Some("auth required".into());
        assert_eq!(value(&s, &c, "primary:Session:300"), None);
    }
    #[test]
    fn tooltip_bound_is_utf16_safe() {
        let s = sample();
        let settings = Settings::default();
        let c = ProviderTrayConfig {
            limit_id: "primary:Session:300".into(),
            ..Default::default()
        };
        let tip = tooltip("codex", Some(&s), &c, &settings);
        assert!(tip.contains("78.8%"));
        assert!(tip.encode_utf16().count() < 128);
        assert_eq!(shorten("🚀🚀🚀", 5), "🚀🚀");
    }
}
