//! Persistent app settings (JSON next to Tauri app config) and JSON project files.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::core::models::DashboardProject;

/// Mirrors frontend `AppSettings` + disk layout for `%APPDATA%`-style config dir.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedAppSettings {
    pub game_root_path: String,
    /// Extra mod workspace folders (material/font resolution: these first, then `game_root_path`).
    #[serde(default)]
    pub mod_root_paths: Vec<String>,
    pub recent_files: Vec<String>,
    pub grid_size: i32,
    pub snap_enabled: bool,
    pub default_zoom: f64,
    pub auto_save_interval_seconds: u32,
    pub theme: String,
}

fn settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
pub fn load_app_settings(app: AppHandle) -> Result<Option<PersistedAppSettings>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let s: PersistedAppSettings = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Some(s))
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: PersistedAppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_project_json(path: String) -> Result<DashboardProject, String> {
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_project_json(path: String, project: DashboardProject) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    fs::write(p, text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persisted_app_settings_json_round_trips() {
        let s = PersistedAppSettings {
            game_root_path: r"C:\Games\ETS2".into(),
            mod_root_paths: vec![r"D:\mod_a".into()],
            recent_files: vec![r"C:\p\a.json".into(), r"D:\b.json".into()],
            grid_size: 8,
            snap_enabled: true,
            default_zoom: 1.25,
            auto_save_interval_seconds: 120,
            theme: "dark".into(),
        };
        let json = serde_json::to_string_pretty(&s).unwrap();
        let back: PersistedAppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back, s);
    }
}
