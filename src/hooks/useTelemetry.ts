import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

import { useTelemetryStore } from "../store/telemetryStore";
import type { TelemetrySnapshot } from "../types/scs";

/**
 * Polls `read_telemetry_snapshot` while not in simulation mode (default 100ms).
 * Step 20: live game telemetry via `Local\\SCSDashboardEditor` on Windows.
 */
export function useTelemetry(intervalMs = 100) {
  const simulationMode = useTelemetryStore((s) => s.simulationMode);
  const applySnapshot = useTelemetryStore((s) => s.applySnapshot);

  useEffect(() => {
    if (simulationMode || intervalMs <= 0) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const snap = await invoke<TelemetrySnapshot>("read_telemetry_snapshot");
        if (!cancelled) applySnapshot(snap);
      } catch {
        if (!cancelled) {
          applySnapshot({
            connected: false,
            sdkActive: 0,
            entries: [],
          });
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [simulationMode, intervalMs, applySnapshot]);
}
