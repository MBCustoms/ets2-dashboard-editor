import { useState } from "react";

import { ScsColorPicker } from "./ScsColorPicker";

/** AABBGGRR → CSS rgba for swatch backgrounds */
function scsHexToCSS(hex: string): string {
  if (hex.length < 8) return "rgba(255,255,255,1)";
  const a = parseInt(hex.slice(0, 2), 16) / 255;
  const b = parseInt(hex.slice(2, 4), 16);
  const g = parseInt(hex.slice(4, 6), 16);
  const r = parseInt(hex.slice(6, 8), 16);
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

const QUICK_COLORS = [
  { hex: "FFFFFFFF", label: "White" },
  { hex: "FF00EEFF", label: "Yellow" },
  { hex: "FF009900", label: "Green" },
  { hex: "FF0000CC", label: "Red" },
  { hex: "FFFF8000", label: "Blue" },
  { hex: "FF888888", label: "Gray" },
];

export function MarkupToolbar({
  onInsert,
  light = false,
}: {
  onInsert: (s: string) => void;
  light?: boolean;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [pickedColor, setPickedColor] = useState("FFFFFFFF");

  const row = light
    ? "flex flex-wrap items-center gap-1 rounded border border-slate-200 bg-slate-100/90 px-1.5 py-1"
    : "flex flex-wrap items-center gap-1 rounded bg-slate-800/70 px-1.5 py-1";
  const btn = light
    ? "rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-700 hover:bg-slate-200"
    : "rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:bg-slate-700";
  const btnMuted = light
    ? "rounded px-1 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200"
    : "rounded px-1 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700";
  const sepCls = light ? "h-3 w-px bg-slate-300" : "h-3 w-px bg-slate-600";

  return (
    <div className={row}>
      {QUICK_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.label}
          className={
            light
              ? "h-3.5 w-3.5 rounded-sm border border-slate-400 transition-transform hover:scale-110"
              : "h-3.5 w-3.5 rounded-sm border border-slate-600 transition-transform hover:scale-110"
          }
          style={{ backgroundColor: scsHexToCSS(c.hex) }}
          onClick={() => onInsert(`<color value=${c.hex}>`)}
        />
      ))}
      <button
        type="button"
        title="Custom color"
        className={btnMuted}
        onClick={() => setColorOpen(true)}
      >
        Color…
      </button>

      <span className={sepCls} />

      <button
        type="button"
        title="Normal font block"
        className={btn}
        onClick={() => onInsert("<font face=/font/db_normal.font xscale=1.5 yscale=1.5>%0</font>")}
      >
        Aa
      </button>
      <button
        type="button"
        title="DIN Pro medium font"
        className={btn}
        onClick={() => onInsert("<font face=/font/db_din_pro_medium.font xscale=2.0 yscale=2.0>%0</font>")}
      >
        AA
      </button>

      <span className={sepCls} />

      <button
        type="button"
        title="Align right"
        className={btnMuted}
        onClick={() => onInsert("<align hstyle=right>")}
      >
        ⇥R
      </button>
      <button
        type="button"
        title="Align center"
        className={btnMuted}
        onClick={() => onInsert("<align hstyle=center>")}
      >
        ↔
      </button>
      <button
        type="button"
        title="End align"
        className={btnMuted}
        onClick={() => onInsert("</align>")}
      >
        /al
      </button>

      <span className={sepCls} />

      <button
        type="button"
        title="<ret> — cursor home"
        className={light ? `${btnMuted} font-mono` : "rounded px-1 py-0.5 font-mono text-[10px] text-slate-500 hover:bg-slate-700"}
        onClick={() => onInsert("<ret>")}
      >
        ret
      </button>
      <button
        type="button"
        title="<br> — line break"
        className={light ? `${btnMuted} font-mono` : "rounded px-1 py-0.5 font-mono text-[10px] text-slate-500 hover:bg-slate-700"}
        onClick={() => onInsert("<br>")}
      >
        br
      </button>

      <button
        type="button"
        title="First value (%0)"
        className={
          light
            ? "rounded px-1.5 py-0.5 font-mono text-[10px] text-amber-700 hover:bg-amber-100"
            : "rounded px-1.5 py-0.5 font-mono text-[10px] text-amber-400 hover:bg-slate-700"
        }
        onClick={() => onInsert("%0")}
      >
        %0
      </button>
      <button
        type="button"
        title="Unit (%1)"
        className={
          light
            ? "rounded px-1.5 py-0.5 font-mono text-[10px] text-amber-700 hover:bg-amber-100"
            : "rounded px-1.5 py-0.5 font-mono text-[10px] text-amber-400 hover:bg-slate-700"
        }
        onClick={() => onInsert("%1")}
      >
        %1
      </button>

      <button
        type="button"
        title="Solid fill (white.mat)"
        className={btnMuted}
        onClick={() =>
          onInsert("<img src=/material/ui/white.mat xscale=stretch yscale=stretch>")
        }
      >
        fill
      </button>

      {colorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setColorOpen(false);
          }}
        >
          <div
            className={
              light
                ? "w-72 rounded-xl border border-slate-300 bg-white p-4 shadow-2xl"
                : "w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
            }
          >
            <h3
              className={`mb-3 text-sm font-semibold ${light ? "text-slate-900" : "text-slate-100"}`}
            >
              Color (AABBGGRR)
            </h3>
            <ScsColorPicker value={pickedColor} onChange={setPickedColor} light={light} />
            <p className={`mt-2 font-mono text-[10px] ${light ? "text-slate-600" : "text-slate-500"}`}>
              {pickedColor}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className={
                  light
                    ? "rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    : "rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-100"
                }
                onClick={() => setColorOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-600"
                onClick={() => {
                  onInsert(`<color value=${pickedColor}>`);
                  setColorOpen(false);
                }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
