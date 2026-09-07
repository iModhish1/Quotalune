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

/// A named destination inside the QuotaArc product — either a tab of the
/// detached `settings` window (which — despite the label — is where most
/// real product surfaces live: Provider Display, Themes, Collections, ...)
/// or the `Dashboard`, which is the one destination that instead lives in
/// the shared `main` window as a `SurfaceMode::PopOut` transition (see
/// `PopOutPanel.tsx` and `main.rs::primary_window_request`). This is the
/// single reusable routing vocabulary for "open the app to X": tray
/// actions, sidebar navigation, and (via `open_or_focus_main_window`) any
/// future notification click or deep link. Cold launch / single-instance
/// relaunch / "last opened" instead resolve an arbitrary settings tab
/// string, OR the Dashboard, directly (see
/// `main.rs::resolve_startup_destination`/`activate_configured_destination`)
/// since "last opened" can be any supported tab, not just this curated
/// list — both paths bottom out in the same two primitives
/// (`settings_window::open_or_focus`, `reopen_to_target`), so there is
/// still only one place each kind of window actually gets
/// created/shown/focused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MainRoute {
    /// The main-window `SurfaceMode::PopOut` + `SurfaceTarget::Dashboard`
    /// surface (`PopOutPanel.tsx`) — the real, pre-existing Dashboard.
    /// Confirmed via source investigation (Wave 6 Phase 3) before adding
    /// this variant: it is not a settings tab, and no placeholder page was
    /// invented for it — this only gives the pre-existing surface a proper
    /// entry in the shared route vocabulary.
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
    /// The settings-window tab this route resolves to, or `None` when the
    /// route targets the main-window Dashboard surface instead (the only
    /// non-settings-window destination in this vocabulary).
    fn settings_tab(self) -> Option<&'static str> {
        match self {
            Self::Dashboard => None,
            Self::ProviderDisplay => Some("providerDisplay"),
            Self::Providers => Some("providers"),
            Self::Collections => Some("collections"),
            Self::Profiles => Some("profiles"),
            Self::General => Some("general"),
            Self::About => Some("about"),
        }
    }
}

/// Open (or focus) the QuotaArc destination `route`. Settings-tab routes
/// show/focus the detached `settings` window on that tab (creating it if
/// absent — see `settings_window::open_or_focus`'s lifecycle contract);
/// `MainRoute::Dashboard` instead reopens the shared `main` window to the
/// same `SurfaceMode::PopOut` + `SurfaceTarget::Dashboard` transition cold
/// launch uses (`main.rs::primary_window_request`) — one definition of
/// "the Dashboard target," reused rather than duplicated.
pub fn open_or_focus_main_window(app: &tauri::AppHandle, route: MainRoute) -> Result<(), String> {
    match route.settings_tab() {
        Some(tab) => settings_window::open_or_focus(app, tab),
        None => {
            let request = crate::primary_window_request();
            reopen_to_target(app, request.mode, request.target, request.position).map(|_| ())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellTransitionRequest {
    pub mode: SurfaceMode,
    pub target: SurfaceTarget,
    pub position: Option<(i32, i32)>,
}

pub(super) static SHELL_TRANSITION_SERIAL: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
