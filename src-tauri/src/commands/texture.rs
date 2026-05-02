//! Tauri commands for loading DDS-backed textures as PNG (sprite picker).

use std::io::Cursor;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{DynamicImage, ImageBuffer, Rgba};

use crate::commands::asset_roots::asset_search_paths;
use crate::core::dds_decoder::decode_dds;
use crate::core::mat_resolver::resolve_texture_search_roots;

/// Resolve a virtual `.mat` path (mod folders first, then `game_root`), decode DDS → PNG as **standard base64**.
#[tauri::command]
pub fn load_mat_texture_png_b64(
    game_root: String,
    mat_virtual_path: String,
    mod_roots: Option<Vec<String>>,
) -> Result<String, String> {
    let roots = asset_search_paths(mod_roots, Some(&game_root));
    if roots.is_empty() {
        return Err("No valid game or mod directory (set game root in Settings).".into());
    }

    let dds_path = resolve_texture_search_roots(&roots, &mat_virtual_path).ok_or_else(|| {
        "Could not resolve .mat → .tobj → .dds (check paths and virtual material path).".to_string()
    })?;

    let (rgba, w, h) = decode_dds(&dds_path).map_err(|e| e.to_string())?;
    let buf: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_raw(w, h, rgba).ok_or_else(|| "DDS rgba size mismatch".to_string())?;

    let dyn_img = DynamicImage::ImageRgba8(buf);
    let mut png = Vec::new();
    dyn_img
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(STANDARD.encode(png))
}
