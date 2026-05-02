import { create } from "zustand";

import type { AppSettings } from "../types/scs";

type SettingsState = AppSettings & {
  setGameRootPath: (v: string) => void;
  setModRootPaths: (paths: string[]) => void;
  setRecentFiles: (paths: string[]) => void;
  pushRecentFile: (path: string) => void;
  setGridSize: (n: number) => void;
  setSnapEnabled: (v: boolean) => void;
  setDefaultZoom: (z: number) => void;
  setAutoSaveIntervalSeconds: (n: number) => void;
  setTheme: (t: AppSettings["theme"]) => void;
  setLanguage: (l: AppSettings["language"]) => void;
};

const MAX_RECENT = 10;

/** Step 21: persisted via Tauri `save_app_settings` (not localStorage). */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  gameRootPath: "",
  modRootPaths: [] as string[],
  recentFiles: [],
  gridSize: 10,
  snapEnabled: true,
  defaultZoom: 0.85,
  autoSaveIntervalSeconds: 120,
  theme: "dark" as const,
  language: "en" as const,

  setGameRootPath: (gameRootPath) => set({ gameRootPath }),
  setModRootPaths: (modRootPaths) => set({ modRootPaths }),
  setRecentFiles: (recentFiles) => set({ recentFiles }),
  pushRecentFile: (path) => {
    const cur = get().recentFiles.filter((p) => p !== path);
    set({ recentFiles: [path, ...cur].slice(0, MAX_RECENT) });
  },
  setGridSize: (gridSize) => set({ gridSize }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setDefaultZoom: (defaultZoom) => set({ defaultZoom }),
  setAutoSaveIntervalSeconds: (autoSaveIntervalSeconds) =>
    set({ autoSaveIntervalSeconds: Math.max(0, Math.min(3600, Math.round(autoSaveIntervalSeconds))) }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
