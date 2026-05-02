import { invoke } from "@tauri-apps/api/core";
import { open as pickPath, open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { saveAppSettingsToDisk } from "../../lib/appStateIpc";
import { useCanvasStore } from "../../store/canvasStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { AppSettings } from "../../types/scs";
import { useT, LANGUAGES } from "../../i18n";

const backdrop =
  "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4";
const panel =
  "max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl";
const inputCls =
  "mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

function PluginSection() {
  const t = useT();
  const [exePath, setExePath] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error" | "already">("idle");
  const [message, setMessage] = useState("");

  const browseExe = async () => {
    const sel = await open({
      multiple: false,
      filters: [{ name: "ETS2 / ATS executable", extensions: ["exe"] }],
    });
    if (sel && !Array.isArray(sel)) setExePath(sel as string);
  };

  const installPlugin = async () => {
    if (!exePath.trim()) {
      setMessage(t("plugin_select_first"));
      setStatus("error");
      return;
    }
    try {
      const msg = await invoke<string>("install_plugin", { exePath: exePath.trim() });
      setStatus("success");
      setMessage(msg || t("plugin_installed_msg"));
    } catch (e) {
      const err =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : String(e);
      if (err.includes("ALREADY_INSTALLED")) {
        setStatus("already");
        setMessage(err.replace(/^.*ALREADY_INSTALLED:?\s*/i, "").trim());
      } else {
        setStatus("error");
        setMessage(err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-200">{t("plugin_title")}</h3>
        <p className="mb-3 text-[11px] text-slate-400">{t("plugin_desc")}</p>
      </div>
      <div>
        <label className="text-[11px] text-slate-400">{t("plugin_exe_label")}</label>
        <div className="mt-0.5 flex gap-1">
          <input
            className={inputCls + " flex-1 font-mono"}
            value={exePath}
            readOnly
            placeholder="C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\eurotrucks2.exe"
          />
          <button
            type="button"
            className="rounded bg-slate-700 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-600"
            onClick={() => void browseExe()}
          >
            {t("btn_browse")}
          </button>
        </div>
      </div>
      <button
        type="button"
        disabled={!exePath.trim()}
        className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
        onClick={() => void installPlugin()}
      >
        {t("plugin_install")}
      </button>
      {message ? (
        <div
          className={`flex items-start gap-2 rounded p-2 text-[11px] ${
            status === "success"
              ? "bg-emerald-900/30 text-emerald-300"
              : status === "already"
                ? "bg-amber-900/30 text-amber-300"
                : "bg-red-900/30 text-red-300"
          }`}
        >
          <span>
            {status === "success" ? "✓" : status === "already" ? "ℹ" : "✗"}
          </span>
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}

export function SettingsDialog({
  open,
  onClose,
  onApplyGameRootToProject,
  onOpenRecent,
}: {
  open: boolean;
  onClose: () => void;
  onApplyGameRootToProject?: (gameRoot: string | undefined) => void;
  onOpenRecent?: (path: string) => void;
}) {
  const t = useT();

  const setGameRootPathStore = useSettingsStore((s) => s.setGameRootPath);
  const setGridSizeStore = useSettingsStore((s) => s.setGridSize);
  const setSnapStore = useSettingsStore((s) => s.setSnapEnabled);
  const setDefaultZoomStore = useSettingsStore((s) => s.setDefaultZoom);
  const setAutoSaveStore = useSettingsStore((s) => s.setAutoSaveIntervalSeconds);
  const setThemeStore = useSettingsStore((s) => s.setTheme);
  const setLanguageStore = useSettingsStore((s) => s.setLanguage);
  const setModRootPathsStore = useSettingsStore((s) => s.setModRootPaths);

  const setZoom = useCanvasStore((s) => s.setZoom);
  const setGridSize = useCanvasStore((s) => s.setGridSize);
  const setSnapEnabled = useCanvasStore((s) => s.setSnapEnabled);

  const [gameRootPath, setGameRootPath] = useState("");
  const [gridSize, setGridSizeLocal] = useState(10);
  const [snapEnabled, setSnapLocal] = useState(true);
  const [defaultZoom, setDefaultZoomLocal] = useState(0.85);
  const [autoSaveIntervalSeconds, setAutoSave] = useState(120);
  const [theme, setTheme] = useState<AppSettings["theme"]>("dark");
  const [language, setLanguage] = useState<AppSettings["language"]>("en");
  const [applyRootToProject, setApplyRootToProject] = useState(true);
  const [modRootsLocal, setModRootsLocal] = useState<string[]>([]);

  const recentFiles = useSettingsStore((s) => s.recentFiles);
  const [tab, setTab] = useState<"general" | "plugin">("general");

  useEffect(() => {
    if (!open) return;
    setTab("general");
    const s = useSettingsStore.getState();
    setGameRootPath(s.gameRootPath);
    setModRootsLocal([...s.modRootPaths]);
    setGridSizeLocal(s.gridSize);
    setSnapLocal(s.snapEnabled);
    setDefaultZoomLocal(s.defaultZoom);
    setAutoSave(s.autoSaveIntervalSeconds);
    setTheme(s.theme);
    setLanguage(s.language);
  }, [open]);

  if (!open) return null;

  const save = () => {
    setGameRootPathStore(gameRootPath.trim());
    setModRootPathsStore(modRootsLocal.map((p) => p.trim()).filter(Boolean));
    setGridSizeStore(gridSize);
    setSnapStore(snapEnabled);
    setDefaultZoomStore(defaultZoom);
    setAutoSaveStore(autoSaveIntervalSeconds);
    setThemeStore(theme);
    setLanguageStore(language);
    setZoom(defaultZoom);
    setGridSize(gridSize);
    setSnapEnabled(snapEnabled);
    if (applyRootToProject && onApplyGameRootToProject) {
      const g = gameRootPath.trim();
      onApplyGameRootToProject(g ? g : undefined);
    }
    void saveAppSettingsToDisk().catch(() => {
      /* Tauri only */
    });
    onClose();
  };

  return (
    <div
      className={backdrop}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={panel}>
        <h2 className="mb-2 text-sm font-semibold text-slate-100">{t("settings_title")}</h2>
        <div className="mb-3 flex gap-1 border-b border-slate-800 pb-2">
          <button
            type="button"
            className={
              "rounded px-2 py-1 text-[11px] " +
              (tab === "general"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-500 hover:bg-slate-900")
            }
            onClick={() => setTab("general")}
          >
            {t("settings_tab_general")}
          </button>
          <button
            type="button"
            className={
              "rounded px-2 py-1 text-[11px] " +
              (tab === "plugin"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-500 hover:bg-slate-900")
            }
            onClick={() => setTab("plugin")}
          >
            {t("settings_tab_plugin")}
          </button>
        </div>
        {tab === "plugin" ? (
          <PluginSection />
        ) : (
          <>
        <p className="mb-3 text-[10px] text-slate-500">
          {t("settings_persist_note")}
        </p>
        <div className="mb-2">
          <label className="text-[11px] text-slate-400">{t("settings_game_root")}</label>
          <input
            className={inputCls + " font-mono"}
            value={gameRootPath}
            placeholder="Path to ETS2 / ATS"
            onChange={(e) => setGameRootPath(e.target.value)}
          />
          {onApplyGameRootToProject ? (
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-[10px] text-slate-500">
              <input
                type="checkbox"
                checked={applyRootToProject}
                onChange={(e) => setApplyRootToProject(e.target.checked)}
              />
              {t("settings_game_root_apply")}
            </label>
          ) : null}
        </div>
        <div className="mb-3 border-t border-slate-800 pt-3">
          <label className="text-[11px] text-slate-400">{t("settings_mod_workspace")}</label>
          <p className="mb-1 text-[10px] text-slate-600">{t("settings_mod_workspace_note")}</p>
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              onClick={() => {
                void (async () => {
                  const d = await pickPath({ directory: true, multiple: false });
                  if (d === null || Array.isArray(d)) return;
                  setModRootsLocal((prev) => (prev.includes(d) ? prev : [...prev, d]));
                })();
              }}
            >
              {t("btn_add_folder")}
            </button>
          </div>
          <ul className="max-h-24 space-y-1 overflow-y-auto font-mono text-[10px] text-slate-400">
            {modRootsLocal.map((p) => (
              <li
                key={p}
                className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 px-2 py-1"
              >
                <span className="min-w-0 truncate" title={p}>
                  {p}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-red-400/90 hover:underline"
                  onClick={() => setModRootsLocal((prev) => prev.filter((x) => x !== p))}
                >
                  {t("btn_remove")}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-400">{t("settings_grid_size")}</label>
            <input
              type="number"
              min={2}
              max={100}
              className={inputCls}
              value={gridSize}
              onChange={(e) => setGridSizeLocal(Number(e.target.value) || 10)}
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">{t("settings_default_zoom")}</label>
            <input
              type="number"
              step={0.05}
              min={0.1}
              max={4}
              className={inputCls}
              value={defaultZoom}
              onChange={(e) => setDefaultZoomLocal(Number(e.target.value) || 1)}
            />
          </div>
        </div>
        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapLocal(e.target.checked)}
          />
          <span className="text-xs text-slate-300">{t("settings_snap")}</span>
        </label>
        <div className="mb-2">
          <label className="text-[11px] font-medium text-slate-300">
            {t("settings_autosave")}
          </label>
          <input
            type="number"
            min={0}
            max={3600}
            step={30}
            className={inputCls}
            value={autoSaveIntervalSeconds}
            onChange={(e) => setAutoSave(Number(e.target.value) || 0)}
          />
        </div>
        <div className="mb-2">
          <label className="text-[11px] text-slate-400">{t("settings_theme")}</label>
          <select
            className={inputCls}
            value={theme}
            onChange={(e) => setTheme(e.target.value as AppSettings["theme"])}
          >
            <option value="dark">{t("settings_theme_dark")}</option>
            <option value="light">{t("settings_theme_light")}</option>
            <option value="system">{t("settings_theme_system")}</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="text-[11px] text-slate-400">{t("settings_language")}</label>
          <select
            className={inputCls}
            value={language}
            onChange={(e) => setLanguage(e.target.value as AppSettings["language"])}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {recentFiles.length > 0 && onOpenRecent ? (
          <div className="mb-4 border-t border-slate-800 pt-3">
            <p className="mb-1 text-[11px] text-slate-400">{t("settings_recent_files")}</p>
            <ul className="max-h-28 space-y-1 overflow-y-auto font-mono text-[10px] text-slate-400">
              {recentFiles.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    className="w-full truncate rounded border border-slate-800 bg-slate-900/80 px-2 py-1 text-left text-emerald-300/90 hover:bg-slate-800"
                    title={p}
                    onClick={() => {
                      onOpenRecent(p);
                      onClose();
                    }}
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            {t("btn_cancel")}
          </button>
          <button
            type="button"
            className="rounded bg-emerald-800 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
            onClick={save}
          >
            {t("btn_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
