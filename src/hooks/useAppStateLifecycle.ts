import { useEffect, useRef } from "react";

import {
  applyPersistedSettingsToStores,
  loadAppSettingsFromDisk,
} from "../lib/appStateIpc";
import { useProjectStore } from "../store/projectStore";

/**
 * Step 21: Load `settings.json` from the Tauri app config dir once at startup,
 * apply to settings + canvas stores, and optionally seed `gameRootPath` on the current project.
 */
export function useAppStateLifecycle() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const loaded = await loadAppSettingsFromDisk();
      if (!loaded) return;

      applyPersistedSettingsToStores(loaded);

      const gr = loaded.gameRootPath?.trim();
      if (!gr) return;

      const { project, applyProject } = useProjectStore.getState();
      if (project && !project.gameRootPath?.trim()) {
        applyProject({ ...project, gameRootPath: gr });
      }
    })();
  }, []);
}
