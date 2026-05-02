import { useEffect, useState } from "react";

const inputCls = (light: boolean) =>
  light
    ? "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-emerald-500/30 focus:ring-1"
    : "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

export type CoordPatch = Partial<{
  coordsL: number;
  coordsR: number;
  coordsT: number;
  coordsB: number;
  layer: number;
}>;

/** SCS layout: L/R/T/B (0–800), layer. Commits on blur with `onCommit(description, patch, revertPatch)`. */
export function CoordEditor({
  coordsL,
  coordsR,
  coordsT,
  coordsB,
  layer,
  onCommit,
  showLayer = true,
  canvasWidth = 800,
  canvasHeight = 800,
  light = false,
}: {
  coordsL: number;
  coordsR: number;
  coordsT: number;
  coordsB: number;
  layer: number;
  showLayer?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
  light?: boolean;
  onCommit: (description: string, patch: CoordPatch, revert: CoordPatch) => void;
}) {
  const w = coordsR - coordsL;
  const h = coordsT - coordsB;

  const [L, setL] = useState(String(coordsL));
  const [R, setR] = useState(String(coordsR));
  const [T, setT] = useState(String(coordsT));
  const [B, setB] = useState(String(coordsB));
  const [layerS, setLayerS] = useState(String(layer));

  useEffect(() => {
    setL(String(coordsL));
    setR(String(coordsR));
    setT(String(coordsT));
    setB(String(coordsB));
    setLayerS(String(layer));
  }, [coordsL, coordsR, coordsT, coordsB, layer]);

  const blur = (
    label: string,
    field: "coordsL" | "coordsR" | "coordsT" | "coordsB",
    raw: string,
    setRaw: (s: string) => void,
    cur: number,
  ) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setRaw(String(cur));
      return;
    }
    const max =
      field === "coordsL" || field === "coordsR" ? canvasWidth : canvasHeight;
    const clamped = Math.max(0, Math.min(max, n));
    if (clamped !== cur) {
      onCommit(label, { [field]: clamped }, { [field]: cur });
    } else {
      setRaw(String(cur));
    }
  };

  const lab = light ? "text-[11px] text-slate-600" : "text-[11px] text-slate-400";
  const hint = light ? "text-[10px] leading-relaxed text-slate-500" : "text-[10px] leading-relaxed text-slate-500";
  const dim = light ? "text-xs text-slate-600" : "text-xs text-slate-500";
  const mono = light ? "font-mono text-slate-800" : "font-mono text-slate-300";

  return (
    <div className="flex flex-col gap-2">
      <p className={hint}>
        SCS space: origin bottom-left. L/R use width ({canvasWidth}px); T/B use height ({canvasHeight}px).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={lab} title="X offset of left edge from canvas left (px)">Left</span>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={L}
            inputMode="numeric"
            title="Left edge X (distance from canvas left, in SCS pixels)"
            onChange={(e) => setL(e.target.value)}
            onBlur={() => blur("Coords L", "coordsL", L, setL, coordsL)}
          />
        </div>
        <div>
          <span className={lab} title="X offset of right edge from canvas left (px)">Right</span>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={R}
            inputMode="numeric"
            title="Right edge X (distance from canvas left, in SCS pixels)"
            onChange={(e) => setR(e.target.value)}
            onBlur={() => blur("Coords R", "coordsR", R, setR, coordsR)}
          />
        </div>
        <div>
          <span className={lab} title="Y offset of top edge from canvas BOTTOM (SCS: origin bottom-left, px)">Top</span>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={T}
            inputMode="numeric"
            title="Top edge Y measured from canvas BOTTOM (SCS bottom-left origin)"
            onChange={(e) => setT(e.target.value)}
            onBlur={() => blur("Coords T", "coordsT", T, setT, coordsT)}
          />
        </div>
        <div>
          <span className={lab} title="Y offset of bottom edge from canvas BOTTOM (SCS: origin bottom-left, px)">Bottom</span>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={B}
            inputMode="numeric"
            title="Bottom edge Y measured from canvas BOTTOM (SCS bottom-left origin)"
            onChange={(e) => setB(e.target.value)}
            onBlur={() => blur("Coords B", "coordsB", B, setB, coordsB)}
          />
        </div>
      </div>
      <div className={`grid grid-cols-2 gap-2 ${dim}`}>
        <span>Width</span>
        <span className={mono}>{w}px</span>
        <span>Height</span>
        <span className={mono}>{h}px</span>
      </div>
      {showLayer ? (
        <div>
          <span className={lab}>Layer</span>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={layerS}
            inputMode="numeric"
            onChange={(e) => setLayerS(e.target.value)}
            onBlur={() => {
              const n = parseInt(layerS, 10);
              if (Number.isNaN(n)) {
                setLayerS(String(layer));
                return;
              }
              if (n !== layer) {
                onCommit("Layer", { layer: n }, { layer });
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
