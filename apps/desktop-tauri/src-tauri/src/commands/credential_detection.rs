use super::*;

// ── Credential detection ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JetbrainsIde {
    pub id: String,
    pub display_name: String,
    pub path: String,
    pub detected: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroStatus {
    pub available: bool,
    pub hint: Option<String>,
}

fn jetbrains_detected_ide_paths() -> Vec<std::path::PathBuf> {
    quotalis_core::host::session::jetbrains_detected_ide_paths()
}

#[tauri::command]
pub fn list_jetbrains_detected_ides() -> Result<Vec<JetbrainsIde>, String> {
    let settings = Settings::load();
    let override_path = settings.jetbrains_ide_base_path().to_string();

    let mut entries: Vec<JetbrainsIde> = jetbrains_detected_ide_paths()
        .into_iter()
        .map(|p| {
            let display = p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| p.display().to_string());
            JetbrainsIde {
                id: display.to_lowercase(),
                display_name: display,
                path: p.to_string_lossy().into_owned(),
                detected: true,
            }
        })
        .collect();

    // If the user has an override that isn't already in the detected list,
    // surface it explicitly with `detected: false`.
    if !override_path.is_empty() && !entries.iter().any(|e| e.path == override_path) {
        let path_buf = std::path::PathBuf::from(&override_path);
        let display = path_buf
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| override_path.clone());
        entries.push(JetbrainsIde {
            id: format!("override::{display}").to_lowercase(),
            display_name: display,
            path: override_path,
            detected: false,
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn set_jetbrains_ide_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("JetBrains IDE path is empty".to_string());
    }
    let pb = std::path::PathBuf::from(trimmed);
    if !pb.is_absolute() {
        return Err("JetBrains IDE path must be absolute".to_string());
    }
    if !pb.is_dir() {
        return Err(format!("JetBrains IDE path is not a directory: {trimmed}"));
    }
    let mut settings = Settings::load();
    settings.set_jetbrains_ide_base_path(pb.to_string_lossy().into_owned());
    settings.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_kiro_status() -> Result<KiroStatus, String> {
    if let Some(path) = quotalis_core::providers::kiro::find_kiro_cli() {
        Ok(KiroStatus {
            available: true,
            hint: Some(path.to_string_lossy().into_owned()),
        })
    } else {
        Ok(KiroStatus {
            available: false,
            hint: Some("kiro-cli: not found on PATH or known install locations".into()),
        })
    }
}
