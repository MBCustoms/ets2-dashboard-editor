const en = {
  // ── App ──
  app_title: "ETS2 Dashboard Editor",

  // ── Menus ──
  menu_file: "File",
  menu_view: "View",
  menu_help: "Help",

  // File menu
  file_new: "New project\u2026",
  file_open: "Open\u2026",
  file_save: "Save",
  file_save_as: "Save as\u2026",
  file_canvas_size: "Canvas size\u2026",
  file_import_sii: "Import SII\u2026",
  file_import_templates: "Import templates\u2026",
  file_export_mod: "Export mod\u2026",

  // View menu
  view_sii_preview: "SII preview\u2026",
  view_settings: "Settings\u2026",

  // Help menu
  help_documentation: "Documentation\u2026",
  help_about: "About\u2026",

  // ── Header toolbar ──
  toolbar_undo: "Undo",
  toolbar_redo: "Redo",
  toolbar_cut: "Cut",
  toolbar_copy: "Copy",
  toolbar_paste: "Paste",
  toolbar_screen: "Screen",
  toolbar_grid: "Grid",
  toolbar_size: "Size",
  toolbar_snap: "Snap",
  undo_nothing: "Nothing to undo",
  redo_nothing: "Nothing to redo",
  undo_history: "History",
  redo_next: "Next",

  // ── Status bar ──
  status_origin: "origin bottom-left",
  status_zoom: "Zoom",
  status_selected: "Selected",
  status_file: "File",
  status_unsaved: "(unsaved)",
  status_modified: "Modified",
  status_saved: "Saved",

  // ── Common buttons ──
  btn_close: "Close",
  btn_cancel: "Cancel",
  btn_save: "Save",
  btn_create: "Create",
  btn_browse: "Browse\u2026",
  btn_remove: "Remove",
  btn_add_folder: "Add folder\u2026",

  // ── Unsaved changes ──
  unsaved_exit: "You have unsaved changes. Exit without saving?",

  // ── About dialog ──
  about_description: "A visual editor for Euro Truck Simulator 2 & ATS dashboard mods.",
  about_created_by: "Created by",

  // ── Settings dialog ──
  settings_title: "Settings",
  settings_tab_general: "General",
  settings_tab_plugin: "Plugin",
  settings_game_root: "Game install root",
  settings_game_root_apply: "Also set on current project (sprite picker / preview)",
  settings_mod_workspace: "Mod workspace folders (optional)",
  settings_mod_workspace_note:
    "Resolved before the base game path for .mat, fonts, and live preview.",
  settings_grid_size: "Grid size",
  settings_default_zoom: "Default zoom",
  settings_snap: "Snap to grid",
  settings_autosave: "Auto-save interval (seconds, 0 = off)",
  settings_theme: "Theme",
  settings_theme_dark: "Dark",
  settings_theme_light: "Light",
  settings_theme_system: "System",
  settings_language: "Language",
  settings_recent_files: "Recent project files",
  settings_persist_note:
    "Persisted as settings.json in the Tauri app config directory. Grid, snap, and zoom apply on Save.",

  // ── Plugin section ──
  plugin_title: "SCS Telemetry Plugin",
  plugin_desc:
    "Enables live telemetry. Select eurotrucks2.exe & amtrucks.exe and install \u2014 scsdashboardeditor.dll is copied into the game\u2019s plugins/ folder (place the DLL next to the editor executable or in the project root for development).",
  plugin_exe_label: "eurotrucks2.exe & amtrucks.exe path",
  plugin_install: "Install plugin",
  plugin_installed_msg: "Plugin installed. Restart ETS2 to activate.",
  plugin_select_first: "Select EuroTrucks2.exe first.",

  // ── New project dialog ──
  new_project_title: "New project",
  new_project_desc:
    "Creates a main screen (100) and shared screen (950) with electricity backgrounds (ids 10 / 20). Export adds any missing pieces for older projects.",
  new_project_mod_id: "Mod ID",
  new_project_filename: "Dashboard file name (no .sii)",
  new_project_unit_name: "Window unit name",
  new_project_canvas_size: "Canvas size",
  new_project_width: "Width (px)",
  new_project_height: "Height (px)",

  // ── Export mod dialog ──
  export_title: "Export mod (ZIP)",
  export_desc:
    "Click export to validate, choose a path, then write ui/dashboard/*.sii and ui/template/dashboard_text.*.sii at the zip root (SCS mod layout).",
  export_working: "Working\u2026",
  export_no_project: "No project loaded.",
  export_run_validate: "Run export to validate the project.",
  export_warnings_only: "Validation passed with warnings only.",
  export_validate_zip: "Validate & choose ZIP\u2026",
  export_wrote: "Wrote",
  export_files_to: "files to",
  export_warnings: "warnings",

  // ── Left sidebar ──
  sidebar_screens: "Screens",
  sidebar_library: "Library",
  sidebar_templates: "Templates",
  sidebar_files: "Files",
  sidebar_telemetry: "Telemetry",
  sidebar_layers: "Layers",

  // ── Game root warning ──
  warning_game_root_title: "Game root not set",
  warning_game_root_desc:
    "DDS textures and fonts won\u2019t load. Set the ETS2/ATS install path in Settings \u2192 Game root.",
  warning_dismiss: "Dismiss",

  // ── Canvas toolbar ──
  zoom_out: "Zoom out",
  zoom_in: "Zoom in",
  zoom_level: "Zoom level",
  zoom_actual: "Actual pixels (1:1)",
  zoom_fit: "Fit to viewport",
  zoom_actual_desc: "Reset zoom to 100% and nudge pan to a comfortable default.",
  zoom_fit_desc: "Scale and center the canvas so the whole board fits inside the editor area.",
  layer_label: "Layer",
  bring_forward: "Bring forward",
  bring_forward_desc: "Move selected elements one layer up (drawn in front of others on the same screen).",
  send_backward: "Send backward",
  send_backward_desc: "Move selected elements one layer down (behind others on the same screen).",
  align_label: "Align",
  align_left: "Align left",
  align_left_desc: "Line up left edges of all selected elements.",
  align_right: "Align right",
  align_right_desc: "Line up right edges of all selected elements.",
  align_top: "Align top",
  align_top_desc: "Line up top edges of all selected elements.",
  align_bottom: "Align bottom",
  align_bottom_desc: "Line up bottom edges of all selected elements.",
  align_center_h: "Center horizontally",
  align_center_h_desc: "Center each selection horizontally within the horizontal span of the selection.",
  align_center_v: "Center vertically",
  align_center_v_desc: "Center each selection vertically within the vertical span of the selection.",
  dist_h: "Distribute horizontally",
  dist_h_desc: "Evenly space centers along X for three or more selected elements.",
  dist_v: "Distribute vertically",
  dist_v_desc: "Evenly space centers along Y for three or more selected elements.",
  show_all: "Show all",
  show_all_desc: "Set every element on the active screen to visible.",
  hide_all: "Hide all",
  hide_all_desc: "Hide every element on the active screen (visibility flag).",
  wireframe_on: "Wireframe overlay",
  wireframe_on_desc: "Draw only element rectangles (and optional collision tint) for layout work.",
  wireframe_off: "Rendered preview",
  wireframe_off_desc: "Return to the full Rust-rendered preview with textures and fonts.",
  collision: "Collision highlight",
  collision_desc: "Highlight overlapping elements on the same layer in red so you can fix accidental overlaps.",
  selection_chrome_show: "Show selection chrome",
  selection_chrome_show_desc: "Show selection outline, handles, and labels again.",
  selection_chrome_hide: "Hide selection chrome",
  selection_chrome_hide_desc: "Hide the yellow outline, resize handles, and floating name tags for the current selection.",
  uv_no_model: "UV overlay (no model)",
  uv_no_model_desc: "Load a model in the 3D viewer; the UV map will become available automatically.",
  uv_show: "Show UV overlay",
  uv_show_desc: "Overlay the loaded 3D model\u2019s UV edges onto the dashboard canvas as cyan lines \u2014 use it to align elements to the physical screen areas on the model.",
  uv_hide: "Hide UV overlay",
  export_png: "Export PNG",
  export_png_desc: "Render the active screen with the Rust engine and save a PNG (requires game root).",
  export_png_no_root: "Set game root for PNG export",
  view_2d: "2D Canvas",
  view_2d_desc: "Show the dashboard canvas editor.",
  view_3d: "3D Viewer",
  view_3d_desc: "Show the 3D model viewer for the physical dashboard part.",
  view_split: "Split view",
  view_split_desc: "Show the dashboard canvas and 3D viewer side by side.",

  // ── Splash screen ──
  splash_loading: "Loading\u2026",
} as const;

export default en;
export type TranslationKey = keyof typeof en;
export type TranslationMap = Record<TranslationKey, string>;
