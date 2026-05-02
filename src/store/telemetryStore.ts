import { create } from "zustand";

import { buildDefaultSimulationRecord } from "../lib/telemetrySimulationMeta";
import type { TelemetrySnapshot } from "../types/scs";

interface TelemetryState {
  connected: boolean;
  sdkActive: number;
  liveEntries: Record<number, number>;
  simulationMode: boolean;
  /** Values: normalised 0–1, raw game units, gear indices, or 0/1 for booleans — see simulation meta. */
  simulation: Record<number, number>;
  /** Bumps when telemetry/simulation values change — canvas Rust preview listens. */
  renderRevision: number;

  setSimulationMode: (v: boolean) => void;
  setSimulationValue: (id: number, value: number) => void;
  applySnapshot: (snap: TelemetrySnapshot) => void;
  /** Live or simulation value for a dashboard id. */
  valueFor: (id: number) => number | undefined;
  /** Merged map for preview hooks (simulation overlays live when sim is on). */
  mergedMap: () => Record<number, number>;
}

function liveFingerprint(m: Record<number, number>): string {
  return Object.entries(m)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

function seededSimulationFrom(live: Record<number, number>, prevSim: Record<number, number>) {
  return { ...buildDefaultSimulationRecord(), ...prevSim, ...live };
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  connected: false,
  sdkActive: 0,
  liveEntries: {},
  simulationMode: false,
  simulation: buildDefaultSimulationRecord(),
  renderRevision: 0,

  setSimulationMode: (simulationMode) =>
    set((s) => {
      if (simulationMode === s.simulationMode) return {};
      if (!simulationMode) {
        return { simulationMode: false, renderRevision: s.renderRevision + 1 };
      }
      return {
        simulationMode: true,
        simulation: seededSimulationFrom(s.liveEntries, s.simulation),
        renderRevision: s.renderRevision + 1,
      };
    }),

  setSimulationValue: (id, value) =>
    set((s) => ({
      simulation: { ...s.simulation, [id]: value },
      renderRevision: s.renderRevision + 1,
    })),

  applySnapshot: (snap) => {
    const live: Record<number, number> = {};
    for (const e of snap.entries) {
      live[e.id] = e.value;
    }
    set((s) => {
      const nextFp = liveFingerprint(live);
      const prevFp = liveFingerprint(s.liveEntries);
      const metaChanged =
        s.connected !== snap.connected || s.sdkActive !== snap.sdkActive;
      const bump = metaChanged || nextFp !== prevFp;
      return {
        connected: snap.connected,
        sdkActive: snap.sdkActive,
        liveEntries: live,
        renderRevision: bump ? s.renderRevision + 1 : s.renderRevision,
      };
    });
  },

  valueFor: (id) => {
    const s = get();
    if (s.simulationMode && s.simulation[id] !== undefined) {
      return s.simulation[id];
    }
    return s.liveEntries[id];
  },

  mergedMap: () => {
    const s = get();
    const out: Record<number, number> = { ...s.liveEntries };
    if (s.simulationMode) {
      for (const [k, v] of Object.entries(s.simulation)) {
        out[Number(k)] = v;
      }
    }
    return out;
  },
}));
