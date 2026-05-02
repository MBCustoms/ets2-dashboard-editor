import { DASHBOARD_ID_LABELS } from "./dashboardIds";

export type SimControlKind = "norm" | "bool" | "gear" | "mode_am" | "mode_dnr" | "raw";

export interface SimRowMeta {
  id: number;
  kind: SimControlKind;
  default: number;
  rawMin?: number;
  rawMax?: number;
  rawStep?: number;
}

const BOOL = new Set([
  1190, 1200, 1230, 1240, 1250, 1260, 1270, 1290, 1410, 1420, 1470, 1480, 1490, 1570, 1580, 1590, 1620, 1630,
  1640, 1650, 1660, 1670,
]);

/** Raw numeric game values (not 0–1 normalised). */
const RAW: Record<number, { min: number; max: number; step: number; def: number }> = {
  1030: { min: 0, max: 2_000_000, step: 1, def: 412847 },
  1210: { min: 0, max: 20_000, step: 0.1, def: 1523.4 },
  1280: { min: 0, max: 2_000_000, step: 1, def: 125400 },
  1320: { min: 20, max: 32, step: 0.1, def: 24.8 },
  1370: { min: 0, max: 200, step: 0.5, def: 118 },
  1390: { min: 0, max: 5_000_000, step: 1, def: 14_400 },
  1400: { min: 0, max: 200, step: 0.5, def: 76 },
  1500: { min: 0, max: 10_000, step: 0.1, def: 412 },
  1510: { min: 0, max: 100, step: 0.5, def: 78 },
  1520: { min: 0, max: 100, step: 0.5, def: 91 },
  1530: { min: 0, max: 2880, step: 1, def: 127 },
  1540: { min: 0, max: 720, step: 1, def: 95 },
  1610: { min: 0, max: 200, step: 1, def: 80 },
  1680: { min: 0, max: 2000, step: 0.1, def: 124 },
};

const NORM_DEFAULTS = new Map<number, number>([
  [1000, 0.45],
  [1010, 0.42],
  [1020, 0.55],
  [1050, 0.42],
  [1060, 0.75],
  [1070, 0.75],
  [1080, 0.35],
  [1090, 0.48],
  [1100, 0.6],
  [1110, 0.55],
  [1120, 0.62],
  [1130, 0.35],
  [1140, 0.82],
  [1150, 0.48],
  [1160, 0.25],
  [1170, 0.4],
  [1180, 0.05],
  [1220, 0.125],
  [1330, 0.72],
  [1340, 0.35],
  [1350, 0.45],
  [1360, 0.5],
  [1430, 0.55],
  [1440, 0.38],
  [1450, 0.6],
  [1460, 0.42],
  [1690, 0.5],
  [1700, 0.42],
]);

function metaForId(id: number): SimRowMeta {
  if (BOOL.has(id)) {
    const def = id === 1270 ? 1 : 0;
    return { id, kind: "bool", default: def };
  }
  if (id === 1040 || id === 1300) {
    return { id, kind: "gear", default: 8 };
  }
  if (id === 1310) {
    return { id, kind: "mode_am", default: 0 };
  }
  if (id === 1380) {
    return { id, kind: "mode_dnr", default: 0 };
  }
  const r = RAW[id];
  if (r) {
    return {
      id,
      kind: "raw",
      default: r.def,
      rawMin: r.min,
      rawMax: r.max,
      rawStep: r.step,
    };
  }
  return { id, kind: "norm", default: NORM_DEFAULTS.get(id) ?? 0.5 };
}

/** Game telemetry widgets use 1000+; 10/20 are electricity overlays (not simulated as sliders). */
export const ALL_SIMULATION_METAS: SimRowMeta[] = Object.keys(DASHBOARD_ID_LABELS)
  .map(Number)
  .filter((n) => n >= 1000)
  .sort((a, b) => a - b)
  .map(metaForId);

export function buildDefaultSimulationRecord(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of ALL_SIMULATION_METAS) {
    out[m.id] = m.default;
  }
  return out;
}

export function formatRawDisplay(value: number, step: number): string {
  if (!Number.isFinite(value)) return "0";
  const s = String(step);
  const decimals = s.includes(".") ? Math.min(4, s.split(".")[1]?.length ?? 0) : 0;
  return value.toFixed(decimals);
}
