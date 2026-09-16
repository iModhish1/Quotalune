//! Native provider icons, separate from the main application icon.
use crate::commands::{ProviderUsageSnapshot, RateWindowSnapshot};
use quotalis_core::{
    core::ProviderId,
    settings::{AppearanceSource, ProviderTrayConfig, Settings, TrayIconMode},
};
use std::{
    collections::HashSet,
    sync::{LazyLock, Mutex},
};
use tauri::{
    AppHandle,
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
static OWNED: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

/// Practical ceiling for provider indicators. Per-provider mode with dozens of
/// enabled providers would otherwise flood the notification area.
pub const MAX_PROVIDER_TRAY_ICONS: usize = 8;

/// Windows `NOTIFYICONDATAW::szTip` holds 128 UTF-16 units including the
/// terminator; tray-icon copies at most 128, so 127 is the usable maximum.
pub const TOOLTIP_UTF16_LIMIT: usize = 127;

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
    token: Option<crate::provider_tray_tokens::TokenLine>,
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
    // Keep the whole reading; shorten only the label in front of it.
    let token = token.map(|line| {
        let reading_units = line.reading.encode_utf16().count();
        let label = shorten(&line.label, 40usize.saturating_sub(reading_units + 2));
        format!("{label}: {}", line.reading)
    });
    let ids = if c.tooltip_limit_ids.is_empty() {
        vec![c.limit_id.clone()]
    } else {
        c.tooltip_limit_ids.clone()
    };
    let count = ids.len().min(3);
    let reserved = header.encode_utf16().count()
        + usize::from(!header.is_empty())
        + token.as_ref().map_or(0, |s| s.encode_utf16().count() + 1);
    let per_line =
        (TOOLTIP_UTF16_LIMIT.saturating_sub(reserved + count.saturating_sub(1))) / count.max(1);
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
    // Final guard: drop whole trailing lines rather than letting the shell cut
    // a line (or a surrogate pair) at the 128-unit buffer edge.
    while lines.len() > 1 && lines.join("\n").encode_utf16().count() > TOOLTIP_UTF16_LIMIT {
        lines.pop();
    }
    let joined = lines.join("\n");
    if joined.encode_utf16().count() > TOOLTIP_UTF16_LIMIT {
        return shorten(&joined, TOOLTIP_UTF16_LIMIT);
    }
    joined
}
/// Tray is its own appearance scope: Global follows the main application's
/// Quotalis mark palette; Override keeps each indicator's explicit color.
fn accent(id: &str, c: &ProviderTrayConfig, settings: &Settings) -> [u8; 3] {
    let color = if settings.appearance_composition.tray == AppearanceSource::Global {
        "identity"
    } else {
        c.color.as_str()
    };
    if color == "silver" {
        return [194, 209, 228];
    }
    if color == "identity" {
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

/// Indicators that should exist, in stable catalog order. Explicitly pinned
/// providers win the cap over automatic per-provider icons. A provider the
/// user disabled produces no icon: it will never receive another reading.
fn desired_indicators(
    settings: &Settings,
    snapshots: &[ProviderUsageSnapshot],
) -> Vec<(String, ProviderTrayConfig)> {
    let enabled = |id: &str| settings.enabled_providers.contains(id);
    let mut explicit = Vec::new();
    let mut automatic = Vec::new();
    for provider in ProviderId::all() {
        let id = provider.cli_name();
        if !enabled(id) {
            continue;
        }
        match settings.provider_tray_configs.get(id) {
            Some(config) if config.enabled => explicit.push((id.to_string(), config.clone())),
            Some(_) => {}
            None if settings.tray_icon_mode == TrayIconMode::PerProvider => {
                let limit_id = snapshots
                    .iter()
                    .find(|s| s.provider_id == id)
                    .and_then(|s| limits(s).first().map(|l| l.id.clone()))
                    .unwrap_or_default();
                automatic.push((
                    id.to_string(),
                    ProviderTrayConfig {
                        enabled: true,
                        limit_id,
                        ..Default::default()
                    },
                ));
            }
            None => {}
        }
    }
    explicit.extend(automatic);
    explicit.truncate(MAX_PROVIDER_TRAY_ICONS);
    explicit
}

fn tray_key(provider: &str) -> String {
    format!("quotalis-provider-{provider}")
}

/// Pure lifecycle plan: which owned icons to remove, which wanted icons
/// already exist (update in place) and which must be built.
#[derive(Debug, Default, PartialEq, Eq)]
struct ReconcilePlan {
    remove: Vec<String>,
    update: Vec<String>,
    create: Vec<String>,
}

fn reconcile_plan(
    owned: &HashSet<String>,
    wanted: &[(String, ProviderTrayConfig)],
    exists: impl Fn(&str) -> bool,
) -> ReconcilePlan {
    let target: HashSet<String> = wanted.iter().map(|(id, _)| tray_key(id)).collect();
    let mut remove: Vec<_> = owned.difference(&target).cloned().collect();
    remove.sort();
    let mut plan = ReconcilePlan {
        remove,
        ..Default::default()
    };
    for (id, _) in wanted {
        let key = tray_key(id);
        if exists(&key) {
            plan.update.push(key);
        } else {
            plan.create.push(key);
        }
    }
    plan
}

/// Snapshots the tray renders from: real provider data, with a Dev-only QA
/// fixture substituted for its one provider when active.
fn effective_snapshots(snapshots: &[ProviderUsageSnapshot]) -> Vec<ProviderUsageSnapshot> {
    let mut result = snapshots.to_vec();
    if let Some(fixture) = crate::tray_qa_fixture::active() {
        let synthetic = fixture.snapshot();
        result.retain(|s| s.provider_id != synthetic.provider_id);
        result.push(synthetic);
    }
    result
}

fn token_line(
    id: &str,
    c: &ProviderTrayConfig,
    settings: &Settings,
) -> Option<crate::provider_tray_tokens::TokenLine> {
    crate::provider_tray_tokens::supported_period(id, &c.token_range)?;
    if let Some(fixture) = crate::tray_qa_fixture::active()
        && fixture.provider_id == id
    {
        return crate::provider_tray_tokens::fixture_label(
            fixture.tokens,
            &c.token_range,
            settings.ui_language,
        );
    }
    crate::provider_tray_tokens::label(id, &c.token_range, settings.ui_language)
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
fn render(
    id: &str,
    percent: Option<f64>,
    c: &ProviderTrayConfig,
    settings: &Settings,
) -> (Vec<u8>, u32, u32) {
    quotalis_core::tray::provider::render_provider_icon_spec(
        &quotalis_core::tray::provider::ProviderIconSpec {
            provider_id: id,
            percent,
            style: &c.style,
            color: accent(id, c, settings),
            stroke: c.stroke,
            identity: &c.identity,
        },
    )
}
fn reconcile_on_main_thread(
    app: &AppHandle,
    settings: &Settings,
    snapshots: &[ProviderUsageSnapshot],
) {
    let snapshots = effective_snapshots(snapshots);
    let wanted = desired_indicators(settings, &snapshots);
    let Ok(mut owned) = OWNED.lock() else {
        return;
    };
    let plan = reconcile_plan(&owned, &wanted, |key| app.tray_by_id(key).is_some());
    for key in &plan.remove {
        drop(app.remove_tray_by_id(key));
        owned.remove(key);
    }
    for (id, c) in wanted {
        let key = tray_key(&id);
        let s = snapshots.iter().find(|s| s.provider_id == id);
        crate::provider_tray_tokens::request(app, &id, &c.token_range);
        let percent = s.and_then(|s| value(s, &c, &c.limit_id));
        let (pixels, w, h) = render(&id, percent, &c, settings);
        let icon = Image::new_owned(pixels, w, h);
        let tip = tooltip(&id, s, &c, settings, token_line(&id, &c, settings));
        if let Some(tray) = app.tray_by_id(&key) {
            let _ = tray.set_icon(Some(icon));
            let _ = tray.set_tooltip(Some(tip));
            owned.insert(key);
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

/// Raw RGBA from the exact production renderer, so Tray Studio's preview can
/// never drift from the native icon.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayPreview {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    pub tooltip: String,
}

#[tauri::command]
pub fn render_provider_tray_preview(
    app: AppHandle,
    provider_id: String,
    config: ProviderTrayConfig,
) -> Result<TrayPreview, String> {
    use tauri::Manager;
    let provider = ProviderId::from_cli_name(&provider_id)
        .filter(|p| p.cli_name() == provider_id)
        .ok_or_else(|| "Unknown provider".to_string())?;
    let id = provider.cli_name();
    let config = config.normalized();
    let settings = Settings::load();
    let cached = app
        .try_state::<Mutex<crate::state::AppState>>()
        .and_then(|state| state.lock().ok().map(|s| s.provider_cache.clone()))
        .unwrap_or_default();
    let snapshots = effective_snapshots(&cached);
    let snapshot = snapshots.iter().find(|s| s.provider_id == id);
    let percent = snapshot.and_then(|s| value(s, &config, &config.limit_id));
    let (rgba, width, height) = render(id, percent, &config, &settings);
    let tooltip = tooltip(
        id,
        snapshot,
        &config,
        &settings,
        token_line(id, &config, &settings),
    );
    Ok(TrayPreview {
        width,
        height,
        rgba,
        tooltip,
    })
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
    fn snapshot(value: serde_json::Value) -> ProviderUsageSnapshot {
        serde_json::from_value(value).unwrap()
    }
    fn pinned(limit: &str) -> ProviderTrayConfig {
        ProviderTrayConfig {
            enabled: true,
            limit_id: limit.into(),
            ..Default::default()
        }
    }
    fn settings_with(enabled: &[&str]) -> Settings {
        Settings {
            enabled_providers: enabled.iter().map(|s| s.to_string()).collect(),
            ..Settings::default()
        }
    }
    fn ids(wanted: &[(String, ProviderTrayConfig)]) -> Vec<&str> {
        wanted.iter().map(|(id, _)| id.as_str()).collect()
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
    fn used_and_remaining_follow_the_observed_window_at_the_edges() {
        let used = ProviderTrayConfig {
            show_as_used: true,
            ..Default::default()
        };
        let remaining = ProviderTrayConfig::default();
        for (used_pct, remaining_pct) in [(0.0, 100.0), (100.0, 0.0), (97.5, 2.5)] {
            let s = snapshot(
                serde_json::json!({"providerId":"codex","sourceLabel":"oauth","errorState":"ready","primaryLabel":"Session","primary":{"usedPercent":used_pct,"remainingPercent":remaining_pct,"windowMinutes":300}}),
            );
            assert_eq!(value(&s, &used, "primary:Session:300"), Some(used_pct));
            assert_eq!(
                value(&s, &remaining, "primary:Session:300"),
                Some(remaining_pct)
            );
        }
        let unavailable = snapshot(
            serde_json::json!({"providerId":"codex","sourceLabel":"unavailable","errorState":"ready","primaryLabel":"Session","primary":{"usedPercent":0.0,"remainingPercent":100.0,"windowMinutes":300}}),
        );
        assert_eq!(value(&unavailable, &used, "primary:Session:300"), None);
        let auth = snapshot(
            serde_json::json!({"providerId":"codex","sourceLabel":"oauth","errorState":"needsAuthentication","primaryLabel":"Session","primary":{"usedPercent":0.0,"remainingPercent":100.0,"windowMinutes":300}}),
        );
        assert_eq!(value(&auth, &remaining, "primary:Session:300"), None);
    }
    #[test]
    fn tooltip_bound_is_utf16_safe() {
        let s = sample();
        let settings = Settings::default();
        let c = ProviderTrayConfig {
            limit_id: "primary:Session:300".into(),
            ..Default::default()
        };
        let tip = tooltip("codex", Some(&s), &c, &settings, None);
        assert!(tip.contains("78.8%"));
        assert!(tip.encode_utf16().count() <= TOOLTIP_UTF16_LIMIT);
        assert_eq!(shorten("🚀🚀🚀", 5), "🚀🚀");
    }
    #[test]
    fn three_row_tooltip_uses_only_real_windows_and_never_zero_fills() {
        let s = snapshot(
            serde_json::json!({"providerId":"claude","sourceLabel":"oauth","errorState":"ready","planName":"Max 20x with a very long plan name","primaryLabel":"Session (5h)","primary":{"usedPercent":41.0,"remainingPercent":59.0,"windowMinutes":300},"secondaryLabel":"Weekly","secondary":{"usedPercent":12.0,"remainingPercent":88.0,"windowMinutes":10080}}),
        );
        let c = ProviderTrayConfig {
            show_as_used: true,
            tooltip_limit_ids: vec![
                "primary:Session (5h):300".into(),
                "secondary:Weekly:10080".into(),
                "tertiary:Monthly:43200".into(),
            ],
            ..Default::default()
        };
        let settings = Settings::default();
        let tip = tooltip(
            "claude",
            Some(&s),
            &c,
            &settings,
            Some(crate::provider_tray_tokens::TokenLine {
                label: "Local tokens with a deliberately overlong period label".into(),
                reading: "≥1234567".into(),
            }),
        );
        let lines: Vec<_> = tip.lines().collect();
        assert_eq!(lines.len(), 5, "{tip}");
        assert!(lines[1].ends_with("41.0% used"), "{tip}");
        assert!(lines[2].ends_with("12.0% used"), "{tip}");
        // A window the provider does not supply is unavailable, never 0%.
        assert!(lines[3].ends_with('—'), "{tip}");
        assert!(!lines[3].contains("0.0%"), "{tip}");
        // The token reading survives intact even though its label was shortened.
        assert!(lines[4].ends_with(": ≥1234567"), "{tip}");
        assert!(tip.encode_utf16().count() <= TOOLTIP_UTF16_LIMIT);
    }
    #[test]
    fn worst_case_tooltip_keeps_whole_lines_surrogates_and_readings() {
        let s = snapshot(
            serde_json::json!({"providerId":"claude","sourceLabel":"oauth","errorState":"ready","planName":"\u{1F680}\u{1F680}\u{1F680}\u{1F680}\u{1F680}\u{1F680} plan","primaryLabel":"\u{1F680} Session with an extremely long reported window label","primary":{"usedPercent":41.25,"remainingPercent":58.75,"windowMinutes":300},"secondaryLabel":"\u{1F680} Weekly with an extremely long reported window label too","secondary":{"usedPercent":12.5,"remainingPercent":87.5,"windowMinutes":10080},"tertiaryLabel":"\u{1F680} Monthly with yet another extremely long window label","tertiary":{"usedPercent":99.99,"remainingPercent":0.01,"windowMinutes":43200}}),
        );
        let c = ProviderTrayConfig {
            show_as_used: true,
            precision: 2,
            tooltip_limit_ids: limits(&s).into_iter().map(|l| l.id).collect(),
            token_range: "lifetime".into(),
            ..Default::default()
        };
        for language in [
            quotalis_core::settings::Language::English,
            quotalis_core::settings::Language::Arabic,
        ] {
            let settings = Settings {
                ui_language: language,
                ..Settings::default()
            };
            let tip = tooltip(
                "claude",
                Some(&s),
                &c,
                &settings,
                crate::provider_tray_tokens::fixture_label(
                    Some(18_446_744_073),
                    "lifetime",
                    language,
                ),
            );
            let units = tip.encode_utf16().count();
            assert!(units <= TOOLTIP_UTF16_LIMIT, "{units}: {tip}");
            assert!(String::from_utf16(&tip.encode_utf16().collect::<Vec<_>>()).is_ok());
            let lines: Vec<_> = tip.lines().collect();
            assert_eq!(lines.len(), 5, "{tip}");
            for (line, reading) in lines[1..4].iter().zip(["41.25%", "12.50%", "99.99%"]) {
                assert!(line.contains(reading), "{reading} missing: {tip}");
            }
            assert!(lines[4].ends_with("18446744073"), "{tip}");
        }
    }
    #[test]
    fn persisted_token_period_reaches_the_tooltip_only_when_supported() {
        let settings = Settings::default();
        let with = |range: &str| ProviderTrayConfig {
            token_range: range.into(),
            ..Default::default()
        };
        assert!(token_line("gemini", &with("week"), &settings).is_none());
        assert!(token_line("codex", &with("none"), &settings).is_none());
        let codex = token_line("codex", &with("week"), &settings).unwrap();
        assert!(codex.label.contains("This week"), "{codex:?}");
        let claude = token_line("claude", &with("lifetime"), &settings).unwrap();
        assert!(
            claude.label.contains("All available local history"),
            "{claude:?}"
        );
        let tip = tooltip(
            "codex",
            Some(&sample()),
            &with("week"),
            &settings,
            Some(codex),
        );
        assert!(tip.lines().last().unwrap().contains("This week"), "{tip}");
    }
    #[test]
    fn arabic_tooltip_stays_within_the_native_limit() {
        let s = sample();
        let settings = Settings {
            ui_language: quotalis_core::settings::Language::Arabic,
            ..Settings::default()
        };
        let c = ProviderTrayConfig {
            tooltip_limit_ids: vec!["primary:Session:300".into()],
            token_range: "week".into(),
            ..Default::default()
        };
        let tip = tooltip(
            "codex",
            Some(&s),
            &c,
            &settings,
            crate::provider_tray_tokens::fixture_label(Some(987_654), "week", settings.ui_language),
        );
        assert!(tip.contains("78.8%"), "{tip}");
        assert!(tip.contains("987654"), "{tip}");
        assert!(tip.encode_utf16().count() <= TOOLTIP_UTF16_LIMIT);
    }
    #[test]
    fn indicators_follow_catalog_order_and_skip_disabled_providers() {
        let mut settings = settings_with(&["codex", "claude"]);
        settings
            .provider_tray_configs
            .insert("codex".into(), pinned("primary:Session:300"));
        settings
            .provider_tray_configs
            .insert("claude".into(), pinned(""));
        settings
            .provider_tray_configs
            .insert("gemini".into(), pinned(""));
        let wanted = desired_indicators(&settings, &[]);
        let order: Vec<_> = ProviderId::all()
            .iter()
            .map(|p| p.cli_name())
            .filter(|id| ["codex", "claude"].contains(id))
            .collect();
        assert_eq!(ids(&wanted), order);
        // Explicitly unpinned wins over per-provider mode.
        settings.tray_icon_mode = TrayIconMode::PerProvider;
        settings
            .provider_tray_configs
            .get_mut("claude")
            .unwrap()
            .enabled = false;
        assert_eq!(ids(&desired_indicators(&settings, &[])), vec!["codex"]);
    }
    #[test]
    fn per_provider_mode_is_capped_and_explicit_pins_win_the_cap() {
        let all: Vec<&str> = ProviderId::all().iter().map(|p| p.cli_name()).collect();
        let mut settings = settings_with(&all);
        settings.tray_icon_mode = TrayIconMode::PerProvider;
        let last = *all.last().unwrap();
        settings
            .provider_tray_configs
            .insert(last.into(), pinned(""));
        let wanted = desired_indicators(&settings, &[]);
        assert_eq!(wanted.len(), MAX_PROVIDER_TRAY_ICONS);
        assert_eq!(wanted[0].0, last);
        let unique: HashSet<_> = wanted.iter().map(|(id, _)| id).collect();
        assert_eq!(unique.len(), wanted.len());
    }
    #[test]
    fn per_provider_default_uses_the_first_real_window() {
        let mut settings = settings_with(&["codex"]);
        settings.tray_icon_mode = TrayIconMode::PerProvider;
        let wanted = desired_indicators(&settings, &[sample()]);
        assert_eq!(wanted[0].1.limit_id, "primary:Session:300");
        let wanted = desired_indicators(&settings, &[]);
        assert_eq!(wanted[0].1.limit_id, "");
    }
    #[test]
    fn lifecycle_plan_creates_updates_and_removes_without_orphans() {
        let simulate = |owned: &mut HashSet<String>,
                        live: &mut HashSet<String>,
                        wanted: &[(String, ProviderTrayConfig)]| {
            let plan = reconcile_plan(owned, wanted, |key| live.contains(key));
            for key in &plan.remove {
                live.remove(key);
                owned.remove(key);
            }
            for key in plan.update.iter().chain(&plan.create) {
                live.insert(key.clone());
                owned.insert(key.clone());
            }
            plan
        };
        let mut owned = HashSet::new();
        let mut live = HashSet::new();
        let mut settings = settings_with(&["codex", "claude", "gemini"]);
        settings
            .provider_tray_configs
            .insert("codex".into(), pinned(""));
        settings
            .provider_tray_configs
            .insert("claude".into(), pinned(""));
        // create
        let plan = simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
        assert_eq!(plan.create.len(), 2);
        // update is idempotent: ×100 never creates duplicates
        for _ in 0..100 {
            let plan = simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
            assert!(plan.create.is_empty() && plan.remove.is_empty());
            assert_eq!(plan.update.len(), 2);
        }
        // disable
        settings
            .provider_tray_configs
            .get_mut("claude")
            .unwrap()
            .enabled = false;
        let plan = simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
        assert_eq!(plan.remove, vec![tray_key("claude")]);
        // re-enable ×50 alternating
        for round in 0..50 {
            settings
                .provider_tray_configs
                .get_mut("claude")
                .unwrap()
                .enabled = round % 2 == 0;
            simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
            assert_eq!(live.len(), if round % 2 == 0 { 2 } else { 1 });
            assert_eq!(owned, live);
        }
        // provider disappears from the enabled set
        settings.enabled_providers.remove("codex");
        simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
        assert!(!live.contains(&tray_key("codex")));
        // provider switch ×50 keeps exactly one icon
        settings.provider_tray_configs.clear();
        for round in 0..50 {
            settings.provider_tray_configs.clear();
            let id = if round % 2 == 0 { "claude" } else { "gemini" };
            settings.provider_tray_configs.insert(id.into(), pinned(""));
            simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
            assert_eq!(live, HashSet::from([tray_key(id)]));
        }
        // remove all
        settings.provider_tray_configs.clear();
        simulate(&mut owned, &mut live, &desired_indicators(&settings, &[]));
        assert!(live.is_empty() && owned.is_empty());
    }
    #[test]
    fn existing_but_unowned_icon_is_updated_not_duplicated() {
        let owned = HashSet::new();
        let wanted = vec![("codex".to_string(), pinned(""))];
        let plan = reconcile_plan(&owned, &wanted, |_| true);
        assert_eq!(plan.update, vec![tray_key("codex")]);
        assert!(plan.create.is_empty());
    }
    #[test]
    fn follow_global_tray_scope_overrides_per_indicator_color() {
        let mut settings = Settings {
            logo_variant: "ember".into(),
            ..Settings::default()
        };
        let c = ProviderTrayConfig {
            color: "silver".into(),
            ..Default::default()
        };
        assert_eq!(accent("claude", &c, &settings), [194, 209, 228]);
        settings.appearance_composition.tray = AppearanceSource::Global;
        assert_eq!(accent("claude", &c, &settings), [255, 126, 47]);
        let provider = ProviderTrayConfig::default();
        settings.appearance_composition.tray = AppearanceSource::Override;
        assert_eq!(
            accent("claude", &provider, &settings),
            quotalis_core::tray::provider::provider_accent("claude")
        );
    }
}
