import { useEffect } from "react";

import { saveProjectToPath } from "../lib/appStateIpc";
import { useProjectStore } from "../store/projectStore";
import { useSettingsStore } from "../store/settingsStore";

/** When `autoSaveIntervalSeconds` > 0 and the project has a path, save JSON on an interval if dirty. */
export function useAutoSave() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const clearTimer = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const tick = () => {
      const { project, currentFilePath, isDirty } = useProjectStore.getState();
      const { autoSaveIntervalSeconds } = useSettingsStore.getState();
      if (autoSaveIntervalSeconds <= 0) return;
      if (!project || !currentFilePath?.trim() || !isDirty) return;
      void saveProjectToPath(currentFilePath, project)
        .then(() => useProjectStore.getState().setDirty(false))
        .catch((e) => console.warn("[AutoSave]", e));
    };

    const schedule = () => {
      clearTimer();
      const secs = useSettingsStore.getState().autoSaveIntervalSeconds;
      if (secs > 0) {
        timer = setInterval(tick, secs * 1000);
      }
    };

    schedule();
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.autoSaveIntervalSeconds !== prev.autoSaveIntervalSeconds) {
        schedule();
      }
    });
    return () => {
      clearTimer();
      unsub();
    };
  }, []);
}
