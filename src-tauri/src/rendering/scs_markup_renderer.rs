//! Walk [`crate::core::ScsMarkupToken`]s and rasterize into a [`tiny_skia::Pixmap`] (straight-alpha → premultiplied blend).
//!
//! Atlas text uses [`FontGlyphRenderer`] quads + [`TextureCache`] (no MSDF shader yet — coverage from alpha / luma).
//! When no game font atlas is available, [`ab_glyph`] rasterizes bundled Fira Mono as a fallback.

use std::collections::HashMap;

use ab_glyph::{point, Font, FontRef, PxScale, ScaleFont};
use anyhow::Result;
use tiny_skia::{Color, Pixmap, PremultipliedColorU8};

use crate::core::{
    normalize_scs_text, resolve_named_color, scs_to_rgba, tokenize_scs_markup, FontDefinition,
    FontRegistry, ScsMarkupToken,
};
use crate::rendering::{FontGlyphRenderer, GlyphQuad, TextureCache};

static FALLBACK_FONT_DATA: &[u8] = include_bytes!("../../assets/fonts/FiraMono-Regular.ttf");

/// Mutable state while rendering (legacy `RenderContext`).
#[derive(Debug, Clone)]
pub struct MarkupRenderContext {
    /// Straight RGBA (matches `scs_to_rgba` order).
    pub color: [u8; 4],
    pub pen_x: f32,
    pub pen_y: f32,
    pub canvas_w: u32,
    pub canvas_h: u32,
    pub line_advance: f32,
    pub line_height: f32,
    pub current_font_face: Option<String>,
    pub current_font_size: f32,
    pub current_x_scale: f32,
    pub current_y_scale: f32,
    pub valign: String,
    pub h_align: String,
    pub in_align_block: bool,
    pub left_margin: f32,
    pub right_margin: f32,
}

impl Default for MarkupRenderContext {
    fn default() -> Self {
        Self {
            color: [255, 255, 255, 255],
            pen_x: 0.0,
            pen_y: 0.0,
            canvas_w: 0,
            canvas_h: 0,
            line_advance: 14.0,
            line_height: 0.0,
            current_font_face: None,
            current_font_size: 0.0,
            current_x_scale: 1.0,
            current_y_scale: 1.0,
            valign: "top".into(),
            h_align: "left".into(),
            in_align_block: false,
            left_margin: 0.0,
            right_margin: 0.0,
        }
    }
}

/// Renders SCS markup using game fonts and textures (game root via caches).
pub struct ScsMarkupRenderer<'a> {
    pub textures: &'a TextureCache,
    pub fonts: &'a FontRegistry,
}

impl<'a> ScsMarkupRenderer<'a> {
    /// Full pipeline: normalize → tokenize → rasterize. Returns `None` when markup is empty / whitespace.
    pub fn render_to_pixmap(&self, markup: &str, width: u32, height: u32) -> Result<Option<Pixmap>> {
        let w = width.clamp(1, 2048);
        let h = height.clamp(1, 2048);
        let text = normalize_scs_text(markup);
        if text.trim().is_empty() {
            return Ok(None);
        }
        let tokens = tokenize_scs_markup(&text);
        let mut pm = Pixmap::new(w, h).expect("pixmap size");
        pm.fill(Color::TRANSPARENT);

        let mut ctx = MarkupRenderContext {
            canvas_w: w,
            canvas_h: h,
            ..Default::default()
        };
        self.process_tokens(&tokens, &mut ctx, &mut pm)?;
        Ok(Some(pm))
    }

    fn process_tokens(
        &self,
        tokens: &[ScsMarkupToken],
        ctx: &mut MarkupRenderContext,
        pm: &mut Pixmap,
    ) -> Result<()> {
        for token in tokens {
            self.process_token(token, ctx, pm)?;
        }
        Ok(())
    }

    fn process_token(
        &self,
        token: &ScsMarkupToken,
        ctx: &mut MarkupRenderContext,
        pm: &mut Pixmap,
    ) -> Result<()> {
        match token {
            ScsMarkupToken::Color(hex) => {
                if hex.starts_with("@@") {
                    if let Some(rgba) = resolve_named_color(hex) {
                        ctx.color = rgba;
                    }
                } else if let Some(rgba) = scs_to_rgba(hex) {
                    ctx.color = rgba;
                }
            }
            ScsMarkupToken::Image { attrs, .. } => {
                self.render_img(attrs, ctx, pm)?;
            }
            ScsMarkupToken::FontBlock {
                face,
                xscale,
                yscale,
                inner,
            } => {
                let saved_face = ctx.current_font_face.clone();
                let saved_xs = ctx.current_x_scale;
                let saved_ys = ctx.current_y_scale;
                let saved_fs = ctx.current_font_size;
                let saved_la = ctx.line_advance;

                ctx.current_font_face = Some(face.clone());
                ctx.current_x_scale = *xscale;
                ctx.current_y_scale = *yscale;

                if let Some(font) = self.fonts.try_get(face.as_str()) {
                    let typ_h = if font.vert_span > 0.0 {
                        font.vert_span
                    } else {
                        14.0
                    };
                    ctx.current_font_size = typ_h * yscale;
                } else {
                    ctx.current_font_size = default_typical_height(face.as_str()) * yscale;
                }
                ctx.line_advance = ctx.current_font_size.max(8.0);

                self.process_tokens(inner, ctx, pm)?;

                ctx.current_font_face = saved_face;
                ctx.current_x_scale = saved_xs;
                ctx.current_y_scale = saved_ys;
                ctx.current_font_size = saved_fs;
                ctx.line_advance = saved_la;
            }
            ScsMarkupToken::Ret => {
                ctx.pen_x = 0.0;
                ctx.pen_y = 0.0;
                ctx.line_height = 0.0;
            }
            ScsMarkupToken::Br => {
                ctx.pen_x = 0.0;
                // Match legacy `ScsTextRenderer` / WPF: +2 only when advancing by measured line height.
                if ctx.line_height > 0.0 {
                    ctx.pen_y += ctx.line_height + 2.0;
                } else {
                    ctx.pen_y += ctx.line_advance;
                }
                ctx.line_height = 0.0;
            }
            ScsMarkupToken::Offset { hshift, vshift } => {
                ctx.pen_x += hshift;
                ctx.pen_y += vshift;
            }
            ScsMarkupToken::AlignPush {
                hstyle,
                vstyle,
                left,
                right,
            } => {
                ctx.h_align = hstyle.clone();
                ctx.valign = vstyle.clone();
                ctx.left_margin = *left;
                ctx.right_margin = *right;
                ctx.in_align_block = true;
            }
            ScsMarkupToken::AlignPop => {
                ctx.h_align = "left".to_string();
                ctx.valign = "top".to_string();
                ctx.left_margin = 0.0;
                ctx.right_margin = 0.0;
                ctx.in_align_block = false;
            }
            ScsMarkupToken::Text(s) => {
                self.draw_plain_text(ctx, pm, s)?;
            }
        }
        Ok(())
    }

    fn draw_plain_text(
        &self,
        ctx: &mut MarkupRenderContext,
        pm: &mut Pixmap,
        text: &str,
    ) -> Result<()> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Ok(());
        }

        if let Some(face) = &ctx.current_font_face {
            if let Some(font) = self.fonts.try_get(face) {
                let any = font
                    .images
                    .iter()
                    .any(|im| self.textures.get_by_virtual_mat(&im.mat_path).is_ok());
                if any {
                    self.render_atlas_line(ctx, pm, &font, trimmed)?;
                    return Ok(());
                }
            }
        }

        Self::draw_fallback_text(ctx, pm, trimmed);
        Ok(())
    }

    fn draw_fallback_text(ctx: &mut MarkupRenderContext, pm: &mut Pixmap, text: &str) {
        let Ok(font) = FontRef::try_from_slice(FALLBACK_FONT_DATA) else {
            return;
        };
        let font_size = ctx.current_font_size.clamp(8.0, 96.0);
        let scale = PxScale::from(font_size);
        let scaled = font.as_scaled(scale);

        let mut total_w = 0.0f32;
        for ch in text.chars() {
            total_w += scaled.h_advance(scaled.glyph_id(ch));
        }

        let canvas_w = ctx.canvas_w as f32;
        let start_x = match ctx.h_align.as_str() {
            "right" => (canvas_w - total_w - ctx.right_margin).max(ctx.pen_x),
            "center" => ((canvas_w - total_w) / 2.0).max(ctx.pen_x),
            _ => ctx.pen_x,
        };

        let [cr, cg, cb, ca] = ctx.color;
        let mut pen_x = start_x;
        let pen_y_base = ctx.pen_y + scaled.ascent();
        let mut max_bottom = pen_y_base;

        for ch in text.chars() {
            let gid = scaled.glyph_id(ch);
            let glyph = gid.with_scale_and_position(scale, point(pen_x, pen_y_base));
            if let Some(outlined) = scaled.outline_glyph(glyph) {
                let b = outlined.px_bounds();
                // ab_glyph's draw() callback provides (x, y) coordinates RELATIVE TO
                // the glyph's pixel-aligned bounding box, NOT absolute canvas coordinates.
                // The bounding box starts at `px_bounds().min`, which is approximately
                // (pen_x + left_bearing, pen_y_base - ascent).  Without adding this
                // offset every character would render at (0,0) regardless of pen_x,
                // causing all characters to stack on top of each other.
                let bx = b.min.x.floor() as i32;
                let by = b.min.y.floor() as i32;
                max_bottom = max_bottom.max(b.max.y);
                outlined.draw(|px_u, py_u, cov| {
                    if cov < 0.02 {
                        return;
                    }
                    // Absolute canvas coordinates = glyph-local coords + bounds origin.
                    let px = bx + px_u as i32;
                    let py = by + py_u as i32;
                    if px < 0 || py < 0 {
                        return;
                    }
                    let (px, py) = (px as u32, py as u32);
                    if px >= pm.width() || py >= pm.height() {
                        return;
                    }
                    let alpha = ((cov as f32) * (ca as f32 / 255.0)).clamp(0.0, 1.0);
                    if alpha < 0.015 {
                        return;
                    }
                    let alpha_u = (alpha * 255.0).round() as u32;
                    let pr = ((cr as u32 * alpha_u) / 255) as u8;
                    let pg = ((cg as u32 * alpha_u) / 255) as u8;
                    let pb = ((cb as u32 * alpha_u) / 255) as u8;
                    let idx = ((py * pm.width() + px) * 4) as usize;
                    let data = pm.data_mut();
                    if idx + 3 >= data.len() {
                        return;
                    }
                    let bg_r = data[idx] as u32;
                    let bg_g = data[idx + 1] as u32;
                    let bg_b = data[idx + 2] as u32;
                    let bg_a = data[idx + 3] as u32;
                    let inv_a = 255u32 - alpha_u;
                    data[idx] = ((pr as u32 + bg_r * inv_a / 255).min(255)) as u8;
                    data[idx + 1] = ((pg as u32 + bg_g * inv_a / 255).min(255)) as u8;
                    data[idx + 2] = ((pb as u32 + bg_b * inv_a / 255).min(255)) as u8;
                    data[idx + 3] = ((alpha_u + bg_a * inv_a / 255).min(255)) as u8;
                });
            }
            pen_x += scaled.h_advance(gid);
        }

        ctx.pen_x = pen_x;
        let line_h = (max_bottom - ctx.pen_y).max(scaled.height());
        ctx.line_height = ctx.line_height.max(line_h);
        ctx.line_advance = ctx.line_advance.max(line_h);
    }

    fn render_atlas_line(
        &self,
        ctx: &mut MarkupRenderContext,
        pm: &mut Pixmap,
        font: &FontDefinition,
        text: &str,
    ) -> Result<()> {
        if font.images.is_empty() && font.texture_virtual_path().is_none() {
            return Ok(());
        }

        let line_w =
            FontGlyphRenderer::measure_line(font, text, ctx.current_x_scale);
        let start_x = FontGlyphRenderer::aligned_pen_x(
            line_w,
            ctx.canvas_w as f32,
            ctx.h_align.as_str(),
            ctx.pen_x,
            ctx.left_margin,
            ctx.right_margin,
        );
        let pen_y = ctx.pen_y;

        let quads = FontGlyphRenderer::layout_line_with_atlas_dims(
            font,
            text,
            start_x,
            pen_y,
            ctx.current_x_scale,
            ctx.current_y_scale,
            |mat| {
                self.textures
                    .get_by_virtual_mat(mat)
                    .ok()
                    .map(|t| (t.width, t.height))
            },
        );

        let mut max_h = 0.0_f32;
        for quad in &quads {
            max_h = max_h.max(quad.dst_px.3);
            match self.textures.get_by_virtual_mat(&quad.mat_virtual_path) {
                Ok(tex) => {
                    blend_glyph_quad(pm, &tex.rgba, tex.width, tex.height, quad, ctx.color)?;
                }
                Err(_) => {}
            }
        }

        ctx.pen_x = start_x + line_w;
        ctx.line_height = ctx.line_height.max(max_h);
        ctx.line_advance = ctx.line_advance.max(max_h);
        Ok(())
    }

    fn render_img(
        &self,
        attrs: &HashMap<String, String>,
        ctx: &mut MarkupRenderContext,
        pm: &mut Pixmap,
    ) -> Result<()> {
        let Some(src) = attr(attrs, "src") else {
            return Ok(());
        };

        let mut draw_color = ctx.color;
        if let Some(hex) = attr(attrs, "color") {
            if let Some(rgba) = scs_to_rgba(hex) {
                draw_color = rgba;
            }
        }

        let element_w = ctx.canvas_w as f32;
        let element_h = ctx.canvas_h as f32;

        let has_w = attr(attrs, "width").is_some();
        let has_h = attr(attrs, "height").is_some();
        let x_stretch = attr(attrs, "xscale")
            .map(|s| s.eq_ignore_ascii_case("stretch"))
            .unwrap_or(false);
        let y_stretch = attr(attrs, "yscale")
            .map(|s| s.eq_ignore_ascii_case("stretch"))
            .unwrap_or(false);

        let mut img_w = if has_w {
            attr(attrs, "width").and_then(|s| s.parse().ok()).unwrap_or(1.0)
        } else if x_stretch {
            (element_w - ctx.pen_x).max(1.0)
        } else {
            (element_w - ctx.pen_x).max(1.0)
        };

        let mut img_h = if has_h && !y_stretch {
            attr(attrs, "height").and_then(|s| s.parse().ok()).unwrap_or(1.0)
        } else if y_stretch {
            (element_h - ctx.pen_y).max(1.0)
        } else {
            (element_h - ctx.pen_y).max(1.0)
        };

        if !x_stretch {
            if let Some(s) = attr(attrs, "xscale") {
                if let Ok(xsf) = s.parse::<f32>() {
                    if xsf > 0.0 {
                        img_w = if has_w { img_w * xsf } else { img_w };
                    }
                }
            }
        }
        if !y_stretch {
            if let Some(s) = attr(attrs, "yscale") {
                if let Ok(ysf) = s.parse::<f32>() {
                    if ysf > 0.0 {
                        img_h = if has_h { img_h * ysf } else { img_h };
                    }
                }
            }
        }

        img_w = img_w.max(1.0);
        img_h = img_h.max(1.0);

        let draw_x = ctx.pen_x + ctx.left_margin;
        let mut draw_y = ctx.pen_y;
        if ctx.in_align_block {
            draw_y = match ctx.valign.to_ascii_lowercase().as_str() {
                "bottom" => element_h - img_h,
                "center" => (element_h - img_h) / 2.0,
                _ => ctx.pen_y,
            };
        }

        if src.to_ascii_lowercase().ends_with("white.mat") {
            fill_rect_pm(
                pm,
                draw_x,
                draw_y,
                img_w,
                img_h,
                straight_to_premul(draw_color),
            );
            ctx.pen_x += img_w;
            return Ok(());
        }

        match self.textures.get_by_virtual_mat(src) {
            Ok(tex) => {
                let tw = tex.width as f32;
                let th = tex.height as f32;

                let mut uv_l = 0.0_f32;
                let mut uv_r = 1.0_f32;
                let mut uv_t = 0.0_f32;
                let mut uv_b = 1.0_f32;
                if let Some(lv) = attr(attrs, "left") {
                    uv_l = parse_uv(lv, tex.width);
                }
                if let Some(rv) = attr(attrs, "right") {
                    uv_r = parse_uv(rv, tex.width);
                }
                if let Some(tv) = attr(attrs, "top") {
                    uv_t = parse_uv(tv, tex.height);
                }
                if let Some(bv) = attr(attrs, "bottom") {
                    uv_b = parse_uv(bv, tex.height);
                }
                if attr(attrs, "right").is_none() {
                    uv_r = 1.0;
                }
                if attr(attrs, "bottom").is_none() {
                    uv_b = 1.0;
                }

                let (mut l, mut r, mut t, mut b) = (uv_l, uv_r, uv_t, uv_b);
                let flip_h = l > r;
                let flip_v = t > b;
                if flip_h {
                    std::mem::swap(&mut l, &mut r);
                }
                if flip_v {
                    std::mem::swap(&mut t, &mut b);
                }

                let px = (l * tw).max(0.0) as i32;
                let py = (t * th).max(0.0) as i32;
                let pw = ((r - l) * tw).max(1.0).min(tw - px as f32) as u32;
                let ph = ((b - t) * th).max(1.0).min(th - py as f32) as u32;

                blit_stretch_tint(
                    pm,
                    &tex.rgba,
                    tex.width,
                    tex.height,
                    px.max(0) as u32,
                    py.max(0) as u32,
                    pw.min(tex.width.saturating_sub(px.max(0) as u32)),
                    ph.min(tex.height.saturating_sub(py.max(0) as u32)),
                    draw_x,
                    draw_y,
                    img_w,
                    img_h,
                    draw_color,
                    flip_h,
                    flip_v,
                );
            }
            Err(_) => {
                fill_rect_pm(
                    pm,
                    draw_x,
                    draw_y,
                    img_w,
                    img_h,
                    PremultipliedColorU8::from_rgba(160, 160, 160, 35)
                        .unwrap_or(PremultipliedColorU8::TRANSPARENT),
                );
            }
        }

        ctx.pen_x += img_w;
        Ok(())
    }
}

fn attr<'a>(m: &'a HashMap<String, String>, key: &str) -> Option<&'a str> {
    m.get(&key.to_ascii_lowercase()).map(|s| s.as_str())
}

fn default_typical_height(font_face: &str) -> f32 {
    let f = font_face.to_ascii_lowercase();
    if f.contains("lcd_number") {
        return 20.0;
    }
    if f.contains("lcd") {
        return 18.0;
    }
    if f.contains("number") {
        return 16.0;
    }
    if f.contains("headline") {
        return 16.0;
    }
    14.0
}

fn parse_uv(value: &str, max_px: u32) -> f32 {
    let v = value.trim();
    if v.len() > 1 && v[..1].eq_ignore_ascii_case("p") {
        return v[1..]
            .parse::<f32>()
            .map(|px| px / max_px.max(1) as f32)
            .unwrap_or(0.0);
    }
    v.parse::<f32>().unwrap_or(0.0)
}

fn straight_to_premul(c: [u8; 4]) -> PremultipliedColorU8 {
    let a = c[3] as f32 / 255.0;
    PremultipliedColorU8::from_rgba(
        ((c[0] as f32) * a) as u8,
        ((c[1] as f32) * a) as u8,
        ((c[2] as f32) * a) as u8,
        c[3],
    )
    .unwrap_or(PremultipliedColorU8::TRANSPARENT)
}

/// Atlas glyph quad → destination pixels, each sampled once from the atlas.
///
/// Iterates over every **destination** pixel, computes the corresponding atlas
/// UV, samples the coverage (alpha-channel or luma), and blends with `color`
/// using source-over compositing.  The old atlas-pixel loop wrote multiple
/// atlas pixels to the same destination pixel, causing alpha to accumulate and
/// characters to appear merged/over-bright.
fn blend_glyph_quad(
    dst: &mut Pixmap,
    tex: &[u8],
    tex_w: u32,
    tex_h: u32,
    quad: &GlyphQuad,
    color: [u8; 4],
) -> Result<()> {
    let (src_x, src_y, src_w, src_h) = quad.src_px;
    let (dst_x, dst_y, dst_w, dst_h) = quad.dst_px;

    if src_w <= 0 || src_h <= 0 || dst_w <= 0.0 || dst_h <= 0.0 {
        return Ok(());
    }

    let src_x0 = src_x.max(0) as u32;
    let src_y0 = src_y.max(0) as u32;
    let src_pw = (src_w.max(0) as u32).min(tex_w.saturating_sub(src_x0));
    let src_ph = (src_h.max(0) as u32).min(tex_h.saturating_sub(src_y0));
    if src_pw == 0 || src_ph == 0 {
        return Ok(());
    }

    let dst_x0 = dst_x.floor() as i32;
    let dst_y0 = dst_y.floor() as i32;
    // Use round for width/height to avoid single-pixel gaps between adjacent glyphs.
    let dst_pw = (dst_w.round() as i32).max(1);
    let dst_ph = (dst_h.round() as i32).max(1);

    let canvas_w = dst.width() as i32;
    let canvas_h = dst.height() as i32;
    let data = dst.data_mut();

    // Iterate destination pixels — each pixel samples the atlas exactly once.
    for dy_off in 0..dst_ph {
        let dy = dst_y0 + dy_off;
        if dy < 0 || dy >= canvas_h {
            continue;
        }

        // Map destination row → atlas row (nearest-neighbour)
        let v = (dy_off as f32 + 0.5) / dst_ph as f32;
        let atlas_row = (src_y0 as f32 + v * src_ph as f32 - 0.5)
            .round()
            .clamp(src_y0 as f32, (src_y0 + src_ph - 1) as f32) as u32;

        for dx_off in 0..dst_pw {
            let dx = dst_x0 + dx_off;
            if dx < 0 || dx >= canvas_w {
                continue;
            }

            // Map destination column → atlas column (nearest-neighbour)
            let u = (dx_off as f32 + 0.5) / dst_pw as f32;
            let atlas_col = (src_x0 as f32 + u * src_pw as f32 - 0.5)
                .round()
                .clamp(src_x0 as f32, (src_x0 + src_pw - 1) as f32) as u32;

            let gi = ((atlas_row * tex_w + atlas_col) * 4) as usize;
            if gi + 3 >= tex.len() {
                continue;
            }

            // Coverage: for bitmap fonts the alpha channel holds direct coverage.
            // SCS fonts are SDF (Signed Distance Field) or MSDF (Multi-channel SDF);
            // in those cases alpha == 0 and the distance data is encoded in RGB.
            //
            //   MSDF encoding: signal = median(R, G, B)
            //   SDF single-channel: signal = max(R, G, B)
            //
            // Heuristic: if all three channels are nearly equal the font uses a single
            // channel (SDF); otherwise it is MSDF.
            //
            // SDF sigmoid sharpening converts the soft distance ramp into a crisp edge:
            //   alpha = clamp((signal − 0.5) × sharpness + 0.5, 0, 1)
            // Without this step SDF fonts look blurry or incorrectly anti-aliased.
            let cov = {
                let ta = tex[gi + 3];
                if ta > 0 {
                    // Bitmap / non-SDF font — alpha is the direct per-pixel coverage.
                    ta
                } else {
                    let r = tex[gi] as f32 / 255.0;
                    let g = tex[gi + 1] as f32 / 255.0;
                    let b = tex[gi + 2] as f32 / 255.0;

                    // Branchless median(R, G, B).
                    let (mut a, mut bv, mut c) = (r, g, b);
                    if a > bv { std::mem::swap(&mut a, &mut bv); }
                    if bv > c { std::mem::swap(&mut bv, &mut c); }
                    if a > bv { std::mem::swap(&mut a, &mut bv); }
                    let median_v = bv;
                    let max_v = r.max(g).max(b);

                    // Channel-spread heuristic: near-equal → single-channel SDF,
                    // spread channels → MSDF.
                    let diff = (r - g).abs() + (g - b).abs() + (r - b).abs();
                    let signal = if diff < 0.05 { max_v } else { median_v };

                    // Sigmoid sharpening — sharpness=16 matches the WPF reference.
                    let sharpness = 16.0_f32;
                    let alpha = ((signal - 0.5) * sharpness + 0.5).clamp(0.0, 1.0);
                    (alpha * 255.0) as u8
                }
            };
            if cov < 4 {
                continue;
            }

            // Premultiplied source-over blend.
            let alpha = (color[3] as u32 * cov as u32) / 255;
            if alpha == 0 {
                continue;
            }
            let sr = (color[0] as u32 * alpha) / 255;
            let sg = (color[1] as u32 * alpha) / 255;
            let sb = (color[2] as u32 * alpha) / 255;

            let di = (dy as usize * canvas_w as usize + dx as usize) * 4;
            if di + 3 >= data.len() {
                continue;
            }
            let inv = 255u32 - alpha;
            data[di]     = (sr + (data[di]     as u32 * inv / 255)).min(255) as u8;
            data[di + 1] = (sg + (data[di + 1] as u32 * inv / 255)).min(255) as u8;
            data[di + 2] = (sb + (data[di + 2] as u32 * inv / 255)).min(255) as u8;
            data[di + 3] = (alpha + (data[di + 3] as u32 * inv / 255)).min(255) as u8;
        }
    }
    Ok(())
}

fn blit_stretch_tint(
    pm: &mut Pixmap,
    tex: &[u8],
    tex_w: u32,
    tex_h: u32,
    src_x: u32,
    src_y: u32,
    src_w: u32,
    src_h: u32,
    dst_x: f32,
    dst_y: f32,
    dst_w: f32,
    dst_h: f32,
    tint: [u8; 4],
    flip_h: bool,
    flip_v: bool,
) {
    let cw = pm.width();
    let ch = pm.height();
    let dw_i = dst_w.ceil().max(1.0) as i32;
    let dh_i = dst_h.ceil().max(1.0) as i32;
    let dx0 = dst_x.floor() as i32;
    let dy0 = dst_y.floor() as i32;

    let tr = tint[0] as f32 / 255.0;
    let tg = tint[1] as f32 / 255.0;
    let tb = tint[2] as f32 / 255.0;
    let ta = tint[3] as f32 / 255.0;

    let is_white = tint[0] >= 250 && tint[1] >= 250 && tint[2] >= 250 && tint[3] >= 250;

    for iy in 0..dh_i {
        for ix in 0..dw_i {
            let px = dx0 + ix;
            let py = dy0 + iy;
            if px < 0 || py < 0 || px >= cw as i32 || py >= ch as i32 {
                continue;
            }

            let u = (ix as f32 + 0.5) / dw_i as f32;
            let v = (iy as f32 + 0.5) / dh_i as f32;
            let mut u = u.clamp(0.0, 1.0);
            let mut v = v.clamp(0.0, 1.0);
            if flip_h {
                u = 1.0 - u;
            }
            if flip_v {
                v = 1.0 - v;
            }

            let tx = src_x as f32 + u * (src_w.saturating_sub(1)) as f32;
            let ty = src_y as f32 + v * (src_h.saturating_sub(1)) as f32;
            let txi = tx.round() as i32;
            let tyi = ty.round() as i32;
            if txi < 0 || tyi < 0 {
                continue;
            }
            let txi = txi as u32;
            let tyi = tyi as u32;
            if txi >= tex_w || tyi >= tex_h {
                continue;
            }

            let o = ((tyi * tex_w + txi) * 4) as usize;
            if o + 3 >= tex.len() {
                continue;
            }
            let sr = tex[o] as f32 / 255.0;
            let sg = tex[o + 1] as f32 / 255.0;
            let sb = tex[o + 2] as f32 / 255.0;
            let sa = tex[o + 3] as f32 / 255.0;
            // SDF/MSDF: alpha may be 0 with signal in RGB — legacy uses max(R,G,B) when single-channel.
            let cov = if sa > 0.001 {
                sa
            } else {
                sr.max(sg).max(sb)
            };

            let (pr, pg, pb, pa) = if is_white {
                (sr * cov, sg * cov, sb * cov, cov * ta)
            } else {
                let mask = if sa > 0.001 { sa } else { sr.max(sg).max(sb) };
                (tr * mask * ta, tg * mask * ta, tb * mask * ta, ta * mask)
            };

            let idx = ((py as u32 * cw + px as u32) * 4) as usize;
            let data = pm.data_mut();
            if idx + 3 >= data.len() {
                continue;
            }
            let dr = data[idx] as f32 / 255.0;
            let dg = data[idx + 1] as f32 / 255.0;
            let db = data[idx + 2] as f32 / 255.0;
            let da = data[idx + 3] as f32 / 255.0;

            let out_a = pa + da * (1.0 - pa);
            let out_r = pr + dr * (1.0 - pa);
            let out_g = pg + dg * (1.0 - pa);
            let out_b = pb + db * (1.0 - pa);

            data[idx] = (out_r.min(1.0) * 255.0) as u8;
            data[idx + 1] = (out_g.min(1.0) * 255.0) as u8;
            data[idx + 2] = (out_b.min(1.0) * 255.0) as u8;
            data[idx + 3] = (out_a.min(1.0) * 255.0) as u8;
        }
    }
}

fn fill_rect_pm(
    pm: &mut Pixmap,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    color: PremultipliedColorU8,
) {
    let cw = pm.width() as i32;
    let ch = pm.height() as i32;
    let x0 = x.floor() as i32;
    let y0 = y.floor() as i32;
    let x1 = (x + w).ceil() as i32;
    let y1 = (y + h).ceil() as i32;
    let pr = color.red() as f32 / 255.0;
    let pg = color.green() as f32 / 255.0;
    let pb = color.blue() as f32 / 255.0;
    let pa = color.alpha() as f32 / 255.0;

    for py in y0.max(0)..y1.min(ch) {
        for px in x0.max(0)..x1.min(cw) {
            let idx = ((py as u32 * pm.width() + px as u32) * 4) as usize;
            let data = pm.data_mut();
            if idx + 3 >= data.len() {
                continue;
            }
            let dr = data[idx] as f32 / 255.0;
            let dg = data[idx + 1] as f32 / 255.0;
            let db = data[idx + 2] as f32 / 255.0;
            let da = data[idx + 3] as f32 / 255.0;
            let out_a = pa + da * (1.0 - pa);
            let out_r = pr + dr * (1.0 - pa);
            let out_g = pg + dg * (1.0 - pa);
            let out_b = pb + db * (1.0 - pa);
            data[idx] = (out_r.min(1.0) * 255.0) as u8;
            data[idx + 1] = (out_g.min(1.0) * 255.0) as u8;
            data[idx + 2] = (out_b.min(1.0) * 255.0) as u8;
            data[idx + 3] = (out_a.min(1.0) * 255.0) as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::FontRegistry;
    use crate::rendering::FontGlyphRenderer;
    use std::path::PathBuf;

    fn example_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dashboard_examples_from_game")
    }

    #[test]
    fn layout_88_yields_glyphs() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let fonts = FontRegistry::new(&root);
        let def = fonts.get("/font/sign/digit.font").expect("font");
        let quads = FontGlyphRenderer::layout_line(&def, "88", 0., 0., 1., 1.);
        assert_eq!(quads.len(), 2, "expected two glyph quads");
    }

    #[test]
    fn renders_img_white_mat_solid_without_dds() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let tex = TextureCache::new(&root);
        let fonts = FontRegistry::new(&root);
        let r = ScsMarkupRenderer {
            textures: &tex,
            fonts: &fonts,
        };
        // Legacy fast path: any `src` ending in `white.mat` fills a solid tint (no texture file).
        let markup = r#"<img src=/material/ui/white.mat width=64 height=32>"#;
        let pm = r
            .render_to_pixmap(markup, 128, 64)
            .expect("render")
            .expect("some");
        let sum: u32 = pm.data().iter().map(|&b| b as u32).sum();
        assert!(sum > 10_000, "expected solid fill pixels, sum={}", sum);
    }
}