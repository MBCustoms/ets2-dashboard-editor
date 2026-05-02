//! Composite [`crate::core::DashboardScreen`] elements into one [`tiny_skia::Pixmap`] (editor preview).
//!
//! Virtual board is **800×800** SCS units; output size scales independently (`sx`, `sy`).

use std::collections::HashMap;

use anyhow::Result;
use tiny_skia::{Pixmap, PixmapPaint, Transform};

use crate::core::{
    apply_template_slots, merge_telemetry_and_default_slots, resolve_element_display_text,
    DashboardElement, DashboardScreen, ElementType, FontRegistry, TextTemplate,
};
use crate::rendering::{ScsMarkupRenderer, TextureCache};

/// Default virtual size when project dimensions are missing (legacy 800×800).
pub const VIRTUAL_BOARD_SIZE: i32 = 800;

/// Maps element SCS coords to top-left position and size in virtual board space (before scale to pixels).
pub fn element_virtual_rect(el: &DashboardElement, virt_h: i32) -> (i32, i32, i32, i32) {
    let ew = el.width();
    let eh = el.height();
    let left = el.coords_l;
    let top = virt_h - el.coords_t;
    (left, top, ew, eh)
}

/// Scale virtual rect to pixel rect for an output canvas.
pub fn scale_virtual_rect_to_canvas(
    left: i32,
    top: i32,
    w: i32,
    h: i32,
    canvas_w: u32,
    canvas_h: u32,
    virt_w: i32,
    virt_h: i32,
) -> (f32, f32, u32, u32) {
    let vw = virt_w.max(1) as f32;
    let vh = virt_h.max(1) as f32;
    let sx = canvas_w as f32 / vw;
    let sy = canvas_h as f32 / vh;
    let x = left as f32 * sx;
    let y = top as f32 * sy;
    let cw = (w as f32 * sx).ceil().max(1.0) as u32;
    let ch = (h as f32 * sy).ceil().max(1.0) as u32;
    (x, y, cw, ch)
}

/// Telemetry ID → `default_value`-style string (`%0|%1` split) for template preview.
pub fn format_telemetry_for_id(id: i32, normalized: f64) -> String {
    match id {
        1020 | 1430 => format!("{:.0}|km/h", normalized * 150.0),
        1040 | 1300 => {
            let g = normalized as i32;
            match g {
                -1 => "R".to_string(),
                0 => "N".to_string(),
                n => n.to_string(),
            }
        }
        1050 => {
            let mins = (normalized * 1440.0) as u32;
            format!("{:02}:{:02}", (mins / 60) % 24, mins % 60)
        }
        1060 => format!("{:.0}|%", normalized * 100.0),
        1090 | 1150 => format!("{:.0}|°C", normalized * 130.0),
        1010 | 1340 => format!("{:.0}|°C", normalized * 130.0),
        1120 | 1370 => format!("{:.1}|bar", normalized * 12.0),
        1110 => format!("{:.1}|bar", normalized * 8.0),
        1130 => format!("{:.2}|bar", normalized),
        // 1510/1520: map stores 0–100 (fuel / AdBlue percent), not 0–1.
        1510 | 1520 => format!("{:.0}|%", normalized.clamp(0.0, 100.0)),
        1100 | 1450 => format!("{:.0}|km/h", normalized * 150.0),
        1610 => format!("{:.0}", normalized),
        1030 => format!("{:.0}|km", normalized),
        1210 => format!("{:.1}|km", normalized),
        1160 | 1350 => format!("{:.1}|l/h", normalized * 50.0),
        1170 | 1360 => format!("{:.1}|l/100km", normalized * 100.0),
        1000 => format!("{:.0}|°C", normalized * 50.0 - 20.0),
        1220 => {
            let dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
            let idx = ((normalized * 8.0).floor() as usize).min(7);
            dirs[idx].to_string()
        }
        1310 => {
            if normalized >= 0.5 {
                "M".to_string()
            } else {
                "A".to_string()
            }
        }
        1380 => match (normalized.floor() as i32).clamp(0, 3) {
            0 => "D".to_string(),
            1 => "N".to_string(),
            2 => "R".to_string(),
            _ => "M".to_string(),
        },
        1280 | 1390 => {
            let s = normalized.max(0.0);
            let h = (s / 3600.0).floor() as u32;
            let m = ((s % 3600.0) / 60.0).floor() as u32;
            format!("{:02}:{:02}", h, m)
        }
        1400 => format!("{:.0}|km/h", normalized),
        1500 => format!("{:.1}|l", normalized),
        1530 | 1540 => {
            let m = normalized.max(0.0) as u32;
            format!("{:02}:{:02}", (m / 60) % 24, m % 60)
        }
        1680 => format!("{:.1}|kWh", normalized),
        1320 => format!("{:.1}|V", normalized),
        1075 => "H~~0~~1".to_string(),
        1115 => "H~~0~~8".to_string(),
        1125 => "H~~0~~12".to_string(),
        1135 => "H~~0~~1".to_string(),
        1145 => "H~~0~~1".to_string(),
        1155 => "H~~0~~130".to_string(),
        1185 => "H~~0~~1".to_string(),
        1355 => "H~~0~~5".to_string(),
        1365 => "H~~0~~5".to_string(),
        1555 => "H~~0~~130".to_string(),
        1565 => "H~~0~~100000".to_string(),
        1605 => "H~~0~~130".to_string(),
        _ => format!("{:.2}", normalized),
    }
}

/// Linear gauge needle angle (degrees), same formula as legacy `ComputeGaugeAngle`.
pub fn gauge_angle_deg(el: &DashboardElement, value: f64) -> f64 {
    let range = el.gauge_value_max - el.gauge_value_min;
    let t = if range.abs() > f64::EPSILON {
        ((value - el.gauge_value_min) / range).clamp(0.0, 1.0)
    } else {
        0.0
    };
    el.gauge_min_angle + t * (el.gauge_max_angle - el.gauge_min_angle)
}

const VIS_CHAIN_MAX: usize = 128;

/// `my_parent` chain: element draws only when **it** and every named ancestor are `is_visible`.
/// Unknown / missing parents do not hide the element (matches loose SCS graphs).
pub fn element_effective_visible(el: &DashboardElement, by_name: &HashMap<&str, &DashboardElement>) -> bool {
    if !el.is_visible {
        return false;
    }
    let mut cur = el;
    for _ in 0..VIS_CHAIN_MAX {
        let p = cur.parent_name.trim();
        if p.is_empty() {
            return true;
        }
        let Some(par) = by_name.get(p).copied() else {
            return true;
        };
        if !par.is_visible {
            return false;
        }
        cur = par;
    }
    false
}

fn visible_elements_for_screen<'a>(
    screen: &'a DashboardScreen,
) -> (HashMap<&'a str, &'a DashboardElement>, Vec<&'a DashboardElement>) {
    let mut by_name: HashMap<&str, &DashboardElement> = HashMap::new();
    for e in &screen.elements {
        if !e.name.is_empty() {
            by_name.insert(e.name.as_str(), e);
        }
    }
    let mut elems: Vec<&DashboardElement> = screen
        .elements
        .iter()
        .filter(|e| element_effective_visible(e, &by_name))
        .collect();
    elems.sort_by_key(|e| e.layer);
    (by_name, elems)
}

/// Renders all visible elements of one screen into a pixmap (transparent background).
pub struct DashboardCanvasRenderer<'a> {
    pub textures: &'a TextureCache,
    pub fonts: &'a FontRegistry,
}

impl<'a> DashboardCanvasRenderer<'a> {
    /// Renders `shared` behind `screen` (e.g. SCS shared layer `screen_id` 950). Per-gauge override is `None` for shared.
    pub fn render_screen(
        &self,
        screen: &DashboardScreen,
        canvas_w: u32,
        canvas_h: u32,
        virt_w: i32,
        virt_h: i32,
        shared: Option<&DashboardScreen>,
        telemetry: Option<&HashMap<i32, f64>>,
        templates: &[TextTemplate],
    ) -> Result<Option<Pixmap>> {
        let cw = canvas_w.clamp(1, 4096);
        let ch = canvas_h.clamp(1, 4096);
        let mut canvas = Pixmap::new(cw, ch).expect("canvas alloc");

        if let Some(sh) = shared {
            self.draw_visible_elements(sh, cw, ch, virt_w, virt_h, None, telemetry, templates, &mut canvas)?;
        }
        self.draw_visible_elements(screen, cw, ch, virt_w, virt_h, None, telemetry, templates, &mut canvas)?;

        if canvas.data().iter().all(|&b| b == 0) {
            return Ok(None);
        }
        Ok(Some(canvas))
    }

    fn draw_visible_elements(
        &self,
        screen: &DashboardScreen,
        canvas_w: u32,
        canvas_h: u32,
        virt_w: i32,
        virt_h: i32,
        gauge_value: Option<f64>,
        telemetry: Option<&HashMap<i32, f64>>,
        templates: &[TextTemplate],
        canvas: &mut Pixmap,
    ) -> Result<()> {
        let (_by_name, elems) = visible_elements_for_screen(screen);

        for el in elems {
            match el.element_type {
                ElementType::Text | ElementType::TextCommon | ElementType::TextBar => {
                    self.draw_text_element(
                        el,
                        templates,
                        canvas_w,
                        canvas_h,
                        virt_w,
                        virt_h,
                        telemetry,
                        canvas,
                    )?;
                }
                ElementType::Gauge => {
                    self.draw_gauge_element(
                        el,
                        canvas_w,
                        canvas_h,
                        virt_w,
                        virt_h,
                        gauge_value,
                        telemetry,
                        canvas,
                    )?;
                }
                ElementType::Group | ElementType::Window => {}
            }
        }
        Ok(())
    }

    fn draw_text_element(
        &self,
        el: &DashboardElement,
        templates: &[TextTemplate],
        canvas_w: u32,
        canvas_h: u32,
        virt_w: i32,
        virt_h: i32,
        telemetry: Option<&HashMap<i32, f64>>,
        canvas: &mut Pixmap,
    ) -> Result<()> {
        let markup = match el.element_type {
            ElementType::TextCommon => {
                let tmpl = templates
                    .iter()
                    .find(|t| t.name.trim() == el.look_template.trim());
                let Some(tmpl) = tmpl else {
                    return Ok(());
                };
                let tele_line = if el.dashboard_id != 0 {
                    telemetry
                        .and_then(|m| m.get(&el.dashboard_id))
                        .map(|&v| format_telemetry_for_id(el.dashboard_id, v))
                } else {
                    None
                };
                let slots = merge_telemetry_and_default_slots(tele_line.as_deref(), &el.default_value);
                apply_template_slots(&tmpl.text, &slots)
            }
            ElementType::Text | ElementType::TextBar => {
                resolve_element_display_text(el, templates)
            }
            _ => return Ok(()),
        };
        let markup = markup.trim();
        if markup.is_empty() {
            return Ok(());
        }
        let (vl, vt, vw, vh) = element_virtual_rect(el, virt_h);
        if vw <= 0 || vh <= 0 {
            return Ok(());
        }
        let (x, y, pw, ph) =
            scale_virtual_rect_to_canvas(vl, vt, vw, vh, canvas_w, canvas_h, virt_w, virt_h);
        let r = ScsMarkupRenderer {
            textures: self.textures,
            fonts: self.fonts,
        };
        let Some(mut sub) = r.render_to_pixmap(markup, pw, ph)? else {
            return Ok(());
        };

        if el.element_type == ElementType::TextBar {
            let raw = telemetry
                .and_then(|m| m.get(&el.dashboard_id))
                .copied()
                .unwrap_or(1.0);
            let t = if el.bar_max_value > el.bar_min_value {
                ((raw - el.bar_min_value) / (el.bar_max_value - el.bar_min_value)).clamp(0.0, 1.0)
            } else {
                raw.clamp(0.0, 1.0)
            };
            let wpx = sub.width();
            let hpx = sub.height();
            let data = sub.data_mut();
            if !el.is_vertical {
                let clip_w = ((wpx as f64) * t).round().clamp(0.0, wpx as f64) as u32;
                for py in 0..hpx {
                    for px in clip_w..wpx {
                        let i = ((py * wpx + px) * 4) as usize;
                        if i + 3 < data.len() {
                            data[i..i + 4].fill(0);
                        }
                    }
                }
            } else {
                let clip_h = ((hpx as f64) * t).round().clamp(0.0, hpx as f64) as u32;
                let clip_start_y = hpx.saturating_sub(clip_h);
                for py in 0..clip_start_y {
                    for px in 0..wpx {
                        let i = ((py * wpx + px) * 4) as usize;
                        if i + 3 < data.len() {
                            data[i..i + 4].fill(0);
                        }
                    }
                }
            }
        }

        composite_pixmap(canvas, &sub, x.round() as i32, y.round() as i32);
        Ok(())
    }

    fn draw_gauge_element(
        &self,
        el: &DashboardElement,
        canvas_w: u32,
        canvas_h: u32,
        virt_w: i32,
        virt_h: i32,
        gauge_value: Option<f64>,
        telemetry: Option<&HashMap<i32, f64>>,
        canvas: &mut Pixmap,
    ) -> Result<()> {
        let mat = el.gauge_material.trim();
        if mat.is_empty() {
            return Ok(());
        }
        let (vl, vt, vw, vh) = element_virtual_rect(el, virt_h);
        if vw <= 0 || vh <= 0 {
            return Ok(());
        }
        let (x, y, bw, bh) =
            scale_virtual_rect_to_canvas(vl, vt, vw, vh, canvas_w, canvas_h, virt_w, virt_h);
        let bx = x.round() as i32;
        let by = y.round() as i32;

        let tex = match self.textures.get_by_virtual_mat(mat) {
            Ok(t) => t,
            Err(_) => return Ok(()),
        };
        let tw = tex.width;
        let th = tex.height;
        if tw == 0 || th == 0 {
            return Ok(());
        }

        let Some(gauge_pm) = rgba_straight_to_pixmap(&tex.rgba, tw, th) else {
            return Ok(());
        };

        let sx = bw as f32 / tw as f32;
        let sy = bh as f32 / th as f32;
        let mut scaled = Pixmap::new(bw, bh).expect("scaled");
        scaled.as_mut().draw_pixmap(
            0,
            0,
            gauge_pm.as_ref(),
            &PixmapPaint::default(),
            Transform::from_scale(sx, sy),
            None,
        );

        let value = telemetry
            .and_then(|m| m.get(&el.dashboard_id))
            .copied()
            .or(gauge_value)
            .unwrap_or(el.gauge_value_off);
        let angle = gauge_angle_deg(el, value) as f32;
        let vw = virt_w.max(1) as f32;
        let vh = virt_h.max(1) as f32;
        let gscale_x = canvas_w as f32 / vw;
        let gscale_y = canvas_h as f32 / vh;
        let off_x = el.gauge_off_x as f32 * gscale_x;
        let off_y = el.gauge_off_y as f32 * gscale_y;
        let px = el.gauge_xref_pos as f32 * (bw as f32 / tw as f32);
        let py = el.gauge_yref_pos as f32 * (bh as f32 / th as f32);

        let draw_x = bx + off_x.round() as i32;
        let draw_y = by + off_y.round() as i32;

        canvas.as_mut().draw_pixmap(
            draw_x,
            draw_y,
            scaled.as_ref(),
            &PixmapPaint::default(),
            Transform::from_rotate_at(angle, px, py),
            None,
        );
        Ok(())
    }
}

fn composite_pixmap(dst: &mut Pixmap, src: &Pixmap, x: i32, y: i32) {
    dst.as_mut().draw_pixmap(
        x,
        y,
        src.as_ref(),
        &PixmapPaint::default(),
        Transform::identity(),
        None,
    );
}

/// Straight RGBA8 → premultiplied `Pixmap` (same convention as game DDS decode).
fn rgba_straight_to_pixmap(rgba: &[u8], w: u32, h: u32) -> Option<Pixmap> {
    let mut pm = Pixmap::new(w, h)?;
    let d = pm.data_mut();
    let n = (w * h) as usize;
    if rgba.len() < n * 4 {
        return None;
    }
    for i in 0..n {
        let o = i * 4;
        let r = rgba[o] as f32 / 255.0;
        let g = rgba[o + 1] as f32 / 255.0;
        let b = rgba[o + 2] as f32 / 255.0;
        let a = rgba[o + 3] as f32 / 255.0;
        d[o] = (r * a * 255.0) as u8;
        d[o + 1] = (g * a * 255.0) as u8;
        d[o + 2] = (b * a * 255.0) as u8;
        d[o + 3] = (a * 255.0) as u8;
    }
    Some(pm)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::{ElementType, FontRegistry};
    use std::path::PathBuf;

    fn example_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dashboard_examples_from_game")
    }

    #[test]
    fn effective_visible_respects_parent_chain() {
        let parent = DashboardElement {
            id: "p".into(),
            element_type: ElementType::Group,
            name: "grp.unit".into(),
            parent_name: String::new(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 10,
            coords_t: 800,
            coords_b: 790,
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
            is_visible: false,
        };
        let mut child = parent.clone();
        child.id = "c".into();
        child.name = "child.unit".into();
        child.parent_name = "grp.unit".into();
        child.element_type = ElementType::Text;
        child.is_visible = true;

        let mut by_name: HashMap<&str, &DashboardElement> = HashMap::new();
        by_name.insert(parent.name.as_str(), &parent);
        by_name.insert(child.name.as_str(), &child);

        assert!(!element_effective_visible(&child, &by_name));
        assert!(!element_effective_visible(&parent, &by_name));
    }

    #[test]
    fn virtual_rect_top_left() {
        let el = DashboardElement {
            id: "1".into(),
            element_type: ElementType::TextCommon,
            name: "n".into(),
            parent_name: "p".into(),
            child_names: vec![],
            coords_l: 10,
            coords_r: 110,
            coords_t: 700,
            coords_b: 650,
            dashboard_id: 0,
            layer: 1,
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
        };
        let (l, t, w, h) = element_virtual_rect(&el, 800);
        assert_eq!((l, t, w, h), (10, 100, 100, 50));
    }

    #[test]
    fn gauge_angle_endpoints() {
        let mut el = DashboardElement {
            id: "g".into(),
            element_type: ElementType::Gauge,
            name: "n".into(),
            parent_name: "p".into(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 100,
            coords_t: 800,
            coords_b: 700,
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
            gauge_min_angle: -90.0,
            gauge_max_angle: 90.0,
            gauge_value_min: 0.0,
            gauge_value_max: 100.0,
            gauge_value_off: 0.0,
            gauge_material: "/m/g.mat".into(),
            gauge_xref_pos: 0,
            gauge_yref_pos: 0,
            gauge_off_x: 0,
            gauge_off_y: 0,
            gauge_smooth_move: false,
            is_visible: true,
        };
        assert!((gauge_angle_deg(&el, 0.0) + 90.0).abs() < 1e-6);
        assert!((gauge_angle_deg(&el, 100.0) - 90.0).abs() < 1e-6);
        el.gauge_value_min = 10.0;
        el.gauge_value_max = 10.0;
        assert_eq!(gauge_angle_deg(&el, 5.0), el.gauge_min_angle);
    }

    #[test]
    fn render_screen_img_only() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let tex = TextureCache::new(&root);
        let fonts = FontRegistry::new(&root);
        let r = DashboardCanvasRenderer {
            textures: &tex,
            fonts: &fonts,
        };
        let screen = DashboardScreen {
            id: "s".into(),
            unit_name: "u".into(),
            screen_id: 10,
            display_name: "d".into(),
            elements: vec![DashboardElement {
                id: "e1".into(),
                element_type: ElementType::Text,
                name: "n".into(),
                parent_name: "p".into(),
                child_names: vec![],
                coords_l: 0,
                coords_r: 200,
                coords_t: 800,
                coords_b: 600,
                dashboard_id: 0,
                layer: 0,
                fitting: None,
                text_content: r#"<img src=/x/white.mat width=64 height=32>"#.into(),
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
            }],
        };
        let pm = r
            .render_screen(&screen, 400, 400, 800, 800, None, None, &[])
            .expect("ok")
            .expect("pix");
        let sum: u32 = pm.data().iter().map(|&b| b as u32).sum();
        assert!(sum > 1000);
    }
}
