//! Native envelope for the compact notch family. Footprints are shared with React.
use super::SurfaceState;
use serde::Deserialize;
use std::{collections::HashMap, sync::OnceLock};
#[derive(Deserialize)]
struct Size {
    width: f64,
    height: f64,
}
fn footprints() -> &'static HashMap<String, Size> {
    static SIZES: OnceLock<HashMap<String, Size>> = OnceLock::new();
    SIZES.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/surfaces/notch/footprints.json"))
            .expect("checked-in notch footprints")
    })
}
pub fn contains(form: &str) -> bool {
    footprints().contains_key(form)
}
pub fn size(
    form: &str,
    state: SurfaceState,
    scale: u8,
    work: Option<(f64, f64)>,
    count: u32,
    anchor: &str,
) -> (f64, f64) {
    let horizontal = matches!(anchor, "top" | "bottom");
    if matches!(state, SurfaceState::Hidden | SurfaceState::Peek) {
        return if horizontal {
            (48.0, 24.0)
        } else {
            (24.0, 48.0)
        };
    }
    let base = &footprints()[form];
    let (mut w, mut h) = (base.width, base.height);
    if count == 0 {
        (w, h) = (64.0, 64.0);
    } else if form == "seam" {
        h = 52.0 + f64::from(count.min(3)) * 64.0;
    } else if form == "ribbon" {
        w = 52.0 + f64::from(count.min(3)) * 64.0;
    }
    if state == SurfaceState::Expanded && count > 0 {
        if horizontal {
            w = w.max(248.0);
            h += 160.0;
        } else {
            w += 260.0;
            h = h.max(148.0);
        }
    }
    let mut factor = f64::from(scale.clamp(75, 125)) / 100.0;
    if let Some((ww, wh)) = work {
        factor = factor.min(ww * 0.4 / w).min(wh * 0.45 / h);
    }
    ((w * factor).round().max(1.0), (h * factor).round().max(1.0))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn footprints_have_bounded_density_and_scaled_work_area_caps() {
        for form in footprints().keys() {
            for state in [SurfaceState::Compact, SurfaceState::Expanded] {
                for anchor in ["right", "top", "bottom-left"] {
                    assert_eq!(
                        size(form, state, 100, None, 6, anchor),
                        size(form, state, 100, None, 20, anchor)
                    );
                    for scale in [75, 100, 125] {
                        let (w, h) = size(form, state, scale, Some((800.0, 600.0)), 6, anchor);
                        assert!(w <= 320.0 && h <= 270.0);
                    }
                }
            }
        }
        assert_eq!(
            size("seam", SurfaceState::Compact, 100, None, 3, "right"),
            (64.0, 244.0)
        );
        assert_eq!(
            size("seam", SurfaceState::Expanded, 100, None, 3, "right"),
            (324.0, 244.0)
        );
        assert_eq!(
            size("ribbon", SurfaceState::Expanded, 100, None, 3, "top"),
            (248.0, 232.0)
        );
    }
}
