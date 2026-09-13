#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use std::time::Duration;

mod auto_refresh;
mod coding_activity;
mod collection_settings;
mod command_profiles;
mod commands;
mod events;
mod floatbar;
mod geometry_store;
mod history_recorder;
mod powertoys;
mod proof_harness;
mod provider_tray;
mod provider_tray_tokens;
mod shell;
mod shortcut_bridge;
mod state;
mod surface;
mod surface_kit;
mod surface_target;
mod surfaces;
mod tray_bridge;
mod tray_menu;
mod tray_visibility;
mod usage_metric;
mod window_positioner;

use std::sync::Mutex;

use state::AppState;
use surface::SurfaceMode;
use surface_target::SurfaceTarget;
use tauri::{Manager, path::BaseDirectory};

const PROOF_ACTIVATION_DELAY: Duration = Duration::from_millis(0);
const VISIBLE_START_ACTIVATION_DELAY: Duration = Duration::from_millis(500);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LaunchBehavior {
    /// Open the compact Pop Out Dashboard: forced-visible (debug/test) or an
    /// explicit tray/menu-bar CLI launch. Unaffected by `startup_destination`
    /// — a user who explicitly asked for the tray view gets the tray view.
    open_primary_window_at_start: bool,
    /// A plain desktop launch (double-click / Start Menu, no CLI args, not
    /// minimized, no compact overlay enabled): open the main Settings
    /// workspace directly per `startup_destination`, instead of the old
    /// PopOut dashboard the user has to click through from.
    open_main_workspace_at_start: bool,
    suppress_blur_dismiss: bool,
}

/// Resolve what a plain desktop launch should open, from `startup_destination`:
/// `None` means "the compact Pop Out Dashboard" (the old default surface,
/// still available as an explicit choice); `Some(tab)` means "the main
/// Settings workspace, on this tab". Falls back safely for "lastOpened" with
/// no (or an unknown/stale) remembered tab, and for any value
/// `normalize_startup_destination` wouldn't otherwise recognize.
pub(crate) fn resolve_startup_destination(
    settings: &quotalis_core::settings::Settings,
) -> Option<String> {
    const DEFAULT_TAB: &str = "providerDisplay";
    match settings.startup_destination.as_str() {
        "dashboard" => None,
        "lastOpened" => Some(
            settings
                .last_settings_tab
                .as_deref()
                .filter(|tab| surface_target::is_supported_settings_tab(tab))
                .unwrap_or(DEFAULT_TAB)
                .to_string(),
        ),
        _ => Some(DEFAULT_TAB.to_string()),
    }
}

/// Open/focus whatever `startup_destination` currently resolves to: the main
/// Settings workspace on the resolved tab, or (destination "dashboard") the
/// compact Pop Out Dashboard. The single reusable "activate the app the way
/// the user configured" action — used by cold launch, single-instance
/// relaunch, and the tray icon's left-click (all three previously
/// duplicated this branch, and the relaunch/left-click paths had each
/// independently drifted from the cold-launch fix — see Phase-1/tray-reset
/// commits). Reloads settings fresh so a change made after this process
/// started (via the Settings UI) is honored immediately.
pub(crate) fn activate_configured_destination(app: &tauri::AppHandle) {
    let current = quotalis_core::settings::Settings::load();
    match resolve_startup_destination(&current) {
        Some(tab) => {
            let _ = shell::settings_window::open_or_focus(app, &tab);
        }
        None => {
            let request = primary_window_request();
            let _ = shell::reopen_to_target(app, request.mode, request.target, request.position);
        }
    }
}

fn should_hide_close_request(mode: SurfaceMode) -> bool {
    matches!(
        mode,
        SurfaceMode::TrayPanel | SurfaceMode::PopOut | SurfaceMode::Settings
    )
}

pub(crate) fn primary_window_request() -> shell::ShellTransitionRequest {
    shell::ShellTransitionRequest {
        mode: SurfaceMode::PopOut,
        target: SurfaceTarget::Dashboard,
        position: None,
    }
}

fn should_open_primary_window_from_args<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().any(|arg| {
        let normalized = arg
            .as_ref()
            .trim()
            .trim_start_matches(['-', '/'])
            .replace(['-', '_'], "")
            .to_ascii_lowercase();
        matches!(normalized.as_str(), "menubar" | "traypanel" | "tray")
    })
}

fn nonblank_launch_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .map(|arg| arg.as_ref().trim().to_string())
        .filter(|arg| !arg.is_empty())
        .collect()
}

/// What a second launch attempt (caught by the single-instance plugin, while
/// this process is already running) should activate: the compact Pop Out
/// Dashboard for an explicit tray/menu-bar re-launch (same as a first-launch
/// explicit request), or the main Settings workspace — per
/// `startup_destination`, exactly like a fresh plain launch — for a plain
/// re-launch (clicking the Start Menu / desktop icon again). `None` for
/// unrelated CLI invocations (e.g. `quotaarc usage -p claude`), which must
/// not raise any window.
#[derive(Debug, Clone, PartialEq, Eq)]
enum InstanceActivation {
    None,
    CompactSurface,
    MainWorkspace,
    Notification(quotalis_core::notifications::NotificationDestination),
}

fn instance_activation<I, S>(args: I) -> InstanceActivation
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let args = nonblank_launch_args(args);
    if let Some(destination) = args
        .iter()
        .find_map(|arg| quotalis_core::notifications::parse_notification_uri(arg))
    {
        InstanceActivation::Notification(destination)
    } else if args.is_empty() {
        InstanceActivation::MainWorkspace
    } else if should_open_primary_window_from_args(&args) {
        InstanceActivation::CompactSurface
    } else {
        InstanceActivation::None
    }
}

fn activate_notification_destination(
    app: &tauri::AppHandle,
    destination: quotalis_core::notifications::NotificationDestination,
) {
    use quotalis_core::notifications::NotificationDestination;

    let result = match destination {
        NotificationDestination::Dashboard => {
            shell::open_or_focus_main_window(app, shell::MainRoute::Dashboard)
        }
        NotificationDestination::Provider(provider) => shell::reopen_to_target(
            app,
            SurfaceMode::PopOut,
            SurfaceTarget::Provider {
                provider_id: provider.cli_name().to_string(),
            },
            None,
        )
        .map(|_| ()),
        NotificationDestination::Providers(provider) => {
            shell::settings_window::open_or_focus_provider(app, "providers", Some(provider))
        }
    };

    if let Err(error) = result {
        tracing::warn!(?destination, %error, "failed to activate notification destination");
    }
}

fn launch_behavior<I, S>(
    force_visible: bool,
    start_minimized: bool,
    compact_surface_enabled: bool,
    args: I,
) -> LaunchBehavior
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let args = nonblank_launch_args(args);
    let explicit_primary_launch = should_open_primary_window_from_args(&args);
    let plain_desktop_launch = args.is_empty();
    // A compact QuotaArc surface is itself the non-interrupting desktop
    // launch. Do not also raise a window over the user's work in that case;
    // an explicit tray/menu launch or a plain desktop launch still opens one.
    let unattended_by_compact_surface = !start_minimized && !compact_surface_enabled;

    LaunchBehavior {
        open_primary_window_at_start: force_visible || explicit_primary_launch,
        open_main_workspace_at_start: plain_desktop_launch && unattended_by_compact_surface,
        suppress_blur_dismiss: force_visible,
    }
}

fn should_suppress_blur_dismiss(launch: LaunchBehavior, proof_mode: bool) -> bool {
    launch.suppress_blur_dismiss || proof_mode
}

/// Build provenance constants, embedded at compile time by build.rs.
pub mod build_info {
    pub const COMMIT: &str = env!("QA_BUILD_COMMIT");
    pub const DIRTY: &str = env!("QA_BUILD_DIRTY");
    pub const TIMESTAMP: &str = env!("QA_BUILD_TIMESTAMP");
    pub const ARCH: &str = env!("QA_BUILD_ARCH");
    pub const CHANNEL: &str = if cfg!(feature = "dev-channel") {
        "dev"
    } else {
        "stable"
    };
}

fn channel_launch_is_safe(dev_channel: bool, proof_requested: bool, exe_name: &str) -> bool {
    dev_channel || (!proof_requested && !exe_name.eq_ignore_ascii_case("QuotalisDev.exe"))
}

fn channel_identity_is_safe(identifier: &str, expected: &str) -> bool {
    !identifier.is_empty() && identifier == expected
}

fn main() {
    // One embedded context is used for diagnostics, the pre-side-effect guard,
    // and the actual app. Cargo's dev-channel feature alone does not change
    // Tauri's single-instance mutex or WebView data identity.
    let mut context = tauri::generate_context!();
    if quotalis_core::paths::is_dev_channel() {
        // A partial app.windows override replaces the entire base array in
        // Tauri's JSON merge. Change only the title, retaining hidden/dark and
        // all other native window settings from the canonical base config.
        for window in &mut context.config_mut().app.windows {
            if window.label == "main" {
                window.title = "Quotalis Dev".to_string();
            }
        }
    }
    // `--print-channel`: a pure, side-effect-free diagnostic exit -- no
    // logging init, no settings load, no registry/notification
    // registration, no window. Lets an external preflight script (see
    // `scripts/dev-preflight.mjs`) PROVE which channel a compiled binary
    // is before ever performing a real launch, instead of trusting the
    // filename alone (the exact gap the Product V3 Personal-channel
    // incident exposed -- see docs/validation/PRODUCT_V3_CHANNEL_INCIDENT.md).
    if std::env::args().skip(1).any(|a| a == "--print-channel") {
        let exe_name = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
            .unwrap_or_default();
        println!(
            "channel={}",
            if quotalis_core::paths::is_dev_channel() {
                "dev"
            } else {
                "stable"
            }
        );
        println!("exe={exe_name}");
        println!("app_dir_name={}", quotalis_core::paths::APP_DIR_NAME);
        println!("tauri_identifier={}", context.config().identifier);
        std::process::exit(0);
    }
    // `--print-build-info`: a second pure diagnostic, same shape and
    // guarantees as `--print-channel` above, for the freshness proof in
    // `scripts/build-dev-verified.mjs` -- reuses the `build_info`
    // constants build.rs already embeds for the About page, so this is
    // exposing existing provenance, not adding a new one.
    if std::env::args().skip(1).any(|a| a == "--print-build-info") {
        let exe_name = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
            .unwrap_or_default();
        println!("channel={}", build_info::CHANNEL);
        println!("git_head={}", build_info::COMMIT);
        println!("git_dirty={}", build_info::DIRTY);
        println!("version={}", env!("CARGO_PKG_VERSION"));
        println!("exe={exe_name}");
        println!("tauri_identifier={}", context.config().identifier);
        std::process::exit(0);
    }
    if !channel_identity_is_safe(
        &context.config().identifier,
        quotalis_core::paths::TOAST_AUMID,
    ) {
        eprintln!("Refusing mixed channel/Tauri identity. Use the verified Dev build workflow.");
        std::process::exit(2);
    }
    // Fail before logs, settings, registry registration or migrations can touch
    // Personal. A Dev filename/config alone is not a Rust channel boundary.
    let exe_name = std::env::current_exe()
        .ok()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
        .unwrap_or_default();
    if !channel_launch_is_safe(
        quotalis_core::paths::is_dev_channel(),
        [
            "CODEXBAR_PROOF_MODE",
            "CODEXBAR_SEED_USAGE_JSON",
            "CODEXBAR_SEED_PROVIDERS_JSON",
        ]
        .iter()
        .any(|name| std::env::var_os(name).is_some()),
        &exe_name,
    ) {
        eprintln!("Refusing non-isolated Dev/proof launch. Rebuild with --features dev-channel.");
        std::process::exit(2);
    }
    // Per-process log file names: the shell writes codexbar-desktop.log so
    // its cached handle never blocks the CLI's rotation on Windows.
    // SAFETY: the context helper thread has joined; application threads have
    // not started, so no concurrent application env access exists.
    unsafe { std::env::set_var("CODEXBAR_PROCESS", "desktop") };
    quotalis_core::logging::install_panic_hook();
    quotalis_core::logging::init(false, false).expect("failed to initialize logging");

    let proof_config = proof_harness::ProofConfig::from_env();
    let is_proof_mode = proof_config.is_some();
    let force_start_visible = std::env::var_os("CODEXBAR_START_VISIBLE").is_some();
    let settings = quotalis_core::settings::Settings::load();
    let launch_args = std::env::args().skip(1).collect::<Vec<_>>();
    let notification_activation = launch_args
        .iter()
        .find_map(|arg| quotalis_core::notifications::parse_notification_uri(arg));
    let launch = launch_behavior(
        force_start_visible,
        settings.start_minimized,
        settings.top_arc_enabled,
        &launch_args,
    );

    let mut initial_state = AppState::new();
    initial_state.notification_manager =
        quotalis_core::notifications::NotificationManager::load_persisted();
    initial_state.proof_config = proof_config;
    // Proof-harness seed: CODEXBAR_SEED_USAGE_JSON plants one synthetic Codex
    // ProviderUsageSnapshot before the event loop and any WebView read. The
    // cache timestamp makes the seeded cache count as fresh so the first
    // frontend refresh-if-stale call does not evict the synthetic data.
    if let Some(snapshot) = proof_harness::seed_usage_snapshot_from_env() {
        tracing::info!(
            "proof-harness: seeded provider snapshot for '{}'",
            snapshot.provider_id
        );
        initial_state.provider_cache.push(snapshot);
        initial_state.provider_cache_updated_at = Some(std::time::Instant::now());
    }
    // Proof-only multi-provider bundle: pins several synthetic providers so
    // usage modes, orbital layouts, and multi-node behavior are provable
    // without credentials. Empty unless the env var is set.
    let bundle = proof_harness::providers_bundle_from_env();
    if !bundle.is_empty() {
        tracing::info!(
            "proof-harness: seeded {} provider(s) from {}",
            bundle.len(),
            proof_harness::SEED_PROVIDERS_ENV_VAR
        );
        for snapshot in bundle {
            initial_state.provider_cache.push(snapshot);
        }
        initial_state.provider_cache_updated_at = Some(std::time::Instant::now());
    }

    tauri::Builder::default()
        .manage(Mutex::new(initial_state))
        .plugin(shortcut_bridge::plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(
            |app, args, _cwd| match instance_activation(args.iter().skip(1)) {
                InstanceActivation::MainWorkspace => {
                    activate_configured_destination(app);
                }
                InstanceActivation::CompactSurface => {
                    let request = primary_window_request();
                    let _ = shell::reopen_to_target(
                        app,
                        request.mode,
                        request.target,
                        request.position,
                    );
                }
                InstanceActivation::Notification(destination) => {
                    activate_notification_destination(app, destination);
                }
                InstanceActivation::None => {}
            },
        ))
        .invoke_handler(tauri::generate_handler![
            commands::list_workspace_backgrounds,
            commands::read_workspace_background,
            commands::import_workspace_background,
            commands::remove_workspace_background,
            commands::get_bootstrap_state,
            commands::get_provider_catalog,
            commands::get_settings_snapshot,
            commands::get_dashboard_snapshot,
            commands::list_agent_sessions,
            commands::focus_agent_session,
            commands::update_settings,
            commands::set_surface_mode,
            commands::dismiss_tray_panel,
            commands::begin_flyout_gesture,
            commands::end_flyout_gesture,
            commands::reveal_tray_panel_window,
            commands::open_settings_window,
            commands::open_dashboard,
            commands::open_flyout_window,
            commands::close_settings_window,
            commands::open_collections_window,
            commands::close_collections_window,
            commands::toggle_collections_window,
            commands::set_flyout_size,
            commands::flyout_stored_size,
            commands::get_current_surface_state,
            commands::refresh_providers,
            commands::refresh_providers_if_stale,
            commands::get_cached_providers,
            commands::get_provider_instances,
            commands::get_deepseek_pricing_status,
            commands::codex_accounts_list,
            commands::codex_account_add,
            commands::codex_account_remove,
            commands::codex_account_switch,
            commands::codex_account_fetch,
            commands::codex_account_snapshots,
            commands::codex_account_restart_desktop,
            commands::get_codex_accounts_state,
            commands::get_credential_storage_status,
            commands::get_update_state,
            commands::check_for_updates,
            commands::download_update,
            commands::apply_update,
            commands::dismiss_update,
            commands::open_release_page,
            commands::get_api_keys,
            commands::get_api_key_providers,
            commands::set_api_key,
            commands::remove_api_key,
            commands::get_manual_cookies,
            commands::set_manual_cookie,
            commands::remove_manual_cookie,
            commands::list_detected_browsers,
            commands::import_browser_cookies,
            commands::get_token_account_providers,
            commands::get_token_accounts,
            commands::add_token_account,
            commands::remove_token_account,
            commands::set_active_token_account,
            commands::get_app_info,
            commands::get_safe_diagnostics,
            commands::get_provider_chart_data,
            commands::get_provider_local_usage_summary,
            commands::get_usage_spend_summary,
            commands::write_usage_spend_export,
            commands::get_spend_contract,
            commands::get_codex_workspaces_snapshot,
            commands::get_analytics_source_registry,
            commands::reorder_providers,
            commands::set_provider_cookie_source,
            commands::set_provider_usage_source,
            commands::has_openrouter_management_api_key,
            commands::set_openrouter_management_api_key,
            commands::remove_openrouter_management_api_key,
            commands::get_provider_cookie_source_options,
            commands::set_provider_region,
            commands::get_provider_region_options,
            commands::set_provider_workspace_id,
            commands::set_provider_gateway_url,
            commands::get_provider_workspace_id,
            commands::get_gemini_cli_signed_in,
            commands::get_vertexai_status,
            commands::list_jetbrains_detected_ides,
            commands::set_jetbrains_ide_path,
            commands::get_kiro_status,
            commands::register_global_shortcut,
            commands::unregister_global_shortcut,
            commands::get_work_area_rect,
            commands::play_notification_sound,
            commands::send_test_notification,
            commands::get_notification_history,
            commands::mark_notification_read,
            commands::mark_all_notifications_read,
            commands::open_external_url,
            commands::reanchor_tray_panel,
            commands::quit_app,
            commands::open_provider_dashboard,
            commands::open_provider_status_page,
            commands::get_provider_detail,
            commands::trigger_provider_login,
            commands::cancel_provider_login,
            commands::revoke_provider_credentials,
            commands::get_available_languages,
            commands::get_locale_strings,
            commands::set_ui_language,
            commands::open_path,
            tray_visibility::tray_visibility_status,
            floatbar::show_float_bar,
            floatbar::hide_float_bar,
            floatbar::set_float_bar_opacity,
            floatbar::set_float_bar_click_through,
            floatbar::resize_float_bar,
            floatbar::set_float_bar_orientation,
            surfaces::show_edge_arc_surface,
            surfaces::hide_edge_arc_surface,
            surfaces::show_top_arc_surface,
            surfaces::hide_top_arc_surface,
            surfaces::resize_edge_arc_surface,
            surfaces::resize_top_arc_surface,
            surfaces::begin_top_arc_drag,
            surfaces::reset_top_arc_position,
            surfaces::show_taskbar_arc_surface,
            surfaces::hide_taskbar_arc_surface,
            surfaces::resize_taskbar_arc_surface,
            surfaces::update_surface_settings,
            surfaces::get_surface_settings,
            collection_settings::get_collection_layout,
            collection_settings::set_collection_layout,
            surfaces::demo::get_surface_demo_mode,
            surfaces::demo::set_surface_demo_mode,
            command_profiles::get_profile_store,
            command_profiles::switch_profile,
            command_profiles::create_profile,
            command_profiles::rename_profile,
            command_profiles::duplicate_profile,
            command_profiles::delete_profile,
            command_profiles::reorder_profiles,
            command_profiles::update_profile,
            command_profiles::add_account,
            command_profiles::update_account,
            command_profiles::set_account_profile_membership,
            command_profiles::remove_account,
            command_profiles::set_privacy_mode,
            command_profiles::set_catalog_theme,
            command_profiles::set_usage_settings,
            command_profiles::set_provider_detail_window,
            command_profiles::set_provider_limit_order,
            command_profiles::set_provider_limit_presentation,
            command_profiles::set_global_limit_presentation,
            command_profiles::set_reset_presentation,
            command_profiles::set_reset_presentation_surface_override,
            proof_harness::show_notification_proof,
            proof_harness::get_provider_tray_proof,
        ])
        .setup(move |app| {
            if let Ok(icon_path) = app
                .path()
                .resolve("quotalis-icon-128.png", BaseDirectory::Resource)
            {
                quotalis_core::notifications::configure_toast_icon(icon_path);
            }
            if let Some(window) = app.get_webview_window("main") {
                shell::dwm::force_dark_caption(&window);
                window.hide()?;
            }
            tray_bridge::setup(app)?;
            shortcut_bridge::register(app.handle());
            floatbar::install(app.handle());
            surfaces::install(app.handle());
            crate::history_recorder::prune_on_startup();
            auto_refresh::install(app.handle().clone());
            if settings.powertoys_status_pipe_enabled {
                powertoys::install(app.handle().clone());
            }

            // Give the WebView/event loop one turn to finish startup before
            // routing shortcut launches into the tray panel. Without this, the
            // Windows shell can leave only Tauri's tiny internal window visible.
            if is_proof_mode {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(PROOF_ACTIVATION_DELAY).await;
                    proof_harness::activate(&app_handle);
                });
            } else if let Some(destination) = notification_activation {
                let app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(VISIBLE_START_ACTIVATION_DELAY).await;
                    activate_notification_destination(&app, destination);
                });
            } else if launch.open_main_workspace_at_start {
                let app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(VISIBLE_START_ACTIVATION_DELAY).await;
                    activate_configured_destination(&app);
                });
            } else if launch.open_primary_window_at_start {
                let app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(VISIBLE_START_ACTIVATION_DELAY).await;
                    let request = primary_window_request();
                    let _ = shell::reopen_to_target(
                        &app,
                        request.mode,
                        request.target,
                        request.position,
                    );
                });
            }

            Ok(())
        })
        .on_window_event(move |window, event| {
            if floatbar::handle_window_event(window, event) {
                return;
            }
            if surfaces::handle_window_event(window, event) {
                return;
            }
            if shell::flyout_window::handle_window_event(window, event) {
                return;
            }
            // Only the main window participates in blur-dismiss and close-to-hide.
            // The detached settings window uses normal OS close behavior.
            if window.label() != "main" {
                return;
            }
            match event {
                tauri::WindowEvent::Focused(false) => {
                    // Suppress blur-dismiss in proof mode so the window stays
                    // visible for automated screenshot capture.
                    if should_suppress_blur_dismiss(
                        launch,
                        proof_harness::is_proof_mode(window.app_handle()),
                    ) {
                        return;
                    }
                    if let Some(st) = window.app_handle().try_state::<Mutex<AppState>>()
                        && st
                            .lock()
                            .unwrap()
                            .take_startup_tray_blur_grace(std::time::Instant::now())
                    {
                        return;
                    }
                    // Grace period: ignore blur within 500ms of showing the panel.
                    // On Windows, the tray click can cause a spurious blur before
                    // the window fully acquires focus.
                    if let Some(st) = window.app_handle().try_state::<Mutex<AppState>>()
                        && st.lock().unwrap().was_tray_panel_recently_shown(
                            std::time::Instant::now(),
                            Duration::from_millis(500),
                        )
                    {
                        return;
                    }
                    // Gesture guard: ignore blur while a resize-grip drag or
                    // HTML5 drag-reorder is running its Win32/OLE modal loop.
                    // Windows produces a spurious Focused(false) the instant
                    // such a loop starts even though the user never left the
                    // window; see AppState::begin_gesture_blur_guard.
                    if let Some(st) = window.app_handle().try_state::<Mutex<AppState>>()
                        && st
                            .lock()
                            .unwrap()
                            .is_gesture_blur_guard_active(std::time::Instant::now())
                    {
                        return;
                    }
                    // Blur in TrayPanel mode → auto-hide. Record successful
                    // dismissals so the same tray click cannot reopen it.
                    if matches!(
                        shell::hide_to_tray_if_current(window.app_handle(), |mode| {
                            mode == SurfaceMode::TrayPanel
                        }),
                        Ok(Some(_))
                    ) && let Some(st) = window.app_handle().try_state::<Mutex<AppState>>()
                    {
                        st.lock()
                            .unwrap()
                            .mark_blur_dismissed(std::time::Instant::now());
                    }
                }
                tauri::WindowEvent::Focused(true) => {
                    // A genuine refocus (after the gesture's own focus flicker
                    // has settled) re-arms the gesture guard so a later
                    // outside-click blur dismisses immediately again.
                    if let Some(st) = window.app_handle().try_state::<Mutex<AppState>>() {
                        st.lock()
                            .unwrap()
                            .clear_gesture_guard_on_refocus(std::time::Instant::now());
                    }
                }
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    let settings_visible = window
                        .app_handle()
                        .try_state::<Mutex<AppState>>()
                        .is_some_and(|state| {
                            state.lock().unwrap().surface_machine.current() == SurfaceMode::Settings
                        });
                    if settings_visible
                        && let Some(webview) =
                            window.app_handle().get_webview_window(window.label())
                    {
                        shell::settings_window::enforce_minimum_content_size(&webview);
                    }
                    // Capture geometry for surfaces eligible for persistence.
                    // The helper is a no-op when the current surface is not eligible.
                    shell::remember_current_geometry_if_eligible(window);
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Close visible shell surfaces → hide instead of quitting.
                    if matches!(
                        shell::hide_to_tray_if_current(
                            window.app_handle(),
                            should_hide_close_request
                        ),
                        Ok(Some(_))
                    ) {
                        api.prevent_close();
                    }
                }
                _ => {}
            }
        })
        .run(context)
        .expect("failed to run CodexBar desktop shell");
}

#[cfg(test)]
mod tests {
    #[test]
    fn channel_identity_rejects_mixed_and_missing_config() {
        let dev = "app.quotalis.desktop.dev";
        let personal = "app.quotaarc.desktop";
        assert!(super::channel_identity_is_safe(dev, dev));
        assert!(super::channel_identity_is_safe(personal, personal));
        assert!(!super::channel_identity_is_safe(personal, dev));
        assert!(!super::channel_identity_is_safe(dev, personal));
        assert!(!super::channel_identity_is_safe("", dev));
        assert!(!super::channel_identity_is_safe("", ""));
        assert!(!super::channel_identity_is_safe(
            "app.quotaarc.desktop.dev",
            dev
        ));
    }

    #[test]
    fn development_launch_cannot_access_personal_channel() {
        assert!(!super::channel_launch_is_safe(
            false,
            false,
            "QuotalisDev.exe"
        ));
        assert!(!super::channel_launch_is_safe(false, true, "Quotalis.exe"));
        assert!(super::channel_launch_is_safe(true, true, "QuotalisDev.exe"));
        assert!(super::channel_launch_is_safe(false, false, "Quotalis.exe"));
    }

    use super::*;

    #[test]
    fn close_request_hides_tray_first_surfaces() {
        assert!(should_hide_close_request(SurfaceMode::TrayPanel));
        assert!(should_hide_close_request(SurfaceMode::PopOut));
        assert!(should_hide_close_request(SurfaceMode::Settings));
    }

    #[test]
    fn close_request_leaves_hidden_surface_alone() {
        assert!(!should_hide_close_request(SurfaceMode::Hidden));
    }

    #[test]
    fn primary_window_request_targets_popout_dashboard() {
        let request = primary_window_request();
        assert_eq!(request.mode, SurfaceMode::PopOut);
        assert_eq!(request.target, SurfaceTarget::Dashboard);
        assert_eq!(request.position, None);
    }

    #[test]
    fn menubar_launch_arg_opens_primary_window() {
        assert!(should_open_primary_window_from_args(["menubar"]));
        assert!(should_open_primary_window_from_args(["--tray-panel"]));
        assert!(should_open_primary_window_from_args(["/tray_panel"]));
    }

    #[test]
    fn unrelated_launch_args_do_not_open_primary_window() {
        assert!(!should_open_primary_window_from_args([
            "usage", "-p", "claude"
        ]));
        assert_eq!(
            instance_activation(["usage", "-p", "claude"]),
            InstanceActivation::None
        );
        assert_eq!(
            launch_behavior(false, false, false, ["usage", "-p", "claude"]),
            LaunchBehavior {
                open_primary_window_at_start: false,
                open_main_workspace_at_start: false,
                suppress_blur_dismiss: false,
            }
        );
    }

    #[test]
    fn plain_desktop_launch_opens_the_main_workspace_unless_start_minimized() {
        // A plain double-click/Start Menu launch opens the main Settings
        // workspace directly (per startup_destination), not the old compact
        // Pop Out Dashboard the user had to click through from.
        assert_eq!(
            launch_behavior(false, false, false, std::iter::empty::<&str>()),
            LaunchBehavior {
                open_primary_window_at_start: false,
                open_main_workspace_at_start: true,
                suppress_blur_dismiss: false,
            }
        );
        assert_eq!(
            launch_behavior(false, false, false, [""]),
            LaunchBehavior {
                open_primary_window_at_start: false,
                open_main_workspace_at_start: true,
                suppress_blur_dismiss: false,
            }
        );
        assert_eq!(
            launch_behavior(false, false, false, ["  "]),
            LaunchBehavior {
                open_primary_window_at_start: false,
                open_main_workspace_at_start: true,
                suppress_blur_dismiss: false,
            }
        );
        assert_eq!(
            launch_behavior(false, true, false, std::iter::empty::<&str>()),
            LaunchBehavior {
                open_primary_window_at_start: false,
                open_main_workspace_at_start: false,
                suppress_blur_dismiss: false,
            }
        );
    }

    #[test]
    fn compact_surface_launch_stays_out_of_the_way() {
        assert_eq!(
            launch_behavior(false, false, true, std::iter::empty::<&str>()),
            LaunchBehavior {
                open_primary_window_at_start: false,
                open_main_workspace_at_start: false,
                suppress_blur_dismiss: false,
            }
        );
    }

    #[test]
    fn single_instance_plain_relaunch_activates_the_main_workspace() {
        // Clicking QuotaArc again while it's already running must restore/
        // focus the main workspace, not spawn the old compact dashboard.
        assert_eq!(
            instance_activation(std::iter::empty::<&str>()),
            InstanceActivation::MainWorkspace
        );
        assert_eq!(instance_activation([""]), InstanceActivation::MainWorkspace);
        assert_eq!(
            instance_activation(["  "]),
            InstanceActivation::MainWorkspace
        );
    }

    #[test]
    fn single_instance_explicit_tray_relaunch_activates_the_compact_surface() {
        assert_eq!(
            instance_activation(["menubar"]),
            InstanceActivation::CompactSurface
        );
    }

    #[test]
    fn notification_links_take_priority_over_normal_launch_arguments() {
        use quotalis_core::core::ProviderId;
        use quotalis_core::notifications::{NotificationDestination, notification_uri};

        let destination = NotificationDestination::Provider(ProviderId::Codex);
        let uri = notification_uri(destination);
        assert_eq!(
            instance_activation(["menubar", uri.as_str()]),
            InstanceActivation::Notification(destination)
        );
    }

    #[test]
    fn invalid_or_cross_channel_notification_links_never_activate_a_surface() {
        let other_scheme = if quotalis_core::paths::is_dev_channel() {
            "quotalis"
        } else {
            "quotalis-dev"
        };
        assert_eq!(
            instance_activation([format!("{other_scheme}://dashboard")]),
            InstanceActivation::None
        );
        assert_eq!(
            instance_activation([format!(
                "{}://provider/not-a-provider",
                quotalis_core::notifications::notification_protocol_scheme()
            )]),
            InstanceActivation::None
        );
    }

    #[test]
    fn menubar_launch_does_not_suppress_blur_dismiss() {
        assert_eq!(
            launch_behavior(false, true, false, ["menubar"]),
            LaunchBehavior {
                open_primary_window_at_start: true,
                open_main_workspace_at_start: false,
                suppress_blur_dismiss: false,
            }
        );
    }

    #[test]
    fn automation_launch_opens_and_suppresses_blur_dismiss() {
        let launch = launch_behavior(true, true, false, std::iter::empty::<&str>());
        assert_eq!(
            launch,
            LaunchBehavior {
                open_primary_window_at_start: true,
                open_main_workspace_at_start: false,
                suppress_blur_dismiss: true,
            }
        );
        assert!(should_suppress_blur_dismiss(launch, false));
    }

    #[test]
    fn proof_mode_suppresses_blur_dismiss() {
        let launch = launch_behavior(false, true, false, std::iter::empty::<&str>());
        assert!(should_suppress_blur_dismiss(launch, true));
    }

    fn settings_with(
        startup_destination: &str,
        last_settings_tab: Option<&str>,
    ) -> quotalis_core::settings::Settings {
        quotalis_core::settings::Settings {
            startup_destination: startup_destination.to_string(),
            last_settings_tab: last_settings_tab.map(str::to_string),
            ..quotalis_core::settings::Settings::default()
        }
    }

    #[test]
    fn startup_destination_dashboard_opens_the_compact_surface_instead_of_settings() {
        assert_eq!(
            resolve_startup_destination(&settings_with("dashboard", None)),
            None
        );
    }

    #[test]
    fn startup_destination_provider_display_opens_settings_on_that_tab() {
        assert_eq!(
            resolve_startup_destination(&settings_with("providerDisplay", None)),
            Some("providerDisplay".to_string())
        );
    }

    #[test]
    fn startup_destination_last_opened_restores_the_remembered_tab() {
        assert_eq!(
            resolve_startup_destination(&settings_with("lastOpened", Some("themes"))),
            Some("themes".to_string())
        );
    }

    #[test]
    fn startup_destination_last_opened_falls_back_when_nothing_was_remembered_yet() {
        assert_eq!(
            resolve_startup_destination(&settings_with("lastOpened", None)),
            Some("providerDisplay".to_string())
        );
    }

    #[test]
    fn startup_destination_last_opened_falls_back_on_a_stale_unknown_tab() {
        // e.g. a tab renamed/removed in a later release than remembered it.
        assert_eq!(
            resolve_startup_destination(&settings_with("lastOpened", Some("apiKeys"))),
            Some("providerDisplay".to_string())
        );
    }

    #[test]
    fn startup_destination_invalid_value_falls_back_to_provider_display() {
        // normalize_startup_destination already repairs this on load, but the
        // resolver stays safe even if it's ever handed a raw, unnormalized value.
        assert_eq!(
            resolve_startup_destination(&settings_with("garbage", Some("themes"))),
            Some("providerDisplay".to_string())
        );
    }

    #[test]
    fn visible_start_delays_stay_short() {
        assert_eq!(PROOF_ACTIVATION_DELAY, Duration::ZERO);
        assert!(VISIBLE_START_ACTIVATION_DELAY <= Duration::from_millis(500));
    }
}
