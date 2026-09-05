//! QuotaArc V9 — THE authoritative surface sizing runtime.
//!
//! This module is the ONLY place a production surface dimension is computed.
//! The TypeScript layer consumes [`ResolvedSurfaceLayout`] DTOs; it never
//! recomputes window geometry. All arithmetic is logical pixels; conversion
//! to physical pixels happens exclusively at native window boundaries.
//!
//! Envelope contract (logical px):
//!   Taskbar      compact 360–440 ×  90–140   expanded 520–640 × 260–340
//!   Top / Island compact 280–320 ×  44– 56   expanded 440–520 × 300–420
//!   Edge         compact  72–110 × 360–480   expanded  ≤260 ×  ≤520
//!                (edge width is the thickness crossing the screen edge)
//!   HUD           compact 300–360 × 320–400
//!   Quick Panel   compact 320–380 × 400–520
//!   Dashboard            360–520 × 480–620   (normal app window)
//!   Settings      entirely within the work area (normal app window)
//!
//! Taskbar, Top, Edge, HUD, and Quick Panel are bounded overlay surfaces.
//! Dashboard and Settings are normal bounded application windows.

use serde::{Deserialize, Serialize};

/// Bounded overlay + application surface identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SurfaceKind {
    Taskbar,
    Top,
    Edge,
    Hud,
    QuickPanel,
    Dashboard,
    Settings,
}

impl SurfaceKind {
    /// Deterministic fallback for corrupt external strings.
    pub fn from_token(token: &str) -> Self {
        match token {
            "top" => SurfaceKind::Top,
            "edge" => SurfaceKind::Edge,
            "hud" => SurfaceKind::Hud,
            "quick-panel" => SurfaceKind::QuickPanel,
            "dashboard" => SurfaceKind::Dashboard,
            "settings" => SurfaceKind::Settings,
            _ => SurfaceKind::Taskbar,
        }
    }

    pub fn as_token(self) -> &'static str {
        match self {
            SurfaceKind::Taskbar => "taskbar",
            SurfaceKind::Top => "top",
            SurfaceKind::Edge => "edge",
            SurfaceKind::Hud => "hud",
            SurfaceKind::QuickPanel => "quick-panel",
            SurfaceKind::Dashboard => "dashboard",
            SurfaceKind::Settings => "settings",
        }
    }

    fn envelope(self) -> Envelope {
        match self {
            SurfaceKind::Taskbar => Envelope {
                compact: (360.0, 440.0, 90.0, 140.0),
                expanded: (520.0, 640.0, 260.0, 340.0),
                cap_w: 0.35,
                cap_h: 0.20,
                cap_w_expanded: 0.50,
                cap_h_expanded: 0.45,
                grows_with_providers: true,
                vertical: false,
                fits_work_area: false,
            },
            SurfaceKind::Top => Envelope {
                // The only interactive overlay: a small top-center status
                // island that opens downward into a bounded detail card.
                compact: (280.0, 320.0, 44.0, 56.0),
                expanded: (440.0, 520.0, 300.0, 420.0),
                cap_w: 0.35,
                cap_h: 0.20,
                cap_w_expanded: 0.50,
                cap_h_expanded: 0.45,
                grows_with_providers: true,
                vertical: false,
                fits_work_area: false,
            },
            SurfaceKind::Edge => Envelope {
                compact: (72.0, 110.0, 360.0, 480.0),
                expanded: (200.0, 260.0, 420.0, 520.0),
                cap_w: 0.12,
                cap_h: 0.65,
                cap_w_expanded: 0.20,
                cap_h_expanded: 0.70,
                grows_with_providers: true,
                vertical: true,
                fits_work_area: false,
            },
            SurfaceKind::Hud => Envelope {
                compact: (300.0, 360.0, 320.0, 400.0),
                expanded: (300.0, 360.0, 320.0, 400.0),
                cap_w: 0.30,
                cap_h: 0.55,
                cap_w_expanded: 0.30,
                cap_h_expanded: 0.55,
                grows_with_providers: false,
                vertical: false,
                fits_work_area: false,
            },
            SurfaceKind::QuickPanel => Envelope {
                compact: (320.0, 380.0, 400.0, 520.0),
                expanded: (320.0, 380.0, 400.0, 520.0),
                cap_w: 0.32,
                cap_h: 0.70,
                cap_w_expanded: 0.32,
                cap_h_expanded: 0.70,
                grows_with_providers: false,
                vertical: false,
                fits_work_area: false,
            },
            SurfaceKind::Dashboard => Envelope {
                compact: (360.0, 520.0, 480.0, 620.0),
                expanded: (360.0, 520.0, 480.0, 620.0),
                cap_w: 0.45,
                cap_h: 0.85,
                cap_w_expanded: 0.45,
                cap_h_expanded: 0.85,
                grows_with_providers: false,
                vertical: false,
                fits_work_area: true,
            },
            SurfaceKind::Settings => Envelope {
                compact: (915.0, 915.0, 758.0, 758.0),
                expanded: (915.0, 915.0, 758.0, 758.0),
                cap_w: 0.95,
                cap_h: 0.95,
                cap_w_expanded: 0.95,
                cap_h_expanded: 0.95,
                grows_with_providers: false,
                vertical: false,
                fits_work_area: true,
            },
        }
    }
}

/// Overlay presentation state. Hover shares the compact envelope.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SurfaceState {
    Hidden,
    Peek,
    Compact,
    Hover,
    Expanded,
}

impl SurfaceState {
    /// Deterministic fallback for corrupt external strings.
    pub fn from_token(token: &str) -> Self {
        match token {
            "hidden" => SurfaceState::Hidden,
            "peek" => SurfaceState::Peek,
            "hover" => SurfaceState::Hover,
            "expanded" => SurfaceState::Expanded,
            _ => SurfaceState::Compact,
        }
    }

    pub fn as_token(self) -> &'static str {
        match self {
            SurfaceState::Hidden => "hidden",
            SurfaceState::Peek => "peek",
            SurfaceState::Compact => "compact",
            SurfaceState::Hover => "hover",
            SurfaceState::Expanded => "expanded",
        }
    }
}

/// Screen edge a surface is anchored to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AnchorEdge {
    Top,
    Bottom,
    Left,
    Right,
    None,
}

impl AnchorEdge {
    /// Deterministic fallback for corrupt external strings.
    pub fn from_token(token: &str) -> Self {
        match token {
            "top" => AnchorEdge::Top,
            "left" => AnchorEdge::Left,
            "right" => AnchorEdge::Right,
            "none" => AnchorEdge::None,
            _ => AnchorEdge::Bottom,
        }
    }
}

/// Sanitized, validated sizing inputs. Construct via [`LayoutInput::new`];
/// every field is coerced to a safe range so no caller can poison the math.
#[derive(Debug, Clone, Copy)]
pub struct LayoutInput {
    pub surface: SurfaceKind,
    pub state: SurfaceState,
    /// Monitor work area, logical px.
    pub work_area: (f64, f64),
    /// Monitor scale factor (1.0 / 1.25 / 1.5 / 2.0). Logical math ignores
    /// this; it rides on the DTO for native physical conversion only.
    pub scale_factor: f64,
    /// User visual scale, 0.5..=2.0.
    pub user_scale: f64,
    /// Provider instrument count, 1..=64.
    pub provider_count: u32,
    pub placement: AnchorEdge,
}

fn sane_dimension(value: f64, fallback: f64) -> f64 {
    if !value.is_finite() || value <= 0.0 || value > 100_000.0 {
        fallback
    } else {
        value
    }
}

impl LayoutInput {
    /// Validates every field; corrupt values become deterministic defaults.
    pub fn new(
        surface: SurfaceKind,
        state: SurfaceState,
        work_area: (f64, f64),
        scale_factor: f64,
        user_scale: f64,
        provider_count: u32,
        placement: AnchorEdge,
    ) -> Self {
        LayoutInput {
            surface,
            state,
            work_area: (
                sane_dimension(work_area.0, 1280.0),
                sane_dimension(work_area.1, 752.0),
            ),
            scale_factor: if scale_factor.is_finite() && (0.5..=4.0).contains(&scale_factor) {
                scale_factor
            } else {
                1.0
            },
            user_scale: if user_scale.is_finite() {
                user_scale.clamp(0.5, 2.0)
            } else {
                1.0
            },
            provider_count: provider_count.clamp(1, 64),
            placement,
        }
    }
}

struct Envelope {
    /// (min_w, max_w, min_h, max_h) for compact.
    compact: (f64, f64, f64, f64),
    /// (min_w, max_w, min_h, max_h) for expanded.
    expanded: (f64, f64, f64, f64),
    /// Fraction of the work area this surface may occupy (compact).
    cap_w: f64,
    cap_h: f64,
    /// Expanded overlays get the looser 50%/45% caps.
    cap_w_expanded: f64,
    cap_h_expanded: f64,
    /// Compact size grows with provider count up to the envelope max.
    grows_with_providers: bool,
    /// Edge rails are authored vertically: width = thickness.
    vertical: bool,
    /// Normal application windows clamp to the full work area instead of
    /// proportional overlay caps.
    fits_work_area: bool,
}

/// One resolved surface layout — the serializable DTO consumed by the
/// frontend and the native window manager.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSurfaceLayout {
    pub surface: SurfaceKind,
    pub state: SurfaceState,
    pub window_bounds_logical: (f64, f64),
    pub viewport_bounds_logical: (f64, f64),
    pub safe_content_bounds: (f64, f64),
    pub center: (f64, f64),
    /// Effective user scale after clamping (1.0 = neutral).
    pub scale: f64,
    /// Monitor scale factor for native-boundary physical conversion only.
    pub scale_factor: f64,
    pub orbit_radius: f64,
    pub instrument_size: f64,
    pub label_bounds: (f64, f64),
    /// Which constraint bounded the result, if any.
    pub clamped_by: Option<String>,
}

impl ResolvedSurfaceLayout {
    /// Authoritative computation. Pure, total (never panics), deterministic.
    pub fn compute(input: LayoutInput) -> Self {
        let env = input.surface.envelope();
        let expanded = input.state == SurfaceState::Expanded;
        let (min_w, max_w, min_h, max_h) = if expanded { env.expanded } else { env.compact };
        let mut clamped_by: Option<String> = None;

        // Compact surfaces start at the envelope minimum and grow with
        // provider density up to the envelope max; expanded starts at max.
        let scale = input.user_scale;
        let mut w;
        let mut h;
        if !expanded && env.grows_with_providers {
            let density_extra = (input.provider_count.saturating_sub(3).min(3) as f64) * 24.0;
            if env.vertical {
                h = ((min_h + density_extra) * scale).clamp(min_h, max_h);
                w = (max_w * scale).clamp(min_w, max_w);
            } else {
                w = ((min_w + density_extra) * scale).clamp(min_w, max_w);
                h = (max_h * scale).clamp(min_h, max_h);
            }
            if density_extra > 0.0 {
                clamped_by = Some("envelope-max".to_string());
            }
        } else {
            w = (max_w * scale).clamp(min_w, max_w);
            h = (max_h * scale).clamp(min_h, max_h);
        }

        // Proportional work-area caps; the cap wins over the envelope.
        // Absolute floors keep surfaces renderable on tiny work areas.
        let (cap_w_frac, cap_h_frac) = if expanded {
            (env.cap_w_expanded, env.cap_h_expanded)
        } else {
            (env.cap_w, env.cap_h)
        };
        if env.fits_work_area {
            // Normal application windows must sit entirely inside the
            // work area; this fit clamp replaces proportional overlay caps.
            let wa_w = input.work_area.0.floor();
            let wa_h = input.work_area.1.floor();
            if w > wa_w {
                w = wa_w.max(200.0);
                clamped_by = Some("work-area-fit".to_string());
            }
            if h > wa_h {
                h = wa_h.max(120.0);
                if clamped_by.is_none() {
                    clamped_by = Some("work-area-fit".to_string());
                }
            }
        } else {
            let cap_w = (input.work_area.0 * cap_w_frac).floor();
            let cap_h = (input.work_area.1 * cap_h_frac).floor();
            let floor_w = if env.vertical { 40.0 } else { 200.0 };
            let floor_h = 60.0;
            if w > cap_w {
                w = cap_w.max(floor_w);
                clamped_by = Some("work-area-width".to_string());
            }
            if h > cap_h {
                h = cap_h.max(floor_h);
                if clamped_by.is_none() {
                    clamped_by = Some("work-area-height".to_string());
                }
            }
        }

        w = w.round();
        h = h.round();

        // Instrument metrics derive from the stage, not call-site magic.
        let instrument_size = if expanded {
            (w / 12.0).clamp(36.0, 56.0)
        } else {
            (w / 14.0).clamp(28.0, 42.0)
        }
        .round();
        let orbit_radius = if env.vertical {
            h * 0.36
        } else {
            w.min(h / 0.95) * 0.38
        }
        .round();

        ResolvedSurfaceLayout {
            surface: input.surface,
            state: input.state,
            window_bounds_logical: (w, h),
            viewport_bounds_logical: (w, h),
            safe_content_bounds: (w, h),
            center: (w / 2.0, h / 2.0),
            scale,
            scale_factor: input.scale_factor,
            orbit_radius,
            instrument_size,
            label_bounds: (w, if expanded { 24.0 } else { 18.0 }),
            clamped_by,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(surface: SurfaceKind, state: SurfaceState) -> LayoutInput {
        LayoutInput::new(
            surface,
            state,
            (1280.0, 752.0),
            1.0,
            1.0,
            3,
            AnchorEdge::Bottom,
        )
    }

    fn bounds(surface: SurfaceKind, state: SurfaceState) -> (f64, f64) {
        ResolvedSurfaceLayout::compute(input(surface, state)).window_bounds_logical
    }

    const OVERLAYS: [SurfaceKind; 5] = [
        SurfaceKind::Taskbar,
        SurfaceKind::Top,
        SurfaceKind::Edge,
        SurfaceKind::Hud,
        SurfaceKind::QuickPanel,
    ];
    const APP_WINDOWS: [SurfaceKind; 2] = [SurfaceKind::Dashboard, SurfaceKind::Settings];

    #[test]
    fn envelopes_match_the_v9_contract_at_reference_work_area() {
        let (w, h) = bounds(SurfaceKind::Taskbar, SurfaceState::Compact);
        assert!((360.0..=440.0).contains(&w), "taskbar compact w={w}");
        assert!((90.0..=140.0).contains(&h), "taskbar compact h={h}");
        let (w, h) = bounds(SurfaceKind::Taskbar, SurfaceState::Expanded);
        assert!((520.0..=640.0).contains(&w), "taskbar expanded w={w}");
        assert!((260.0..=340.0).contains(&h), "taskbar expanded h={h}");
        let (w, h) = bounds(SurfaceKind::Top, SurfaceState::Compact);
        assert!((280.0..=320.0).contains(&w) && (44.0..=56.0).contains(&h));
        let (w, h) = bounds(SurfaceKind::Top, SurfaceState::Expanded);
        assert!((440.0..=520.0).contains(&w) && (300.0..=420.0).contains(&h));
        let (w, h) = bounds(SurfaceKind::Edge, SurfaceState::Compact);
        assert!((72.0..=110.0).contains(&w) && (360.0..=480.0).contains(&h));
        let (w, h) = bounds(SurfaceKind::Edge, SurfaceState::Expanded);
        assert!(w <= 260.0 && h <= 520.0);
        let (w, h) = bounds(SurfaceKind::Hud, SurfaceState::Compact);
        assert!((300.0..=360.0).contains(&w) && (320.0..=400.0).contains(&h));
        let (w, h) = bounds(SurfaceKind::QuickPanel, SurfaceState::Compact);
        assert!((320.0..=380.0).contains(&w) && (400.0..=520.0).contains(&h));
        let (w, h) = bounds(SurfaceKind::Dashboard, SurfaceState::Compact);
        assert!((360.0..=520.0).contains(&w) && (480.0..=620.0).contains(&h));
    }

    #[test]
    fn edge_is_vertical_thickness_first() {
        let (w, h) = bounds(SurfaceKind::Edge, SurfaceState::Compact);
        assert!(w < h, "edge thickness {w} must be < length {h}");
    }

    #[test]
    fn proportional_caps_hold_for_every_surface_and_state() {
        for surface in OVERLAYS.iter().copied().chain(APP_WINDOWS.iter().copied()) {
            for state in [
                SurfaceState::Compact,
                SurfaceState::Hover,
                SurfaceState::Expanded,
            ] {
                let env = surface.envelope();
                let layout = ResolvedSurfaceLayout::compute(input(surface, state));
                let (w, h) = layout.window_bounds_logical;
                let wa = input(surface, state).work_area;
                if env.fits_work_area {
                    assert!(
                        w <= wa.0 && h <= wa.1,
                        "{surface:?} {state:?} {w}x{h} escapes work area"
                    );
                    continue;
                }
                let (cap_w_frac, cap_h_frac) = if state == SurfaceState::Expanded {
                    (env.cap_w_expanded, env.cap_h_expanded)
                } else {
                    (env.cap_w, env.cap_h)
                };
                assert!(
                    w <= (wa.0 * cap_w_frac).ceil() + 1.0,
                    "{surface:?} {state:?} w={w} breaches width cap"
                );
                assert!(
                    h <= (wa.1 * cap_h_frac).ceil() + 1.0,
                    "{surface:?} {state:?} h={h} breaches height cap"
                );
            }
        }
    }

    #[test]
    fn expanded_is_larger_than_compact_for_stateful_overlays() {
        for surface in [SurfaceKind::Taskbar, SurfaceKind::Top, SurfaceKind::Edge] {
            let c = bounds(surface, SurfaceState::Compact);
            let e = bounds(surface, SurfaceState::Expanded);
            assert!(e.0 > c.0 && e.1 > c.1, "{surface:?} must grow on expansion");
        }
    }

    #[test]
    fn dpi_is_invariant_in_logical_pixels() {
        for dpi in [1.0, 1.25, 1.5, 2.0] {
            let layout = ResolvedSurfaceLayout::compute(LayoutInput::new(
                SurfaceKind::Taskbar,
                SurfaceState::Compact,
                (1280.0, 752.0),
                dpi,
                1.0,
                3,
                AnchorEdge::Bottom,
            ));
            // Three providers sit at the envelope minimum; layout stays in
            // logical pixels regardless of the monitor scale factor.
            assert_eq!(layout.window_bounds_logical, (360.0, 140.0));
            assert_eq!(layout.scale_factor, dpi);
        }
    }

    #[test]
    fn resolutions_do_not_breach_caps() {
        for (wa_w, wa_h) in [
            (1280.0, 720.0),
            (1920.0, 1080.0),
            (1920.0, 1200.0),
            (2560.0, 1440.0),
            (3840.0, 2160.0),
        ] {
            for surface in OVERLAYS.iter().copied().chain(APP_WINDOWS.iter().copied()) {
                let layout = ResolvedSurfaceLayout::compute(LayoutInput::new(
                    surface,
                    SurfaceState::Compact,
                    (wa_w, wa_h),
                    1.5,
                    1.0,
                    3,
                    AnchorEdge::Bottom,
                ));
                let env = surface.envelope();
                let (w, h) = layout.window_bounds_logical;
                if env.fits_work_area {
                    assert!(w <= wa_w && h <= wa_h, "{surface:?} escapes {wa_w}x{wa_h}");
                    continue;
                }
                assert!(w <= (wa_w * env.cap_w).ceil() + 1.0);
                assert!(h <= (wa_h * env.cap_h).ceil() + 1.0);
            }
        }
    }

    #[test]
    fn settings_fits_entirely_within_small_work_areas() {
        let layout = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Settings,
            SurfaceState::Compact,
            (1024.0, 600.0),
            1.0,
            1.0,
            3,
            AnchorEdge::None,
        ));
        let (w, h) = layout.window_bounds_logical;
        assert!(
            w <= 1024.0 && h <= 600.0,
            "settings {w}x{h} escapes work area"
        );
        assert_eq!(layout.clamped_by.as_deref(), Some("work-area-fit"));
    }

    #[test]
    fn provider_density_grows_then_saturates_within_envelope() {
        let three = bounds(SurfaceKind::Taskbar, SurfaceState::Compact);
        let seven = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Taskbar,
            SurfaceState::Compact,
            (1280.0, 752.0),
            1.0,
            1.0,
            7,
            AnchorEdge::Bottom,
        ))
        .window_bounds_logical;
        let twelve = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Taskbar,
            SurfaceState::Compact,
            (1280.0, 752.0),
            1.0,
            1.0,
            12,
            AnchorEdge::Bottom,
        ))
        .window_bounds_logical;
        assert!(seven.0 > three.0, "7 providers wider than 3");
        assert_eq!(seven, twelve, "density saturates by 6 extra providers");
        assert!(twelve.0 <= 440.0, "density stays inside the envelope");
    }

    #[test]
    fn user_scale_moves_inside_envelope_and_caps_win() {
        let half = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Taskbar,
            SurfaceState::Compact,
            (1280.0, 752.0),
            1.0,
            0.5,
            3,
            AnchorEdge::Bottom,
        ))
        .window_bounds_logical;
        assert!(
            (360.0..=440.0).contains(&half.0),
            "scaled-down stays >= min"
        );
        let huge = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Taskbar,
            SurfaceState::Expanded,
            (1280.0, 752.0),
            1.0,
            99.0,
            3,
            AnchorEdge::Bottom,
        ));
        assert_eq!(huge.scale, 2.0, "corrupt scale clamps to 2.0");
        assert!(huge.window_bounds_logical.0 <= 640.0);
    }

    #[test]
    fn corrupt_inputs_return_deterministic_safe_layouts() {
        let nan = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Taskbar,
            SurfaceState::Compact,
            (f64::NAN, f64::INFINITY),
            f64::NAN,
            f64::NEG_INFINITY,
            u32::MAX,
            AnchorEdge::Bottom,
        ));
        assert_eq!(nan.window_bounds_logical, (432.0, 140.0));
        assert_eq!(nan.scale_factor, 1.0);
        let zero = ResolvedSurfaceLayout::compute(LayoutInput::new(
            SurfaceKind::Edge,
            SurfaceState::Compact,
            (0.0, 0.0),
            0.0,
            -5.0,
            0,
            AnchorEdge::Bottom,
        ));
        assert!(zero.window_bounds_logical.0 > 0.0 && zero.window_bounds_logical.1 > 0.0);
        assert_eq!(
            ResolvedSurfaceLayout::compute(LayoutInput::new(
                SurfaceKind::Edge,
                SurfaceState::Compact,
                (1280.0, 752.0),
                1.0,
                1.0,
                3,
                AnchorEdge::Bottom,
            )),
            ResolvedSurfaceLayout::compute(LayoutInput::new(
                SurfaceKind::Edge,
                SurfaceState::Compact,
                (1280.0, 752.0),
                1.0,
                1.0,
                3,
                AnchorEdge::Bottom,
            ))
        );
    }

    #[test]
    fn corrupt_tokens_fall_back_deterministically() {
        assert_eq!(SurfaceKind::from_token("bogus"), SurfaceKind::Taskbar);
        assert_eq!(
            SurfaceKind::from_token("quick-panel"),
            SurfaceKind::QuickPanel
        );
        assert_eq!(SurfaceState::from_token("bogus"), SurfaceState::Compact);
        assert_eq!(SurfaceState::from_token("expanded"), SurfaceState::Expanded);
        assert_eq!(AnchorEdge::from_token("bogus"), AnchorEdge::Bottom);
    }

    #[test]
    fn dto_serializes_with_stable_camel_case_contract() {
        let layout =
            ResolvedSurfaceLayout::compute(input(SurfaceKind::Taskbar, SurfaceState::Compact));
        let json = serde_json::to_string(&layout).expect("serialize");
        assert!(json.contains("\"windowBoundsLogical\""), "{json}");
        assert!(json.contains("\"orbitRadius\""), "{json}");
        assert!(json.contains("\"instrumentSize\""), "{json}");
        assert!(json.contains("\"clampedBy\""), "{json}");
        assert!(json.contains("\"surface\":\"taskbar\""), "{json}");
        let round: ResolvedSurfaceLayout = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(round, layout);
    }

    #[test]
    fn hover_shares_the_compact_envelope() {
        assert_eq!(
            bounds(SurfaceKind::Taskbar, SurfaceState::Hover),
            bounds(SurfaceKind::Taskbar, SurfaceState::Compact)
        );
    }

    #[test]
    fn all_kinds_finite_integer_positive_in_every_state() {
        for surface in OVERLAYS.iter().copied().chain(APP_WINDOWS.iter().copied()) {
            for state in [
                SurfaceState::Compact,
                SurfaceState::Hover,
                SurfaceState::Expanded,
            ] {
                let layout = ResolvedSurfaceLayout::compute(input(surface, state));
                let (w, h) = layout.window_bounds_logical;
                assert!(w.is_finite() && h.is_finite() && w > 0.0 && h > 0.0);
                assert_eq!(w.fract(), 0.0);
                assert_eq!(h.fract(), 0.0);
                assert!(layout.orbit_radius.is_finite() && layout.orbit_radius > 0.0);
                assert!(layout.instrument_size.is_finite() && layout.instrument_size >= 28.0);
            }
        }
    }
}

#[cfg(test)]
mod golden_tests {
    use super::*;

    /// Generate the checked-in golden fixture bundle consumed by the
    /// TypeScript contract test. Run with:
    ///   cargo test --lib surface_layout -- --ignored --nocapture
    fn build_golden_fixtures() -> serde_json::Map<String, serde_json::Value> {
        let mut fixtures = serde_json::Map::new();
        let surfaces = [
            SurfaceKind::Taskbar,
            SurfaceKind::Top,
            SurfaceKind::Edge,
            SurfaceKind::Hud,
            SurfaceKind::QuickPanel,
            SurfaceKind::Dashboard,
            SurfaceKind::Settings,
        ];
        for surface in surfaces {
            for state in [
                SurfaceState::Compact,
                SurfaceState::Hover,
                SurfaceState::Expanded,
            ] {
                let layout = ResolvedSurfaceLayout::compute(LayoutInput::new(
                    surface,
                    state,
                    (1280.0, 752.0),
                    1.5,
                    1.0,
                    3,
                    if surface == SurfaceKind::Edge {
                        AnchorEdge::Right
                    } else if surface == SurfaceKind::Taskbar {
                        AnchorEdge::Bottom
                    } else {
                        AnchorEdge::None
                    },
                ));
                let key = format!("{}:{}", surface.as_token(), state.as_token());
                fixtures.insert(key, serde_json::to_value(&layout).unwrap());
            }
        }
        fixtures
    }

    /// Serialization contract: the checked-in golden fixtures that the
    /// TypeScript layer tests against MUST byte-match what this Rust
    /// authority produces. If this test fails, Rust changed and the
    /// frontend fixtures are stale — regenerate, never hand-edit.
    #[test]
    fn golden_fixtures_match_the_rust_authority_byte_for_byte() {
        let fixtures = build_golden_fixtures();
        let expected = serde_json::to_string_pretty(&fixtures).unwrap();
        let checked_in = include_str!("../../docs/golden_surface_layouts.json");
        assert_eq!(
            expected,
            checked_in.trim_end(),
            "docs/golden_surface_layouts.json is stale; regenerate from Rust"
        );
    }
}
