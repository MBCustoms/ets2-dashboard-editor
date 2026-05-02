//! Resolve `look_template` + `value` into preview markup (legacy `TemplateLoader.Render` / `ResolveElementDisplayText`).

use crate::core::models::{DashboardElement, ElementType, TextTemplate};

/// Split `value` by `|` into slot strings (SCS dashboard `value:` / default_value).
pub fn split_pipe_slots(s: &str) -> Vec<String> {
    if s.is_empty() {
        return vec![];
    }
    s.split('|').map(|p| p.trim().to_string()).collect()
}

/// Merge telemetry-formatted string with default slots: per index, use telemetry segment if non-empty, else default.
pub fn merge_telemetry_and_default_slots(telemetry_fmt: Option<&str>, default: &str) -> Vec<String> {
    let t = telemetry_fmt.map(split_pipe_slots).unwrap_or_default();
    let d = split_pipe_slots(default);
    let n = t.len().max(d.len()).max(1);
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let tv = t.get(i).map(|s| s.as_str()).unwrap_or("");
        let dv = d.get(i).map(|s| s.as_str()).unwrap_or("");
        let use_t = !tv.is_empty();
        out.push(if use_t { tv.to_string() } else { dv.to_string() });
    }
    out
}

/// Replace `%0` … `%99` in template markup (SCS `ui::text_template`).
pub fn apply_template_slots(tmpl: &str, slots: &[String]) -> String {
    let mut out = tmpl.to_string();
    for (i, slot) in slots.iter().enumerate().take(100) {
        let key = format!("%{}", i);
        out = out.replace(&key, slot);
    }
    out
}

/// Replace `%0` / `%1` in template body (legacy `TemplateLoader.Render`).
pub fn render_template_text(tmpl: &TextTemplate, value0: &str, value1: &str) -> String {
    apply_template_slots(
        &tmpl.text,
        &[value0.to_string(), value1.to_string()],
    )
}

fn find_template<'a>(templates: &'a [TextTemplate], key: &str) -> Option<&'a TextTemplate> {
    let k = key.trim();
    if k.is_empty() {
        return None;
    }
    templates.iter().find(|t| t.name == k)
}

/// Full markup string used for canvas preview (legacy `ResolveElementDisplayText`).
///
/// `templates` comes from `DashboardProject::templates` (keys match `TextTemplate::name` / `ui::text_template : …` unit names).
pub fn resolve_element_display_text(el: &DashboardElement, templates: &[TextTemplate]) -> String {
    match el.element_type {
        ElementType::TextCommon => {
            if !el.look_template.is_empty() {
                if let Some(t) = find_template(templates, &el.look_template) {
                    let slots = split_pipe_slots(&el.default_value);
                    return apply_template_slots(&t.text, &slots);
                }
            }
            if !el.default_value.is_empty() {
                let parts = split_pipe_slots(&el.default_value);
                let joined = parts.join(" ");
                return format!(
                    r#"<color value=FFFFFFFF><font face=/font/db_normal.font xscale=2 yscale=2>{}</font>"#,
                    joined
                );
            }
            String::new()
        }
        ElementType::TextBar => el.text_content.clone(),
        ElementType::Gauge => String::new(),
        ElementType::Text => {
            if !el.text_content.trim().is_empty() {
                return el.text_content.clone();
            }
            if !el.look_template.is_empty() {
                if let Some(t) = find_template(templates, &el.look_template) {
                    let slots = split_pipe_slots(&el.default_value);
                    return apply_template_slots(&t.text, &slots);
                }
            }
            String::new()
        }
        ElementType::Group | ElementType::Window => el.text_content.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::models::ElementType;

    fn sample_template() -> TextTemplate {
        TextTemplate {
            name: "dot.test.tmpl".into(),
            text: r#"<font face=/font/x.font>%0|%1</font>"#.into(),
        }
    }

    #[test]
    fn render_replaces_placeholders() {
        let t = sample_template();
        let s = render_template_text(&t, "A", "B");
        assert!(s.contains("A") && s.contains("B"));
        assert!(!s.contains("%0"));
    }

    #[test]
    fn merge_fills_missing_slots_from_default() {
        let m = merge_telemetry_and_default_slots(Some("88"), "x|mph");
        assert_eq!(m, vec!["88", "mph"]);
    }

    #[test]
    fn apply_template_replaces_many_slots() {
        let s = apply_template_slots("<t>%0|%1|%2</t>", &["a".into(), "b".into(), "c".into()]);
        assert_eq!(s, "<t>a|b|c</t>");
    }

    #[test]
    fn text_common_resolves_template() {
        let el = DashboardElement {
            id: "1".into(),
            element_type: ElementType::TextCommon,
            name: "n".into(),
            parent_name: "p".into(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 10,
            coords_t: 10,
            coords_b: 0,
            dashboard_id: 0,
            layer: 0,
            fitting: None,
            text_content: String::new(),
            look_template: "dot.test.tmpl".into(),
            default_value: "speed|km/h".into(),
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
        let out = resolve_element_display_text(&el, &[sample_template()]);
        assert!(out.contains("speed"));
        assert!(out.contains("km/h"));
    }

    #[test]
    fn text_common_fallback_without_template() {
        let el = DashboardElement {
            look_template: "missing.key".into(),
            default_value: "hello".into(),
            ..text_common_stub()
        };
        let out = resolve_element_display_text(&el, &[]);
        assert!(out.contains("hello"));
        assert!(out.contains("db_normal.font"));
    }

    fn text_common_stub() -> DashboardElement {
        DashboardElement {
            id: "1".into(),
            element_type: ElementType::TextCommon,
            name: "n".into(),
            parent_name: "p".into(),
            child_names: vec![],
            coords_l: 0,
            coords_r: 10,
            coords_t: 10,
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
    fn text_prefers_text_content_over_template() {
        let el = DashboardElement {
            element_type: ElementType::Text,
            text_content: "<img src=/a/white.mat width=8 height=8>".into(),
            look_template: "dot.test.tmpl".into(),
            default_value: "x|y".into(),
            ..text_common_stub()
        };
        let out = resolve_element_display_text(&el, &[sample_template()]);
        assert!(out.contains("white.mat"));
    }

    #[test]
    fn text_uses_template_when_content_empty() {
        let el = DashboardElement {
            element_type: ElementType::Text,
            text_content: "   ".into(),
            look_template: "dot.test.tmpl".into(),
            default_value: "only0".into(),
            ..text_common_stub()
        };
        let out = resolve_element_display_text(&el, &[sample_template()]);
        assert!(out.contains("only0"));
    }
}
