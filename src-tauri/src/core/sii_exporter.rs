//! Serialize [`DashboardProject`] to SCS `SiiNunit` text (dashboard + template files).

use std::collections::{HashMap, HashSet};

use anyhow::{anyhow, Result};
use uuid::Uuid;

use crate::core::models::{
    DashboardElement, DashboardProject, DashboardScreen, ElementType, TextTemplate,
};

const UTF8_BOM: char = '\u{FEFF}';

/// Returns `(dashboard_sii, template_sii)` — both strings include a UTF-8 BOM prefix (U+FEFF).
pub fn export_project(project: &DashboardProject) -> Result<(String, String)> {
    let mut p = project.clone();
    ensure_defaults(&mut p);
    let dashboard = export_dashboard(&p)?;
    let template = export_templates(&p)?;
    Ok((format!("{UTF8_BOM}{dashboard}"), format!("{UTF8_BOM}{template}")))
}

/// Clone `project` and apply the same injection as [`export_project`] (shared screen 950, ids 10/20).
pub fn project_with_export_defaults(project: &DashboardProject) -> DashboardProject {
    let mut p = project.clone();
    ensure_defaults(&mut p);
    p
}

fn ensure_defaults(p: &mut DashboardProject) {
    if p.canvas_width <= 0 {
        p.canvas_width = 800;
    }
    if p.canvas_height <= 0 {
        p.canvas_height = 800;
    }
    let has_10 = project_has_dashboard_id(p, 10);
    let has_20 = project_has_dashboard_id(p, 20);
    let has_950 = p.screens.iter().any(|s| s.screen_id == 950);

    let cw = p.canvas_width.max(1);
    let ch = p.canvas_height.max(1);

    if !has_950 {
        let root = DashboardElement {
            id: Uuid::new_v4().to_string(),
            element_type: ElementType::Group,
            name: "_nameless._.sharedisplay".to_string(),
            parent_name: p.window_unit_name.clone(),
            child_names: vec![],
            coords_l: 0,
            coords_r: cw,
            coords_t: ch,
            coords_b: 0,
            dashboard_id: 950,
            layer: -1,
            fitting: Some(false),
            ..blank_element()
        };
        p.screens.push(DashboardScreen {
            id: Uuid::new_v4().to_string(),
            unit_name: "_nameless._.sharedisplay".to_string(),
            screen_id: 950,
            display_name: "Shared (950)".to_string(),
            elements: vec![root],
        });
    }

    if p.window_unit_name.is_empty() {
        return;
    }

    let mut bg_order: Vec<String> = Vec::new();
    if !has_10 {
        inject_background(p, 10, "_nameless._.elec_off_bg");
        bg_order.push("_nameless._.elec_off_bg".into());
    }
    if !has_20 {
        inject_background(p, 20, "_nameless._.elec_on_bg");
        bg_order.push("_nameless._.elec_on_bg".into());
    }
    if !bg_order.is_empty() {
        if let Some(shared) = p.screens.iter_mut().find(|s| s.screen_id == 950) {
            let un = shared.unit_name.clone();
            if let Some(root) = shared.elements.iter_mut().find(|e| e.name == un) {
                for n in bg_order.iter().rev() {
                    if !root.child_names.iter().any(|c| c == n) {
                        root.child_names.insert(0, n.clone());
                    }
                }
            }
        }
    }
}

fn project_has_dashboard_id(p: &DashboardProject, id: i32) -> bool {
    p.screens.iter().any(|s| s.elements.iter().any(|e| e.dashboard_id == id))
}

fn inject_background(p: &mut DashboardProject, dash_id: i32, name: &str) {
    let Some(shared) = p.screens.iter_mut().find(|s| s.screen_id == 950) else {
        return;
    };
    let parent = shared.unit_name.clone();
    let el = DashboardElement {
        id: Uuid::new_v4().to_string(),
        element_type: ElementType::Text,
        name: name.to_string(),
        parent_name: parent.clone(),
        child_names: vec![],
        coords_l: 0,
        coords_r: p.canvas_width.max(1),
        coords_t: p.canvas_height.max(1),
        coords_b: 0,
        dashboard_id: dash_id,
        layer: -10,
        fitting: None,
        text_content: r#"<img src=/material/ui/white.mat xscale=stretch yscale=stretch color=ff000000>"#
            .to_string(),
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
    shared.elements.push(el);
}

fn blank_element() -> DashboardElement {
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

fn export_dashboard(p: &DashboardProject) -> Result<String> {
    let win = p
        .window_unit_name
        .trim()
        .to_string();
    if win.is_empty() {
        return Err(anyhow!("window_unit_name is required for export"));
    }

    let screen_order = sort_screens_for_export(&p.screens);
    let window_children: Vec<String> = screen_order
        .iter()
        .map(|i| p.screens[*i].unit_name.clone())
        .collect();

    let mut blocks = String::new();
    blocks.push_str(&emit_window_block(p, &win, &window_children)?);

    for idx in screen_order {
        let s = &p.screens[idx];
        let root = s
            .elements
            .iter()
            .find(|e| e.name == s.unit_name)
            .ok_or_else(|| anyhow!("screen {} missing root group element", s.unit_name))?;
        let ordered = dfs_screen_elements(s, root)?;
        for el in ordered {
            blocks.push_str(&emit_element_block(el)?);
            blocks.push('\n');
        }
    }

    Ok(format!(
        "SiiNunit\n{{\n{blocks}}}\n"
    ))
}

/// Order: 950, 100,200,…800, 900
fn sort_screens_for_export(screens: &[DashboardScreen]) -> Vec<usize> {
    let mut v: Vec<(i32, usize)> = screens
        .iter()
        .enumerate()
        .map(|(i, s)| (export_screen_sort_key(s.screen_id), i))
        .collect();
    v.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
    v.into_iter().map(|(_, i)| i).collect()
}

fn export_screen_sort_key(screen_id: i32) -> i32 {
    match screen_id {
        950 => 0,
        900 => 20_000,
        x if (100..=800).contains(&x) && x % 100 == 0 => x,
        _ => 10_000 + screen_id,
    }
}

fn dfs_screen_elements<'a>(
    screen: &'a DashboardScreen,
    root: &'a DashboardElement,
) -> Result<Vec<&'a DashboardElement>> {
    let map: HashMap<String, &DashboardElement> = screen
        .elements
        .iter()
        .map(|e| (e.name.clone(), e))
        .collect();
    let mut out: Vec<&DashboardElement> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    fn visit<'a>(
        name: &str,
        map: &HashMap<String, &'a DashboardElement>,
        out: &mut Vec<&'a DashboardElement>,
        seen: &mut HashSet<String>,
    ) -> Result<()> {
        if seen.contains(name) {
            return Err(anyhow!("cycle or duplicate visit: {name}"));
        }
        seen.insert(name.to_string());
        let el = map
            .get(name)
            .ok_or_else(|| anyhow!("missing element {name}"))?;
        out.push(*el);
        for ch in &el.child_names {
            visit(ch, map, out, seen)?;
        }
        Ok(())
    }
    visit(&root.name, &map, &mut out, &mut seen)?;
    Ok(out)
}

fn emit_window_block(p: &DashboardProject, win: &str, children: &[String]) -> Result<String> {
    let w = p
        .screens
        .iter()
        .flat_map(|s| s.elements.iter())
        .find(|e| e.element_type == ElementType::Window && e.name == win);

    let cw = p.canvas_width.max(1);
    let ch = p.canvas_height.max(1);
    let (cl, cr, ct, cb) = w
        .map(|e| (e.coords_l, e.coords_r, e.coords_t, e.coords_b))
        .unwrap_or((0, cw, ch, 0));

    let mut s = String::new();
    s.push_str(&format!("ui::window : {win} {{\n"));
    s.push_str(" window_handler: null\n");
    s.push_str(" clip_children: true\n");
    s.push_str(" keep_aspect: none\n");
    s.push_str(" user_string_data: \"\"\n");
    s.push_str(" first_direction_focus_id: 0\n");
    s.push_str(" fitting: false\n");
    s.push_str(&format!(" my_children: {}\n", children.len()));
    for (i, c) in children.iter().enumerate() {
        s.push_str(&format!(" my_children[{i}]: {c}\n"));
    }
    s.push_str(&format!(" coords_l: {cl}\n coords_r: {cr}\n coords_t: {ct}\n coords_b: {cb}\n"));
    s.push_str(&format!(
        " area_l: {cl}\n area_r: {cr}\n area_t: {ct}\n area_b: {cb}\n"
    ));
    s.push_str(" id: 0\n layer: 0\n tab: -1\n pointer: -1\n");
    s.push_str(" my_parent: null\n}\n\n");
    Ok(s)
}

fn emit_element_block(el: &DashboardElement) -> Result<String> {
    let kind = match el.element_type {
        ElementType::Window => "ui::window",
        ElementType::Group => "ui::group",
        ElementType::Text => "ui::text",
        ElementType::TextCommon => "ui::text_common",
        ElementType::TextBar => "ui_text_bar",
        ElementType::Gauge => "ui_gauge",
    };

    let mut body = String::new();

    match el.element_type {
        ElementType::Group => {
            if el.fitting == Some(false) {
                body.push_str(" fitting: false\n");
            }
            emit_children_array(&mut body, &el.child_names);
        }
        ElementType::Text => {
            body.push_str(&format!(" text: {}\n", quote_scs_string(&el.text_content)));
        }
        ElementType::TextCommon => {
            if !el.look_template.trim().is_empty() {
                body.push_str(&format!(
                    " look_template: {}\n",
                    format_token(el.look_template.trim())
                ));
            }
            if !el.default_value.is_empty() {
                let v = el.default_value.trim();
                let needs_quotes = v.contains(' ') || v.contains('|') || v.contains('"');
                if needs_quotes {
                    body.push_str(&format!(" value: \"{}\"\n", v.replace('"', "\\\"")));
                } else {
                    body.push_str(&format!(" value: {v}\n"));
                }
            }
            body.push_str(" text: \"\"\n");
        }
        ElementType::TextBar => {
            body.push_str(&format!(" vertical: {}\n", el.is_vertical));
            body.push_str(&format!(" min_size: {}\n", el.bar_min_size));
            body.push_str(&format!(" max_size: {}\n", el.bar_max_size));
            body.push_str(&format!(" min_value: {}\n", format_f64(el.bar_min_value)));
            body.push_str(&format!(" max_value: {}\n", format_f64(el.bar_max_value)));
            let text_val = el.text_content.trim();
            if text_val.is_empty() {
                body.push_str(" text: \"\"\n");
            } else {
                body.push_str(&format!(" text: {}\n", quote_scs_string(text_val)));
            }
        }
        ElementType::Gauge => {
            body.push_str(&format!(" min: {}\n", fmt_f64(el.gauge_min_angle)));
            body.push_str(&format!(" max: {}\n", fmt_f64(el.gauge_max_angle)));
            body.push_str(&format!(" value_min: {}\n", fmt_f64(el.gauge_value_min)));
            body.push_str(&format!(" value_max: {}\n", fmt_f64(el.gauge_value_max)));
            body.push_str(&format!(" value: {}\n", fmt_f64(el.gauge_value_off)));
            body.push_str(&format!(
                " material: {}\n",
                quote_scs_string(&el.gauge_material)
            ));
            body.push_str(&format!(" xref_pos: {}\n", el.gauge_xref_pos));
            body.push_str(&format!(" yref_pos: {}\n", el.gauge_yref_pos));
            body.push_str(&format!(" off_x: {}\n", el.gauge_off_x));
            body.push_str(&format!(" off_y: {}\n", el.gauge_off_y));
            body.push_str(&format!(" smooth_move: {}\n", el.gauge_smooth_move));
        }
        ElementType::Window => {}
    }

    body.push_str(&format!(
        " coords_l: {}\n coords_r: {}\n coords_t: {}\n coords_b: {}\n",
        el.coords_l, el.coords_r, el.coords_t, el.coords_b
    ));
    body.push_str(&format!(
        " area_l: {}\n area_r: {}\n area_t: {}\n area_b: {}\n",
        el.coords_l, el.coords_r, el.coords_t, el.coords_b
    ));
    body.push_str(&format!(
        " id: {}\n layer: {}\n tab: -1\n pointer: -1\n",
        el.dashboard_id, el.layer
    ));
    body.push_str(&format!(
        " my_parent: {}\n",
        if el.parent_name.is_empty() {
            "null".to_string()
        } else {
            el.parent_name.clone()
        }
    ));
    body.push_str("}");

    Ok(format!("{kind} : {} {{\n{body}\n}}\n", el.name))
}

fn emit_children_array(out: &mut String, names: &[String]) {
    out.push_str(&format!(" my_children: {}\n", names.len()));
    for (i, n) in names.iter().enumerate() {
        out.push_str(&format!(" my_children[{i}]: {n}\n"));
    }
}

fn quote_scs_string(s: &str) -> String {
    if needs_quoting(s) {
        let esc = escape_scs_string(s);
        format!("\"{esc}\"")
    } else {
        s.to_string()
    }
}

fn needs_quoting(s: &str) -> bool {
    s.is_empty()
        || s.chars().any(|c| c.is_whitespace() && c != ' ')
        || s.contains(' ')
        || s.contains(':')
        || s.contains('"')
        || s.contains('\\')
        || s.contains('\n')
        || s.contains('\r')
        || s.contains('\t')
}

fn escape_scs_string(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => o.push_str("\\\\"),
            '"' => o.push_str("\\\""),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c => o.push(c),
        }
    }
    o
}

fn format_token(s: &str) -> String {
    if needs_quoting(s) {
        quote_scs_string(s)
    } else {
        s.to_string()
    }
}

/// Prefer integer formatting for whole numbers (export readability).
fn format_f64(v: f64) -> String {
    if v.fract() == 0.0 && v.abs() < 1e9 {
        format!("{}", v as i64)
    } else {
        format!("{}", v)
    }
}

fn fmt_f64(f: f64) -> String {
    if !f.is_finite() {
        return "0".to_string();
    }
    let r = f.round();
    if (f - r).abs() < 1e-9 && r.abs() < 1e15 {
        format!("{}", r as i64)
    } else {
        let mut s = format!("{:.10}", f);
        while s.contains('.') && (s.ends_with('0') || s.ends_with('.')) {
            s.pop();
        }
        s
    }
}

fn export_templates(p: &DashboardProject) -> Result<String> {
    let mut out = String::from("SiiNunit\n{\n");
    for t in &p.templates {
        out.push_str(&emit_text_template(t)?);
        out.push('\n');
    }
    out.push_str("}\n");
    Ok(out)
}

fn emit_text_template(t: &TextTemplate) -> Result<String> {
    let inner_name = format!("Template {}", t.name);
    Ok(format!(
        "ui::text_template : {} {{\n\tname: {}\n\ttext: {}\n}}",
        t.name,
        quote_scs_string(&inner_name),
        quote_scs_string(&t.text)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::sii_parser::parse_sii_string;
    use crate::core::models::ElementType;

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

    #[test]
    fn export_round_trip_minimal() {
        let p = minimal_project();
        let (dash, _tpl) = export_project(&p).unwrap();
        let parsed = parse_sii_string(&dash, None).unwrap();
        assert_eq!(parsed.screens.len(), 1);
        assert_eq!(parsed.screens[0].screen_id, 950);
    }

    #[test]
    fn injects_id_10_20_and_keeps_950() {
        let p = minimal_project();
        let (dash, _) = export_project(&p).unwrap();
        assert!(dash.contains("id: 10"));
        assert!(dash.contains("id: 20"));
        assert!(dash.contains("id: 950"));
    }

    #[test]
    fn template_block_contains_markup() {
        let p = minimal_project();
        let (_d, tpl) = export_project(&p).unwrap();
        assert!(tpl.contains("ui::text_template"));
        assert!(tpl.contains("%0"));
    }

    /// Step 22: export → parse merged dashboard + template SII matches templates (game pipeline).
    #[test]
    fn export_round_trip_merges_dashboard_and_template_sii() {
        let p = minimal_project();
        let (dash, tpl) = export_project(&p).unwrap();
        let dash_clean = dash.trim_start_matches(UTF8_BOM);
        let tpl_clean = tpl.trim_start_matches(UTF8_BOM);
        let mut parsed_dash = parse_sii_string(dash_clean, None).unwrap();
        let parsed_tpl = parse_sii_string(tpl_clean, None).unwrap();
        parsed_dash.templates = parsed_tpl.templates;
        assert_eq!(parsed_dash.templates.len(), p.templates.len());
        assert_eq!(parsed_dash.templates[0].name, p.templates[0].name);
        assert_eq!(parsed_dash.templates[0].text, p.templates[0].text);
    }
}
