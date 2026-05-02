//! Atlas text measurement and layout (legacy `MeasureAtlasLine` / `RenderAtlasLine` math).
//!
//! Rendering (SDF/MSDF masking, color) is handled separately; this module produces pixel quads
//! and pen advances so [`crate::rendering::TextureCache`] can sample the right DDS regions.

use crate::core::{FontDefinition, FontGlyph};

/// One drawable glyph: source crop in atlas pixels, destination quad in layout space.
#[derive(Debug, Clone, PartialEq)]
pub struct GlyphQuad {
    /// Virtual `.mat` path for the atlas page (resolve via [`crate::core::MatResolver`] / [`crate::rendering::TextureCache`]).
    pub mat_virtual_path: String,
    /// Crop rectangle in decoded atlas pixel space (after the same clamping as the legacy editor).
    pub src_px: (i32, i32, i32, i32),
    /// Destination rectangle (x, y, width, height) in the same units as pen / canvas (markup scale applied).
    pub dst_px: (f32, f32, f32, f32),
}

/// Measurement + layout helpers for SCS bitmap / SDF fonts.
pub struct FontGlyphRenderer;

impl FontGlyphRenderer {
    /// Horizontal advance for a missing code point: `8 * scale_x * x_scale` (legacy constant width).
    pub fn missing_glyph_advance(font: &FontDefinition, x_scale: f32) -> f32 {
        8.0 * fallback_scale_x(font) * x_scale
    }

    /// Sum of advances only (no `PlaneX`), matching ETS2 layout — see legacy `MeasureAtlasLine`.
    pub fn measure_line(font: &FontDefinition, line: &str, x_scale: f32) -> f32 {
        let fb = fallback_scale_x(font);
        let mut w = 0.0_f32;
        for ch in line.chars() {
            if let Some(g) = font.glyphs.get(&(ch as u32)) {
                let sx = scale_x_or_fallback(g, font, fb);
                w += g.advance * sx * x_scale;
            } else {
                w += Self::missing_glyph_advance(font, x_scale);
            }
        }
        w
    }

    /// Vertical step for one text line (before `line_spacing`), matching legacy `RenderAtlasText`:
    /// `(vert_span > 0 ? vert_span : typical_height) * first_atlas_scale_y * y_scale`.
    pub fn line_advance_y(font: &FontDefinition, y_scale: f32) -> f32 {
        let sy = fallback_scale_y(font).max(1e-6);
        let span = if font.vert_span > 0.0 {
            font.vert_span
        } else {
            font.typical_height
        };
        span * sy * y_scale
    }

    /// Extra pixels between lines from the `.font` file (`line_spacing` is an integer in SCS data).
    pub fn line_spacing_px(font: &FontDefinition) -> f32 {
        font.line_spacing as f32
    }

    /// Starting `pen_x` for a line given alignment (legacy `RenderAtlasLine` / `RenderAtlasText`).
    pub fn aligned_pen_x(
        line_width: f32,
        canvas_width: f32,
        h_align: &str,
        base_pen_x: f32,
        left_margin: f32,
        right_margin: f32,
    ) -> f32 {
        let pen_x = match h_align {
            "right" => canvas_width - right_margin - line_width,
            "center" => (canvas_width - line_width) * 0.5 + left_margin,
            _ => base_pen_x + left_margin,
        };
        pen_x.max(0.0)
    }

    /// Layout one line using atlas dimensions from the `.font` file only.
    pub fn layout_line(
        font: &FontDefinition,
        line: &str,
        pen_x: f32,
        pen_y: f32,
        x_scale: f32,
        y_scale: f32,
    ) -> Vec<GlyphQuad> {
        Self::layout_line_with_atlas_dims(font, line, pen_x, pen_y, x_scale, y_scale, |_| None)
    }

    /// Layout one line; for each virtual `.mat`, use **decoded DDS** width/height when `atlas_dims`
    /// returns `Some`, matching legacy `RenderAtlasLine` (`atlasBmp.PixelWidth/Height` per glyph).
    pub fn layout_line_with_atlas_dims<F>(
        font: &FontDefinition,
        line: &str,
        mut pen_x: f32,
        pen_y: f32,
        x_scale: f32,
        y_scale: f32,
        atlas_dims: F,
    ) -> Vec<GlyphQuad>
    where
        F: Fn(&str) -> Option<(u32, u32)>,
    {
        let fb_x = fallback_scale_x(font);
        let fb_y = fallback_scale_y(font);
        let mut out = Vec::new();

        for ch in line.chars() {
            let Some(glyph) = font.glyphs.get(&(ch as u32)) else {
                pen_x += Self::missing_glyph_advance(font, x_scale);
                continue;
            };

            let sx = scale_x_or_fallback(glyph, font, fb_x);
            let sy = scale_y_or_fallback(glyph, font, fb_y);
            let mat = glyph
                .mat_path(font)
                .map(|s| s.to_string())
                .unwrap_or_default();

            let idx = glyph.image_index as usize;
            let (tex_w, tex_h) = if !mat.is_empty() {
                if let Some((w, h)) = atlas_dims(&mat) {
                    (w, h)
                } else {
                    font
                        .images
                        .get(idx)
                        .map(|i| (i.width, i.height))
                        .unwrap_or((0, 0))
                }
            } else {
                font
                    .images
                    .get(idx)
                    .map(|i| (i.width, i.height))
                    .unwrap_or((0, 0))
            };

            let gpx = glyph.atlas_x.round() as i32;
            let gpy = glyph.atlas_y.round() as i32;
            let gpw = glyph.width.round() as i32;
            let gph = glyph.height.round() as i32;

            let Some((cx, cy, cw, ch)) = clamp_crop(gpx, gpy, gpw, gph, tex_w, tex_h) else {
                pen_x += glyph.advance * sx * x_scale;
                continue;
            };

            let draw_x = pen_x + glyph.plane_x * sx * x_scale;
            let draw_y = pen_y + glyph.plane_y * sy * y_scale;
            let draw_w = (glyph.width * sx * x_scale).max(1.0);
            let draw_h = (glyph.height * sy * y_scale).max(1.0);

            out.push(GlyphQuad {
                mat_virtual_path: mat,
                src_px: (cx, cy, cw, ch),
                dst_px: (draw_x, draw_y, draw_w, draw_h),
            });

            pen_x += glyph.advance * sx * x_scale;
        }

        out
    }

    /// MSDF sharpness hint (legacy `GetOrCreateMsdfOpacityMask`): `clamp(2..64, sdf_pad * draw_h / gph)`.
    pub fn sdf_sharpness(sdf_padding: f32, atlas_glyph_h_px: i32, draw_h: f32) -> f32 {
        if sdf_padding > 0.0 && atlas_glyph_h_px > 0 {
            let s = sdf_padding * draw_h / atlas_glyph_h_px as f32;
            s.max(2.0).min(64.0)
        } else {
            16.0
        }
    }
}

fn fallback_scale_x(font: &FontDefinition) -> f32 {
    font.images
        .first()
        .map(|i| i.scale_x)
        .filter(|&s| s > 0.0)
        .unwrap_or(1.0)
}

fn fallback_scale_y(font: &FontDefinition) -> f32 {
    font.images
        .first()
        .map(|i| i.scale_y)
        .filter(|&s| s > 0.0)
        .unwrap_or(1.0)
}

fn scale_x_or_fallback(g: &FontGlyph, font: &FontDefinition, fb: f32) -> f32 {
    let sx = g.scale_x(font);
    if sx > 0.0 {
        sx
    } else {
        fb
    }
}

fn scale_y_or_fallback(g: &FontGlyph, font: &FontDefinition, fb: f32) -> f32 {
    let sy = g.scale_y(font);
    if sy > 0.0 {
        sy
    } else {
        fb
    }
}

fn clamp_crop(
    mut gpx: i32,
    mut gpy: i32,
    mut gpw: i32,
    mut gph: i32,
    tex_w: u32,
    tex_h: u32,
) -> Option<(i32, i32, i32, i32)> {
    if gpx < 0 {
        gpx = 0;
    }
    if gpy < 0 {
        gpy = 0;
    }
    if gpw <= 0 || gph <= 0 {
        return None;
    }
    let tw = tex_w as i32;
    let th = tex_h as i32;
    if tw <= 0 || th <= 0 {
        return None;
    }
    if gpx + gpw > tw {
        gpw = tw - gpx;
    }
    if gpy + gph > th {
        gph = th - gpy;
    }
    if gpw <= 0 || gph <= 0 {
        return None;
    }
    Some((gpx, gpy, gpw, gph))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::parse_font_file;
    use std::path::PathBuf;

    fn example_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dashboard_examples_from_game")
    }

    #[test]
    fn measure_matches_sum_of_advances_digit_font() {
        let root = example_root();
        let path = root.join("font/sign/digit.font");
        if !path.is_file() {
            return;
        }
        let font = parse_font_file(&path).expect("parse");
        let line = "012";
        let x = 1.0_f32;
        let w = FontGlyphRenderer::measure_line(&font, line, x);
        let mut manual = 0.0_f32;
        for ch in line.chars() {
            let g = font.glyphs.get(&(ch as u32)).expect("glyph");
            let sx = g.scale_x(&font);
            manual += g.advance * sx * x;
        }
        assert!((w - manual).abs() < 0.01);
    }

    #[test]
    fn missing_glyph_adds_fixed_width() {
        let root = example_root();
        let path = root.join("font/sign/digit.font");
        if !path.is_file() {
            return;
        }
        let font = parse_font_file(&path).expect("parse");
        let w = FontGlyphRenderer::measure_line(&font, "A", 1.0);
        let expect = FontGlyphRenderer::missing_glyph_advance(&font, 1.0);
        assert!((w - expect).abs() < 0.001);
    }

    #[test]
    fn layout_line_emits_one_quad_per_char() {
        let root = example_root();
        let path = root.join("font/sign/digit.font");
        if !path.is_file() {
            return;
        }
        let font = parse_font_file(&path).expect("parse");
        let quads = FontGlyphRenderer::layout_line(&font, "01", 0.0, 0.0, 1.0, 1.0);
        assert_eq!(quads.len(), 2);
        assert!(quads[0].mat_virtual_path.contains(".mat"));
        assert!(quads[0].src_px.2 > 0 && quads[0].src_px.3 > 0);
    }

    #[test]
    fn aligned_pen_center() {
        let px = FontGlyphRenderer::aligned_pen_x(40.0, 200.0, "center", 0.0, 0.0, 0.0);
        assert!((px - 80.0).abs() < 0.01);
    }
}
