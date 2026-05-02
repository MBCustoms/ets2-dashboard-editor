//! Validate a [`DashboardProject`] for export / in-game use.

use std::collections::{HashMap, HashSet};

use crate::core::models::{
    DashboardElement, DashboardProject, ElementType, ValidationError, ValidationSeverity,
};

/// Run all validation rules; errors block export, warnings do not.
pub fn validate(project: &DashboardProject) -> Vec<ValidationError> {
    let mut out = Vec::new();

    check_required_ids_and_screen(project, &mut out);
    if project.templates.is_empty() {
        out.push(ValidationError {
            severity: ValidationSeverity::Info,
            message: "Project has no text templates defined.".to_string(),
            element_id: None,
        });
    }

    let all_names = collect_all_element_names(project);
    let parent_map = collect_parent_map(project);

    check_mod_id(project, &mut out);
    check_duplicate_dashboard_ids(project, &mut out);
    check_parents_exist(project, &all_names, &mut out);
    check_children_exist(project, &all_names, &mut out);
    check_parent_cycles(project, &parent_map, &mut out);
    check_coordinates(project, &mut out);
    check_look_templates(project, &mut out);
    check_zero_size(project, &mut out);
    check_layer_overlaps(project, &mut out);
    check_text_common_look_template(project, &mut out);

    out
}

fn collect_all_element_names(project: &DashboardProject) -> HashSet<String> {
    project
        .screens
        .iter()
        .flat_map(|s| s.elements.iter())
        .map(|e| e.name.clone())
        .collect()
}

fn collect_parent_map(project: &DashboardProject) -> HashMap<String, String> {
    project
        .screens
        .iter()
        .flat_map(|s| s.elements.iter())
        .map(|e| (e.name.clone(), e.parent_name.clone()))
        .collect()
}

fn check_required_ids_and_screen(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    let mut has_10 = false;
    let mut has_20 = false;
    for s in &project.screens {
        for e in &s.elements {
            if e.dashboard_id == 10 {
                has_10 = true;
            }
            if e.dashboard_id == 20 {
                has_20 = true;
            }
        }
    }
    if !has_10 {
        out.push(err(
            "No element with dashboard id 10 (electricity off background).",
            None,
        ));
    }
    if !has_20 {
        out.push(err(
            "No element with dashboard id 20 (electricity on background).",
            None,
        ));
    }
    if !project.screens.iter().any(|s| s.screen_id == 950) {
        out.push(err(
            "No screen with id 950 (shared display).",
            None,
        ));
    }
}

fn check_mod_id(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    const BAD: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    if project.mod_id.chars().any(|c| BAD.contains(&c)) {
        out.push(ValidationError {
            severity: ValidationSeverity::Warning,
            message: format!(
                "mod_id \"{}\" contains characters not allowed in Windows file names.",
                project.mod_id
            ),
            element_id: None,
        });
    }
}

fn check_duplicate_dashboard_ids(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    for screen in &project.screens {
        let mut seen: HashMap<i32, String> = HashMap::new();
        for e in &screen.elements {
            let id = e.dashboard_id;
            if id == 0 {
                continue;
            }
            if let Some(first) = seen.get(&id) {
                out.push(err(
                    &format!(
                        "Duplicate dashboard id {id} in screen \"{}\" (elements \"{}\" and \"{}\").",
                        screen.unit_name, first, e.name
                    ),
                    Some(e.id.clone()),
                ));
            } else {
                seen.insert(id, e.name.clone());
            }
        }
    }
}

fn check_parents_exist(
    project: &DashboardProject,
    all_names: &HashSet<String>,
    out: &mut Vec<ValidationError>,
) {
    let win = project.window_unit_name.trim();
    for s in &project.screens {
        for e in &s.elements {
            let p = e.parent_name.trim();
            if p.is_empty() {
                continue;
            }
            if p == win {
                continue;
            }
            if all_names.contains(p) {
                continue;
            }
            out.push(err(
                &format!(
                    "Element \"{}\" has my_parent \"{}\" which does not exist.",
                    e.name, p
                ),
                Some(e.id.clone()),
            ));
        }
    }
}

fn check_children_exist(
    project: &DashboardProject,
    all_names: &HashSet<String>,
    out: &mut Vec<ValidationError>,
) {
    for s in &project.screens {
        for e in &s.elements {
            for ch in &e.child_names {
                if all_names.contains(ch) {
                    continue;
                }
                out.push(err(
                    &format!(
                        "Element \"{}\" lists child \"{}\" which does not exist.",
                        e.name, ch
                    ),
                    Some(e.id.clone()),
                ));
            }
        }
    }
}

fn check_parent_cycles(
    project: &DashboardProject,
    parents: &HashMap<String, String>,
    out: &mut Vec<ValidationError>,
) {
    let win = project.window_unit_name.trim();
    for s in &project.screens {
        for e in &s.elements {
            if parent_chain_has_cycle(parents, &e.name, win) {
                out.push(err(
                    &format!(
                        "Circular parent reference detected (starting from \"{}\").",
                        e.name
                    ),
                    Some(e.id.clone()),
                ));
            }
        }
    }
}

fn parent_chain_has_cycle(
    parents: &HashMap<String, String>,
    start: &str,
    window: &str,
) -> bool {
    let mut seen = HashSet::<String>::new();
    let mut cur = start.to_string();
    for _ in 0..=parents.len().saturating_add(2) {
        let p = parents.get(&cur).cloned().unwrap_or_default();
        let pt = p.trim();
        if pt.is_empty() || pt == window {
            return false;
        }
        if seen.contains(pt) {
            return true;
        }
        seen.insert(cur);
        cur = pt.to_string();
    }
    true
}

fn check_coordinates(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    let cw = project.canvas_width.max(1);
    let ch = project.canvas_height.max(1);
    for s in &project.screens {
        for e in &s.elements {
            for (label, v, max_v) in [
                ("coords_l", e.coords_l, cw),
                ("coords_r", e.coords_r, cw),
                ("coords_t", e.coords_t, ch),
                ("coords_b", e.coords_b, ch),
            ] {
                if v < 0 || v > max_v {
                    out.push(err(
                        &format!(
                            "Element \"{}\" has {} = {v} outside the 0–{max_v} range.",
                            e.name, label
                        ),
                        Some(e.id.clone()),
                    ));
                }
            }
        }
    }
}

fn template_names(project: &DashboardProject) -> HashSet<String> {
    project
        .templates
        .iter()
        .map(|t| t.name.clone())
        .collect()
}

fn check_look_templates(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    let names = template_names(project);
    for s in &project.screens {
        for e in &s.elements {
            if e.element_type != ElementType::TextCommon {
                continue;
            }
            let lt = e.look_template.trim();
            if lt.is_empty() {
                continue;
            }
            if !names.contains(lt) {
                let label = if e.name.trim().is_empty() {
                    e.id.as_str()
                } else {
                    e.name.as_str()
                };
                out.push(warn(
                    &format!(
                        "Element '{}' references look_template '{}' which is not defined in this project.",
                        label, e.look_template
                    ),
                    Some(e.id.clone()),
                ));
            }
        }
    }
}

fn check_zero_size(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    for s in &project.screens {
        for e in &s.elements {
            if e.coords_l == e.coords_r {
                out.push(warn(
                    &format!(
                        "Element \"{}\" has zero width (coords_l == coords_r).",
                        e.name
                    ),
                    Some(e.id.clone()),
                ));
            }
            if e.coords_t == e.coords_b {
                out.push(warn(
                    &format!(
                        "Element \"{}\" has zero height (coords_t == coords_b).",
                        e.name
                    ),
                    Some(e.id.clone()),
                ));
            }
        }
    }
}

fn rects_overlap(a: &DashboardElement, b: &DashboardElement) -> bool {
    if a.coords_r < b.coords_l || b.coords_r < a.coords_l {
        return false;
    }
    if a.coords_b > b.coords_t || b.coords_b > a.coords_t {
        return false;
    }
    true
}

fn check_layer_overlaps(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    for s in &project.screens {
        let els: Vec<&DashboardElement> = s.elements.iter().collect();
        for i in 0..els.len() {
            for j in (i + 1)..els.len() {
                let a = els[i];
                let b = els[j];
                if a.layer != b.layer {
                    continue;
                }
                if !rects_overlap(a, b) {
                    continue;
                }
                out.push(warn(
                    &format!(
                        "Elements \"{}\" and \"{}\" are on layer {} and have overlapping bounds.",
                        a.name, b.name, a.layer
                    ),
                    Some(a.id.clone()),
                ));
            }
        }
    }
}

fn check_text_common_look_template(project: &DashboardProject, out: &mut Vec<ValidationError>) {
    for s in &project.screens {
        for e in &s.elements {
            if e.element_type != ElementType::TextCommon {
                continue;
            }
            if e.look_template.trim().is_empty() {
                out.push(warn(
                    &format!(
                        "ui::text_common element \"{}\" has an empty look_template.",
                        e.name
                    ),
                    Some(e.id.clone()),
                ));
            }
        }
    }
}

fn err(message: &str, element_id: Option<String>) -> ValidationError {
    ValidationError {
        severity: ValidationSeverity::Error,
        message: message.to_string(),
        element_id,
    }
}

fn warn(message: &str, element_id: Option<String>) -> ValidationError {
    ValidationError {
        severity: ValidationSeverity::Warning,
        message: message.to_string(),
        element_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::models::{DashboardScreen, TextTemplate};
    use uuid::Uuid;

    fn blank_el() -> DashboardElement {
        DashboardElement {
            id: Uuid::new_v4().to_string(),
            element_type: ElementType::Text,
            name: String::new(),
            parent_name: String::new(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 100,
            coords_t: 100,
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

    fn minimal_valid() -> DashboardProject {
        let win = ".win".to_string();
        let g950n = ".shared".to_string();
        let mut root = blank_el();
        root.element_type = ElementType::Group;
        root.name = g950n.clone();
        root.parent_name = win.clone();
        root.coords_r = 800;
        root.coords_t = 800;
        root.dashboard_id = 950;
        root.layer = -1;

        let mut e10 = blank_el();
        e10.name = ".bg10".into();
        e10.parent_name = g950n.clone();
        e10.dashboard_id = 10;
        e10.coords_r = 800;
        e10.coords_t = 800;

        let mut e20 = blank_el();
        e20.name = ".bg20".into();
        e20.parent_name = g950n.clone();
        e20.dashboard_id = 20;
        e20.coords_r = 800;
        e20.coords_t = 800;

        root.child_names = vec![e10.name.clone(), e20.name.clone()];

        DashboardProject {
            window_unit_name: win,
            mod_id: "my_mod".into(),
            dashboard_file_name: "dash".into(),
            screens: vec![DashboardScreen {
                id: Uuid::new_v4().to_string(),
                unit_name: g950n.clone(),
                screen_id: 950,
                display_name: "s".into(),
                elements: vec![root, e10, e20],
            }],
            templates: vec![TextTemplate {
                name: "t.a".into(),
                text: "%0".into(),
            }],
            sii_source_directory: None,
            game_root_path: None,
            canvas_width: 800,
            canvas_height: 800,
        }
    }

    #[test]
    fn valid_minimal_has_no_errors() {
        let p = minimal_valid();
        let v = validate(&p);
        let errors: Vec<_> = v
            .iter()
            .filter(|e| e.severity == ValidationSeverity::Error)
            .collect();
        assert!(errors.is_empty(), "{:?}", v);
    }

    #[test]
    fn error_missing_10() {
        let mut p = minimal_valid();
        p.screens[0].elements.retain(|e| e.dashboard_id != 10);
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("id 10")));
    }

    #[test]
    fn error_missing_950_screen() {
        let mut p = minimal_valid();
        p.screens[0].screen_id = 100;
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("950")));
    }

    #[test]
    fn error_duplicate_id_same_screen() {
        let mut p = minimal_valid();
        p.screens[0].elements[1].dashboard_id = 999;
        p.screens[0].elements[2].dashboard_id = 999;
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("Duplicate dashboard id 999")));
    }

    #[test]
    fn error_bad_parent() {
        let mut p = minimal_valid();
        p.screens[0].elements[1].parent_name = ".nope".into();
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("my_parent")));
    }

    #[test]
    fn error_bad_child() {
        let mut p = minimal_valid();
        p.screens[0].elements[0]
            .child_names
            .push(".missing".into());
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("child")));
    }

    #[test]
    fn error_coords_out_of_range() {
        let mut p = minimal_valid();
        p.screens[0].elements[1].coords_l = -1;
        let v = validate(&p);
        let cw = p.canvas_width;
        assert!(v.iter().any(|e| e.message.contains(&format!("0–{cw}"))));
    }

    #[test]
    fn warning_look_template_missing() {
        let mut p = minimal_valid();
        let mut tc = blank_el();
        tc.element_type = ElementType::TextCommon;
        tc.name = ".tc".into();
        tc.parent_name = p.screens[0].unit_name.clone();
        tc.look_template = "missing.tpl".into();
        tc.coords_r = 50;
        tc.coords_t = 50;
        p.screens[0].elements.push(tc);
        let v = validate(&p);
        assert!(v.iter().any(|e| {
            e.severity == ValidationSeverity::Warning && e.message.contains("look_template")
        }));
    }

    #[test]
    fn warning_mod_id_invalid() {
        let mut p = minimal_valid();
        p.mod_id = "bad:name".into();
        let v = validate(&p);
        assert!(v.iter().any(|e| {
            e.severity == ValidationSeverity::Warning && e.message.contains("mod_id")
        }));
    }

    #[test]
    fn info_no_templates() {
        let mut p = minimal_valid();
        p.templates.clear();
        let v = validate(&p);
        assert!(v.iter().any(|e| {
            e.severity == ValidationSeverity::Info && e.message.contains("no text templates")
        }));
    }

    #[test]
    fn error_parent_cycle() {
        let mut p = minimal_valid();
        let a = p.screens[0].elements[1].name.clone();
        let b = p.screens[0].elements[2].name.clone();
        p.screens[0].elements[1].parent_name = b.clone();
        p.screens[0].elements[2].parent_name = a.clone();
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("Circular")));
    }

    #[test]
    fn warning_text_common_empty_look_template() {
        let mut p = minimal_valid();
        let mut tc = blank_el();
        tc.element_type = ElementType::TextCommon;
        tc.name = ".tc".into();
        tc.parent_name = p.screens[0].unit_name.clone();
        tc.look_template = String::new();
        tc.text_content = String::new();
        tc.coords_r = 50;
        tc.coords_t = 50;
        p.screens[0].elements.push(tc);
        let v = validate(&p);
        assert!(v.iter().any(|e| {
            e.severity == ValidationSeverity::Warning && e.message.contains("look_template")
        }));
    }

    #[test]
    fn warning_zero_width() {
        let mut p = minimal_valid();
        p.screens[0].elements[1].coords_r = p.screens[0].elements[1].coords_l;
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("zero width")));
    }

    #[test]
    fn warning_overlap_same_layer() {
        let mut p = minimal_valid();
        let mut a = blank_el();
        a.name = ".a".into();
        a.parent_name = p.screens[0].unit_name.clone();
        a.coords_l = 10;
        a.coords_r = 50;
        a.coords_t = 50;
        a.coords_b = 10;
        a.layer = 5;
        let mut b = blank_el();
        b.name = ".b".into();
        b.parent_name = p.screens[0].unit_name.clone();
        b.coords_l = 40;
        b.coords_r = 80;
        b.coords_t = 50;
        b.coords_b = 10;
        b.layer = 5;
        p.screens[0].elements.push(a);
        p.screens[0].elements.push(b);
        let v = validate(&p);
        assert!(v.iter().any(|e| e.message.contains("overlapping")));
    }
}
