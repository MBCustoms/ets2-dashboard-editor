import { useEffect, useMemo, useState } from "react";

import type { DashboardProject } from "../../types/scs";

const backdrop =
  "fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4";
const panel =
  "w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl";
const inputCls =
  "mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

const CANVAS_PRESETS = [
  { label: "800×800 (Classic)", w: 800, h: 800 },
  { label: "1280×480 (Wide)", w: 1280, h: 480 },
  { label: "1440×540 (Scania S/R)", w: 1440, h: 540 },
  { label: "1152×864 (DAF XF)", w: 1152, h: 864 },
  { label: "1024×600 (MAN TGX)", w: 1024, h: 600 },
  { label: "1024×1024 (Square)", w: 1024, h: 1024 },
  { label: "Custom", w: 0, h: 0 },
] as const;

export function CanvasSizeDialog({
  open,
  project,
  suggestedAspect,
  onClose,
  onApply,
}: {
  open: boolean;
  project: DashboardProject | null;
  /** Optional hint from the 3D model viewer: target canvas aspect (w/h). */
  suggestedAspect?: number | null;
  onClose: () => void;
  /**
   * Called with the new project. Caller is responsible for dispatching the
   * change through the undo/redo manager and the project store.
   */
  onApply: (next: DashboardProject) => void;
}) {
  const currentW = project?.canvasWidth ?? 800;
  const currentH = project?.canvasHeight ?? 800;

  const [canvasPreset, setCanvasPreset] = useState<number>(CANVAS_PRESETS.length - 1);
  const [customW, setCustomW] = useState(currentW);
  const [customH, setCustomH] = useState(currentH);
  const [scaleCoords, setScaleCoords] = useState(true);

  useEffect(() => {
    if (!open) return;
    // Pre-fill with suggested aspect (if any), trying to preserve the pixel
    // area of the current canvas so elements end up similarly sized in SCS
    // coords after scaling.
    if (suggestedAspect && isFinite(suggestedAspect) && suggestedAspect > 0) {
      const area = currentW * currentH;
      let w = Math.round(Math.sqrt(area * suggestedAspect));
      let h = Math.round(w / suggestedAspect);
      w = Math.max(200, Math.min(3840, w));
      h = Math.max(200, Math.min(2160, h));
      setCustomW(w);
      setCustomH(h);
    } else {
      setCustomW(currentW);
      setCustomH(currentH);
    }
    setCanvasPreset(CANVAS_PRESETS.length - 1);
    setScaleCoords(true);
  }, [open, currentW, currentH, suggestedAspect]);

  const preset = CANVAS_PRESETS[canvasPreset];
  const finalW = preset.w || customW;
  const finalH = preset.h || customH;

  const scaleFactorX = finalW / Math.max(1, currentW);
  const scaleFactorY = finalH / Math.max(1, currentH);

  const aspectInfo = useMemo(() => {
    const curAspect = currentW / Math.max(1, currentH);
    const newAspect = finalW / Math.max(1, finalH);
    return { curAspect, newAspect };
  }, [currentW, currentH, finalW, finalH]);

  if (!open || !project) return null;

  const submit = () => {
    const cw = Math.max(200, Math.min(3840, Math.round(finalW)));
    const ch = Math.max(200, Math.min(2160, Math.round(finalH)));
    const next: DashboardProject = {
      ...project,
      canvasWidth: cw,
      canvasHeight: ch,
      screens: project.screens.map((s) => ({
        ...s,
        elements: s.elements.map((e) => {
          if (scaleCoords) {
            return {
              ...e,
              coordsL: Math.round(e.coordsL * scaleFactorX),
              coordsR: Math.round(e.coordsR * scaleFactorX),
              coordsT: Math.round(e.coordsT * scaleFactorY),
              coordsB: Math.round(e.coordsB * scaleFactorY),
            };
          }
          return e;
        }),
      })),
    };
    onApply(next);
    onClose();
  };

  return (
    <div
      className={backdrop}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={panel}>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Canvas size</h2>
        <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
          SCS koordinat sistemi bu boyutlara göre hesaplanır. 3B modelin UV
          oranıyla aynı yaparsanız texture üzerinde yazı/ikonlar gerilmez.
        </p>

        <div className="mb-2 rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 font-mono text-[11px] text-slate-400">
          <div>
            Mevcut: <span className="text-slate-200">{currentW}×{currentH}</span>{" "}
            <span className="text-slate-500">
              ({aspectInfo.curAspect.toFixed(3)}:1)
            </span>
          </div>
          {suggestedAspect && isFinite(suggestedAspect) && suggestedAspect > 0 ? (
            <div className="mt-0.5 text-emerald-300">
              Önerilen aspect:{" "}
              <span className="text-emerald-100">{suggestedAspect.toFixed(3)}:1</span>{" "}
              (yüklenen 3B modelden)
            </div>
          ) : null}
        </div>

        <div className="mb-2">
          <label className="text-[11px] text-slate-400">Preset</label>
          <select
            className={inputCls}
            value={canvasPreset}
            onChange={(e) => setCanvasPreset(Number(e.target.value))}
          >
            {CANVAS_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {preset.w === 0 && (
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400">Width (px)</label>
              <input
                type="number"
                className={inputCls}
                min={200}
                max={3840}
                value={customW}
                onChange={(e) => setCustomW(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-slate-400">Height (px)</label>
              <input
                type="number"
                className={inputCls}
                min={200}
                max={2160}
                value={customH}
                onChange={(e) => setCustomH(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="mb-2 rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 font-mono text-[11px] text-slate-400">
          Yeni: <span className="text-slate-200">{finalW}×{finalH}</span>{" "}
          <span className="text-slate-500">
            ({aspectInfo.newAspect.toFixed(3)}:1)
          </span>
        </div>

        <label className="mb-2 flex cursor-pointer items-start gap-2 rounded border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-900">
          <input
            type="checkbox"
            className="mt-0.5 accent-emerald-500"
            checked={scaleCoords}
            onChange={(e) => setScaleCoords(e.target.checked)}
          />
          <span className="leading-relaxed">
            Element koordinatlarını orantılı ölçekle
            <span className="block text-[10px] text-slate-500">
              Kapalı olursa yalnızca canvas boyutları değişir; elementler eski
              SCS koordinatlarını korur (yeni boyuta göre sol alta toplanabilir).
            </span>
          </span>
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            İptal
          </button>
          <button
            type="button"
            className="rounded bg-emerald-800 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
            onClick={submit}
          >
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
}
