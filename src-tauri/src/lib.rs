pub mod commands;
pub mod core;
pub mod rendering;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::texture::load_mat_texture_png_b64,
            commands::project::validate_project,
            commands::project::generate_sii_preview,
            commands::project::export_mod_zip,
            commands::project::import_dashboard_from_sii,
            commands::project::get_element_rects,
            commands::project::import_templates_from_sii,
            commands::project::write_binary_file,
            commands::project::collect_project_files,
            commands::project::create_tobj_mat_for_dds,
            commands::project::import_dds_into_project,
            commands::plugin::install_plugin,
            commands::telemetry::read_telemetry_snapshot,
            commands::telemetry::render_screen_preview_png_b64,
            commands::app_state::load_app_settings,
            commands::app_state::save_app_settings,
            commands::app_state::load_project_json,
            commands::app_state::save_project_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
