import { Activity, SlidersHorizontal, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";

import { dashboardIdLabel } from "../../lib/dashboardIds";
import {
  ALL_SIMULATION_METAS,
  formatRawDisplay,
  type SimRowMeta,
} from "../../lib/telemetrySimulationMeta";
import { useTelemetry } from "../../hooks/useTelemetry";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { useTelemetryStore } from "../../store/telemetryStore";

const GEAR_OPTIONS: { v: number; l: string }[] = [
  { v: -1, l: "R" },
  { v: 0, l: "N" },
  ...Array.from({ length: 16 }, (_, i) => ({ v: i + 1, l: String(i + 1) })),
];

const MODE_AM: { v: number; l: string }[] = [
  { v: 0, l: "A" },
  { v: 1, l: "M" },
];

const MODE_DNR: { v: number; l: string }[] = [
  { v: 0, l: "D" },
  { v: 1, l: "N" },
  { v: 2, l: "R" },
  { v: 3, l: "M" },
];

function SimControl({
  meta,
  value,
  onChange,
  light,
  rowInput,
}: {
  meta: SimRowMeta;
  value: number;
  onChange: (v: number) => void;
  light: boolean;
  rowInput: string;
}) {
  switch (meta.kind) {
    case "bool":
      return (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={value > 0.5}
            onChange={(e) => onChange(e.target.checked ? 1 : 0)}
          />
          <span className={light ? "text-[10px] text-slate-600" : "text-[10px] text-slate-400"}>
            {value > 0.5 ? "On" : "Off"}
          </span>
        </label>
      );
    case "gear": {
      const v = Math.round(value);
      const safe = GEAR_OPTIONS.some((o) => o.v === v) ? v : 0;
      return (
        <select
          className={rowInput}
          value={safe}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {GEAR_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      );
    }
    case "mode_am": {
      const v = value > 0.5 ? 1 : 0;
      return (
        <select className={rowInput} value={v} onChange={(e) => onChange(Number(e.target.value))}>
          {MODE_AM.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      );
    }
    case "mode_dnr": {
      const rv = Math.min(3, Math.max(0, Math.round(value)));
      return (
        <select className={rowInput} value={rv} onChange={(e) => onChange(Number(e.target.value))}>
          {MODE_DNR.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      );
    }
    case "raw": {
      const min = meta.rawMin ?? 0;
      const max = meta.rawMax ?? 1;
      const step = meta.rawStep ?? 1;
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            className="w-full accent-amber-500"
            value={Math.min(max, Math.max(min, value))}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <div className="flex justify-between font-mono text-[9px] opacity-80">
            <span>{formatRawDisplay(min, step)}</span>
            <span>{formatRawDisplay(value, step)}</span>
            <span>{formatRawDisplay(max, step)}</span>
          </div>
        </div>
      );
    }
    case "norm":
    default:
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            className="w-full accent-amber-500"
            value={Math.min(1, Math.max(0, value))}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="text-center font-mono text-[9px] opacity-80">{value.toFixed(3)}</span>
        </div>
      );
  }
}

export function TelemetryPanel({ isVisible = true }: { isVisible?: boolean }) {
  useTelemetry(isVisible ? 200 : 0);
  const light = useAppThemeIsLight();

  const connected = useTelemetryStore((s) => s.connected);
  const sdkActive = useTelemetryStore((s) => s.sdkActive);
  const simulationMode = useTelemetryStore((s) => s.simulationMode);
  const setSimulationMode = useTelemetryStore((s) => s.setSimulationMode);
  const setSimulationValue = useTelemetryStore((s) => s.setSimulationValue);
  const simulation = useTelemetryStore((s) => s.simulation);

  const [filter, setFilter] = useState("");

  const metas = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ALL_SIMULATION_METAS;
    return ALL_SIMULATION_METAS.filter((m) => {
      const label = dashboardIdLabel(m.id).toLowerCase();
      return String(m.id).includes(q) || label.includes(q);
    });
  }, [filter]);

  const borderT = light ? "border-slate-200" : "border-slate-800";
  const labelMuted = light ? "text-[10px] text-slate-600" : "text-[10px] text-slate-500";
  const rowInput = light
    ? "w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-900 outline-none focus:border-emerald-600"
    : "w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-100 outline-none focus:border-emerald-600";

  return (
    <div className={`flex flex-col gap-3 p-3 text-xs ${light ? "text-slate-800" : "text-slate-200"}`}>
      <div
        className={`flex items-center justify-between rounded-lg border p-2 ${
          simulationMode
            ? light
              ? "border-amber-300 bg-amber-50"
              : "border-amber-800/40 bg-amber-900/20"
            : connected && sdkActive
              ? light
                ? "border-emerald-300 bg-emerald-50"
                : "border-emerald-800/40 bg-emerald-900/20"
              : light
                ? "border-slate-200 bg-slate-100"
                : "border-slate-800/40 bg-slate-900/40"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {simulationMode ? (
            <SlidersHorizontal size={13} className="text-amber-500" />
          ) : connected && sdkActive ? (
            <Wifi size={13} className="text-emerald-500" />
          ) : (
            <WifiOff size={13} className={light ? "text-slate-500" : "text-slate-500"} />
          )}
          <span
            className={`text-[11px] font-medium ${
              simulationMode
                ? light
                  ? "text-amber-800"
                  : "text-amber-300"
                : connected && sdkActive
                  ? light
                    ? "text-emerald-800"
                    : "text-emerald-300"
                  : light
                    ? "text-slate-600"
                    : "text-slate-500"
            }`}
          >
            {simulationMode ? "Simulation" : connected && sdkActive ? "Connected" : "Disconnected"}
          </span>
        </div>
        <label
          className={`flex cursor-pointer items-center gap-1.5 text-[10px] ${
            light ? "text-slate-600" : "text-slate-400"
          }`}
        >
          <input
            type="checkbox"
            checked={simulationMode}
            onChange={(e) => setSimulationMode(e.target.checked)}
            className="accent-amber-500"
          />
          Simulation
        </label>
      </div>

      <p className={`text-[10px] leading-relaxed ${labelMuted}`}>
        Live preview uses the main canvas. Enable <strong>Simulation</strong> to drive all dashboard
        element IDs with sliders and switches (values follow the same rules as the game plugin:
        mostly 0–1, bars and gauges, raw km / litres / volts where applicable).
      </p>

      {simulationMode ? (
        <div className={`flex flex-col gap-2 border-t pt-2 ${borderT}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Activity size={11} className={light ? "text-slate-500" : "text-slate-500"} />
            <span className={labelMuted}>Dashboard element IDs</span>
          </div>
          <input
            type="search"
            placeholder="Filter by ID or name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={
              light
                ? "w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-emerald-600"
                : "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-600"
            }
          />
          <div
            className={`flex max-h-[min(52vh,480px)] flex-col gap-1 overflow-y-auto rounded border p-1.5 ${
              light ? "border-slate-200 bg-white" : "border-slate-800 bg-slate-950/80"
            }`}
          >
            {metas.map((meta) => {
              const v = simulation[meta.id] ?? meta.default;
              return (
                <div
                  key={meta.id}
                  className={`rounded px-1.5 py-1 ${light ? "hover:bg-slate-50" : "hover:bg-slate-900/80"}`}
                >
                  <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className={`shrink-0 font-mono text-[10px] ${light ? "text-slate-700" : "text-slate-300"}`}>
                      {meta.id}
                    </span>
                    <span className={`min-w-0 flex-1 text-[10px] leading-snug ${labelMuted}`}>
                      {dashboardIdLabel(meta.id)}
                    </span>
                  </div>
                  <SimControl
                    meta={meta}
                    value={v}
                    onChange={(nv) => setSimulationValue(meta.id, nv)}
                    light={light}
                    rowInput={rowInput}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
