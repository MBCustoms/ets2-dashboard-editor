//! Platform-independent domain types (no UI / Tauri specifics).

pub mod color_helper;
pub mod dds_decoder;
pub mod font_registry;
pub mod mat_resolver;
pub mod models;
pub mod scs_markup;
pub mod sii_exporter;
pub mod sii_parser;
pub mod telemetry;
pub mod template_display;
pub mod validator;

pub use color_helper::{resolve_named_color, rgba_to_scs, scs_to_rgba};
pub use dds_decoder::{decode_dds, decode_dds_bytes};
pub use font_registry::{parse_font_file, parse_font_str, FontDefinition, FontGlyph, FontImage, FontRegistry};
pub use mat_resolver::{resolve_texture_search_roots, MatResolver};
pub use models::*;
pub use scs_markup::{
    find_matching_font_end, normalize_scs_text, parse_attrs, parse_scs_markup, tokenize_scs_markup,
    ScsMarkupToken,
};
pub use sii_exporter::export_project;
pub use template_display::{
    apply_template_slots, merge_telemetry_and_default_slots, render_template_text,
    resolve_element_display_text,
};
pub use sii_parser::{parse_dashboard_with_templates, parse_sii_file, parse_sii_string};
pub use validator::validate;
