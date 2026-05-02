//! Decode DDS files to straight RGBA8888 using the [`dds`](https://docs.rs/dds) crate (BC1–BC7, etc.).
//! The `image` crate's DDS support does not cover all in-game DXGI formats (e.g. BC7 / DXGI 91).

use std::io::Cursor;
use std::path::Path;

use anyhow::{Context, Result};
use dds::{ColorFormat, Decoder, ImageViewMut};

/// Load a DDS from disk → RGBA bytes row-major, `(rgba, width, height)`.
pub fn decode_dds(path: &Path) -> Result<(Vec<u8>, u32, u32)> {
    let bytes = std::fs::read(path).with_context(|| format!("read {}", path.display()))?;
    decode_dds_bytes(&bytes).with_context(|| format!("decode DDS {}", path.display()))
}

/// Decode DDS from memory (same layout as [`decode_dds`]).
pub fn decode_dds_bytes(bytes: &[u8]) -> Result<(Vec<u8>, u32, u32)> {
    let mut decoder =
        Decoder::new(Cursor::new(bytes)).context("open DDS (dds::Decoder)")?;
    let size = decoder.main_size();
    let px = usize::try_from(size.pixels())
        .unwrap_or(0)
        .saturating_mul(4);
    let mut data = vec![0_u8; px];
    let view =
        ImageViewMut::new(&mut data, size, ColorFormat::RGBA_U8).context("dds ImageViewMut")?;
    decoder
        .read_surface(view)
        .context("dds decode surface to RGBA8")?;
    Ok((data, size.width, size.height))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn decode_example_dds_if_present() {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let dds = manifest.join("../../dashboard_examples_from_game/material/ui/dashboard/daf_2021/gauge_left.dds");
        if !dds.exists() {
            return;
        }
        let (px, w, h) = decode_dds(&dds).expect("decode");
        assert!(w > 0 && h > 0);
        assert_eq!(px.len() as u32, w * h * 4);
    }
}
