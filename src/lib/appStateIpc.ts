import { invoke } from "@tauri-apps/api/core";

import { useCanvasStore } from "../store/canvasStore";
import { useSettingsStore } from "../store/settingsStore";
import type { AppSettings, DashboardProject } from "../types/scs";

/** Matches Rust `PersistedAppSettings` (camelCase). */
export type PersistedAppSettingsPayload = AppSettings;

let persistTimer: ReturnType<typeof setTimeout> | undefined;

/** Build payload from current stores (canvas wins for grid/zoom/snap). */
export function collectPersistedSettings(): PersistedAppSettingsPayload {
  const s = useSettingsStore.getState();
  const c = useCanvasStore.getState();
  return {
    gameRootPath: s.gameRootPath,
    modRootPaths: s.modRootPaths,
    recentFiles: s.recentFiles,
    gridSize: c.gridSize,
    snapEnabled: c.snapEnabled,
    defaultZoom: c.zoom,
    autoSaveIntervalSeconds: s.autoSaveIntervalSeconds,
    theme: s.theme,
    language: s.language,
  };
}

export async function saveAppSettingsToDisk(): Promise<void> {
  const settings = collectPersistedSettings();
  await invoke("save_app_settings", { settings });
}

/** Debounced disk write after toolbar / inspector tweaks. */
export function schedulePersistAppSettings(delayMs = 800): void {
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    void saveAppSettingsToDisk().catch(() => {
      /* ignore offline / web */
    });
  }, delayMs);
}

export async function loadAppSettingsFromDisk(): Promise<PersistedAppSettingsPayload | null> {
  try {
    const s = await invoke<PersistedAppSettingsPayload | null>("load_app_settings");
    return s ?? null;
  } catch {
    return null;
  }
}

export function applyPersistedSettingsToStores(p: PersistedAppSettingsPayload): void {
  const st = useSettingsStore.getState();
  st.setGameRootPath(p.gameRootPath ?? "");
  st.setModRootPaths(p.modRootPaths ?? []);
  st.setRecentFiles(p.recentFiles ?? []);
  st.setGridSize(p.gridSize ?? 10);
  st.setSnapEnabled(p.snapEnabled ?? true);
  st.setDefaultZoom(p.defaultZoom ?? 0.85);
  st.setAutoSaveIntervalSeconds(p.autoSaveIntervalSeconds ?? 120);
  st.setTheme(p.theme ?? "dark");
  st.setLanguage(p.language ?? "en");

  const c = useCanvasStore.getState();
  c.setGridSize(p.gridSize ?? 10);
  c.setSnapEnabled(p.snapEnabled ?? true);
  c.setZoom(p.defaultZoom ?? 0.85);
}

export async function saveProjectToPath(path: string, project: DashboardProject): Promise<void> {
  await invoke("save_project_json", { path, project });
}

export async function loadProjectFromPath(path: string): Promise<DashboardProject> {
  return invoke<DashboardProject>("load_project_json", { path });
}
