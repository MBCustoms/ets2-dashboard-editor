/** Mod folders first, then base game (matches Rust `asset_search_paths`). */
export function buildAssetSearchRoots(
  modRootPaths: readonly string[],
  gameRootPath: string,
): string[] {
  const out: string[] = [];
  for (const p of modRootPaths) {
    const t = p.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  const g = gameRootPath.trim();
  if (g && !out.includes(g)) out.push(g);
  return out;
}
