//! Parse SCS `.font` (SDF) descriptors and cache them by resolved file path.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use anyhow::{anyhow, Context, Result};

/// One atlas page: virtual path to `.mat`, pixel size, per-axis scale, SDF padding.
#[derive(Debug, Clone, PartialEq)]
pub struct FontImage {
    pub mat_path: String,
    pub width: u32,
    pub height: u32,
    pub scale_x: f32,
    pub scale_y: f32,
    pub sdf_padding: f32,
}

/// Metrics for a single code point (Unicode value from the `xHHHH` prefix in the file).
#[derive(Debug, Clone, PartialEq)]
pub struct FontGlyph {
    pub atlas_x: f32,
    pub atlas_y: f32,
    pub width: f32,
    pub height: f32,
    pub plane_x: f32,
    pub plane_y: f32,
    pub advance: f32,
    pub image_index: u32,
}

/// Parsed contents of one `.font` file.
#[derive(Debug, Clone, PartialEq)]
pub struct FontDefinition {
    pub vert_span: f32,
    pub line_spacing: i32,
    pub default_scale: f32,
    /// Height of capital **M** in texture-pixel units when present; else mean glyph height; else `14`
    /// (matches legacy editor — used when `vert_span` is zero or as a fallback).
    pub typical_height: f32,
    pub images: Vec<FontImage>,
    pub glyphs: HashMap<u32, FontGlyph>,
}

impl FontDefinition {
    /// First atlas `.mat` virtual path, if any.
    pub fn texture_virtual_path(&self) -> Option<&str> {
        self.images.first().map(|i| i.mat_path.as_str())
    }

    /// Scale factors of the first atlas (for single-atlas fonts).
    pub fn first_scale(&self) -> Option<(f32, f32)> {
        self.images.first().map(|i| (i.scale_x, i.scale_y))
    }
}

impl FontGlyph {
    /// Per-atlas scale **X** for this glyph (index into [`FontDefinition::images`]).
    pub fn scale_x(&self, font: &FontDefinition) -> f32 {
        font.images
            .get(self.image_index as usize)
            .map(|i| i.scale_x)
            .or_else(|| font.images.first().map(|i| i.scale_x))
            .unwrap_or(1.0)
    }

    /// Per-atlas scale **Y** for this glyph.
    pub fn scale_y(&self, font: &FontDefinition) -> f32 {
        font.images
            .get(self.image_index as usize)
            .map(|i| i.scale_y)
            .or_else(|| font.images.first().map(|i| i.scale_y))
            .unwrap_or(1.0)
    }

    /// Virtual path to the `.mat` for this glyph’s atlas.
    pub fn mat_path<'a>(&self, font: &'a FontDefinition) -> Option<&'a str> {
        font.images
            .get(self.image_index as usize)
            .map(|i| i.mat_path.as_str())
            .or_else(|| font.images.first().map(|i| i.mat_path.as_str()))
    }

    /// SDF padding (**pxRange**) for this glyph’s atlas.
    pub fn sdf_padding(&self, font: &FontDefinition) -> f32 {
        font.images
            .get(self.image_index as usize)
            .map(|i| i.sdf_padding)
            .or_else(|| font.images.first().map(|i| i.sdf_padding))
            .unwrap_or(0.0)
    }
}

/// Read and parse a `.font` file from disk (UTF-8, optional BOM).
pub fn parse_font_file(path: &Path) -> Result<FontDefinition> {
    let raw = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    let text = decode_utf8_with_bom(&raw);
    parse_font_str(&text).with_context(|| format!("parse {}", path.display()))
}

/// Parse `.font` text (comments `#`, `image:` atlas lines, `xHEX` glyph rows).
pub fn parse_font_str(content: &str) -> Result<FontDefinition> {
    let mut vert_span = 0.0_f32;
    let mut line_spacing = 0_i32;
    let mut default_scale = 1.0_f32;
    let mut images = Vec::new();
    let mut glyphs = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("vert_span:") {
            vert_span = parse_first_number(rest).unwrap_or(0.0);
            continue;
        }
        if let Some(rest) = line.strip_prefix("line_spacing:") {
            line_spacing = parse_first_int(rest).unwrap_or(0);
            continue;
        }
        if let Some(rest) = line.strip_prefix("default_scale:") {
            default_scale = parse_first_number(rest).unwrap_or(1.0);
            continue;
        }
        if line.starts_with("image:") {
            if let Some(img) = parse_image_line(line) {
                images.push(img);
            }
            continue;
        }
        if let Some(g) = parse_glyph_line(line) {
            glyphs.insert(g.0, g.1);
        }
    }

    let typical_height = compute_typical_height(&glyphs);

    Ok(FontDefinition {
        vert_span,
        line_spacing,
        default_scale,
        typical_height,
        images,
        glyphs,
    })
}

fn compute_typical_height(glyphs: &HashMap<u32, FontGlyph>) -> f32 {
    if glyphs.is_empty() {
        return 14.0;
    }
    if let Some(g) = glyphs.get(&0x004d) {
        return g.height;
    }
    let n = glyphs.len() as f32;
    glyphs.values().map(|g| g.height).sum::<f32>() / n
}

/// Cached parsed fonts keyed by canonical `.font` path on disk.
#[derive(Debug)]
pub struct FontRegistry {
    roots: Vec<PathBuf>,
    entries: RwLock<HashMap<String, Arc<FontDefinition>>>,
}

impl FontRegistry {
    pub fn new(game_root: impl AsRef<Path>) -> Self {
        Self::from_roots(vec![game_root.as_ref().to_path_buf()])
    }

    pub fn from_roots(mut roots: Vec<PathBuf>) -> Self {
        roots.retain(|p| p.is_dir());
        Self {
            roots,
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn game_root(&self) -> &Path {
        self.roots
            .first()
            .map(|p| p.as_path())
            .unwrap_or_else(|| Path::new("."))
    }

    pub fn len(&self) -> usize {
        self.entries.read().map(|m| m.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn invalidate_all(&self) {
        if let Ok(mut m) = self.entries.write() {
            m.clear();
        }
    }

    pub fn invalidate_virtual_path(&self, virtual_font_path: &str) {
        for root in &self.roots {
            if let Some(p) = resolve_font_file(root, virtual_font_path) {
                if let Ok(k) = cache_key(&p) {
                    if let Ok(mut m) = self.entries.write() {
                        m.remove(&k);
                    }
                }
            }
        }
    }

    /// Load a font by virtual path (e.g. `/font/sign/digit.font`).
    pub fn get(&self, virtual_font_path: &str) -> Result<Arc<FontDefinition>> {
        let mut disk_opt = None;
        for root in &self.roots {
            if let Some(d) = resolve_font_file(root, virtual_font_path) {
                disk_opt = Some(d);
                break;
            }
        }
        let disk =
            disk_opt.ok_or_else(|| anyhow!("font file not found for {virtual_font_path}"))?;
        let key = cache_key(&disk).context("font path key")?;
        if let Ok(guard) = self.entries.read() {
            if let Some(hit) = guard.get(&key) {
                return Ok(Arc::clone(hit));
            }
        }
        let def = Arc::new(parse_font_file(&disk)?);
        if let Ok(mut m) = self.entries.write() {
            m.insert(key, Arc::clone(&def));
        }
        Ok(def)
    }

    /// Resolve and parse when the file exists; otherwise `None` (matches legacy best-effort load).
    pub fn try_get(&self, virtual_font_path: &str) -> Option<Arc<FontDefinition>> {
        self.get(virtual_font_path).ok()
    }
}

fn cache_key(path: &Path) -> Result<String> {
    path.canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .with_context(|| format!("canonicalize {}", path.display()))
}

fn resolve_font_file(game_root: &Path, virtual_path: &str) -> Option<PathBuf> {
    let rel = strip_leading_slash(trim_quotes(virtual_path));
    if rel.is_empty() {
        return None;
    }
    let rel = if rel.to_ascii_lowercase().ends_with(".font") {
        rel
    } else {
        format!("{rel}.font")
    };
    let p = game_root.join(path_from_slash(&rel));
    p.is_file().then_some(p)
}

fn path_from_slash(s: &str) -> PathBuf {
    s.split('/').filter(|p| !p.is_empty()).collect()
}

fn trim_quotes(s: &str) -> &str {
    s.trim().trim_matches('"')
}

fn strip_leading_slash(s: &str) -> String {
    s.trim().trim_start_matches(['/', '\\']).to_string()
}

fn decode_utf8_with_bom(raw: &[u8]) -> String {
    if raw.len() >= 3 && raw[0..3] == [0xEF, 0xBB, 0xBF] {
        return String::from_utf8_lossy(&raw[3..]).into_owned();
    }
    String::from_utf8_lossy(raw).into_owned()
}

fn parse_first_number(s: &str) -> Option<f32> {
    let token = s
        .split(|c: char| c.is_whitespace() || c == '#')
        .next()?
        .trim();
    token.parse().ok()
}

fn parse_first_int(s: &str) -> Option<i32> {
    let token = s
        .split(|c: char| c.is_whitespace() || c == '#')
        .next()?
        .trim();
    token.parse().ok()
}

fn parse_image_line(line: &str) -> Option<FontImage> {
    let after = line.strip_prefix("image:")?;
    let parts: Vec<&str> = after
        .split(',')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();
    if parts.len() < 6 {
        return None;
    }
    Some(FontImage {
        mat_path: parts[0].to_string(),
        width: parts[1].parse().ok()?,
        height: parts[2].parse().ok()?,
        scale_x: parts[3].parse().ok()?,
        scale_y: parts[4].parse().ok()?,
        sdf_padding: parts[5].parse().ok()?,
    })
}

/// Same splitting rules as legacy `FontRegistry.ParseGlyph` (comma-separated, `#` comment).
/// `image_index` defaults to **0** when the ninth field is omitted.
fn parse_glyph_line(line: &str) -> Option<(u32, FontGlyph)> {
    let line = line.split('#').next()?.trim();
    if line.len() < 5 || !line.as_bytes().first().map(|b| *b == b'x' || *b == b'X').unwrap_or(false) {
        return None;
    }
    let parts: Vec<&str> = line.split(',').map(|p| p.trim()).collect();
    if parts.len() < 8 {
        return None;
    }
    let head = parts[0].trim();
    let code_str = head.strip_prefix('x').or_else(|| head.strip_prefix('X'))?.trim();
    if code_str.is_empty() {
        return None;
    }
    let code = u32::from_str_radix(code_str, 16).ok()?;
    let atlas_x = parts[1].parse().ok()?;
    let atlas_y = parts[2].parse().ok()?;
    let width = parts[3].parse().ok()?;
    let height = parts[4].parse().ok()?;
    let plane_x = parts[5].parse().ok()?;
    let plane_y = parts[6].parse().ok()?;
    let advance = parts[7].parse().ok()?;
    let image_index = parts
        .get(8)
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    Some((
        code,
        FontGlyph {
            atlas_x,
            atlas_y,
            width,
            height,
            plane_x,
            plane_y,
            advance,
            image_index,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dashboard_examples_from_game")
    }

    #[test]
    fn parse_digit_font() {
        let root = example_root();
        let path = root.join("font/sign/digit.font");
        if !path.is_file() {
            return;
        }
        let def = parse_font_file(&path).expect("parse");
        assert_eq!(def.images.len(), 1);
        assert!(def.images[0].mat_path.contains("digit_0.mat"));
        assert!(def.glyphs.contains_key(&0x20));
        assert!(def.glyphs.contains_key(&0x30));
        // No 'M' in digit font — legacy uses average glyph height
        assert!(def.typical_height > 0.0);
        let expect_avg: f32 =
            def.glyphs.values().map(|g| g.height).sum::<f32>() / def.glyphs.len() as f32;
        assert!((def.typical_height - expect_avg).abs() < 1e-3);
    }

    #[test]
    fn parse_normal_font_multi_atlas() {
        let root = example_root();
        let path = root.join("font/normal.font");
        if !path.is_file() {
            return;
        }
        let def = parse_font_file(&path).expect("parse");
        assert_eq!(def.images.len(), 7);
        assert_eq!(def.images[0].mat_path, "/font/normal_0.mat");
        if let Some(m) = def.glyphs.get(&0x004d) {
            assert!((def.typical_height - m.height).abs() < 1e-3);
        }
        let g = def.glyphs.get(&0x0020).expect("space");
        assert!((g.scale_x(&def) - def.images[0].scale_x).abs() < 1e-6);
    }

    #[test]
    fn registry_get_and_cache() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let reg = FontRegistry::new(&root);
        let a = reg.get("/font/sign/digit.font").expect("get");
        let b = reg.get("/font/sign/digit.font").expect("get2");
        assert_eq!(reg.len(), 1);
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn glyph_without_image_index_defaults_to_atlas_zero() {
        let s = r#"
image:/font/x.mat, 256, 128, 1.0, 1.0, 0.0
x0041, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.5
"#;
        let def = parse_font_str(s).expect("parse");
        let g = def.glyphs.get(&0x41).expect("A");
        assert_eq!(g.image_index, 0);
        assert!((g.advance - 7.5).abs() < 1e-6);
    }

    #[test]
    fn invalidate_virtual_path() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let reg = FontRegistry::new(&root);
        let _ = reg.get("/font/sign/digit.font").unwrap();
        assert_eq!(reg.len(), 1);
        reg.invalidate_virtual_path("/font/sign/digit.font");
        assert_eq!(reg.len(), 0);
    }
}
