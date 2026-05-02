//! Project validation, SII preview generation, and mod ZIP export.

use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use regex::Regex;

use crate::core::mat_resolver::{
    mat_to_tobj_virtual, resolve_dds_from_tobj_any_root, resolve_mat_any_root,
    resolve_tobj_from_mat_any_root, tobj_to_dds_virtual,
};
use crate::core::models::{
    DashboardProject, ExportSummary, TextTemplate, ValidationError, ValidationSeverity,
};
use crate::core::sii_parser::parse_sii_file;
use crate::core::sii_exporter::{export_project, project_with_export_defaults};
use crate::core::sii_parser::parse_dashboard_with_templates;
use crate::core::validator::validate;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

/// Load `dashboard_path` and merge `ui/template/dashboard_text.<mod_id>.sii` when present.
#[tauri::command]
pub fn import_dashboard_from_sii(
    dashboard_path: String,
    mod_id: String,
    game_root: Option<String>,
    mod_roots: Option<Vec<String>>,
) -> Result<DashboardProject, String> {
    let p = PathBuf::from(dashboard_path.trim());
    let mut project = parse_dashboard_with_templates(&p, mod_id.trim())
        .map_err(|e| format!("SII parse error: {e:#}"))?;

    if let Some(ref g) = game_root {
        let t = g.trim();
        if !t.is_empty() {
            project.game_root_path = Some(t.to_string());
        }
    }

    let gr = game_root
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let roots_pb = asset_roots_ordered(mod_roots.clone(), gr);
    let template_dirs = super::asset_roots::template_search_dirs(gr, &roots_pb);

    let mut extra_templates: Vec<TextTemplate> = Vec::new();
    for dir in &template_dirs {
        let Ok(rd) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in rd.flatten() {
            let path = entry.path();
            if path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("sii"))
                != Some(true)
            {
                continue;
            }
            if let Ok(tp) = parse_sii_file(&path) {
                for t in tp.templates {
                    if !project
                        .templates
                        .iter()
                        .any(|existing| existing.name == t.name)
                    {
                        extra_templates.push(t);
                    }
                }
            }
        }
    }
    project.templates.extend(extra_templates);

    Ok(project)
}

/// Bounding boxes for canvas overlay (board space: Y from top, origin top-left).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementRectInfo {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub layer: i32,
    pub dashboard_id: i32,
    pub label: String,
}

#[tauri::command]
pub fn get_element_rects(project: DashboardProject, screen_id: i32) -> Vec<ElementRectInfo> {
    let screen = project.screens.iter().find(|s| s.screen_id == screen_id);
    let Some(screen) = screen else {
        return vec![];
    };
    let bh = project.canvas_height.max(1);
    screen
        .elements
        .iter()
        .map(|el| ElementRectInfo {
            id: el.id.clone(),
            x: el.coords_l,
            y: bh - el.coords_t,
            w: (el.coords_r - el.coords_l).max(0),
            h: (el.coords_t - el.coords_b).max(0),
            layer: el.layer,
            dashboard_id: el.dashboard_id,
            label: if el.default_value.is_empty() {
                el.name.clone()
            } else {
                el.default_value.clone()
            },
        })
        .collect()
}

#[tauri::command]
pub fn import_templates_from_sii(path: String) -> Result<Vec<TextTemplate>, String> {
    let p = Path::new(path.trim());
    let proj = parse_sii_file(p).map_err(|e| e.to_string())?;
    Ok(proj.templates)
}

#[tauri::command]
pub fn validate_project(project: DashboardProject) -> Vec<ValidationError> {
    let p = project_with_export_defaults(&project);
    validate(&p)
}

#[tauri::command]
pub fn generate_sii_preview(project: DashboardProject) -> Result<(String, String), String> {
    export_project(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_mod_zip(project: DashboardProject, output_path: String) -> Result<ExportSummary, String> {
    let prepared = project_with_export_defaults(&project);
    let issues = validate(&prepared);
    let errors: Vec<&ValidationError> = issues
        .iter()
        .filter(|i| i.severity == ValidationSeverity::Error)
        .collect();
    if !errors.is_empty() {
        return Err(errors
            .iter()
            .map(|e| e.message.as_str())
            .collect::<Vec<_>>()
            .join("\n"));
    }

    let (dashboard_sii, template_sii) = export_project(&project).map_err(|e| e.to_string())?;

    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let dash_rel = format!("ui/dashboard/{}.sii", prepared.dashboard_file_name);
    let tpl_rel = format!("ui/template/dashboard_text.{}.sii", prepared.mod_id);

    zip.start_file(&dash_rel, opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(dashboard_sii.as_bytes())
        .map_err(|e| e.to_string())?;
    zip.start_file(
        &tpl_rel,
        SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
    )
    .map_err(|e| e.to_string())?;
    zip.write_all(template_sii.as_bytes())
        .map_err(|e| e.to_string())?;
    zip.finish().map_err(|e| e.to_string())?;

    let warnings: Vec<ValidationError> = issues
        .into_iter()
        .filter(|i| i.severity != ValidationSeverity::Error)
        .collect();

    Ok(ExportSummary {
        warnings,
        output_path,
        file_count: 2,
    })
}

/// Base64-encoded PNG bytes (or raw UTF-8 bytes if `is_base64` is false) written to disk.
#[tauri::command]
pub fn write_binary_file(path: String, data: String, is_base64: bool) -> Result<(), String> {
    let bytes = if is_base64 {
        STANDARD
            .decode(&data)
            .map_err(|e| format!("base64 decode: {e}"))?
    } else {
        data.into_bytes()
    };
    std::fs::write(Path::new(&path), &bytes).map_err(|e| format!("write {path}: {e}"))
}

/// Result of copying a `.dds` into the mod under `material/ui/`.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDdsResult {
    pub dest_path: String,
    pub virtual_dds_path: String,
}

/// Find `…/material/ui` under the mod that owns `project.sii_source_directory`.
fn resolve_mod_material_ui_dir(project: &DashboardProject) -> Result<PathBuf, String> {
    let Some(dir) = project
        .sii_source_directory
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    else {
        return Err(
            "Project has no SII source folder. Import a dashboard from SII or set the path."
                .into(),
        );
    };
    let start = Path::new(dir);
    let mut cur = start.to_path_buf();
    for _ in 0..14 {
        let has_def = cur.join("def").is_dir();
        let has_mat = cur.join("material").is_dir();
        if has_def || has_mat {
            let mat_ui = cur.join("material").join("ui");
            std::fs::create_dir_all(&mat_ui).map_err(|e| e.to_string())?;
            return Ok(mat_ui);
        }
        if !cur.pop() {
            break;
        }
    }
    let fallback = start.join("material").join("ui");
    std::fs::create_dir_all(&fallback).map_err(|e| e.to_string())?;
    Ok(fallback)
}

/// Copy a DDS from anywhere on disk into this mod's `material/ui/` (next to `def/` when found).
#[tauri::command]
pub fn import_dds_into_project(
    project: DashboardProject,
    source_dds_path: String,
) -> Result<ImportDdsResult, String> {
    let src = Path::new(source_dds_path.trim());
    if !src.is_file() {
        return Err(format!("Source DDS not found: {}", src.display()));
    }
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !ext.eq_ignore_ascii_case("dds") {
        return Err("Selected file must have a .dds extension.".into());
    }
    let dest_dir = resolve_mod_material_ui_dir(&project)?;
    let fname = src
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?;
    let dest = dest_dir.join(fname);
    std::fs::copy(src, &dest).map_err(|e| format!("Copy failed: {e}"))?;
    let vpath = format!("/material/ui/{}", fname.to_string_lossy());
    Ok(ImportDdsResult {
        dest_path: dest.to_string_lossy().into_owned(),
        virtual_dds_path: vpath,
    })
}

/// Create a `.tobj` + `.mat` file pair next to a DDS file for use as a UI texture.
///
/// `virtual_dds_path` must be a virtual path like `/material/ui/my_icon.dds`.
/// The `.tobj` and `.mat` are written alongside the real DDS file on disk.
/// Returns `(tobj_real_path, mat_real_path, virtual_mat_path)`.
#[tauri::command]
pub fn create_tobj_mat_for_dds(
    dds_real_path: String,
    virtual_dds_path: String,
) -> Result<(String, String, String), String> {
    let dds_path = Path::new(dds_real_path.trim());
    if !dds_path.is_file() {
        return Err(format!("DDS file not found: {dds_real_path}"));
    }

    let virtual_dds = virtual_dds_path.trim().trim_start_matches('/');
    if virtual_dds.is_empty() {
        return Err("virtual_dds_path is empty".into());
    }
    // Derive virtual .tobj and .mat paths by replacing extension
    let virtual_tobj = {
        let v = virtual_dds_path.trim();
        if let Some(stem) = v.strip_suffix(".dds").or_else(|| v.strip_suffix(".DDS")) {
            format!("{stem}.tobj")
        } else {
            format!("{v}.tobj")
        }
    };
    let virtual_mat = {
        let v = virtual_dds_path.trim();
        if let Some(stem) = v.strip_suffix(".dds").or_else(|| v.strip_suffix(".DDS")) {
            format!("{stem}.mat")
        } else {
            format!("{v}.mat")
        }
    };

    // Real paths next to the DDS file
    let parent = dds_path.parent().ok_or("DDS file has no parent dir")?;
    let dds_stem = dds_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("DDS file has no stem")?;
    let tobj_real = parent.join(format!("{dds_stem}.tobj"));
    let mat_real = parent.join(format!("{dds_stem}.mat"));

    // ---- Build TOBJ binary (UI Icon type) ----
    // Default header from TOBJEditor's getDefaultBytes() + UI Icon mode overrides
    let mut header: [u8; 48] = [
        0x01, 0x0A, 0xB1, 0x70, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00,
        0x02, 0x00, 0x03, 0x03, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00, 0x35, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];
    // UI Icon overrides (TOBJEditor index 3)
    header[22] = 0x00;
    header[28] = 0x02;
    header[30] = 0x02;
    header[31] = 0x02;
    header[33] = 0x01;
    // Texture path = virtual DDS path (same as what SCS expects in .tobj)
    let path_bytes = virtual_dds_path.trim().as_bytes().to_vec();
    header[40] = path_bytes.len().min(255) as u8;

    let mut tobj_bytes = header.to_vec();
    tobj_bytes.extend_from_slice(&path_bytes);
    std::fs::write(&tobj_real, &tobj_bytes)
        .map_err(|e| format!("write tobj {}: {e}", tobj_real.display()))?;

    // ---- Build MAT text ----
    let mat_content = format!(
        "material : \"eut2.ui\"\n{{\n\ttexture : \"tex\"\n\ttexture[0] : \"{virtual_tobj}\"\n}}\n"
    );
    std::fs::write(&mat_real, mat_content.as_bytes())
        .map_err(|e| format!("write mat {}: {e}", mat_real.display()))?;

    Ok((
        tobj_real.to_string_lossy().into_owned(),
        mat_real.to_string_lossy().into_owned(),
        virtual_mat,
    ))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileInfo {
    pub r#type: String,
    pub virtual_path: String,
    pub real_path: Option<String>,
    pub found: bool,
    pub size_bytes: u64,
}

fn asset_roots_ordered(
    mod_roots: Option<Vec<String>>,
    game_root: Option<&str>,
) -> Vec<PathBuf> {
    super::asset_roots::asset_search_paths(mod_roots, game_root)
}

fn collect_push(
    result: &mut Vec<ProjectFileInfo>,
    seen: &mut std::collections::HashSet<String>,
    ftype: &str,
    vpath: &str,
    found: bool,
    real: Option<PathBuf>,
    size: u64,
) {
    let key = format!("{ftype}:{vpath}");
    if !seen.insert(key) {
        return;
    }
    result.push(ProjectFileInfo {
        r#type: ftype.to_string(),
        virtual_path: vpath.to_string(),
        real_path: real.as_ref().map(|p| p.to_string_lossy().into_owned()),
        found,
        size_bytes: size,
    });
}

fn collect_push_mat_chain(
    result: &mut Vec<ProjectFileInfo>,
    seen: &mut std::collections::HashSet<String>,
    roots: &[PathBuf],
    mat_vpath: &str,
) {
    let real_mat = resolve_mat_any_root(roots, mat_vpath);
    let (mf, ms) = real_mat
        .as_ref()
        .map(|p| (p.exists(), p.metadata().map(|m| m.len()).unwrap_or(0)))
        .unwrap_or((false, 0));
    collect_push(result, seen, "MAT", mat_vpath, mf, real_mat.clone(), ms);

    let Some(ref mat_pb) = real_mat else {
        return;
    };
    let Some(ref tobj_v) = mat_to_tobj_virtual(mat_pb) else {
        return;
    };
    let tobj_pb = resolve_tobj_from_mat_any_root(roots, mat_pb);
    let (tf, ts) = tobj_pb
        .as_ref()
        .map(|p| (p.exists(), p.metadata().map(|m| m.len()).unwrap_or(0)))
        .unwrap_or((false, 0));
    collect_push(result, seen, "TOBJ", tobj_v, tf, tobj_pb.clone(), ts);

    let Some(ref tb) = tobj_pb else {
        return;
    };
    let Some(dds_v) = tobj_to_dds_virtual(tb) else {
        return;
    };
    let dds_pb = resolve_dds_from_tobj_any_root(roots, tb);
    let (df, ds) = dds_pb
        .as_ref()
        .map(|p| (p.exists(), p.metadata().map(|m| m.len()).unwrap_or(0)))
        .unwrap_or((false, 0));
    collect_push(result, seen, "DDS", &dds_v, df, dds_pb.clone(), ds);
}

/// Resolve a game-relative path (slashes) under any search root.
fn resolve_file_any(roots: &[PathBuf], virtual_path: &str) -> Option<PathBuf> {
    let rel = virtual_path.trim().trim_start_matches('/');
    if rel.is_empty() {
        return None;
    }
    for root in roots {
        let mut p = root.clone();
        for seg in rel.split('/') {
            if seg.is_empty() {
                continue;
            }
            p.push(seg);
        }
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

/// Collect referenced assets and virtual export paths for the project.
#[tauri::command]
pub fn collect_project_files(
    project: DashboardProject,
    game_root: Option<String>,
    mod_roots: Vec<String>,
) -> Vec<ProjectFileInfo> {
    let roots = asset_roots_ordered(
        if mod_roots.is_empty() {
            None
        } else {
            Some(mod_roots)
        },
        game_root.as_deref(),
    );

    let mut result: Vec<ProjectFileInfo> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    let re_src = Regex::new(r#"src=([^\s<>'"]+)"#).expect("regex");
    let re_face = Regex::new(r#"face=([^\s<>'"]+\.font)"#).expect("regex");
    let re_mat_ext = Regex::new(r"(?i)\.mat$").expect("regex");

    let dash_vpath = format!("ui/dashboard/{}.sii", project.dashboard_file_name);
    let tpl_vpath = format!("ui/template/dashboard_text.{}.sii", project.mod_id);

    let dash_disk = project.sii_source_directory.as_ref().map(|d| {
        Path::new(d.trim()).join(format!("{}.sii", project.dashboard_file_name))
    });
    let tpl_disk = project.sii_source_directory.as_ref().map(|d| {
        Path::new(d.trim()).join(format!("dashboard_text.{}.sii", project.mod_id))
    });

    if let Some(ref p) = dash_disk {
        if p.is_file() {
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            collect_push(&mut result, &mut seen, "SII", &dash_vpath, true, Some(p.clone()), size);
        } else {
            collect_push(&mut result, &mut seen, "SII", &dash_vpath, false, None, 0);
        }
    } else {
        collect_push(&mut result, &mut seen, "SII", &dash_vpath, false, None, 0);
    }

    if let Some(ref p) = tpl_disk {
        if p.is_file() {
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            collect_push(&mut result, &mut seen, "SII", &tpl_vpath, true, Some(p.clone()), size);
        } else {
            collect_push(&mut result, &mut seen, "SII", &tpl_vpath, false, None, 0);
        }
    } else {
        collect_push(&mut result, &mut seen, "SII", &tpl_vpath, false, None, 0);
    }

    for t in &project.templates {
        collect_push(
            &mut result,
            &mut seen,
            "TEMPLATE",
            &t.name,
            true,
            None,
            t.text.len() as u64,
        );
    }

    for screen in &project.screens {
        for el in &screen.elements {
            if !el.look_template.is_empty() {
                let found = project
                    .templates
                    .iter()
                    .any(|tm| tm.name == el.look_template);
                collect_push(
                    &mut result,
                    &mut seen,
                    "TEMPLATE",
                    &el.look_template,
                    found,
                    None,
                    0,
                );
            }

            for text in [el.text_content.as_str(), el.gauge_material.as_str()] {
                if text.is_empty() {
                    continue;
                }
                for cap in re_src.captures_iter(text) {
                    if let Some(m) = cap.get(1) {
                        let s = m.as_str();
                        if re_mat_ext.is_match(s) {
                            collect_push_mat_chain(&mut result, &mut seen, &roots, s);
                        }
                    }
                }
                for cap in re_face.captures_iter(text) {
                    if let Some(m) = cap.get(1) {
                        let s = m.as_str();
                        if let Some(real) = resolve_file_any(&roots, s) {
                            let size = real.metadata().map(|m| m.len()).unwrap_or(0);
                            collect_push(&mut result, &mut seen, "FONT", s, true, Some(real), size);
                        } else {
                            collect_push(&mut result, &mut seen, "FONT", s, false, None, 0);
                        }
                    }
                }
            }

            if !el.gauge_material.is_empty() {
                let s = el.gauge_material.trim();
                if re_mat_ext.is_match(s) {
                    collect_push_mat_chain(&mut result, &mut seen, &roots, s);
                }
            }
        }
    }

    result.sort_by(|a, b| {
        a.r#type
            .cmp(&b.r#type)
            .then(a.virtual_path.cmp(&b.virtual_path))
    });
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::models::{
        DashboardElement, DashboardProject, DashboardScreen, ElementType, TextTemplate,
    };
    use uuid::Uuid;

    fn minimal_project() -> DashboardProject {
        let win = "_nameless.win".to_string();
        let shared = "_nameless._.sharedisplay".to_string();
        let g950 = DashboardElement {
            id: Uuid::new_v4().to_string(),
            element_type: ElementType::Group,
            name: shared.clone(),
            parent_name: win.clone(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 800,
            coords_t: 300,
            coords_b: 0,
            dashboard_id: 950,
            layer: -1,
            fitting: Some(false),
            ..default_el()
        };
        DashboardProject {
            window_unit_name: win,
            mod_id: "test".into(),
            dashboard_file_name: "test".into(),
            screens: vec![DashboardScreen {
                id: Uuid::new_v4().to_string(),
                unit_name: shared,
                screen_id: 950,
                display_name: "s".into(),
                elements: vec![g950],
            }],
            templates: vec![TextTemplate {
                name: "txt.test.a".into(),
                text: "<font>%0</font>".into(),
            }],
            sii_source_directory: None,
            game_root_path: None,
            canvas_width: 800,
            canvas_height: 800,
        }
    }

    fn default_el() -> DashboardElement {
        DashboardElement {
            id: Uuid::new_v4().to_string(),
            element_type: ElementType::Text,
            name: String::new(),
            parent_name: String::new(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 0,
            coords_t: 0,
            coords_b: 0,
            dashboard_id: 0,
            layer: 0,
            fitting: None,
            text_content: String::new(),
            look_template: String::new(),
            default_value: String::new(),
            is_vertical: false,
            bar_min_value: 0.0,
            bar_max_value: 1.0,
            bar_min_size: 0,
            bar_max_size: 0,
            gauge_min_angle: 0.0,
            gauge_max_angle: 0.0,
            gauge_value_min: 0.0,
            gauge_value_max: 1.0,
            gauge_value_off: 0.0,
            gauge_material: String::new(),
            gauge_xref_pos: 0,
            gauge_yref_pos: 0,
            gauge_off_x: 0,
            gauge_off_y: 0,
            gauge_smooth_move: false,
            is_visible: true,
        }
    }

    /// Step 22: same path as the UI (defaults → validate → SII strings).
    #[test]
    fn validate_and_sii_preview_pipeline_minimal() {
        let p = minimal_project();
        let issues = validate_project(p.clone());
        assert!(
            !issues
                .iter()
                .any(|i| i.severity == ValidationSeverity::Error),
            "unexpected errors: {:?}",
            issues
        );
        let preview = generate_sii_preview(p);
        assert!(preview.is_ok(), "{:?}", preview.err());
    }
}
