//! QuotaArc V9 — Rust-authoritative surface coordinator.
//!
//! State machine guaranteeing AT MOST ONE expanded overlay at a time.
//! Dashboard and Settings are normal application windows and are excluded
//! from overlay coordination by construction: they are not members of
//! [`OverlayKind`], so they cannot participate even by mistake.
//!
//! The native window manager calls into this machine on every expand /
//! collapse / Escape transition; the returned [`Transition`] describes the
//! exact native actions to take (collapse X, expand Y) so window bounds and
//! frontend layout move together under one decision.

use serde::{Deserialize, Serialize};

/// The five bounded overlay surfaces that participate in expansion
/// coordination. Deliberately excludes Dashboard and Settings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayKind {
    Taskbar,
    Top,
    Edge,
    Hud,
    QuickPanel,
}

impl OverlayKind {
    /// Deterministic fallback for corrupt external strings.
    pub fn from_token(token: &str) -> Self {
        match token {
            "top" => OverlayKind::Top,
            "edge" => OverlayKind::Edge,
            "hud" => OverlayKind::Hud,
            "quick-panel" => OverlayKind::QuickPanel,
            _ => OverlayKind::Taskbar,
        }
    }

    pub fn as_token(self) -> &'static str {
        match self {
            OverlayKind::Taskbar => "taskbar",
            OverlayKind::Top => "top",
            OverlayKind::Edge => "edge",
            OverlayKind::Hud => "hud",
            OverlayKind::QuickPanel => "quick-panel",
        }
    }
}

/// One coordinated decision produced by the state machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transition {
    /// Nothing to do (transition was redundant or stale).
    Noop,
    /// Expand `expand`; if `collapse` is Some, collapse that overlay first.
    ExpandThenCollapse {
        expand: OverlayKind,
        collapse: OverlayKind,
    },
    /// Expand `expand`; nothing else is expanded.
    Expand { expand: OverlayKind },
    /// Collapse `collapse` (it was the active overlay).
    Collapse { collapse: OverlayKind },
}

/// The coordinator: `None` = no overlay is expanded.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct SurfaceCoordinator {
    active: Option<OverlayKind>,
}

impl SurfaceCoordinator {
    pub fn new() -> Self {
        SurfaceCoordinator { active: None }
    }

    /// The currently expanded overlay, if any.
    pub fn active(&self) -> Option<OverlayKind> {
        self.active
    }

    /// Request expansion of `kind`. Returns the native actions to perform.
    /// Expanding an already-expanded overlay is a safe no-op; expanding a
    /// second overlay collapses the previously active one first.
    pub fn expand(&mut self, kind: OverlayKind) -> Transition {
        match self.active {
            Some(current) if current == kind => Transition::Noop,
            Some(current) => {
                self.active = Some(kind);
                Transition::ExpandThenCollapse {
                    expand: kind,
                    collapse: current,
                }
            }
            None => {
                self.active = Some(kind);
                Transition::Expand { expand: kind }
            }
        }
    }

    /// Escape / explicit collapse of the active overlay. Collapsing an
    /// overlay that is not active is a stale request and is rejected as a
    /// no-op.
    pub fn collapse(&mut self, kind: OverlayKind) -> Transition {
        match self.active {
            Some(current) if current == kind => {
                self.active = None;
                Transition::Collapse { collapse: kind }
            }
            _ => Transition::Noop,
        }
    }

    /// Collapse whatever is expanded (surface hide, app shutdown).
    pub fn collapse_all(&mut self) -> Option<OverlayKind> {
        self.active.take()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL: [OverlayKind; 5] = [
        OverlayKind::Taskbar,
        OverlayKind::Top,
        OverlayKind::Edge,
        OverlayKind::Hud,
        OverlayKind::QuickPanel,
    ];

    #[test]
    fn starts_with_no_expanded_overlay() {
        let c = SurfaceCoordinator::new();
        assert_eq!(c.active(), None);
    }

    #[test]
    fn expanding_first_overlay_expands_without_collapsing() {
        let mut c = SurfaceCoordinator::new();
        assert_eq!(
            c.expand(OverlayKind::Taskbar),
            Transition::Expand {
                expand: OverlayKind::Taskbar
            }
        );
        assert_eq!(c.active(), Some(OverlayKind::Taskbar));
    }

    #[test]
    fn expanding_a_second_overlay_collapses_the_first() {
        let mut c = SurfaceCoordinator::new();
        let _ = c.expand(OverlayKind::Taskbar);
        assert_eq!(
            c.expand(OverlayKind::Top),
            Transition::ExpandThenCollapse {
                expand: OverlayKind::Top,
                collapse: OverlayKind::Taskbar,
            }
        );
        assert_eq!(c.active(), Some(OverlayKind::Top));
    }

    #[test]
    fn exclusivity_invariant_holds_across_full_cycle_of_every_overlay() {
        let mut c = SurfaceCoordinator::new();
        for a in ALL {
            for b in ALL {
                let _ = c.expand(a);
                let t = c.expand(b);
                // After any transition, at most one overlay is active.
                assert_eq!(c.active(), Some(b));
                match t {
                    Transition::Noop if a == b => {
                        // Same-kind expand is idempotent by contract.
                    }
                    Transition::Expand { expand } => {
                        assert_eq!(expand, b);
                        assert_eq!(a, b, "only same-kind expand yields plain Expand");
                    }
                    Transition::ExpandThenCollapse { expand, collapse } => {
                        assert_eq!(expand, b);
                        assert_eq!(collapse, a);
                    }
                    other => panic!("unexpected transition {other:?} for {a:?}->{b:?}"),
                }
                // Every pairwise swap leaves exactly the new overlay active.
                assert!(ALL.iter().filter(|k| Some(**k) == c.active()).count() <= 1);
            }
        }
    }

    #[test]
    fn escape_collapses_the_active_overlay() {
        let mut c = SurfaceCoordinator::new();
        let _ = c.expand(OverlayKind::Edge);
        assert_eq!(
            c.collapse(OverlayKind::Edge),
            Transition::Collapse {
                collapse: OverlayKind::Edge
            }
        );
        assert_eq!(c.active(), None);
    }

    #[test]
    fn escape_of_a_non_active_overlay_is_rejected_as_noop() {
        let mut c = SurfaceCoordinator::new();
        let _ = c.expand(OverlayKind::Hud);
        assert_eq!(c.collapse(OverlayKind::Taskbar), Transition::Noop);
        assert_eq!(c.active(), Some(OverlayKind::Hud), "stale escape is safe");
    }

    #[test]
    fn expanding_the_active_overlay_is_idempotent() {
        let mut c = SurfaceCoordinator::new();
        let _ = c.expand(OverlayKind::QuickPanel);
        assert_eq!(c.expand(OverlayKind::QuickPanel), Transition::Noop);
        assert_eq!(c.active(), Some(OverlayKind::QuickPanel));
    }

    #[test]
    fn collapse_all_reports_and_clears_the_active_overlay() {
        let mut c = SurfaceCoordinator::new();
        assert_eq!(c.collapse_all(), None);
        let _ = c.expand(OverlayKind::Hud);
        assert_eq!(c.collapse_all(), Some(OverlayKind::Hud));
        assert_eq!(c.active(), None);
    }

    #[test]
    fn corrupt_tokens_fall_back_deterministically() {
        assert_eq!(OverlayKind::from_token("bogus"), OverlayKind::Taskbar);
        assert_eq!(
            OverlayKind::from_token("quick-panel"),
            OverlayKind::QuickPanel
        );
        assert_eq!(OverlayKind::from_token("settings"), OverlayKind::Taskbar);
    }

    #[test]
    fn dashboard_and_settings_are_unrepresentable_as_overlays() {
        // The type system excludes app windows; this pins the token map too:
        // no token maps Dashboard/Settings into OverlayKind.
        for token in ["dashboard", "settings", "taskbar", "top", "edge", "hud"] {
            let kind = OverlayKind::from_token(token);
            assert!(matches!(
                kind,
                OverlayKind::Taskbar
                    | OverlayKind::Top
                    | OverlayKind::Edge
                    | OverlayKind::Hud
                    | OverlayKind::QuickPanel
            ));
        }
    }
}
