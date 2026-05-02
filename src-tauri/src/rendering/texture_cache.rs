//! Path-keyed cache of decoded DDS textures as straight RGBA8888 (row-major).
//!
//! Serves the same role as an Skia `SKBitmap` cache in the C# stack: avoid re-reading and
//! decompressing the same `.dds` files during preview and markup rendering.

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, RwLock};

use anyhow::{anyhow, Context, Result};

use crate::core::dds_decoder::decode_dds;
use crate::core::mat_resolver::{resolve_texture_search_roots, MatResolver};

/// Decoded 2D texture: straight alpha RGBA8, width × height × 4 bytes.
#[derive(Debug, Clone)]
pub struct CachedTexture {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// Thread-safe cache keyed by **canonical** DDS path on disk (see [`cache_key_for_dds`]).
#[derive(Debug)]
pub struct TextureCache {
    /// Search order: mod roots first, then base game (see [`Self::from_roots`]).
    roots: Vec<std::path::PathBuf>,
    entries: RwLock<HashMap<String, Arc<CachedTexture>>>,
}

impl TextureCache {
    pub fn new(game_root: impl AsRef<Path>) -> Self {
        Self::from_roots(vec![game_root.as_ref().to_path_buf()])
    }

    /// Only existing directories are kept.
    pub fn from_roots(mut roots: Vec<std::path::PathBuf>) -> Self {
        roots.retain(|p| p.is_dir());
        Self {
            roots,
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn game_root(&self) -> &Path {
        self.roots
            .first()
            .map(|p| p.as_path())
            .unwrap_or_else(|| Path::new("."))
    }

    pub fn resolver(&self) -> MatResolver {
        MatResolver::new(self.game_root())
    }

    /// Number of cached entries.
    pub fn len(&self) -> usize {
        self.entries.read().map(|m| m.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Drop every cached texture (e.g. game path changed).
    pub fn invalidate_all(&self) {
        if let Ok(mut m) = self.entries.write() {
            m.clear();
        }
    }

    /// Resolve virtual `.mat` → DDS file and remove that DDS entry from the cache.
    pub fn invalidate_virtual_mat(&self, virtual_mat_path: &str) {
        if let Some(dds) = resolve_texture_search_roots(&self.roots, virtual_mat_path) {
            self.remove_key_for_path(&dds);
        }
    }

    /// Remove the entry for this DDS path (canonical key).
    pub fn invalidate_dds_path(&self, dds_path: &Path) {
        self.remove_key_for_path(dds_path);
    }

    fn remove_key_for_path(&self, path: &Path) {
        if let Ok(k) = cache_key_for_dds(path) {
            if let Ok(mut m) = self.entries.write() {
                m.remove(&k);
            }
        }
    }

    /// Resolve a virtual `/material/.../*.mat`, decode the target DDS, cache by canonical DDS path.
    pub fn get_by_virtual_mat(&self, virtual_mat_path: &str) -> Result<Arc<CachedTexture>> {
        let dds = resolve_texture_search_roots(&self.roots, virtual_mat_path).ok_or_else(|| {
            anyhow!("could not resolve texture for {virtual_mat_path}")
        })?;
        self.get_by_dds_path(&dds)
    }

    /// Decode a DDS on disk; cache key is [`cache_key_for_dds`].
    pub fn get_by_dds_path(&self, dds_path: &Path) -> Result<Arc<CachedTexture>> {
        let key = cache_key_for_dds(dds_path).context("dds path key")?;
        if let Ok(guard) = self.entries.read() {
            if let Some(hit) = guard.get(&key) {
                return Ok(Arc::clone(hit));
            }
        }
        self.load_dds_with_key(&key, dds_path)
    }

    fn load_dds_with_key(&self, key: &str, dds_path: &Path) -> Result<Arc<CachedTexture>> {
        let (rgba, w, h) = decode_dds(dds_path)?;
        let cached = Arc::new(CachedTexture {
            width: w,
            height: h,
            rgba,
        });
        if let Ok(mut m) = self.entries.write() {
            m.insert(key.to_string(), Arc::clone(&cached));
        }
        Ok(cached)
    }
}

fn cache_key_for_dds(path: &Path) -> Result<String> {
    path.canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .with_context(|| format!("canonicalize {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::mat_resolver::resolve_texture_search_roots;
    use std::path::PathBuf;

    fn example_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dashboard_examples_from_game")
    }

    #[test]
    fn virtual_mat_and_dds_share_one_entry() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let cache = TextureCache::new(&root);
        let vmat = "/material/ui/dashboard/daf_2021/gauge_left.mat";
        let a = cache.get_by_virtual_mat(vmat).expect("virtual");
        let dds = resolve_texture_search_roots(&[root.clone()], vmat).expect("resolved dds");
        let b = cache.get_by_dds_path(&dds).expect("dds");
        assert_eq!(cache.len(), 1);
        assert_eq!(a.width, b.width);
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn invalidate_virtual_mat_drops_entry() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let cache = TextureCache::new(&root);
        let vmat = "/material/ui/dashboard/daf_2021/gauge_left.mat";
        let _ = cache.get_by_virtual_mat(vmat).expect("load");
        assert_eq!(cache.len(), 1);
        cache.invalidate_virtual_mat(vmat);
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn invalidate_all_clears() {
        let root = example_root();
        if !root.is_dir() {
            return;
        }
        let cache = TextureCache::new(&root);
        let _ = cache.get_by_virtual_mat("/material/ui/dashboard/daf_2021/gauge_left.mat");
        assert_eq!(cache.len(), 1);
        cache.invalidate_all();
        assert_eq!(cache.len(), 0);
    }
}
