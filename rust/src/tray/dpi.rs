//! One raster-sizing policy for every native tray icon.
//!
//! What Windows actually receives: `tray-icon` 0.21.3 turns one RGBA buffer
//! into one `HICON` (`CreateIcon(width, height)`) and passes it to
//! `Shell_NotifyIconW`. There is no multi-resolution facility; the shell
//! resamples that single icon to the small-icon metric of the taskbar's
//! monitor (16px at 100% scaling). So the only lever is the source size, and
//! it must be at least the largest shell size we support so the shell only
//! ever downsamples.

/// Small-icon edge at 100% display scaling (`SM_CXSMICON`).
pub const SHELL_SMALL_ICON_BASE_PX: u32 = 16;

/// Highest Windows display scaling this policy guarantees without upscaling.
pub const MAX_SUPPORTED_SCALE_PERCENT: u32 = 400;

/// Edge of every tray icon source raster, main and provider alike.
pub const TRAY_ICON_SOURCE_PX: u32 = 64;

/// Layout grid the main-icon geometry is authored on; sources are integer
/// multiples of it so strokes and glyphs land on whole pixels.
pub const TRAY_ICON_DESIGN_GRID_PX: u32 = 32;

/// Physical small-icon edge the shell draws at `scale_percent` display scaling.
pub fn shell_icon_px(scale_percent: u32) -> u32 {
    (SHELL_SMALL_ICON_BASE_PX * scale_percent + 50) / 100
}

/// Whether the source raster must be enlarged to fill the shell's icon.
pub fn requires_upscale(source_px: u32, scale_percent: u32) -> bool {
    shell_icon_px(scale_percent) > source_px
}

const _: () = assert!(TRAY_ICON_SOURCE_PX.is_multiple_of(TRAY_ICON_DESIGN_GRID_PX));
const _: () =
    assert!(TRAY_ICON_SOURCE_PX >= SHELL_SMALL_ICON_BASE_PX * MAX_SUPPORTED_SCALE_PERCENT / 100);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_sizes_match_windows_small_icon_metrics() {
        for (scale, px) in [
            (100, 16),
            (125, 20),
            (150, 24),
            (175, 28),
            (200, 32),
            (250, 40),
            (300, 48),
            (400, 64),
        ] {
            assert_eq!(shell_icon_px(scale), px, "{scale}%");
        }
    }

    #[test]
    fn the_shared_source_is_never_upscaled_at_supported_scales() {
        for scale in [100, 125, 150, 175, 200, 250, 300, 350, 400] {
            assert!(!requires_upscale(TRAY_ICON_SOURCE_PX, scale), "{scale}%");
        }
        // The old 32px main-icon source was upscaled above 200%.
        assert!(requires_upscale(TRAY_ICON_DESIGN_GRID_PX, 250));
        assert!(requires_upscale(TRAY_ICON_DESIGN_GRID_PX, 300));
    }
}
