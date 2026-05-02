//! Build ordered search paths: mod folders first, then base game install.

use std::path::PathBuf;

/// Non-empty, existing directories only, in order.
pub fn asset_search_paths(mod_roots: Option<Vec<String>>, game_root: Option<&str>) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    if let Some(mods) = mod_roots {
        for s in mods {
            let p = PathBuf::from(s.trim());
            if p.is_dir() && !out.contains(&p) {
                out.push(p);
            }
        }
    }
    if let Some(g) = game_root {
        let p = PathBuf::from(g.trim());
        if p.is_dir() && !out.contains(&p) {
            out.push(p);
        }
    }
    out
}

/// `ui/template` directories under each search root (mods first, then game).
pub fn template_search_dirs(game_root: Option<&str>, mod_roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for root in mod_roots {
        let p = root.join("ui").join("template");
        if p.is_dir() {
            dirs.push(p);
        }
    }
    if let Some(g) = game_root {
        let p = PathBuf::from(g.trim()).join("ui").join("template");
        if p.is_dir() && !dirs.contains(&p) {
            dirs.push(p);
        }
    }
    dirs
}

/// `font` directories under each search root.
#[allow(dead_code)]
pub fn font_search_dirs(game_root: Option<&str>, mod_roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for root in mod_roots {
        let p = root.join("font");
        if p.is_dir() {
            dirs.push(p);
        }
    }
    if let Some(g) = game_root {
        let p = PathBuf::from(g.trim()).join("font");
        if p.is_dir() && !dirs.contains(&p) {
            dirs.push(p);
        }
    }
    dirs
}

