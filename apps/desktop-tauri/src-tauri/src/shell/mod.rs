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

/// A named destination inside the main QuotaArc workspace (the detached
/// `settings` window, which — despite the label — is where the real product
/// surfaces live: Provider Display, Themes, Collections, ...). The single
/// reusable routing vocabulary for "open the app to X": tray actions, and
/// (via `open_or_focus_main_window`) any future notification click or deep
/// link. Cold launch / single-instance relaunch / "last opened" instead
/// resolve an arbitrary settings tab string directly (see
/// `main.rs::resolve_startup_destination`) since "last opened" can be any
/// supported tab, not just this curated list — both paths bottom out in the
/// same `settings_window::open_or_focus` primitive, so there is still only
/// one place a window actually gets created/shown/focused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MainRoute {
    ProviderDisplay,
    Providers,
    /// Collections lives inside the Surfaces tab today, not yet its own
    /// top-level destination (see docs/validation/COLLECTIONS_0_10_1.md) —
    /// routing through this one variant keeps "which tab has Collections"
    /// a single fact instead of duplicated across every caller.
    Collections,
    General,
    About,
}

impl MainRoute {
    fn settings_tab(self) -> &'static str {
        match self {
            Self::ProviderDisplay => "providerDisplay",
            Self::Providers => "providers",
            Self::Collections => "surfaces",
            Self::General => "general",
            Self::About => "about",
        }
    }
}

/// Open (or focus) the main QuotaArc workspace on `route`. If the window is
/// absent this creates it; if hidden/minimized/behind other windows,
/// `settings_window::open_or_focus` already shows, unminimizes and
/// forefronts it — see that function for the exact lifecycle contract.
pub fn open_or_focus_main_window(app: &tauri::AppHandle, route: MainRoute) -> Result<(), String> {
    settings_window::open_or_focus(app, route.settings_tab())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellTransitionRequest {
    pub mode: SurfaceMode,
    pub target: SurfaceTarget,
    pub position: Option<(i32, i32)>,
}

pub(super) static SHELL_TRANSITION_SERIAL: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
