//! Live telemetry from shared memory + optional PNG preview of the active screen.

use std::collections::HashMap;
use std::io::Cursor;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{DynamicImage, ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};

use crate::commands::asset_roots::asset_search_paths;
use crate::core::models::DashboardProject;
use crate::core::telemetry::{normalize, read_shared_memory_telemetry};
use crate::core::FontRegistry;
use crate::rendering::{DashboardCanvasRenderer, TextureCache};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryEntry {
    pub id: i32,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySnapshot {
    pub connected: bool,
    pub sdk_active: u32,
    pub entries: Vec<TelemetryEntry>,
}

/// Poll shared memory; returns empty `entries` when the game / plugin is not running.
#[tauri::command]
pub fn read_telemetry_snapshot() -> TelemetrySnapshot {
    let Some(raw) = read_shared_memory_telemetry() else {
        return TelemetrySnapshot {
            connected: false,
            sdk_active: 0,
            entries: vec![],
        };
    };
    let connected = raw.sdk_active != 0;
    let sdk_active = raw.sdk_active;
    let map = normalize(&raw);
    let mut entries: Vec<TelemetryEntry> = map
        .into_iter()
        .map(|(id, value)| TelemetryEntry { id, value })
        .collect();
    entries.sort_by_key(|e| e.id);
    TelemetrySnapshot {
        connected,
        sdk_active,
        entries,
    }
}

fn preview_output_dimensions(vw: u32, vh: u32, max_edge: u32) -> (u32, u32) {
    let max_edge = max_edge.clamp(64, 4096);
    if vw >= vh {
        let ow = max_edge;
        let oh = ((max_edge as u64 * vh as u64 + vw as u64 - 1) / vw as u64).max(1) as u32;
        (ow, oh)
    } else {
        let oh = max_edge;
        let ow = ((max_edge as u64 * vw as u64 + vh as u64 - 1) / vh as u64).max(1) as u32;
        (ow, oh)
    }
}

/// Tiny-skia screen preview as PNG (standard base64). Uses mod roots + `game_root_path` for DDS/fonts.
#[tauri::command]
pub fn render_screen_preview_png_b64(
    project: DashboardProject,
    screen_id: i32,
    size: Option<u32>,
    mod_roots: Option<Vec<String>>,
    telemetry_overrides: Option<HashMap<String, f64>>,
) -> Result<Option<String>, String> {
    let root = project
        .game_root_path
        .as_deref()
        .filter(|p| !p.is_empty())
        .ok_or_else(|| "Set game install root (project paths or settings).".to_string())?;
    if !Path::new(root).is_dir() {
        return Err(format!("game_root is not a directory: {}", root));
    }

    let screen = project
        .screens
        .iter()
        .find(|s| s.screen_id == screen_id)
        .ok_or_else(|| format!("No screen with screen_id {}", screen_id))?;

    let shared_screen = project.screens.iter().find(|s| s.screen_id == 950 && s.id != screen.id);

    let vw = project.canvas_width.max(1) as u32;
    let vh = project.canvas_height.max(1) as u32;
    let max_edge = size.unwrap_or(800);
    let (out_w, out_h) = preview_output_dimensions(vw, vh, max_edge);

    let mut tele_map: HashMap<i32, f64> = HashMap::new();
    if let Some(over) = telemetry_overrides {
        for (k, v) in over {
            if let Ok(id) = k.parse::<i32>() {
                tele_map.insert(id, v);
            }
        }
    }
    let tele_ref = if tele_map.is_empty() {
        None
    } else {
        Some(&tele_map)
    };

    let roots = asset_search_paths(mod_roots, Some(root));
    if roots.is_empty() {
        return Err("No valid asset search path.".into());
    }
    let tex = TextureCache::from_roots(roots.clone());
    let fonts = FontRegistry::from_roots(roots);
    let r = DashboardCanvasRenderer {
        textures: &tex,
        fonts: &fonts,
    };

    let virt_w = project.canvas_width.max(1);
    let virt_h = project.canvas_height.max(1);

    let Some(pm) = r
        .render_screen(
            screen,
            out_w,
            out_h,
            virt_w,
            virt_h,
            shared_screen,
            tele_ref,
            &project.templates,
        )
        .map_err(|e| e.to_string())?
    else {
        return Ok(None);
    };

    let w = pm.width();
    let h = pm.height();
    let rgba = pm.data().to_vec();
    let buf: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_raw(w, h, rgba).ok_or_else(|| "Pixmap buffer size mismatch".to_string())?;
    let dyn_img = DynamicImage::ImageRgba8(buf);
    let mut png = Vec::new();
    dyn_img
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(Some(STANDARD.encode(png)))
}
