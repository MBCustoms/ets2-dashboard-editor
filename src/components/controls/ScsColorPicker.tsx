import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

import {
  NAMED_SCS_COLORS,
  namedColorToRgba,
  rgbaToScs,
  scsToRgba,
} from "../../lib/scsColors";

const inputClsDark =
  "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";
const inputClsLight =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-emerald-500/30 focus:ring-1";

/** `value` is AABBGGRR (no `#`) or a named `@@clr_*@@` token. */
export function ScsColorPicker({
  value,
  onChange,
  className = "",
  light = false,
}: {
  value: string;
  onChange: (scsHexOrNamed: string) => void;
  className?: string;
  light?: boolean;
}) {
  const inputCls = light ? inputClsLight : inputClsDark;
  const labelMuted = light ? "text-slate-600" : "text-slate-500";
  const namedBtn = light
    ? "rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 hover:bg-slate-200"
    : "rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700";
  const [hexDraft, setHexDraft] = useState("");
  const [r, setR] = useState(255);
  const [g, setG] = useState(255);
  const [b, setB] = useState(255);
  const [a, setA] = useState(255);
  // Track the last value we emitted ourselves so the useEffect doesn't create a
  // feedback loop when the parent reflects our own onChange back to us as a new `value`.
  const lastEmitted = useRef<string>("");

  const isNamed = value.trim().startsWith("@@");

  useEffect(() => {
    const v = value.trim();
    // Skip if this exact value was just emitted by us — prevents drag feedback loop.
    if (v === lastEmitted.current) return;
    if (v.startsWith("@@")) {
      const rgba = namedColorToRgba(v);
      if (rgba) {
        const [rr, gg, bb, aa] = rgba;
        setR(rr);
        setG(gg);
        setB(bb);
        setA(aa);
      }
      setHexDraft("");
      return;
    }
    const rgba = scsToRgba(v);
    if (rgba) {
      const [rr, gg, bb, aa] = rgba;
      setR(rr);
      setG(gg);
      setB(bb);
      setA(aa);
      setHexDraft(v.toUpperCase());
    }
  }, [value]);

  const pushRgba = (nr: number, ng: number, nb: number, na: number) => {
    setR(nr);
    setG(ng);
    setB(nb);
    setA(na);
    const scs = rgbaToScs(nr, ng, nb, na);
    lastEmitted.current = scs;
    onChange(scs);
    setHexDraft(scs);
  };

  const rrggbb = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <HexColorPicker
        color={rrggbb}
        onChange={(hex) => {
          const h = hex.replace("#", "");
          const nr = parseInt(h.slice(0, 2), 16);
          const ng = parseInt(h.slice(2, 4), 16);
          const nb = parseInt(h.slice(4, 6), 16);
          pushRgba(nr, ng, nb, a);
        }}
        className="w-full max-w-[200px] !h-28"
      />
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {(
          [
            ["R", r, (n: number) => pushRgba(n, g, b, a)],
            ["G", g, (n: number) => pushRgba(r, n, b, a)],
            ["B", b, (n: number) => pushRgba(r, g, n, a)],
            ["A", a, (n: number) => pushRgba(r, g, b, n)],
          ] as const
        ).map(([label, val, apply]) => (
          <label key={label} className={`flex flex-col gap-0.5 ${labelMuted}`}>
            {label}
            <input
              type="number"
              min={0}
              max={255}
              className={inputCls}
              value={val}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isNaN(n)) return;
                apply(Math.max(0, Math.min(255, n)));
              }}
            />
          </label>
        ))}
      </div>
      <div>
        <label className={`text-[10px] ${labelMuted}`}>AABBGGRR (hex)</label>
        <input
          className={inputCls + " mt-0.5 font-mono"}
          value={isNamed ? value : hexDraft || rgbaToScs(r, g, b, a)}
          spellCheck={false}
          onChange={(e) => {
            const t = e.target.value.trim().replace(/^#/, "");
            setHexDraft(t);
            if (t.startsWith("@@")) {
              onChange(t);
              return;
            }
            const rgba = scsToRgba(t);
            if (rgba) {
              const [rr, gg, bb, aa] = rgba;
              pushRgba(rr, gg, bb, aa);
            }
          }}
          onBlur={() => {
            if (value.trim().startsWith("@@")) return;
            const t = hexDraft.trim().replace(/^#/, "");
            if (t.length === 8 && scsToRgba(t)) onChange(t.toUpperCase());
          }}
        />
      </div>
      {isNamed ? (
        <p className={`text-[10px] ${light ? "text-amber-800" : "text-amber-300/90"}`}>
          Named color — edit hex or use wheel to use AABBGGRR.
        </p>
      ) : null}
      <div>
        <p className={`mb-1 text-[10px] ${labelMuted}`}>Named</p>
        <div className="flex flex-wrap gap-1">
          {NAMED_SCS_COLORS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={namedBtn}
              onClick={() => onChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
