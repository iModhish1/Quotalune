//! System tray icon setup: left-click opens the tray panel, right-click native menu.

use std::sync::Mutex;

use crate::commands::ProviderCatalogEntry;
#[cfg(test)]
use quotalis_core::core::ProviderId;
use quotalis_core::settings::MetricPreference;
use quotalis_core::settings::{Settings, TrayIconMode};
use tauri::image::Image;
use tauri::menu::{CheckMenuItemBuilder, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use quotalis_core::tray::{
    apply_logo_identity_rgba, render_bar_icon_rgba, render_percent_icon_rgba,
};

use crate::shell;
use crate::state::{AppState, TrayAnchor};
use crate::surface::SurfaceMode;
use crate::surface_target::SurfaceTarget;
#[cfg(test)]
use crate::tray_menu::build_tray_menu;
use crate::tray_menu::{TrayMenuEntry, build_tray_menu_with};

#[derive(Debug, Clone, Copy)]
struct MonitorScaleInfo {
    physical_x: i32,
    physical_y: i32,
    physical_width: u32,
    physical_height: u32,
    scale_factor: f64,
}

impl MonitorScaleInfo {
    fn from_monitor(monitor: &tauri::Monitor) -> Self {
        let scale_factor = monitor.scale_factor();
        let safe_scale = if scale_factor.is_finite() && scale_factor > 0.0 {
            scale_factor
        } else {
            1.0
        };
        let position = monitor.position();
        let size = monitor.size();

        Self {
            physical_x: position.x,
            physical_y: position.y,
            physical_width: size.width,
            physical_height: size.height,
            scale_factor: safe_scale,
        }
    }
}

fn scale_factor_for_physical_point(x: f64, y: f64, monitors: &[MonitorScaleInfo]) -> Option<f64> {
    monitors
        .iter()
        .find(|monitor| {
            x >= monitor.physical_x as f64
                && x < (monitor.physical_x + monitor.physical_width as i32) as f64
                && y >= monitor.physical_y as f64
                && y < (monitor.physical_y + monitor.physical_height as i32) as f64
        })
        .map(|monitor| monitor.scale_factor)
}

fn logical_to_physical_anchor(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    scale_factor: f64,
) -> TrayAnchor {
    let safe_scale = if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    };

    TrayAnchor {
        x: (x * safe_scale).round() as i32,
        y: (y * safe_scale).round() as i32,
        width: ((width * safe_scale).round().max(1.0)) as u32,
        height: ((height * safe_scale).round().max(1.0)) as u32,
    }
}

fn resolve_tray_anchor(
    rect: &tauri::Rect,
    click_position: tauri::PhysicalPosition<f64>,
    monitors: &[MonitorScaleInfo],
) -> Option<TrayAnchor> {
    let click_scale = scale_factor_for_physical_point(click_position.x, click_position.y, monitors);

    match (rect.position, rect.size) {
        (tauri::Position::Physical(position), tauri::Size::Physical(size)) => Some(TrayAnchor {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        }),
        (tauri::Position::Logical(position), tauri::Size::Logical(size)) => {
            click_scale.map(|scale| {
                logical_to_physical_anchor(position.x, position.y, size.width, size.height, scale)
            })
        }
        (tauri::Position::Physical(position), tauri::Size::Logical(size)) => {
            click_scale.map(|scale| TrayAnchor {
                x: position.x,
                y: position.y,
                width: ((size.width * scale).round().max(1.0)) as u32,
                height: ((size.height * scale).round().max(1.0)) as u32,
            })
        }
        (tauri::Position::Logical(position), tauri::Size::Physical(size)) => {
            click_scale.map(|scale| TrayAnchor {
                x: (position.x * scale).round() as i32,
                y: (position.y * scale).round() as i32,
                width: size.width,
                height: size.height,
            })
        }
    }
}

fn build_native_tray_menu(
    app: &AppHandle,
    providers: &[ProviderCatalogEntry],
    status_labels: &[(String, String)],
) -> tauri::Result<Menu<tauri::Wry>> {
    let settings = Settings::load();
    let enabled = settings.enabled_providers.clone();
    let store = quotalis_core::profiles::ProfileStore::load();
    let profile_entries: Vec<crate::tray_menu::ProfileMenuEntry> = store
        .profiles
        .iter()
        .map(|p| crate::tray_menu::ProfileMenuEntry {
            id: p.id.clone(),
            name: p.name.clone(),
            active: p.id == store.active_profile_id,
        })
        .collect();
    let spec = build_tray_menu_with(
        providers,
        status_labels,
        &enabled,
        crate::tray_menu::SurfaceToggles {
            float_bar: settings.float_bar_enabled,
            top_arc: settings.top_arc_enabled,
        },
        &profile_entries,
        settings.privacy_mode,
        settings.ui_language,
    );
    let entries = spec
        .iter()
        .map(|entry| build_native_menu_entry(app, entry))
        .collect::<tauri::Result<Vec<_>>>()?;
    let item_refs = entries
        .iter()
        .map(NativeMenuEntry::as_item)
        .collect::<Vec<_>>();

    Menu::with_items(app, &item_refs)
}

fn resolve_menu_target(id: &str) -> Option<shell::ShellTransitionRequest> {
    match id {
        // NOTE: "pop_out" ("Pop Out Panel") is NOT handled here — it opens
        // the dedicated flyout window (MenuAction::OpenFlyout in
        // resolve_menu_action below), not a `shell::ShellTransitionRequest`
        // against the `main`-window surface-mode machine. `SurfaceMode::TrayPanel`
        // remains as a data key (geometry-key / window_properties source /
        // panel-size reference) but `main` no longer transitions into it.
        _ if id.starts_with("provider:") => Some(shell::ShellTransitionRequest {
            mode: SurfaceMode::PopOut,
            target: SurfaceTarget::parse(id)?,
            position: None,
        }),
        _ => None,
    }
}

enum MenuAction {
    Transition(shell::ShellTransitionRequest),
    /// Open/focus the main workspace per the configured startup destination
    /// — the same action as left-click, a cold launch, or a relaunch.
    OpenMainApp,
    /// Open/focus the main workspace on one specific, named route —
    /// unambiguous regardless of the user's configured startup destination.
    OpenMainRoute(shell::MainRoute),
    /// Open (or focus) the dedicated flyout ("Pop Out Panel") window —
    /// a distinct, still-supported compact-window feature, not the main app.
    OpenFlyout,
    /// Open (or focus) the dedicated detached Collections window — a
    /// secondary path; "Collections" itself opens the main app.
    OpenCollectionsWindow,
    Refresh,
    CheckForUpdates,
    /// Toggle the enabled/disabled state of the provider with the given CLI name.
    ToggleProvider(String),
    /// Toggle the floating bar window on/off.
    ToggleFloatBar,
    ToggleEdgeArc,
    SwitchProfile(String),
    TogglePrivacyMode,
    ToggleTaskbarArc,
    ToggleTopArc,
    Quit,
}

fn resolve_menu_action(id: &str) -> Option<MenuAction> {
    match id {
        "open_main_app" => Some(MenuAction::OpenMainApp),
        "dashboard" => Some(MenuAction::OpenMainRoute(shell::MainRoute::Dashboard)),
        "provider_display" => Some(MenuAction::OpenMainRoute(shell::MainRoute::ProviderDisplay)),
        "collections" => Some(MenuAction::OpenMainRoute(shell::MainRoute::Collections)),
        "manage_providers" => Some(MenuAction::OpenMainRoute(shell::MainRoute::Providers)),
        "manage_profiles" => Some(MenuAction::OpenMainRoute(shell::MainRoute::Profiles)),
        "open_collections_window" => Some(MenuAction::OpenCollectionsWindow),
        "refresh" => Some(MenuAction::Refresh),
        "check_for_updates" => Some(MenuAction::CheckForUpdates),
        "quit" => Some(MenuAction::Quit),
        "settings" => Some(MenuAction::OpenMainRoute(shell::MainRoute::General)),
        "about" => Some(MenuAction::OpenMainRoute(shell::MainRoute::About)),
        "toggle_float_bar" => Some(MenuAction::ToggleFloatBar),
        "toggle_edge_arc" => Some(MenuAction::ToggleEdgeArc),
        "toggle_privacy_mode" => Some(MenuAction::TogglePrivacyMode),
        _ if id.starts_with("switch_profile:") => {
            let profile_id = id["switch_profile:".len()..].to_string();
            Some(MenuAction::SwitchProfile(profile_id))
        }
        "toggle_top_arc" => Some(MenuAction::ToggleTopArc),
        "toggle_taskbar_arc" => Some(MenuAction::ToggleTaskbarArc),
        "pop_out" => Some(MenuAction::OpenFlyout),
        _ if id.starts_with("toggle_provider:") => {
            let provider_id = id["toggle_provider:".len()..].to_string();
            Some(MenuAction::ToggleProvider(provider_id))
        }
        _ => resolve_menu_target(id).map(MenuAction::Transition),
    }
}

/// Store the tray icon bounds from a click event into shared state.
fn store_anchor(app: &AppHandle, rect: &tauri::Rect, click_position: tauri::PhysicalPosition<f64>) {
    let monitors = app
        .get_webview_window("main")
        .and_then(|window| window.available_monitors().ok())
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| MonitorScaleInfo::from_monitor(&monitor))
        .collect::<Vec<_>>();

    let Some(anchor) = resolve_tray_anchor(rect, click_position, &monitors) else {
        return;
    };

    if let Some(st) = app.try_state::<Mutex<AppState>>() {
        let mut guard = st.lock().unwrap();
        guard.tray_anchor = Some(anchor);
    }
}

/// Initialise the system tray icon, context menu, and event handlers.
///
/// - **Left-click** toggles the custom tray panel via the surface state machine.
/// - **Right-click** opens the native context menu with shell actions.
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_native_tray_menu(app.handle(), &crate::commands::get_provider_catalog(), &[])?;

    // Embed the icon at compile time so it works regardless of working directory.
    let icon_bytes = include_bytes!("../../../../rust/icons/icon.png");
    let icon = Image::from_bytes(icon_bytes)?;

    let _tray = TrayIconBuilder::with_id("quotalis-main")
        .icon(icon)
        .tooltip(format!(
            "Quotalis{}",
            quotalis_core::paths::channel_suffix()
        ))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                position,
                rect,
                ..
            } = event
            {
                let app = tray.app_handle();
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    store_anchor(app, &rect, position);
                    // Left-click opens/focuses the main QuotaArc workspace —
                    // the same "activate the app" action a cold launch and a
                    // single-instance relaunch use, per `startup_destination`
                    // (tray/UX reset wave). Previously toggled the compact
                    // Pop Out Panel flyout instead, which is exactly the
                    // "mini tray dashboard on click" behavior product review
                    // flagged; the flyout remains reachable explicitly via
                    // its own "Pop Out Panel" menu item. Called directly
                    // (not spawned): native tray-icon event callbacks run on
                    // the same main-thread event-loop context as
                    // `on_menu_event` below, where `settings_window::
                    // open_or_focus` is also called synchronously — the
                    // WebviewWindowBuilder deadlock only affects builds
                    // invoked from *synchronous Tauri IPC commands*, not
                    // native event-loop callbacks.
                    crate::activate_configured_destination(app);
                }
            }
        })
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id().as_ref());
        })
        .build(app)?;

    // Apply tray promotion on startup. The NotifyIconSettings entry is created
    // by Windows only after the icon is first registered, so on first run /
    // post-upgrade the subkey may not exist yet — apply_promotion tolerates
    // EntryNotFound. Retry a few times while explorer finishes registration.
    schedule_tray_promotion_retries(app.handle().clone());

    Ok(())
}

/// Re-apply Win11 tray promotion a few times after startup.
///
/// Windows often creates the NotifyIconSettings subkey only after the first
/// successful NIM_ADD (and sometimes only after the icon is refreshed). A
/// single immediate write is not enough after upgrades.
fn schedule_tray_promotion_retries(app_handle: AppHandle) {
    if !quotalis_core::settings::Settings::load().promote_tray_icon {
        return;
    }
    crate::tray_visibility::apply_promotion(true);
    tauri::async_runtime::spawn(async move {
        for secs in [1_u64, 3, 8] {
            tokio::time::sleep(std::time::Duration::from_secs(secs)).await;
            if !quotalis_core::settings::Settings::load().promote_tray_icon {
                break;
            }
            crate::tray_visibility::apply_promotion(true);
        }
        drop(app_handle);
    });
}

/// Route a native menu-item click to the corresponding shell action.
fn handle_menu_event(app: &AppHandle, id: &str) {
    match resolve_menu_action(id) {
        Some(MenuAction::Transition(request)) => {
            crate::auto_refresh::note_menu_open();
            let _ =
                shell::transition_to_target(app, request.mode, request.target, request.position);
        }
        Some(MenuAction::OpenMainApp) => {
            crate::activate_configured_destination(app);
        }
        Some(MenuAction::OpenMainRoute(route)) => {
            let _ = shell::open_or_focus_main_window(app, route);
        }
        Some(MenuAction::OpenFlyout) => {
            // Pass None: open_or_focus falls back to the tray-anchored
            // default position (same placement chain the old TrayPanel
            // transition used) when no explicit position is given.
            crate::auto_refresh::note_menu_open();
            let _ = shell::flyout_window::open_or_focus(app, None);
        }
        Some(MenuAction::OpenCollectionsWindow) => {
            let _ = shell::collections_window::open_or_focus(app);
        }
        Some(MenuAction::Refresh) => {
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::commands::do_refresh_providers(&handle).await;
            });
        }
        Some(MenuAction::CheckForUpdates) => {
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<Mutex<AppState>>();
                let _ = crate::commands::check_for_updates(handle.clone(), state).await;
            });
        }
        Some(MenuAction::ToggleProvider(provider_id)) => {
            let mut settings = Settings::load();
            if settings.enabled_providers.contains(&provider_id) {
                settings.enabled_providers.remove(&provider_id);
            } else {
                settings.enabled_providers.insert(provider_id);
            }
            let _ = settings.save();
            crate::floatbar::notify_settings_changed(app);
            rebuild_tray_menu(app);
        }
        Some(MenuAction::ToggleFloatBar) => {
            crate::floatbar::toggle(app);
            rebuild_tray_menu(app);
        }
        Some(MenuAction::ToggleEdgeArc) => {
            let mut settings = Settings::load();
            settings.edge_arc_enabled = !settings.edge_arc_enabled;
            let _save = settings.save();
            if settings.edge_arc_enabled {
                let _show = crate::surfaces::show_edge_arc(app);
            } else {
                let _hide = crate::surfaces::hide_edge_arc(app);
            }
            rebuild_tray_menu(app);
        }
        Some(MenuAction::ToggleTopArc) => {
            let mut settings = Settings::load();
            settings.top_arc_enabled = !settings.top_arc_enabled;
            let _save = settings.save();
            if settings.top_arc_enabled {
                let _show = crate::surfaces::show_top_arc(app);
            } else {
                let _hide = crate::surfaces::hide_top_arc(app);
            }
            rebuild_tray_menu(app);
        }
        Some(MenuAction::SwitchProfile(profile_id)) => {
            let _ = crate::command_profiles::switch_profile(app.clone(), profile_id);
        }
        Some(MenuAction::ToggleTaskbarArc) => {
            let mut settings = Settings::load();
            settings.taskbar_arc_enabled = !settings.taskbar_arc_enabled;
            let _save = settings.save();
            if settings.taskbar_arc_enabled {
                let _show = crate::surfaces::show_taskbar_arc(app);
            } else {
                let _hide = crate::surfaces::hide_taskbar_arc(app);
            }
            rebuild_tray_menu(app);
        }
        Some(MenuAction::TogglePrivacyMode) => {
            let mut settings = Settings::load();
            settings.privacy_mode = !settings.privacy_mode;
            if settings.privacy_mode {
                settings.hide_personal_info = true;
            }
            let _save = settings.save();
            use tauri::Emitter;
            let _ = app.emit("quotalis:settings-updated", ());
            rebuild_tray_menu(app);
        }
        Some(MenuAction::Quit) => {
            app.exit(0);
        }
        None => {}
    }
}

/// Rebuild the native tray menu from current provider + settings state.
pub(crate) fn rebuild_tray_menu(app: &AppHandle) {
    let catalog = crate::commands::get_provider_catalog();
    let settings = Settings::load();
    let status_labels = if let Some(st) = app.try_state::<Mutex<AppState>>() {
        let guard = st.lock().unwrap();
        let snapshots =
            presentation_snapshots(&guard.provider_cache, settings.codex_spark_usage_visible());
        status_labels_for_settings(&settings, &snapshots, settings.ui_language)
    } else {
        vec![]
    };
    if let Ok(menu) = build_native_tray_menu(app, &catalog, &status_labels)
        && let Some(tray) = app.tray_by_id("quotalis-main")
    {
        let _ = tray.set_menu(Some(menu));
    }
}

/// Rebuild the tray menu with current provider status labels after a refresh cycle.
pub fn update_tray_status_items(
    app: &AppHandle,
    snapshots: &[crate::commands::ProviderUsageSnapshot],
) {
    let catalog = crate::commands::get_provider_catalog();
    let settings = Settings::load();
    let snapshots = presentation_snapshots(snapshots, settings.codex_spark_usage_visible());
    let status_labels = status_labels_for_settings(&settings, &snapshots, settings.ui_language);

    if let Ok(menu) = build_native_tray_menu(app, &catalog, &status_labels)
        && let Some(tray) = app.tray_by_id("quotalis-main")
    {
        let _ = tray.set_menu(Some(menu));
    }
}

/// Refresh every native tray surface that depends on settings and cached provider data.
pub(crate) fn refresh_tray_presentation(app: &AppHandle) {
    let snapshots = app
        .try_state::<Mutex<AppState>>()
        .map(|st| st.lock().unwrap().provider_cache.clone())
        .unwrap_or_default();
    update_tray_status_items(app, &snapshots);
    update_tray_icon_and_tooltip(app, &snapshots);
}

fn presentation_snapshots(
    snapshots: &[crate::commands::ProviderUsageSnapshot],
    spark_usage_visible: bool,
) -> Vec<crate::commands::ProviderUsageSnapshot> {
    let mut snapshots = snapshots.to_vec();
    for snapshot in &mut snapshots {
        crate::commands::filter_hidden_codex_spark_rows(snapshot, spark_usage_visible);
    }
    snapshots
}

/// Update the tray icon pixels and tooltip text to reflect current provider usage.
///
/// Behaviour mirrors egui's `choose_tray_update_plan` (rust/src/native_ui/app.rs):
/// - If `menu_bar_shows_highest_usage` is on OR `menu_bar_display_mode == "minimal"`,
///   render the bar from the healthy provider with the highest session usage.
/// - Otherwise render from the first enabled healthy provider (catalog order).
/// - When any provider exposes a weekly/secondary window, the icon shows both
///   bars from the same picked provider.
/// - With zero healthy providers but at least one error, fall back to an
///   error-styled icon using the last known max percentage so the tray
///   still communicates "something is wrong".
pub fn update_tray_icon_and_tooltip(
    app: &AppHandle,
    snapshots: &[crate::commands::ProviderUsageSnapshot],
) {
    let Some(tray) = app.tray_by_id("quotalis-main") else {
        return;
    };

    // ── Icon ─────────────────────────────────────────────────────────────
    let settings = Settings::load();
    let snapshots = presentation_snapshots(snapshots, settings.codex_spark_usage_visible());
    crate::provider_tray::update(app, &settings, &snapshots);
    let ordered_snapshots = ordered_snapshot_refs(&settings, &snapshots);
    let ok_snapshots: Vec<_> = ordered_snapshots
        .iter()
        .copied()
        .filter(|s| s.error.is_none())
        .collect();
    let all_error = ok_snapshots.is_empty() && !snapshots.is_empty();

    let prefer_highest = settings.menu_bar_shows_highest_usage
        || settings.menu_bar_display_mode.as_str() == "minimal";

    let picked = pick_tray_provider(&ok_snapshots, prefer_highest);

    let (session_pct, weekly_pct) = match picked {
        Some(s) => selected_tray_percents(s, &settings),
        None => (
            ok_snapshots
                .iter()
                .map(|s| selected_tray_percents(s, &settings).0)
                .fold(0.0_f64, f64::max),
            None,
        ),
    };

    let (rgba, w, h) = render_tray_icon_for_settings(&settings, session_pct, weekly_pct, all_error);
    let icon = Image::new_owned(rgba, w, h);
    let _ = tray.set_icon(Some(icon));

    // ── Tooltip ───────────────────────────────────────────────────────────
    let tooltip = build_tooltip(&snapshots, settings.ui_language);
    let _ = tray.set_tooltip(Some(tooltip));
}

fn status_labels_for_settings(
    settings: &Settings,
    snapshots: &[crate::commands::ProviderUsageSnapshot],
    lang: quotalis_core::settings::Language,
) -> Vec<(String, String)> {
    let ordered_snapshots = ordered_snapshot_refs(settings, snapshots);
    let healthy: Vec<_> = ordered_snapshots
        .into_iter()
        .filter(|s| s.error.is_none())
        .collect();
    if settings.tray_icon_mode == TrayIconMode::PerProvider {
        return healthy
            .into_iter()
            .map(|s| provider_status_label(s, lang))
            .collect::<Vec<_>>();
    }

    let Some(selected) = pick_tray_provider(
        &healthy,
        settings.menu_bar_shows_highest_usage || settings.menu_bar_display_mode == "minimal",
    ) else {
        return vec![];
    };

    let (_, label) = provider_status_label(selected, lang);
    vec![("status_summary".to_string(), label)]
}

fn ordered_snapshot_refs<'a>(
    settings: &Settings,
    snapshots: &'a [crate::commands::ProviderUsageSnapshot],
) -> Vec<&'a crate::commands::ProviderUsageSnapshot> {
    let order = settings
        .provider_display_order_names()
        .into_iter()
        .enumerate()
        .map(|(index, provider_id)| (provider_id, index))
        .collect::<std::collections::HashMap<_, _>>();
    let mut ordered = snapshots.iter().collect::<Vec<_>>();
    ordered.sort_by(|a, b| {
        let a_order = order.get(&a.provider_id);
        let b_order = order.get(&b.provider_id);
        match (a_order, b_order) {
            (Some(a_order), Some(b_order)) if a_order != b_order => a_order.cmp(b_order),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            _ => a.display_name.cmp(&b.display_name),
        }
    });
    ordered
}

fn provider_status_label(
    snapshot: &crate::commands::ProviderUsageSnapshot,
    lang: quotalis_core::settings::Language,
) -> (String, String) {
    // MonthlyPlan metric (PAYG spend, e.g. Mistral): show formatted cost.
    let provider = quotalis_core::core::ProviderId::from_cli_name(&snapshot.provider_id);
    let preference = provider
        .map(|id| Settings::load().get_provider_metric(id))
        .unwrap_or_default();
    if preference == MetricPreference::MonthlyPlan
        && let Some(cost) = snapshot.cost.as_ref()
    {
        let amount = if !cost.formatted_used.is_empty() {
            cost.formatted_used.clone()
        } else {
            crate::commands::format_cost_amount(cost)
        };
        return (
            snapshot.provider_id.clone(),
            format!("{} {}", snapshot.display_name, amount),
        );
    }

    let label = crate::commands::compact_tray_status_label(headline_window(snapshot), lang);
    (
        snapshot.provider_id.clone(),
        format!("{} {}", snapshot.display_name, label),
    )
}

/// Window that headline tray surfaces should label for a provider.
///
/// F5 (upstream 0.48.0): for Codex, prefer the first non-informational lane so
/// a monthly-only plan shows the monthly window with its reset countdown
/// instead of the informational "No active 5h session" placeholder.
///
/// Shared by the tray menu rows (`provider_status_label`) and the tray tooltip
/// (`build_tooltip`) so the two cannot drift apart.
fn headline_window(
    snapshot: &crate::commands::ProviderUsageSnapshot,
) -> &crate::commands::RateWindowSnapshot {
    if snapshot.provider_id == "codex" {
        codex_lane_headline_window(snapshot)
    } else {
        &snapshot.primary
    }
}

/// F5 (upstream 0.48.0): pick the first non-informational Codex lane in
/// session → weekly → monthly order. When all lanes are informational
/// (no active session at all), fall back to the primary for the
/// "No active 5h session" placeholder.
pub(crate) fn codex_lane_headline_window(
    snapshot: &crate::commands::ProviderUsageSnapshot,
) -> &crate::commands::RateWindowSnapshot {
    if !snapshot.primary.is_informational {
        return &snapshot.primary;
    }
    if let Some(ref secondary) = snapshot.secondary
        && !secondary.is_informational
    {
        return secondary;
    }
    if let Some(ref tertiary) = snapshot.tertiary
        && !tertiary.is_informational
    {
        return tertiary;
    }
    &snapshot.primary
}

fn render_tray_icon_for_settings(
    settings: &Settings,
    session_pct: f64,
    weekly_pct: Option<f64>,
    all_error: bool,
) -> (Vec<u8>, u32, u32) {
    let (rgba, width, height) = if settings.menu_bar_shows_percent {
        render_percent_icon_rgba(session_pct, all_error)
    } else {
        render_bar_icon_rgba(session_pct, weekly_pct, all_error)
    };
    (
        apply_logo_identity_rgba(
            rgba,
            width,
            height,
            &settings.logo_variant,
            settings.logo_scale_percent,
        ),
        width,
        height,
    )
}

/// Pick the provider whose usage the tray icon should render.
///
/// Exposed so that the unit tests can exercise both `highest` and `first`
/// paths without needing a live Tauri app handle.
fn pick_tray_provider<'a>(
    ok_snapshots: &'a [&'a crate::commands::ProviderUsageSnapshot],
    prefer_highest: bool,
) -> Option<&'a crate::commands::ProviderUsageSnapshot> {
    if ok_snapshots.is_empty() {
        return None;
    }
    if prefer_highest {
        ok_snapshots.iter().copied().max_by(|a, b| {
            a.primary
                .used_percent
                .partial_cmp(&b.primary.used_percent)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    } else {
        Some(ok_snapshots[0])
    }
}

fn selected_tray_percents(
    snapshot: &crate::commands::ProviderUsageSnapshot,
    settings: &Settings,
) -> (f64, Option<f64>) {
    let (selected, companion) =
        crate::usage_metric::selected_usage_icon_windows(snapshot, settings);
    (
        display_metric_percent(selected.used_percent, settings.show_as_used),
        companion
            .as_ref()
            .map(|window| display_metric_percent(window.used_percent, settings.show_as_used)),
    )
}

fn display_metric_percent(used_percent: f64, show_as_used: bool) -> f64 {
    let used = used_percent.clamp(0.0, 100.0);
    if show_as_used { used } else { 100.0 - used }
}

/// Build a compact multi-line tooltip string from provider snapshots.
fn build_tooltip(
    snapshots: &[crate::commands::ProviderUsageSnapshot],
    lang: quotalis_core::settings::Language,
) -> String {
    use quotalis_core::locale::{LocaleKey, get_text};

    if snapshots.is_empty() {
        return format!("Quotalis{}", quotalis_core::paths::channel_suffix());
    }

    let error_label = get_text(lang, LocaleKey::TrayStatusRowError);
    let mut lines = Vec::with_capacity(snapshots.len() + 1);
    for s in snapshots {
        let status = if let Some(ref err) = s.error {
            let short = truncate_tooltip_text(err, 36);
            format!("{}: {} ({})", s.display_name, error_label, short)
        } else {
            let label = crate::commands::compact_tray_status_label(headline_window(s), lang);
            format!("{}: {}", s.display_name, truncate_tooltip_text(&label, 42))
        };
        lines.push(status);
    }

    format!("Quotalis\n{}", lines.join("\n"))
}

fn truncate_tooltip_text(text: &str, max_chars: usize) -> String {
    let mut chars = text.chars();
    let truncated: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

#[allow(
    dead_code,
    reason = "tray bridge helper reserved for future system tray integration"
)]
fn menu_contains(menu: &[TrayMenuEntry], id: &str) -> bool {
    menu.iter().any(|entry| {
        entry.id.as_deref() == Some(id)
            || (!entry.children.is_empty() && menu_contains(&entry.children, id))
    })
}

enum NativeMenuEntry {
    Item(MenuItem<tauri::Wry>),
    CheckItem(tauri::menu::CheckMenuItem<tauri::Wry>),
    Submenu(Submenu<tauri::Wry>),
    Separator(PredefinedMenuItem<tauri::Wry>),
}

impl NativeMenuEntry {
    fn as_item(&self) -> &dyn IsMenuItem<tauri::Wry> {
        match self {
            Self::Item(item) => item,
            Self::CheckItem(item) => item,
            Self::Submenu(item) => item,
            Self::Separator(item) => item,
        }
    }
}

fn build_native_menu_entry(
    app: &AppHandle,
    entry: &TrayMenuEntry,
) -> tauri::Result<NativeMenuEntry> {
    if entry.is_separator {
        return Ok(NativeMenuEntry::Separator(PredefinedMenuItem::separator(
            app,
        )?));
    }

    if !entry.children.is_empty() {
        let children = entry
            .children
            .iter()
            .map(|child| build_native_menu_entry(app, child))
            .collect::<tauri::Result<Vec<_>>>()?;
        let child_refs = children
            .iter()
            .map(NativeMenuEntry::as_item)
            .collect::<Vec<_>>();

        return Ok(NativeMenuEntry::Submenu(Submenu::with_items(
            app,
            &entry.label,
            true,
            &child_refs,
        )?));
    }

    // Render as a checkbox item when `checked` is set.
    if let Some(checked) = entry.checked {
        return Ok(NativeMenuEntry::CheckItem(
            CheckMenuItemBuilder::with_id(entry.id.clone().unwrap_or_default(), &entry.label)
                .enabled(!entry.disabled)
                .checked(checked)
                .build(app)?,
        ));
    }

    Ok(NativeMenuEntry::Item(MenuItem::with_id(
        app,
        entry.id.clone().unwrap_or_default(),
        &entry.label,
        !entry.disabled,
        None::<&str>,
    )?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_provider_catalog() -> Vec<ProviderCatalogEntry> {
        vec![
            ProviderCatalogEntry {
                id: "codex".into(),
                display_name: "Codex".into(),
                cookie_domain: None,
            },
            ProviderCatalogEntry {
                id: "claude".into(),
                display_name: "Claude".into(),
                cookie_domain: None,
            },
        ]
    }

    #[test]
    fn tray_menu_includes_about_and_provider_entries() {
        let menu = build_tray_menu(
            &sample_provider_catalog(),
            &[],
            &["codex".to_string(), "claude".to_string()]
                .into_iter()
                .collect(),
        );
        assert!(menu_contains(&menu, "about"));
        assert!(menu_contains(&menu, "toggle_provider:codex"));
        assert!(menu_contains(&menu, "quit"));
    }

    #[test]
    fn toggle_float_bar_routes_to_toggle_action() {
        let action = resolve_menu_action("toggle_float_bar").expect("float bar action");
        assert!(matches!(action, MenuAction::ToggleFloatBar));
    }

    #[test]
    fn settings_menu_routes_to_the_main_workspace_general_and_about_routes() {
        let action = resolve_menu_action("about").expect("about action");
        assert!(matches!(
            action,
            MenuAction::OpenMainRoute(shell::MainRoute::About)
        ));

        let action = resolve_menu_action("settings").expect("settings action");
        assert!(matches!(
            action,
            MenuAction::OpenMainRoute(shell::MainRoute::General)
        ));
    }

    #[test]
    fn provider_menu_routes_to_provider_popout_target() {
        let action = resolve_menu_target("provider:codex").expect("provider target");
        assert_eq!(action.mode, SurfaceMode::PopOut);
        assert_eq!(
            action.target,
            SurfaceTarget::Provider {
                provider_id: "codex".into()
            }
        );
    }

    #[test]
    fn pop_out_menu_routes_to_open_flyout_action() {
        // "Pop Out Panel" opens the dedicated flyout window — a distinct,
        // still-supported compact-window feature, deliberately separate from
        // "Open QuotaArc" (the main workspace). The old ambiguous "Show
        // Window" item (which duplicated this by reshaping `main` into the
        // same PopOut/Dashboard surface via a second mechanism) was retired
        // in the tray/UX-reset wave.
        let action = resolve_menu_action("pop_out").expect("pop_out action");
        assert!(matches!(action, MenuAction::OpenFlyout));
        assert!(resolve_menu_action("show_panel").is_none());

        // SurfaceMode::TrayPanel is retained purely as a data key (geometry
        // key / window_properties source / panel-size reference) for the
        // flyout window's builder — the properties themselves are unchanged.
        let props = SurfaceMode::TrayPanel.window_properties();
        assert!(props.resizable && props.blur_dismiss && props.skip_taskbar);
    }

    #[test]
    fn open_main_app_and_named_routes_resolve_distinctly() {
        assert!(matches!(
            resolve_menu_action("open_main_app"),
            Some(MenuAction::OpenMainApp)
        ));
        assert!(matches!(
            resolve_menu_action("dashboard"),
            Some(MenuAction::OpenMainRoute(shell::MainRoute::Dashboard))
        ));
        assert!(matches!(
            resolve_menu_action("provider_display"),
            Some(MenuAction::OpenMainRoute(shell::MainRoute::ProviderDisplay))
        ));
        assert!(matches!(
            resolve_menu_action("collections"),
            Some(MenuAction::OpenMainRoute(shell::MainRoute::Collections))
        ));
        assert!(matches!(
            resolve_menu_action("manage_providers"),
            Some(MenuAction::OpenMainRoute(shell::MainRoute::Providers))
        ));
        assert!(matches!(
            resolve_menu_action("manage_profiles"),
            Some(MenuAction::OpenMainRoute(shell::MainRoute::Profiles))
        ));
        assert!(matches!(
            resolve_menu_action("open_collections_window"),
            Some(MenuAction::OpenCollectionsWindow)
        ));
    }

    #[test]
    fn provider_deep_link_resolves_to_a_popout_provider_target() {
        // The only surviving `resolve_menu_target`/`MenuAction::Transition`
        // caller is a `provider:` deep link, passed straight through to
        // `transition_to_target` in `handle_menu_event`.
        let request = resolve_menu_target("provider:codex").expect("provider target");
        assert_eq!(request.mode, SurfaceMode::PopOut);
        assert_eq!(
            request.target,
            SurfaceTarget::Provider {
                provider_id: "codex".into()
            }
        );
        assert_eq!(request.position, None);
    }

    #[test]
    fn logical_tray_anchor_uses_click_monitor_scale() {
        let monitors = vec![
            MonitorScaleInfo {
                physical_x: 0,
                physical_y: 0,
                physical_width: 1920,
                physical_height: 1080,
                scale_factor: 1.0,
            },
            MonitorScaleInfo {
                physical_x: 1920,
                physical_y: 0,
                physical_width: 2560,
                physical_height: 1440,
                scale_factor: 2.0,
            },
        ];

        let rect = tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(1500.0, 500.0)),
            size: tauri::Size::Logical(tauri::LogicalSize::new(12.0, 12.0)),
        };
        let anchor = resolve_tray_anchor(
            &rect,
            tauri::PhysicalPosition::new(1510.0, 500.0),
            &monitors,
        )
        .expect("matching click monitor scale");

        assert_eq!(anchor.x, 1500);
        assert_eq!(anchor.y, 500);
        assert_eq!(anchor.width, 12);
        assert_eq!(anchor.height, 12);
    }

    #[test]
    fn logical_tray_anchor_skips_conversion_without_click_monitor() {
        let monitors = vec![MonitorScaleInfo {
            physical_x: 0,
            physical_y: 0,
            physical_width: 1920,
            physical_height: 1080,
            scale_factor: 1.0,
        }];
        let rect = tauri::Rect {
            position: tauri::Position::Logical(tauri::LogicalPosition::new(1500.0, 500.0)),
            size: tauri::Size::Logical(tauri::LogicalSize::new(12.0, 12.0)),
        };

        let anchor = resolve_tray_anchor(
            &rect,
            tauri::PhysicalPosition::new(2500.0, 500.0),
            &monitors,
        );

        assert!(anchor.is_none());
    }

    fn fake_snapshot_with(
        id: &str,
        display: &str,
        used_percent: f64,
        secondary_percent: Option<f64>,
        tertiary_percent: Option<f64>,
        cost: Option<(f64, f64)>,
    ) -> crate::commands::ProviderUsageSnapshot {
        crate::commands::ProviderUsageSnapshot {
            provider_id: id.into(),
            display_name: display.into(),
            primary: crate::commands::RateWindowSnapshot {
                used_percent,
                remaining_percent: 100.0 - used_percent,
                window_minutes: None,
                resets_at: None,
                reset_description: None,
                is_exhausted: false,
                is_informational: false,
                reserve_percent: None,
                reserve_description: None,
                reserve_will_last_to_reset: false,
                reserve_eta_seconds: None,
            },
            primary_label: None,
            secondary: secondary_percent.map(|pct| crate::commands::RateWindowSnapshot {
                used_percent: pct,
                remaining_percent: 100.0 - pct,
                window_minutes: None,
                resets_at: None,
                reset_description: None,
                is_exhausted: false,
                is_informational: false,
                reserve_percent: None,
                reserve_description: None,
                reserve_will_last_to_reset: false,
                reserve_eta_seconds: None,
            }),
            secondary_label: None,
            model_specific: None,
            tertiary: tertiary_percent.map(|pct| crate::commands::RateWindowSnapshot {
                used_percent: pct,
                remaining_percent: 100.0 - pct,
                window_minutes: None,
                resets_at: None,
                reset_description: None,
                is_exhausted: false,
                is_informational: false,
                reserve_percent: None,
                reserve_description: None,
                reserve_will_last_to_reset: false,
                reserve_eta_seconds: None,
            }),
            tertiary_label: None,
            extra_rate_windows: Vec::new(),
            reset_facts: None,
            cost: cost.map(|(used, limit)| crate::commands::CostSnapshotBridge {
                used,
                limit: Some(limit),
                remaining: Some((limit - used).max(0.0)),
                currency_code: "USD".to_string(),
                currency_symbol: None,
                period: "monthly".to_string(),
                resets_at: None,
                formatted_used: format!("${used:.2}"),
                formatted_limit: Some(format!("${limit:.2}")),
                balance: None,
                formatted_balance: None,
                daily: Vec::new(),
            }),
            plan_name: None,
            account_email: None,
            source_label: String::new(),
            updated_at: "2025-01-01T00:00:00Z".into(),
            error: None,
            error_state: quotalis_core::core::ProviderStateKind::Ready,
            pace: None,
            account_organization: None,
            tray_status_label: None,
            fetch_duration_ms: None,
            wayfinder_usage: None,
            session_equivalent_forecast: None,
        }
    }

    fn fake_snapshot(
        id: &str,
        display: &str,
        used_percent: f64,
    ) -> crate::commands::ProviderUsageSnapshot {
        fake_snapshot_with(id, display, used_percent, None, None, None)
    }

    fn fake_extra_window(percent: f64) -> crate::commands::NamedRateWindowSnapshot {
        crate::commands::NamedRateWindowSnapshot {
            id: "additional_budget".to_string(),
            title: "Additional Budget".to_string(),
            window: crate::commands::RateWindowSnapshot {
                used_percent: percent,
                remaining_percent: 100.0 - percent,
                window_minutes: None,
                resets_at: None,
                reset_description: None,
                is_exhausted: false,
                is_informational: false,
                reserve_percent: None,
                reserve_description: None,
                reserve_will_last_to_reset: false,
                reserve_eta_seconds: None,
            },
        }
    }

    #[test]
    fn pick_tray_provider_highest_picks_max_primary() {
        let a = fake_snapshot("codex", "Codex", 30.0);
        let b = fake_snapshot("claude", "Claude", 72.5);
        let c = fake_snapshot("gemini", "Gemini", 50.0);
        let refs: Vec<&crate::commands::ProviderUsageSnapshot> = vec![&a, &b, &c];

        let picked = pick_tray_provider(&refs, /* prefer_highest = */ true)
            .expect("highest mode should pick a provider");
        assert_eq!(picked.provider_id, "claude");
    }

    #[test]
    fn pick_tray_provider_first_preserves_catalog_order() {
        let a = fake_snapshot("codex", "Codex", 30.0);
        let b = fake_snapshot("claude", "Claude", 72.5);
        let refs: Vec<&crate::commands::ProviderUsageSnapshot> = vec![&a, &b];

        let picked = pick_tray_provider(&refs, /* prefer_highest = */ false)
            .expect("non-highest mode should still pick the first entry");
        assert_eq!(picked.provider_id, "codex");
    }

    #[test]
    fn pick_tray_provider_none_when_empty() {
        let refs: Vec<&crate::commands::ProviderUsageSnapshot> = vec![];
        assert!(pick_tray_provider(&refs, true).is_none());
        assert!(pick_tray_provider(&refs, false).is_none());
    }

    #[test]
    fn status_labels_per_provider_mode_lists_each_healthy_provider() {
        let settings = Settings {
            tray_icon_mode: TrayIconMode::PerProvider,
            provider_order: quotalis_core::settings::normalize_provider_order(&[
                "claude".to_string(),
                "codex".to_string(),
            ]),
            ..Settings::default()
        };
        let snapshots = vec![
            fake_snapshot("codex", "Codex", 30.0),
            fake_snapshot("claude", "Claude", 72.0),
        ];

        let labels = status_labels_for_settings(
            &settings,
            &snapshots,
            quotalis_core::settings::Language::English,
        );

        assert_eq!(
            labels,
            vec![
                ("claude".to_string(), "Claude 72%".to_string()),
                ("codex".to_string(), "Codex 30%".to_string()),
            ]
        );
    }

    #[test]
    fn status_labels_single_mode_collapses_to_selected_provider() {
        let settings = Settings {
            tray_icon_mode: TrayIconMode::Single,
            menu_bar_shows_highest_usage: true,
            ..Settings::default()
        };
        let snapshots = vec![
            fake_snapshot("codex", "Codex", 30.0),
            fake_snapshot("claude", "Claude", 72.0),
        ];

        let labels = status_labels_for_settings(
            &settings,
            &snapshots,
            quotalis_core::settings::Language::English,
        );

        assert_eq!(
            labels,
            vec![("status_summary".to_string(), "Claude 72%".to_string())]
        );
    }

    #[test]
    fn tray_icon_renderer_uses_percent_mode_when_enabled() {
        let bar_settings = Settings {
            menu_bar_shows_percent: false,
            ..Settings::default()
        };
        let percent_settings = Settings {
            menu_bar_shows_percent: true,
            ..Settings::default()
        };

        let (bar, bar_w, bar_h) =
            render_tray_icon_for_settings(&bar_settings, 72.0, Some(40.0), false);
        let (percent, pct_w, pct_h) =
            render_tray_icon_for_settings(&percent_settings, 72.0, Some(40.0), false);

        assert_eq!((bar_w, bar_h), (pct_w, pct_h));
        assert_ne!(bar, percent);
    }

    #[test]
    fn tooltip_uses_compact_status_labels() {
        let mut claude = fake_snapshot("claude", "Claude", 13.0);
        claude.primary.reset_description = Some("2h 05m".to_string());
        let mut codex = fake_snapshot("codex", "Codex", 8.0);
        codex.primary.reset_description = Some("4h 10m".to_string());

        let tooltip = build_tooltip(&[claude, codex], quotalis_core::settings::Language::English);

        assert_eq!(
            tooltip,
            "Quotalis\nClaude: 13% • Resets in 2h 05m\nCodex: 8% • Resets in 4h 10m"
        );
    }

    #[test]
    fn tooltip_skips_informational_codex_primary() {
        // Weekly-only Codex plan: the 5h lane is an informational placeholder,
        // so the tooltip must label the real weekly lane instead of echoing
        // "No active 5h session" back at the user.
        let mut codex = fake_snapshot_with("codex", "Codex", 0.0, Some(16.0), None, None);
        codex.primary.is_informational = true;
        codex.primary.reset_description = Some("No active 5h session".to_string());
        codex.secondary.as_mut().unwrap().reset_description = Some("3d 17h".to_string());

        let tooltip = build_tooltip(&[codex], quotalis_core::settings::Language::English);

        assert_eq!(tooltip, "Quotalis\nCodex: 16% • Resets in 3d 17h");
    }

    #[test]
    fn tooltip_truncates_long_provider_lines() {
        let mut claude = fake_snapshot("claude", "Claude", 13.0);
        claude.primary.reset_description =
            Some("resets in Jun 10 at 3:00PM with extra noisy suffix".to_string());

        let tooltip = build_tooltip(&[claude], quotalis_core::settings::Language::English);

        let line = tooltip.lines().nth(1).expect("provider tooltip line");
        assert!(line.starts_with("Claude: 13% • Resets in Jun 10 at 3:00PM"));
        assert!(line.ends_with("..."));
        assert!(line.chars().count() <= 53);
    }

    #[test]
    fn japanese_tooltip_localizes_error_status() {
        let mut claude = fake_snapshot("claude", "Claude", 13.0);
        claude.error = Some("network timeout".to_string());

        let tooltip = build_tooltip(&[claude], quotalis_core::settings::Language::Japanese);

        assert!(tooltip.contains("エラー"), "{tooltip}");
        assert!(!tooltip.contains(": error ("), "{tooltip}");
    }

    #[test]
    fn tray_labels_relocalize_on_language_change_without_refetch() {
        let mut claude = fake_snapshot("claude", "Claude", 13.0);
        claude.primary.resets_at =
            Some((chrono::Utc::now() + chrono::Duration::hours(2)).to_rfc3339());

        let english_tooltip = build_tooltip(
            &[claude.clone()],
            quotalis_core::settings::Language::English,
        );
        let japanese_tooltip = build_tooltip(
            &[claude.clone()],
            quotalis_core::settings::Language::Japanese,
        );

        assert!(english_tooltip.contains("Resets in"), "{english_tooltip}");
        assert!(
            japanese_tooltip.contains("リセットまで"),
            "{japanese_tooltip}"
        );
        assert!(
            !japanese_tooltip.to_ascii_lowercase().contains("resets in"),
            "{japanese_tooltip}"
        );

        let (_, english_label) =
            provider_status_label(&claude, quotalis_core::settings::Language::English);
        let (_, japanese_label) =
            provider_status_label(&claude, quotalis_core::settings::Language::Japanese);
        assert!(english_label.contains("Resets in"), "{english_label}");
        assert!(japanese_label.contains("リセットまで"), "{japanese_label}");
    }

    #[test]
    fn selected_tray_percent_uses_cursor_extra_usage_cost() {
        let mut settings = Settings::default();
        settings.set_provider_metric(ProviderId::Cursor, MetricPreference::ExtraUsage);
        let snapshot = fake_snapshot_with(
            "cursor",
            "Cursor",
            10.0,
            Some(20.0),
            Some(72.0),
            Some((15.0, 100.0)),
        );

        let (primary, secondary) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 15.0);
        assert_eq!(secondary, Some(20.0));
    }

    #[test]
    fn selected_tray_percent_tracks_extra_rate_window() {
        let mut settings = Settings::default();
        settings.set_provider_metric(ProviderId::Copilot, MetricPreference::ExtraUsage);
        let mut snapshot = fake_snapshot("copilot", "Copilot", 20.0);
        snapshot.extra_rate_windows.push(fake_extra_window(42.0));

        let (primary, secondary) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 42.0);
        assert_eq!(secondary, None);
    }

    #[test]
    fn copilot_automatic_tracks_highest_extra_rate_window() {
        let settings = Settings::default();
        let mut snapshot = fake_snapshot("copilot", "Copilot", 20.0);
        snapshot.extra_rate_windows.push(fake_extra_window(42.0));

        let (primary, _) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 42.0);
    }

    #[test]
    fn selected_tray_percent_respects_remaining_display_mode() {
        let mut settings = Settings {
            show_as_used: false,
            ..Settings::default()
        };
        settings.set_provider_metric(ProviderId::Cursor, MetricPreference::ExtraUsage);
        let snapshot = fake_snapshot_with(
            "cursor",
            "Cursor",
            10.0,
            Some(20.0),
            Some(72.0),
            Some((15.0, 100.0)),
        );

        let (primary, secondary) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 85.0);
        assert_eq!(secondary, Some(80.0));
    }

    #[test]
    fn selected_tray_percent_falls_back_when_extra_usage_missing() {
        let mut settings = Settings::default();
        settings.set_provider_metric(ProviderId::Cursor, MetricPreference::ExtraUsage);
        let snapshot = fake_snapshot_with("cursor", "Cursor", 10.0, Some(72.0), None, None);

        let (primary, _) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 72.0);
    }

    #[test]
    fn single_meaningful_secondary_quota_uses_full_single_meter() {
        let settings = Settings::default();
        let mut snapshot = fake_snapshot_with("claude", "Claude", 0.0, Some(42.0), None, None);
        snapshot.primary.is_informational = true;

        let (primary, secondary) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 42.0);
        assert_eq!(secondary, None);
    }

    #[test]
    fn selected_secondary_quota_is_not_duplicated_when_tertiary_is_meaningful() {
        let settings = Settings::default();
        let mut snapshot =
            fake_snapshot_with("claude", "Claude", 0.0, Some(42.0), Some(30.0), None);
        snapshot.primary.is_informational = true;

        let (primary, secondary) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 42.0);
        assert_eq!(secondary, Some(30.0));
    }

    #[test]
    fn two_meaningful_quotas_keep_two_meter_layout() {
        let mut settings = Settings::default();
        settings.set_provider_metric(ProviderId::Cursor, MetricPreference::Session);
        let snapshot = fake_snapshot_with("cursor", "Cursor", 15.0, Some(40.0), None, None);

        let (primary, secondary) = selected_tray_percents(&snapshot, &settings);

        assert_eq!(primary, 15.0);
        assert_eq!(secondary, Some(40.0));
    }

    #[test]
    fn informational_primary_skips_session_and_automatic_phantom_zero() {
        let mut settings = Settings::default();
        settings.set_provider_metric(ProviderId::Claude, MetricPreference::Session);
        let mut snapshot = fake_snapshot_with("claude", "Claude", 0.0, Some(42.0), None, None);
        snapshot.primary.is_informational = true;

        // Session preference must not paint the synthetic 0% primary;
        // it falls through to Automatic which prefers weekly (42%).
        let (primary, _) = selected_tray_percents(&snapshot, &settings);
        assert_eq!(primary, 42.0);
        assert_ne!(primary, 0.0);

        // Automatic also prefers weekly over informational primary.
        settings.set_provider_metric(ProviderId::Claude, MetricPreference::Automatic);
        let (primary, _) = selected_tray_percents(&snapshot, &settings);
        assert_eq!(primary, 42.0);
    }

    #[test]
    fn claude_automatic_prefers_weekly_when_model_exhausted() {
        let settings = Settings::default();
        let mut snapshot = fake_snapshot_with("claude", "Claude", 40.0, Some(22.0), None, None);
        snapshot.model_specific = Some(crate::commands::RateWindowSnapshot {
            used_percent: 100.0,
            remaining_percent: 0.0,
            window_minutes: Some(10080),
            resets_at: None,
            reset_description: None,
            is_exhausted: true,
            is_informational: false,
            reserve_percent: None,
            reserve_description: None,
            reserve_will_last_to_reset: false,
            reserve_eta_seconds: None,
        });

        let (primary, _) = selected_tray_percents(&snapshot, &settings);
        assert_eq!(primary, 22.0);

        // Explicit model override is untouched.
        let mut overridden = settings.clone();
        overridden.set_provider_metric(ProviderId::Claude, MetricPreference::Model);
        let (primary, _) = selected_tray_percents(&snapshot, &overridden);
        assert_eq!(primary, 100.0);
    }

    #[test]
    fn automatic_prefers_exhausted_weekly_over_low_session() {
        let settings = Settings::default();
        let snapshot = fake_snapshot_with("codex", "Codex", 20.0, Some(100.0), None, None);

        let (primary, _) = selected_tray_percents(&snapshot, &settings);
        assert_eq!(primary, 100.0);

        // Explicit session override still wins.
        let mut overridden = settings.clone();
        overridden.set_provider_metric(ProviderId::Codex, MetricPreference::Session);
        let (primary, _) = selected_tray_percents(&snapshot, &overridden);
        assert_eq!(primary, 20.0);
    }

    #[test]
    fn automatic_picks_highest_among_model_and_extra_windows() {
        let settings = Settings::default();
        let mut snapshot =
            fake_snapshot_with("gemini", "Gemini", 10.0, Some(30.0), Some(40.0), None);
        snapshot.model_specific = Some(crate::commands::RateWindowSnapshot {
            used_percent: 55.0,
            remaining_percent: 45.0,
            window_minutes: None,
            resets_at: None,
            reset_description: None,
            is_exhausted: false,
            is_informational: false,
            reserve_percent: None,
            reserve_description: None,
            reserve_will_last_to_reset: false,
            reserve_eta_seconds: None,
        });
        snapshot.extra_rate_windows.push(fake_extra_window(90.0));

        let (primary, _) = selected_tray_percents(&snapshot, &settings);
        assert_eq!(primary, 90.0);
    }

    #[test]
    fn f5_headline_prefers_non_informational_primary() {
        let snapshot = fake_snapshot_with("codex", "Codex", 50.0, Some(20.0), Some(30.0), None);
        let headline = codex_lane_headline_window(&snapshot);
        assert!((headline.used_percent - 50.0).abs() < f64::EPSILON);
    }

    #[test]
    fn f5_headline_falls_back_to_secondary_when_primary_informational() {
        let mut snapshot = fake_snapshot_with("codex", "Codex", 0.0, Some(25.0), Some(30.0), None);
        snapshot.primary.is_informational = true;
        let headline = codex_lane_headline_window(&snapshot);
        assert!((headline.used_percent - 25.0).abs() < f64::EPSILON);
    }

    #[test]
    fn f5_headline_falls_back_to_tertiary_when_primary_and_secondary_informational() {
        let mut snapshot = fake_snapshot_with("codex", "Codex", 0.0, Some(0.0), Some(35.0), None);
        snapshot.primary.is_informational = true;
        snapshot.secondary.as_mut().unwrap().is_informational = true;
        let headline = codex_lane_headline_window(&snapshot);
        assert!((headline.used_percent - 35.0).abs() < f64::EPSILON);
    }

    #[test]
    fn f5_headline_returns_primary_when_all_informational() {
        let mut snapshot = fake_snapshot_with("codex", "Codex", 0.0, Some(0.0), Some(0.0), None);
        snapshot.primary.is_informational = true;
        if let Some(sec) = &mut snapshot.secondary {
            sec.is_informational = true;
        }
        if let Some(ter) = &mut snapshot.tertiary {
            ter.is_informational = true;
        }
        let headline = codex_lane_headline_window(&snapshot);
        // Falls back to primary (the placeholder) when all are informational.
        assert!(headline.is_informational);
    }
}
