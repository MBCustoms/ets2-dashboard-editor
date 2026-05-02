import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";

const inputCls =
  "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

type Sel = { x0: number; y0: number; x1: number; y1: number } | null;

interface ProjectFile {
  type: string;
  virtualPath: string;
  realPath: string | null;
  found: boolean;
  sizeBytes: number;
}

export function SpritePickerDialog({
  open,
  onClose,
  onConfirm,
  gameRoot,
  defaultMatPath,
  modRootPaths = [],
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (markup: string) => void;
  gameRoot: string;
  /** Mod folders first when resolving assets (optional). */
  modRootPaths?: string[];
  defaultMatPath: string;
}) {
  const project = useProjectStore((s) => s.project);
  const settingsGameRoot = useSettingsStore((s) => s.gameRootPath);
  const settingsModRoots = useSettingsStore((s) => s.modRootPaths ?? []);

  const resolvedGameRoot = gameRoot || settingsGameRoot || "";
  const resolvedModRoots = modRootPaths.length ? modRootPaths : settingsModRoots;

  const [matFiles, setMatFiles] = useState<ProjectFile[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [matPath, setMatPath] = useState(defaultMatPath);
  const [showManual, setShowManual] = useState(false);
  const [pixelMode, setPixelMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [activeMatPath, setActiveMatPath] = useState<string>("");
  const [iw, setIw] = useState(0);
  const [ih, setIh] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const drag = useRef<{ active: boolean; sx: number; sy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Scan project files on open
  useEffect(() => {
    if (!open) return;
    setMatPath(defaultMatPath);
    setError(null);
    setDataUrl(null);
    setSel(null);
    setActiveMatPath("");
    setIw(0);
    setIh(0);

    if (!project) return;
    setScanLoading(true);
    void invoke<ProjectFile[]>("collect_project_files", {
      project,
      gameRoot: resolvedGameRoot.trim() || null,
      modRoots: resolvedModRoots.filter(Boolean),
    })
      .then((files) => {
        setMatFiles(files.filter((f) => f.type === "MAT"));
      })
      .catch(() => setMatFiles([]))
      .finally(() => setScanLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadTexture = useCallback(
    async (mp: string) => {
      setError(null);
      setDataUrl(null);
      setSel(null);
      setIw(0);
      setIh(0);
      const gr = resolvedGameRoot.trim();
      const p = mp.trim();
      if (!gr || !p) {
        setError("Game root is not set. Configure it in Settings.");
        return;
      }
      try {
        const mods = resolvedModRoots.map((r) => r.trim()).filter(Boolean);
        const b64 = await invoke<string>("load_mat_texture_png_b64", {
          gameRoot: gr,
          matVirtualPath: p,
          modRoots: mods.length ? mods : null,
        });
        setDataUrl(`data:image/png;base64,${b64}`);
        setActiveMatPath(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [resolvedGameRoot, resolvedModRoots],
  );

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    setIw(im.naturalWidth);
    setIh(im.naturalHeight);
  };

  const normRect = () => {
    if (!sel || iw <= 0 || ih <= 0) return null;
    const x0 = Math.max(0, Math.min(sel.x0, sel.x1));
    const x1 = Math.min(iw, Math.max(sel.x0, sel.x1));
    const y0 = Math.max(0, Math.min(sel.y0, sel.y1));
    const y1 = Math.min(ih, Math.max(sel.y0, sel.y1));
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return { x0, x1, y0, y1 };
  };

  const buildMarkup = () => {
    const r = normRect();
    const mp = (activeMatPath || matPath).trim();
    if (!r || !mp) return;
    const { x0, x1, y0, y1 } = r;
    if (pixelMode) {
      return `<img src=${mp} left=p${Math.round(x0)} right=p${Math.round(x1)} top=p${Math.round(y0)} bottom=p${Math.round(y1)}>`;
    }
    return `<img src=${mp} left=${(x0 / iw).toFixed(6)} right=${(x1 / iw).toFixed(6)} top=${(y0 / ih).toFixed(6)} bottom=${(y1 / ih).toFixed(6)}>`;
  };

  if (!open) return null;

  const r = normRect();
  const curMat = activeMatPath || matPath;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
        {/* Left sidebar: MAT file list */}
        <div className="flex w-56 shrink-0 flex-col border-r border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Project assets
            </h3>
            {scanLoading ? (
              <p className="mt-0.5 text-[10px] text-slate-500">Scanning…</p>
            ) : (
              <p className="mt-0.5 text-[10px] text-slate-600">
                {matFiles.length} material{matFiles.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {matFiles.length === 0 && !scanLoading ? (
              <p className="px-3 py-2 text-[10px] text-slate-600">
                No .mat files found in project. Set a game root in Settings and check Files panel.
              </p>
            ) : null}
            {matFiles.map((f) => {
              const name = f.virtualPath.split("/").pop() ?? f.virtualPath;
              const isActive = f.virtualPath === curMat;
              return (
                <button
                  key={f.virtualPath}
                  type="button"
                  title={f.virtualPath}
                  className={`flex w-full items-start gap-1.5 px-3 py-1.5 text-left text-[10px] ${
                    isActive
                      ? "bg-emerald-900/40 text-emerald-300"
                      : f.found
                        ? "text-slate-300 hover:bg-slate-800/60"
                        : "text-slate-600 hover:bg-slate-800/40"
                  }`}
                  onClick={() => {
                    setMatPath(f.virtualPath);
                    void loadTexture(f.virtualPath);
                  }}
                >
                  <span className="min-w-0 truncate font-mono">{name}</span>
                  {!f.found ? (
                    <span className="shrink-0 text-red-500">✕</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {/* Manual path (collapsible) */}
          <div className="border-t border-slate-800 p-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-[10px] text-slate-500 hover:text-slate-300"
              onClick={() => setShowManual((v) => !v)}
            >
              <span>Manual path</span>
              <span>{showManual ? "▴" : "▾"}</span>
            </button>
            {showManual ? (
              <div className="mt-1.5 flex flex-col gap-1">
                <input
                  className={inputCls + " font-mono"}
                  value={matPath}
                  placeholder="/material/ui/icon.mat"
                  onChange={(e) => setMatPath(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded bg-emerald-800 px-2 py-1 text-[10px] text-white hover:bg-emerald-700"
                  onClick={() => void loadTexture(matPath)}
                >
                  Load
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right area: preview + region selection */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <h2 className="text-sm font-semibold text-slate-100">Sprite picker</h2>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={pixelMode}
                  onChange={(e) => setPixelMode(e.target.checked)}
                />
                Pixel mode
              </label>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {!dataUrl && !error ? (
              <div className="flex h-40 items-center justify-center text-[11px] text-slate-600">
                {activeMatPath
                  ? "Loading…"
                  : "Select a material from the list on the left."}
              </div>
            ) : null}
            {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
            {dataUrl ? (
              <div className="overflow-auto rounded border border-slate-800 bg-black/40">
                <div className="relative inline-block">
                  <img
                    ref={imgRef}
                    src={dataUrl}
                    alt="Texture"
                    draggable={false}
                    className="max-h-[340px] max-w-full cursor-crosshair select-none"
                    onLoad={onImgLoad}
                    onMouseDown={(e) => {
                      const el = imgRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const scaleX = el.naturalWidth / rect.width;
                      const scaleY = el.naturalHeight / rect.height;
                      const ix = (e.clientX - rect.left) * scaleX;
                      const iy = (e.clientY - rect.top) * scaleY;
                      drag.current = { active: true, sx: ix, sy: iy };
                      setSel({ x0: ix, y0: iy, x1: ix, y1: iy });
                    }}
                    onMouseMove={(e) => {
                      if (!drag.current?.active) return;
                      const el = imgRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const scaleX = el.naturalWidth / rect.width;
                      const scaleY = el.naturalHeight / rect.height;
                      const ix = (e.clientX - rect.left) * scaleX;
                      const iy = (e.clientY - rect.top) * scaleY;
                      setSel((s) =>
                        s ? { ...s, x1: ix, y1: iy } : { x0: ix, y0: iy, x1: ix, y1: iy },
                      );
                    }}
                    onMouseUp={() => {
                      if (drag.current) drag.current.active = false;
                    }}
                    onMouseLeave={() => {
                      if (drag.current) drag.current.active = false;
                    }}
                  />
                  {/* Selection overlay */}
                  {sel && imgRef.current && iw > 0 && ih > 0 ? (() => {
                    const el = imgRef.current;
                    const rect = el.getBoundingClientRect();
                    const scaleX = rect.width / iw;
                    const scaleY = rect.height / ih;
                    const sx = Math.min(sel.x0, sel.x1) * scaleX;
                    const sy = Math.min(sel.y0, sel.y1) * scaleY;
                    const sw = Math.abs(sel.x1 - sel.x0) * scaleX;
                    const sh = Math.abs(sel.y1 - sel.y0) * scaleY;
                    return (
                      <div
                        className="pointer-events-none absolute border-2 border-emerald-400/80 bg-emerald-400/10"
                        style={{ left: sx, top: sy, width: sw, height: sh }}
                      />
                    );
                  })() : null}
                </div>
              </div>
            ) : null}

            {iw > 0 && ih > 0 && r ? (
              <p className="mt-2 font-mono text-[10px] text-slate-400">
                {pixelMode
                  ? `left=p${Math.round(r.x0)} right=p${Math.round(r.x1)} top=p${Math.round(r.y0)} bottom=p${Math.round(r.y1)}`
                  : `left=${(r.x0 / iw).toFixed(4)} right=${(r.x1 / iw).toFixed(4)} top=${(r.y0 / ih).toFixed(4)} bottom=${(r.y1 / ih).toFixed(4)}`}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-2">
            <span className="truncate font-mono text-[10px] text-slate-500">
              {curMat || "No material selected"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!r || !curMat.trim()}
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
                onClick={() => {
                  const m = buildMarkup();
                  if (m) {
                    onConfirm(m);
                    onClose();
                  }
                }}
              >
                Insert markup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
