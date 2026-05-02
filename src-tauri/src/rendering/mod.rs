//! GPU-agnostic helpers for dashboard preview (DDS → RGBA, caching).

pub mod dashboard_canvas;
pub mod font_glyph_renderer;
pub mod scs_markup_renderer;
pub mod texture_cache;

pub use dashboard_canvas::{
    element_effective_visible, element_virtual_rect, gauge_angle_deg, scale_virtual_rect_to_canvas,
    DashboardCanvasRenderer, VIRTUAL_BOARD_SIZE,
};
pub use font_glyph_renderer::{FontGlyphRenderer, GlyphQuad};
pub use scs_markup_renderer::{MarkupRenderContext, ScsMarkupRenderer};
pub use texture_cache::{CachedTexture, TextureCache};
