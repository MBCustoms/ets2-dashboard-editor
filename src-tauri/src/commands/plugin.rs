//! Copy bundled dashboard editor telemetry plugin DLL into the game `plugins/` folder.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const PLUGIN_DLL_NAME: &str = "scsdashboardeditor.dll";

/// Build the ordered list of locations where the bundled DLL might live.
///
/// In production (NSIS/MSI installer) the DLL ships through Tauri's
/// `bundle.resources`, so it ends up under `resource_dir()/scsdashboardeditor.dll`
/// (i.e. `<install>/resources/scsdashboardeditor.dll` on Windows).
///
/// In `cargo tauri dev` the executable lives in `target/debug/` and the DLL is
/// copied next to the app via the post-build step, but during early development
/// it can also still be at the repository root.  The fallback chain keeps both
/// dev and release working.
fn dll_search_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();

    if let Ok(res_dir) = app.path().resource_dir() {
        v.push(res_dir.join(PLUGIN_DLL_NAME));
        v.push(res_dir.join("resources").join(PLUGIN_DLL_NAME));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            v.push(dir.join(PLUGIN_DLL_NAME));
            v.push(dir.join("resources").join(PLUGIN_DLL_NAME));
        }
    }

    v.push(Path::new("../../").join(PLUGIN_DLL_NAME));
    v.push(Path::new("../").join(PLUGIN_DLL_NAME));
    v.push(Path::new(PLUGIN_DLL_NAME).to_path_buf());

    v
}

/// Copy `scsdashboardeditor.dll` from the app bundle into `plugins/` next to the game executable.
#[tauri::command]
pub fn install_plugin(app: AppHandle, exe_path: String) -> Result<String, String> {
    let exe = Path::new(exe_path.trim());

    if !exe.exists() {
        return Err(format!("File not found: {}", exe_path.trim()));
    }
    if exe.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("exe")) != Some(true) {
        return Err("Selected file is not an .exe".to_string());
    }

    let filename = exe
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !filename.contains("eurotrucks") && !filename.contains("amtrucks") {
        return Err(format!(
            "Expected EuroTrucks2.exe or AmericanTruck.exe, got: {filename}"
        ));
    }

    let exe_dir = exe.parent().ok_or_else(|| "Cannot get exe directory".to_string())?;
    let plugins_dir = exe_dir.join("plugins");

    if !plugins_dir.exists() {
        std::fs::create_dir_all(&plugins_dir)
            .map_err(|e| format!("Cannot create plugins dir: {e}"))?;
    }

    let dst = plugins_dir.join(PLUGIN_DLL_NAME);

    if dst.exists() {
        return Err(format!(
            "ALREADY_INSTALLED:Plugin already exists at: {}",
            dst.display()
        ));
    }

    let candidates = dll_search_paths(&app);
    let dll_src = candidates
        .iter()
        .find(|p| p.exists())
        .ok_or_else(|| {
            let tried = candidates
                .iter()
                .map(|p| p.display().to_string())
                .collect::<Vec<_>>()
                .join("\n  - ");
            format!(
                "Plugin DLL ({PLUGIN_DLL_NAME}) not found. Tried:\n  - {tried}"
            )
        })?;

    std::fs::copy(dll_src, &dst).map_err(|e| format!("Copy failed: {e}"))?;

    Ok(format!("Installed to: {}", dst.display()))
}
