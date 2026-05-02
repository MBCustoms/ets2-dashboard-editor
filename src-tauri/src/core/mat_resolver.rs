//! Resolve SCS virtual `/material/...` paths to files under a game installation root.

use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;
use std::sync::OnceLock;

fn re_source() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?m)source\s*:\s*"([^"]+)""#).unwrap())
}

fn re_texture0() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?m)texture\[\s*0\s*\]\s*:\s*"([^"]+)""#).unwrap())
}

fn re_texture_legacy() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?m)^\s*texture\s*:\s*"([^"]+\.tobj)""#).unwrap()
    })
}

/// Maps `/material/...` virtual paths to `<game_root>/material/...` on disk.
#[derive(Debug, Clone)]
pub struct MatResolver {
    game_root: PathBuf,
}

impl MatResolver {
    pub fn new(game_root: impl AsRef<Path>) -> Self {
        Self {
            game_root: game_root.as_ref().to_path_buf(),
        }
    }

    pub fn game_root(&self) -> &Path {
        &self.game_root
    }

    /// Virtual path like `/material/ui/dashboard/volvo/pict.mat` → absolute `.mat` path.
    pub fn resolve_mat(&self, virtual_path: &str) -> Option<PathBuf> {
        let rel = strip_leading_slash(trim_virtual(virtual_path));
        if rel.is_empty() {
            return None;
        }
        let rel = if rel.to_ascii_lowercase().ends_with(".mat") {
            rel
        } else {
            format!("{rel}.mat")
        };
        let p = self.game_root.join(path_from_slash(&rel));
        p.exists().then_some(p)
    }

    /// Read a `.mat` file and return the first `.tobj` reference as an absolute path.
    pub fn mat_to_tobj(&self, mat_path: &Path) -> Option<PathBuf> {
        let text = fs::read_to_string(mat_path).ok()?;
        let parent = mat_path.parent()?;
        let tobj_ref = first_tobj_reference(&text)?;
        resolve_sidecar_path(&self.game_root, parent, &tobj_ref)
    }

    /// Read a `.tobj` (binary + embedded UTF-8) and return the virtual `/material/.../*.dds` path.
    pub fn tobj_to_dds_virtual(tobj_path: &Path) -> Option<String> {
        let bytes = fs::read(tobj_path).ok()?;
        extract_dds_virtual_path(&bytes)
    }

    /// Full chain: virtual `.mat` path → physical `.dds` path.
    pub fn resolve_texture(&self, virtual_mat_path: &str) -> Option<PathBuf> {
        let mat = self.resolve_mat(virtual_mat_path)?;
        let tobj = self.mat_to_tobj(&mat)?;
        let virt = Self::tobj_to_dds_virtual(&tobj)?;
        self.resolve_virtual_texture_file(&virt)
    }

    /// Turn `/material/.../file.dds` into a path under [`Self::game_root`].
    pub fn resolve_virtual_texture_file(&self, virtual_dds_path: &str) -> Option<PathBuf> {
        let rel = strip_leading_slash(trim_virtual(virtual_dds_path));
        if rel.is_empty() {
            return None;
        }
        let p = self.game_root.join(path_from_slash(&rel));
        p.exists().then_some(p)
    }
}

/// Try each installation root in order (e.g. mod folders first, then base game).
pub fn resolve_texture_search_roots(
    roots: &[std::path::PathBuf],
    virtual_mat_path: &str,
) -> Option<PathBuf> {
    for r in roots {
        let m = MatResolver::new(r);
        if let Some(p) = m.resolve_texture(virtual_mat_path) {
            return Some(p);
        }
    }
    None
}

/// First `.tobj` path string from a `.mat` body (same rules as [`MatResolver::mat_to_tobj`]).
pub fn first_tobj_ref_from_mat_file(mat_path: &Path) -> Option<String> {
    let text = fs::read_to_string(mat_path).ok()?;
    first_tobj_reference(&text)
}

/// Resolve a virtual `.mat` path against any of the search roots.
pub fn resolve_mat_any_root(roots: &[PathBuf], virtual_mat_path: &str) -> Option<PathBuf> {
    for r in roots {
        let m = MatResolver::new(r);
        if let Some(p) = m.resolve_mat(virtual_mat_path) {
            return Some(p);
        }
    }
    None
}

/// Physical `.tobj` for a resolved `.mat` on disk, searching mod/game roots.
pub fn resolve_tobj_from_mat_any_root(roots: &[PathBuf], mat_real: &Path) -> Option<PathBuf> {
    let ref_s = first_tobj_ref_from_mat_file(mat_real)?;
    let parent = mat_real.parent()?;
    for root in roots {
        if let Some(p) = resolve_sidecar_path(root, parent, &ref_s) {
            return Some(p);
        }
    }
    None
}

/// Physical `.dds` (or resolved texture file) for a `.tobj` on disk.
pub fn resolve_dds_from_tobj_any_root(roots: &[PathBuf], tobj_real: &Path) -> Option<PathBuf> {
    let virt = MatResolver::tobj_to_dds_virtual(tobj_real)?;
    for r in roots {
        let m = MatResolver::new(r);
        if let Some(p) = m.resolve_virtual_texture_file(&virt) {
            return Some(p);
        }
    }
    None
}

/// Virtual `.tobj` path as stored in the `.mat` (quoted reference string).
pub fn mat_to_tobj_virtual(mat_real_path: &Path) -> Option<String> {
    first_tobj_ref_from_mat_file(mat_real_path)
}

/// Virtual `/material/.../*.dds` path embedded in a `.tobj` file.
pub fn tobj_to_dds_virtual(real_tobj_path: &Path) -> Option<String> {
    MatResolver::tobj_to_dds_virtual(real_tobj_path)
}

fn path_from_slash(s: &str) -> PathBuf {
    s.split('/').filter(|p| !p.is_empty()).collect()
}

fn trim_virtual(s: &str) -> &str {
    s.trim().trim_matches('"')
}

fn strip_leading_slash(s: &str) -> String {
    s.trim().trim_start_matches(['/', '\\']).to_string()
}

fn first_tobj_reference(mat_body: &str) -> Option<String> {
    if let Some(c) = re_texture0().captures(mat_body) {
        return c.get(1).map(|m| m.as_str().to_string());
    }

    if let Some(c) = re_source().captures(mat_body) {
        return c.get(1).map(|m| m.as_str().to_string());
    }

    if let Some(c) = re_texture_legacy().captures(mat_body) {
        return c.get(1).map(|m| m.as_str().to_string());
    }

    None
}

/// `tobj_ref` may be `gauge_left.tobj` (relative to mat dir) or `/material/.../x.tobj`.
fn resolve_sidecar_path(
    game_root: &Path,
    mat_parent: &Path,
    tobj_ref: &str,
) -> Option<PathBuf> {
    let t = tobj_ref.trim();
    if t.starts_with('/') {
        let rel = strip_leading_slash(t);
        let p = game_root.join(path_from_slash(&rel));
        return p.exists().then_some(p);
    }
    let p = mat_parent.join(t);
    p.exists().then_some(p)
}

/// Find the first `/material/....dds` substring in a `.tobj` blob.
fn extract_dds_virtual_path(bytes: &[u8]) -> Option<String> {
    let s = String::from_utf8_lossy(bytes);
    let lower = s.to_ascii_lowercase();
    let start = lower.find("/material")?;
    let tail = &lower[start..];
    let dot = tail.find(".dds")?;
    let end = start + dot + 4;
    Some(s[start..end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn example_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dashboard_examples_from_game")
    }

    #[test]
    fn resolve_mat_daf_gauge() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let r = MatResolver::new(&root);
        let p = r
            .resolve_mat("/material/ui/dashboard/daf_2021/gauge_left.mat")
            .expect("mat");
        assert!(p.is_file());
    }

    #[test]
    fn mat_to_tobj_chain() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let r = MatResolver::new(&root);
        let mat = r
            .resolve_mat("/material/ui/dashboard/daf_2021/gauge_left.mat")
            .unwrap();
        let tobj = r.mat_to_tobj(&mat).expect("tobj");
        assert!(tobj.file_name().unwrap().to_string_lossy().ends_with(".tobj"));
    }

    #[test]
    fn full_resolve_texture() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let r = MatResolver::new(&root);
        let dds = r
            .resolve_texture("/material/ui/dashboard/daf_2021/gauge_left.mat")
            .expect("dds");
        assert!(dds.extension().map(|e| e == "dds").unwrap_or(false));
    }

    #[test]
    fn tobj_embedded_path() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let tobj = root.join("material/ui/dashboard/daf_2021/gauge_left.tobj");
        if !tobj.is_file() {
            return;
        }
        let v = MatResolver::tobj_to_dds_virtual(&tobj).expect("virt");
        assert!(v.starts_with("/material/"));
        assert!(v.ends_with(".dds"));
    }
}
