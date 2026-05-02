//! Data model for ETS2/ATS dashboard `.sii` projects (mirrors frontend `src/types/scs.ts`).

use serde::{Deserialize, Serialize};

// --- Element types -----------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ElementType {
    Window,
    Group,
    Text,
    TextCommon,
    TextBar,
    Gauge,
}

/// Used by the element library / presets (not serialized in `.sii` files).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ElementCategory {
    Background,
    Icon,
    TextValue,
    Bar,
    Gauge,
    Group,
    Indicator,
}

// --- Core graph types --------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardElement {
    /// UUID as string (client-generated or assigned on import).
    pub id: String,
    pub element_type: ElementType,
    /// SCS unit name, e.g. `.clock` or `_nameless._.foo`.
    pub name: String,
    pub parent_name: String,
    pub child_names: Vec<String>,

    /// Coordinates in SCS space: bottom-left origin, 0–800 virtual pixels.
    pub coords_l: i32,
    pub coords_r: i32,
    pub coords_t: i32,
    pub coords_b: i32,

    /// `id:` value in SiiNunit (`0` = no game binding).
    pub dashboard_id: i32,
    pub layer: i32,
    /// `fitting: false` on `ui::group` — omit or `None` when not applicable.
    pub fitting: Option<bool>,

    // ui::text / ui::text_common
    pub text_content: String,
    pub look_template: String,
    pub default_value: String,

    // ui_text_bar (1.49+)
    pub is_vertical: bool,
    pub bar_min_value: f64,
    pub bar_max_value: f64,
    pub bar_min_size: i32,
    pub bar_max_size: i32,

    // ui_gauge
    pub gauge_min_angle: f64,
    pub gauge_max_angle: f64,
    pub gauge_value_min: f64,
    pub gauge_value_max: f64,
    pub gauge_value_off: f64,
    pub gauge_material: String,
    pub gauge_xref_pos: i32,
    pub gauge_yref_pos: i32,
    pub gauge_off_x: i32,
    pub gauge_off_y: i32,
    pub gauge_smooth_move: bool,

    pub is_visible: bool,
}

impl DashboardElement {
    pub fn width(&self) -> i32 {
        self.coords_r - self.coords_l
    }

    pub fn height(&self) -> i32 {
        self.coords_t - self.coords_b
    }

    /// Top-left Y in board space (Y grows downward), given canvas height in SCS units.
    pub fn screen_y(&self, canvas_height: i32) -> i32 {
        canvas_height - self.coords_t
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardScreen {
    pub id: String,
    pub unit_name: String,
    pub screen_id: i32,
    pub display_name: String,
    pub elements: Vec<DashboardElement>,
}

impl DashboardScreen {
    #[inline]
    pub fn is_shared(&self) -> bool {
        self.screen_id == 950
    }

    #[inline]
    pub fn is_warning(&self) -> bool {
        self.screen_id == 900
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextTemplate {
    pub name: String,
    pub text: String,
}

fn default_canvas_dim() -> i32 {
    800
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardProject {
    pub window_unit_name: String,
    pub mod_id: String,
    pub dashboard_file_name: String,
    pub screens: Vec<DashboardScreen>,
    pub templates: Vec<TextTemplate>,
    pub sii_source_directory: Option<String>,
    pub game_root_path: Option<String>,
    /// Virtual canvas width (SCS `coords_r` on root window), default 800.
    #[serde(default = "default_canvas_dim")]
    pub canvas_width: i32,
    /// Virtual canvas height (SCS `coords_t`), default 800.
    #[serde(default = "default_canvas_dim")]
    pub canvas_height: i32,
}

// --- Validation --------------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum ValidationSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ValidationError {
    pub severity: ValidationSeverity,
    pub message: String,
    pub element_id: Option<String>,
}

// --- Supporting types --------------------------------------------------------------------------

/// UV crop for `<img>` markup / sprite picker (normalized and pixel forms live in tooling).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SpriteRegion {
    pub left: f32,
    pub right: f32,
    pub top: f32,
    pub bottom: f32,
}

/// Result metadata for mod ZIP export (Tauri command response).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExportSummary {
    pub warnings: Vec<ValidationError>,
    pub output_path: String,
    pub file_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn dashboard_element_round_trips_json_camel_case() {
        let el = DashboardElement {
            id: "550e8400-e29b-41d4-a716-446655440000".into(),
            element_type: ElementType::TextCommon,
            name: ".spd".into(),
            parent_name: ".root".into(),
            child_names: vec![],
            coords_l: 10,
            coords_r: 110,
            coords_t: 700,
            coords_b: 650,
            dashboard_id: 1020,
            layer: 2,
            fitting: None,
            text_content: String::new(),
            look_template: "dot.flb.text.right".into(),
            default_value: "88|km/h".into(),
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
        let v = serde_json::to_value(&el).unwrap();
        assert_eq!(v["elementType"], json!("textCommon"));
        assert_eq!(v["dashboardId"], json!(1020));
        let back: DashboardElement = serde_json::from_value(v).unwrap();
        assert_eq!(back, el);
    }

    #[test]
    fn validation_severity_pascal_case() {
        let e = ValidationError {
            severity: ValidationSeverity::Warning,
            message: "test".into(),
            element_id: None,
        };
        let s = serde_json::to_string(&e).unwrap();
        assert!(s.contains("\"severity\":\"Warning\""));
    }

    fn el_group_screen100() -> (DashboardScreen, String) {
        let win = "_nameless.win".to_string();
        let unit = "_nameless.s100".to_string();
        let root = DashboardElement {
            id: "root-100".into(),
            element_type: ElementType::Group,
            name: unit.clone(),
            parent_name: win.clone(),
            child_names: vec![".speed_txt".into()],
            coords_l: 0,
            coords_r: 800,
            coords_t: 800,
            coords_b: 0,
            dashboard_id: 100,
            layer: 0,
            fitting: Some(false),
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
        let text = DashboardElement {
            id: "txt-1".into(),
            element_type: ElementType::TextCommon,
            name: ".speed_txt".into(),
            parent_name: unit.clone(),
            child_names: vec![],
            coords_l: 10,
            coords_r: 200,
            coords_t: 750,
            coords_b: 700,
            dashboard_id: 1020,
            layer: 2,
            fitting: None,
            text_content: String::new(),
            look_template: "dot.flb.text.right".into(),
            default_value: "88|km/h".into(),
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
        (
            DashboardScreen {
                id: "scr100".into(),
                unit_name: unit.clone(),
                screen_id: 100,
                display_name: "Main".into(),
                elements: vec![root, text],
            },
            win,
        )
    }

    /// Step 22: frontend and backend share the same JSON shape (`serde_json` / camelCase).
    #[test]
    fn dashboard_project_round_trips_json_full() {
        let (screen100, win) = el_group_screen100();
        let project = DashboardProject {
            window_unit_name: win,
            mod_id: "step22_test".into(),
            dashboard_file_name: "dashboard".into(),
            screens: vec![screen100],
            templates: vec![
                TextTemplate {
                    name: "txt.step22.a".into(),
                    text: "<font>%0</font>".into(),
                },
                TextTemplate {
                    name: "txt.step22.b".into(),
                    text: "aux".into(),
                },
            ],
            sii_source_directory: Some(r"mod\ui".into()),
            game_root_path: Some(r"C:\Games\ETS2".into()),
            canvas_width: 800,
            canvas_height: 800,
        };
        let json = serde_json::to_string_pretty(&project).unwrap();
        let back: DashboardProject = serde_json::from_str(&json).unwrap();
        assert_eq!(back, project);
    }
}
