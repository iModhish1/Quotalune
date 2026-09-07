//! Centralized shell behavior: surface transitions, window positioning,
//! and helpers shared across tray, shortcut, and single-instance entry points.

use std::sync::{LazyLock, Mutex};

use crate::surface::SurfaceMode;
use crate::surface_target::SurfaceTarget;

pub mod collections_window;
pub(crate) mod dwm;
pub mod flyout_window;
mod geometry;
mod position;
pub mod settings_window;
mod transition;
mod window;

#[cfg(test)]
mod tests;

pub(crate) use position::inferred_tray_panel_position_for_monitor_size;
pub use position::{remember_current_geometry_if_eligible, tray_panel_position};
pub use transition::{reopen_to_target, transition_to_target};
pub use window::hide_to_tray_if_current;

/// A named destination inside the QuotaArc product — a tab of the detached
/// `settings` window, which is where every first-class product surface
/// lives: Dashboard, Provider Display, Themes, Collections, ... This is the
/// single reusable routing vocabulary for "open the app to X": tray
/// actions, sidebar navigation, and (via `open_or_focus_main_window`) any
/// future notification click or deep link. Cold launch / single-instance
/// relaunch / "last opened" instead resolve an arbitrary settings tab
/// string, OR a `MainRoute`, directly (see
/// `main.rs::resolve_startup_destination`/`activate_configured_destination`)
/// since "last opened" can be any supported tab, not just this curated
/// list — both paths bottom out in the same primitive
/// (`settings_window::open_or_focus`), so there is still only one place
/// this window actually gets created/shown/focused.
///
/// Dashboard was originally routed to the separate `main`-window
/// `SurfaceMode::PopOut` + `SurfaceTarget::Dashboard` surface
/// (`PopOutPanel.tsx`) as a Wave 6 Phase 3 shortcut, reusing that
/// pre-existing surface rather than inventing a placeholder page. The
/// owner later rejected that: clicking Dashboard from the Settings sidebar
/// must not spawn a separate window — it must behave like every other
/// first-class destination and render in-shell. `PopOutPanel.tsx` is
/// unchanged and still reachable as an explicit secondary "Open Dashboard
/// in Separate Window" path (via `startupDestination` and the persistent
/// global shortcut); only this named-route resolution changed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MainRoute {
    Dashboard,
    ProviderDisplay,
    Providers,
    /// A real first-class destination as of the tray/UX-reset wave (was
    /// previously nested inside the Surfaces tab behind an extra
    /// "experimental" disclosure — see docs/validation/COLLECTIONS_0_10_1.md
    /// for that history).
    Collections,
    /// A real first-class destination as of the Wave 6 UX pass — profile
    /// management previously had no main-app page at all, only tray-menu
    /// switching (see docs/validation/PROFILES_0_11_0.md).
    Profiles,
    General,
    About,
}

impl MainRoute {
    /// The settings-window tab this route resolves to. Always `Some` --
    /// every `MainRoute` is a real settings tab (see the type doc comment
    /// for Dashboard's history). Kept as `Option` rather than a bare
    /// `&'static str` so a future route that genuinely needs a
    /// non-settings-window destination can still express that here.
    fn settings_tab(self) -> Option<&'static str> {
        match self {
            // Dashboard is now a real, first-class tab of the `settings`
            // window (in-shell, alongside Provider Display/Collections/...)
            // rather than a separate `main`-window PopOut surface -- see
            // the owner's explicit "Dashboard must open inside the main
            // app" correction. `PopOutPanel.tsx` / `SurfaceTarget::Dashboard`
            // still exist as the (unchanged) "Open Dashboard in Separate
            // Window" secondary path, reachable via `startupDestination`
            // and the persistent global shortcut -- only this named-route
            // resolution (tray menu + Settings sidebar) changed.
            Self::Dashboard => Some("dashboard"),
            Self::ProviderDisplay => Some("providerDisplay"),
            Self::Providers => Some("providers"),
            Self::Collections => Some("collections"),
            Self::Profiles => Some("profiles"),
            Self::General => Some("general"),
            Self::About => Some("about"),
        }
    }
}

/// Open (or focus) the QuotaArc destination `route`: shows/focuses the
/// detached `settings` window on the route's tab, creating it if absent —
/// see `settings_window::open_or_focus`'s lifecycle contract. Every
/// `MainRoute` (Dashboard included) resolves to a real settings tab; the
/// separate `main`-window PopOut Dashboard surface (`PopOutPanel.tsx`) is
/// reached through a different path entirely now (`startupDestination`,
/// the persistent global shortcut) — not through this named-route
/// vocabulary.
pub fn open_or_focus_main_window(app: &tauri::AppHandle, route: MainRoute) -> Result<(), String> {
    settings_window::open_or_focus(
        app,
        route
            .settings_tab()
            .expect("every MainRoute is a settings tab"),
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellTransitionRequest {
    pub mode: SurfaceMode,
    pub target: SurfaceTarget,
    pub position: Option<(i32, i32)>,
}

pub(super) static SHELL_TRANSITION_SERIAL: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
