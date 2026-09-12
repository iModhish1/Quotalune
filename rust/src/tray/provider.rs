/// Rasterized original provider marks; unknown providers have no invented logo.
pub fn provider_logo_png(id: &str) -> Option<&'static [u8]> {
    Some(match id {
        "abacus" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-abacus.png"
        ),
        "aiand" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-aiand.png"
        ),
        "alibaba" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-alibaba.png"
        ),
        "amp" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-amp.png"
        ),
        "antigravity" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-antigravity.png"
        ),
        "augment" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-augment.png"
        ),
        "bedrock" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-bedrock.png"
        ),
        "chutes" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-chutes.png"
        ),
        "claude" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-claude.png"
        ),
        "clinepass" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-clinepass.png"
        ),
        "codebuff" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-codebuff.png"
        ),
        "codex" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-codex.png"
        ),
        "commandcode" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-commandcode.png"
        ),
        "copilot" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-copilot.png"
        ),
        "crof" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-crof.png"
        ),
        "crossmodel" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-crossmodel.png"
        ),
        "cursor" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-cursor.png"
        ),
        "deepgram" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-deepgram.png"
        ),
        "deepinfra" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-deepinfra.png"
        ),
        "deepseek" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-deepseek.png"
        ),
        "devin" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-devin.png"
        ),
        "doubao" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-doubao.png"
        ),
        "elevenlabs" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-elevenlabs.png"
        ),
        "factory" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-factory.png"
        ),
        "fireworks" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-fireworks.png"
        ),
        "gemini" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-gemini.png"
        ),
        "grok" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-grok.png"
        ),
        "groq" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-groq.png"
        ),
        "jetbrains" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-jetbrains.png"
        ),
        "kilo" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-kilo.png"
        ),
        "kimi" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-kimi.png"
        ),
        "kiro" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-kiro.png"
        ),
        "litellm" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-litellm.png"
        ),
        "llmproxy" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-llmproxy.png"
        ),
        "longcat" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-longcat.png"
        ),
        "manus" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-manus.png"
        ),
        "mimo" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-mimo.png"
        ),
        "minimax" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-minimax.png"
        ),
        "mistral" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-mistral.png"
        ),
        "neuralwatt" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-neuralwatt.png"
        ),
        "notion" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-notion.png"
        ),
        "ollama" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-ollama.png"
        ),
        "opencode" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-opencode.png"
        ),
        "opencodego" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-opencodego.png"
        ),
        "openrouter" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-openrouter.png"
        ),
        "perplexity" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-perplexity.png"
        ),
        "poe" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-poe.png"
        ),
        "qoder" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-qoder.png"
        ),
        "qwencloud" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-qwencloud.png"
        ),
        "sakana" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-sakana.png"
        ),
        "stepfun" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-stepfun.png"
        ),
        "sub2api" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-sub2api.png"
        ),
        "t3chat" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-t3chat.png"
        ),
        "venice" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-venice.png"
        ),
        "vertexai" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-vertexai.png"
        ),
        "warp" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-warp.png"
        ),
        "wayfinder" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-wayfinder.png"
        ),
        "windsurf" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-windsurf.png"
        ),
        "xai" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-xai.png"
        ),
        "zai" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-zai.png"
        ),
        "zed" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-zed.png"
        ),
        "zenmux" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-zenmux.png"
        ),
        "zoommate" => include_bytes!(
            "../../../apps/desktop-tauri/src-tauri/icons/providers/ProviderIcon-zoommate.png"
        ),
        _ => return None,
    })
}

/// Provider geometry is never redrawn: composite the original mark into a measured frame.
/// Missing/error readings render a neutral broken frame, never a known zero.
pub fn render_provider_icon(
    id: &str,
    percent: Option<f64>,
    style: &str,
    color: [u8; 3],
    stroke: u8,
) -> (Vec<u8>, u32, u32) {
    use image::{Rgba, RgbaImage, imageops};
    let mut img = RgbaImage::new(64, 64);
    let value = percent
        .filter(|p| p.is_finite() && *p >= 0.0)
        .map(|p| p.min(100.0));
    let thickness = f64::from(stroke.clamp(1, 4)) * 1.5;
    for y in 0..64 {
        for x in 0..64 {
            let dx = f64::from(x) - 31.5;
            let dy = f64::from(y) - 31.5;
            let r = dx.hypot(dy);
            let angle =
                (dy.atan2(dx) + std::f64::consts::FRAC_PI_2).rem_euclid(std::f64::consts::TAU);
            let (in_track, fraction) = match style {
                "bar" => (
                    (5..59).contains(&x) && y >= 57 && f64::from(y) < 57.0 + thickness,
                    (f64::from(x) - 5.0) / 54.0,
                ),
                "arc" => (
                    r >= 29.0 - thickness && r <= 29.0 && angle < std::f64::consts::TAU * 0.8,
                    angle / (std::f64::consts::TAU * 0.8),
                ),
                _ => (
                    r >= 29.0 - thickness && r <= 29.0,
                    angle / std::f64::consts::TAU,
                ),
            };
            if in_track {
                let active = value.is_some_and(|v| fraction < v / 100.0);
                if value.is_some() || (angle * 6.0).floor().rem_euclid(2.0) < 1.0 {
                    img.put_pixel(
                        x,
                        y,
                        if active {
                            Rgba([color[0], color[1], color[2], 255])
                        } else {
                            Rgba([160, 174, 192, 105])
                        },
                    );
                }
            }
        }
    }
    let bytes = provider_logo_png(id).unwrap_or(include_bytes!(
        "../../../assets/brand/icons/quotaarc-icon-128.png"
    ));
    if let Ok(logo) = image::load_from_memory(bytes) {
        let size = if style == "bar" { 46 } else { 38 };
        let logo = imageops::resize(&logo.to_rgba8(), size, size, imageops::FilterType::Lanczos3);
        imageops::overlay(
            &mut img,
            &logo,
            i64::from((64 - size) / 2),
            i64::from((64 - size) / 2) - if style == "bar" { 3 } else { 0 },
        );
    }
    if style == "badge"
        && let Some(v) = value
    {
        // Tiny number badge uses the existing legible percent glyph renderer.
        let (rgba, w, h) = super::render_percent_icon_rgba(v, false);
        if let Some(badge) = RgbaImage::from_raw(w, h, rgba) {
            let badge = imageops::resize(&badge, 30, 26, imageops::FilterType::Lanczos3);
            imageops::overlay(&mut img, &badge, 34, 38);
        }
    }
    (img.into_raw(), 64, 64)
}
/// Existing provider identity palette with a contrast floor for Windows dark taskbars.
pub fn provider_accent(id: &str) -> [u8; 3] {
    match id {
        "alibaba" => [255, 106, 0],
        "alibabatokenplan" => [255, 106, 0],
        "amp" => [220, 38, 38],
        "antigravity" => [96, 186, 126],
        "augment" => [99, 102, 241],
        "claude" => [204, 124, 94],
        "codebuff" => [68, 255, 0],
        "codex" => [73, 163, 176],
        "copilot" => [168, 85, 247],
        "cursor" => [0, 191, 165],
        "deepgram" => [19, 239, 147],
        "deepinfra" => [180, 195, 210],
        "fireworks" => [242, 91, 28],
        "aiand" => [226, 92, 43],
        "clinepass" => [97, 163, 250],
        "longcat" => [255, 209, 0],
        "neuralwatt" => [56, 217, 140],
        "zoommate" => [11, 92, 255],
        "zenmux" => [108, 92, 231],
        "deepseek" => [82, 125, 240],
        "elevenlabs" => [180, 195, 210],
        "factory" => [255, 107, 53],
        "gemini" => [171, 135, 234],
        "grok" => [180, 195, 210],
        "groq" => [245, 80, 54],
        "jetbrains" => [255, 51, 153],
        "kilo" => [93, 135, 255],
        "bedrock" => [255, 153, 0],
        "kimi" => [254, 96, 60],
        "kimik2" => [76, 0, 255],
        "kiro" => [255, 153, 0],
        "llmproxy" => [79, 70, 229],
        "minimax" => [254, 96, 60],
        "mistral" => [255, 80, 15],
        "ollama" => [139, 149, 176],
        "azureopenai" => [0, 120, 212],
        "t3chat" => [139, 92, 246],
        "opencode" => [59, 130, 246],
        "opencodego" => [59, 130, 246],
        "openrouter" => [107, 114, 128],
        "perplexity" => [31, 184, 205],
        "vertexai" => [66, 133, 244],
        "warp" => [99, 102, 241],
        "windsurf" => [34, 197, 94],
        "wayfinder" => [20, 184, 166],
        "zai" => [232, 90, 106],
        "nanogpt" => [104, 127, 161],
        "infini" => [104, 127, 161],
        "abacus" => [124, 58, 237],
        "manus" => [180, 195, 210],
        "mimo" => [255, 105, 0],
        "doubao" => [37, 99, 235],
        "commandcode" => [68, 255, 0],
        "crof" => [124, 58, 237],
        "crossmodel" => [192, 132, 252],
        "qoder" => [37, 99, 235],
        "codebuddy" => [0, 82, 217],
        "sakana" => [14, 165, 233],
        "stepfun" => [153, 153, 153],
        "sub2api" => [45, 198, 216],
        "venice" => [180, 195, 210],
        "openaiapi" => [16, 163, 127],
        "chutes" => [255, 92, 53],
        "litellm" => [14, 165, 233],
        "poe" => [93, 95, 239],
        "devin" => [180, 195, 210],
        "zed" => [8, 76, 207],
        "qwencloud" => [97, 92, 237],
        "notion" => [51, 126, 169],
        "xai" => [142, 142, 147],
        _ => [75, 194, 218],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn provider_marks_are_real_pngs() {
        for id in ["codex", "claude", "gemini", "crossmodel"] {
            assert!(image::load_from_memory(provider_logo_png(id).unwrap()).is_ok());
        }
        assert!(provider_logo_png("made-up").is_none());
    }
    #[test]
    fn unknown_is_distinct_from_zero_and_full() {
        let render = |p| render_provider_icon("codex", p, "ring", [30, 200, 180], 2).0;
        assert_ne!(render(None), render(Some(0.0)));
        assert_ne!(render(Some(0.0)), render(Some(100.0)));
        assert_eq!(render(None), render(Some(f64::NAN)));
    }
    #[test]
    fn templates_are_distinct() {
        let mut unique = std::collections::HashSet::new();
        for style in ["ring", "arc", "bar", "badge"] {
            unique.insert(render_provider_icon("claude", Some(62.5), style, [230, 130, 80], 2).0);
        }
        assert_eq!(unique.len(), 4);
    }
}
