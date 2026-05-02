import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { CanvasToolbar } from "./components/canvas/CanvasToolbar";
import { DashboardCanvas, type PresetDropPayload } from "./components/canvas/DashboardCanvas";
import { ImportSiiDialog } from "./components/dialogs/ImportSiiDialog";
import { ModExportDialog } from "./components/dialogs/ModExportDialog";
import { NewProjectDialog } from "./components/dialogs/NewProjectDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { DocumentationDialog } from "./components/dialogs/DocumentationDialog";
import { CanvasSizeDialog } from "./components/dialogs/CanvasSizeDialog";
import { ModelViewerPanel } from "./components/dialogs/ModelViewerDialog";
import { SiiPreviewDialog } from "./components/dialogs/SiiPreviewDialog";
import { GameRootWarning } from "./components/layout/GameRootWarning";
import { EditorLeftSidebar } from "./components/layout/EditorLeftSidebar";
import { SplitDivider } from "./components/layout/SplitDivider";
import { InspectorPanel } from "./components/inspector/InspectorPanel";
import { Clipboard, Copy, Redo2, Scissors, Undo2 } from "lucide-react";

import { useUndoRedo } from "./contexts/UndoRedoContext";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useAppStateLifecycle } from "./hooks/useAppStateLifecycle";
import { useAppThemeIsLight } from "./hooks/useAppThemeIsLight";
import { useAutoSave } from "./hooks/useAutoSave";
import { useFileMenuKeyboard } from "./hooks/useFileMenuKeyboard";
import { useUndoKeyboard } from "./hooks/useUndoKeyboard";
import {
  loadProjectFromPath,
  saveAppSettingsToDisk,
  saveProjectToPath,
  schedulePersistAppSettings,
} from "./lib/appStateIpc";
import { projectAddElement } from "./lib/projectOps";
import { createPlacedElement } from "./lib/presetPlacement";
import { useCanvasStore } from "./store/canvasStore";
import { useProjectStore } from "./store/projectStore";
import { useSettingsStore } from "./store/settingsStore";
import { useTelemetryStore } from "./store/telemetryStore";
import type { DashboardProject, TextTemplate } from "./types/scs";
import { useT } from "./i18n";

let closeListenerRegistered = false;
/** Programmatic close in progress — skip the unsaved-changes dialog. */
let forceClose = false;
/** Dialog already open — prevent a second one from stacking. */
let dialogShowing = false;

function mapMenuChildren(children: ReactNode, close: () => void): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === MenuItem) {
      const oc = (child.props as { onClick?: () => void }).onClick;
      return cloneElement(child as ReactElement<{ onClick?: () => void }>, {
        onClick: () => {
          oc?.();
          close();
        },
      });
    }
    return child;
  });
}

function MenuGroup({
  label,
  buttonClass,
  light,
  children,
}: {
  label: string;
  buttonClass: string;
  light: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const panel =
    light
      ? "absolute left-0 top-full z-50 mt-0.5 min-w-[160px] rounded-lg border border-slate-300 bg-white py-1 shadow-2xl"
      : "absolute left-0 top-full z-50 mt-0.5 min-w-[160px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-2xl";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`${buttonClass} font-medium`}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className="text-[9px] opacity-60">▾</span>
      </button>
      {open ? (
        <div className={panel}>{mapMenuChildren(children, () => setOpen(false))}</div>
      ) : null}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  shortcut,
  light = false,
}: {
  onClick: () => void;
  children: ReactNode;
  shortcut?: string;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        light
          ? "flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-slate-800 hover:bg-slate-100"
          : "flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-slate-200 hover:bg-slate-800"
      }
      onClick={onClick}
    >
      <span>{children}</span>
      {shortcut ? (
        <span className={"ml-4 text-[10px] " + (light ? "text-slate-500" : "text-slate-500")}>
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}

function MenuDivider({ light = false }: { light?: boolean }) {
  return (
    <div className={"mx-2 my-0.5 border-t " + (light ? "border-slate-200" : "border-slate-700")} />
  );
}

function App() {
  useUndoKeyboard();
  useAppStateLifecycle();
  useAutoSave();

  const t = useT();

  useEffect(() => {
    if (closeListenerRegistered) return;
    closeListenerRegistered = true;

    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          if (forceClose) return;
          if (!useProjectStore.getState().isDirty) return;
          event.preventDefault();
          if (dialogShowing) return;
          dialogShowing = true;
          try {
            const ok = await ask(
              useSettingsStore.getState().language === "tr"
                ? "Kaydedilmemiş değişiklikler var. Kaydetmeden çıkmak istiyor musunuz?"
                : "You have unsaved changes. Exit without saving?",
              { title: "ETS2 Dashboard Editor", kind: "warning" },
            );
            if (ok) {
              forceClose = true;
              const win = getCurrentWindow();
              try {
                await win.close();
              } catch (e) {
                console.warn("[App] window.close() failed, calling destroy()", e);
                try {
                  await win.destroy();
                } catch (e2) {
                  console.error("[App] window.destroy() also failed", e2);
                  forceClose = false;
                }
              }
            }
          } finally {
            dialogShowing = false;
          }
        });
      } catch {
        /* Web / non-Tauri */
      }
    })();

    return () => {
      unlisten?.();
      closeListenerRegistered = false;
      forceClose = false;
      dialogShowing = false;
    };
  }, []);

  const mouseScsX = useCanvasStore((s) => s.mouseScsX);
  const mouseScsY = useCanvasStore((s) => s.mouseScsY);
  const zoom = useCanvasStore((s) => s.zoom);
  const showGrid = useCanvasStore((s) => s.showGrid);
  const setShowGrid = useCanvasStore((s) => s.setShowGrid);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const setGridSize = useCanvasStore((s) => s.setGridSize);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const setSnapEnabled = useCanvasStore((s) => s.setSnapEnabled);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const viewMode = useCanvasStore((s) => s.viewMode);

  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);
  const setProject = useProjectStore((s) => s.setProject);
  const applyProject = useProjectStore((s) => s.applyProject);
  const light = useAppThemeIsLight();
  const hdrBtn =
    light
      ? "rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-800 hover:bg-slate-100"
      : "rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800";
  const currentFilePath = useProjectStore((s) => s.currentFilePath);
  const setCurrentFilePath = useProjectStore((s) => s.setCurrentFilePath);
  const isDirty = useProjectStore((s) => s.isDirty);
  const setDirty = useProjectStore((s) => s.setDirty);
  const pushRecentFile = useSettingsStore((s) => s.pushRecentFile);
  const recentFiles = useSettingsStore((s) => s.recentFiles);

  const { manager, undo, redo, revision, executeCommand } = useUndoRedo();
  const canvasKeys = useCanvasKeyboard(executeCommand);

  const [exportOpen, setExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState("");
  const [importDefaultModId, setImportDefaultModId] = useState("mod");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [splitLeftPct, setSplitLeftPct] = useState(50);
  const [modelViewerResetSignal, setModelViewerResetSignal] = useState(0);
  const [canvasSizeOpen, setCanvasSizeOpen] = useState(false);
  const [canvasSizeSuggestedAspect, setCanvasSizeSuggestedAspect] = useState<
    number | null
  >(null);

  useEffect(() => {
    setSnapshotVersion((v) => v + 1);
  }, [project]);

  const getDashboardSnapshot = useCallback((): string | null => {
    const viewport = document.querySelector("[data-canvas-viewport]");
    if (!viewport) return null;
    const canvas = viewport.querySelector("canvas");
    if (!canvas) return null;
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, [snapshotVersion]);

  const applyGameRootToProject = useCallback(
    (gameRootPath: string | undefined) => {
      const p = useProjectStore.getState().project;
      if (!p) return;
      applyProject({ ...p, gameRootPath });
    },
    [applyProject],
  );

  const openProjectFromPath = useCallback(
    async (path: string) => {
      const proj = await loadProjectFromPath(path);
      setProject(proj);
      setActiveScreen(proj.screens[0]?.id ?? null);
      setCurrentFilePath(path);
      pushRecentFile(path);
      await saveAppSettingsToDisk().catch(() => {
        /* Tauri only */
      });
    },
    [setProject, setActiveScreen, setCurrentFilePath, pushRecentFile],
  );

  const handleOpenProject = useCallback(async () => {
    const sel = await open({
      multiple: false,
      filters: [{ name: "Dashboard project (JSON)", extensions: ["json"] }],
    });
    if (sel === null || Array.isArray(sel)) return;
    await openProjectFromPath(sel);
  }, [openProjectFromPath]);

  const handleSaveProject = useCallback(async () => {
    const p = useProjectStore.getState().project;
    if (!p) return;
    const path = useProjectStore.getState().currentFilePath;
    if (!path?.trim()) {
      const out = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `${p.dashboardFileName || "project"}.json`,
      });
      if (out === null) return;
      await saveProjectToPath(out, p);
      setCurrentFilePath(out);
      pushRecentFile(out);
      setDirty(false);
      await saveAppSettingsToDisk().catch(() => {});
      return;
    }
    await saveProjectToPath(path, p);
    setDirty(false);
  }, [pushRecentFile, setCurrentFilePath, setDirty]);

  const handleImportTemplates = useCallback(async () => {
    const p = useProjectStore.getState().project;
    if (!p) return;
    const sel = await open({
      multiple: false,
      filters: [{ name: "Template SII", extensions: ["sii"] }],
    });
    if (sel === null || Array.isArray(sel)) return;
    try {
      const templates = await invoke<TextTemplate[]>("import_templates_from_sii", {
        path: sel as string,
      });
      const merged = [...p.templates];
      for (const t of templates) {
        const idx = merged.findIndex((m) => m.name === t.name);
        if (idx >= 0) merged[idx] = t;
        else merged.push(t);
      }
      applyProject({ ...p, templates: merged });
      window.alert(`Imported ${templates.length} template(s). Total: ${merged.length}`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [applyProject]);

  const handleImportSii = useCallback(async () => {
    const sel = await open({
      multiple: false,
      filters: [{ name: "SCS dashboard / template", extensions: ["sii"] }],
    });
    if (sel === null || Array.isArray(sel)) return;
    const defaultMod = project?.modId?.trim() || "mod";
    setPendingImportPath(sel as string);
    setImportDefaultModId(defaultMod);
    setImportDialogOpen(true);
  }, [project?.modId]);

  const doImport = useCallback(
    async (modId: string) => {
      setImportDialogOpen(false);
      const gameRoot = useSettingsStore.getState().gameRootPath;
      const modRoots = useSettingsStore.getState().modRootPaths;
      const roots = modRoots.map((x) => x.trim()).filter(Boolean);
      try {
        const p = await invoke<DashboardProject>("import_dashboard_from_sii", {
          dashboardPath: pendingImportPath,
          modId,
          gameRoot: gameRoot?.trim() || null,
          modRoots: roots.length ? roots : null,
        });
        applyProject(p);
        setActiveScreen(p.screens[0]?.id ?? null);
        setCurrentFilePath(null);
        setDirty(false);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    },
    [pendingImportPath, applyProject, setActiveScreen, setCurrentFilePath, setDirty],
  );

  const handleNewProject = useCallback(
    (p: DashboardProject) => {
      useCanvasStore.getState().setSelection([]);
      useCanvasStore.getState().setHovered(null);
      useCanvasStore.getState().setZoom(useSettingsStore.getState().defaultZoom);
      useCanvasStore.getState().setPan(40, 32);
      useTelemetryStore.getState().setSimulationMode(false);
      setProject(p);
      setActiveScreen(p.screens[0]?.id ?? null);
      setCurrentFilePath(null);
      setDirty(false);
      setModelViewerResetSignal((v) => v + 1);
    },
    [setProject, setActiveScreen, setCurrentFilePath, setDirty],
  );

  const handleSaveProjectAs = useCallback(async () => {
    const p = useProjectStore.getState().project;
    if (!p) return;
    const out = await save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: currentFilePath ?? `${p.dashboardFileName || "project"}.json`,
    });
    if (out === null) return;
    await saveProjectToPath(out, p);
    setCurrentFilePath(out);
    pushRecentFile(out);
    setDirty(false);
    await saveAppSettingsToDisk().catch(() => {});
  }, [currentFilePath, pushRecentFile, setCurrentFilePath, setDirty]);

  useFileMenuKeyboard(handleOpenProject, handleSaveProject);

  const activeScreen =
    project?.screens.find((s) => s.id === activeScreenId) ?? project?.screens[0];

  const onPresetDrop = useCallback(
    (payload: PresetDropPayload) => {
      const p = useProjectStore.getState().project;
      const aid = useProjectStore.getState().activeScreenId;
      if (!p) return;
      const screen = p.screens.find((s) => s.id === aid) ?? p.screens[0];
      if (!screen) return;
      const bw = p.canvasWidth ?? 800;
      const bh = p.canvasHeight ?? 800;
      const placed = createPlacedElement(
        payload.presetId,
        payload.wx,
        payload.wy,
        screen.unitName,
        bw,
        bh,
      );
      if (!placed) return;
      const prev = structuredClone(p);
      const next = projectAddElement(p, screen.id, placed);
      executeCommand({
        execute: () => applyProject(structuredClone(next)),
        undo: () => applyProject(prev),
        description: "Add element (drop)",
      });
      useCanvasStore.getState().setSelection([placed.id]);
    },
    [applyProject, executeCommand],
  );

  return (
    <div
      className={
        light
          ? "flex h-full min-h-0 flex-col bg-slate-100 text-slate-900"
          : "flex h-full min-h-0 flex-col bg-slate-950 text-slate-100"
      }
    >
      <ImportSiiDialog
        open={importDialogOpen}
        filePath={pendingImportPath}
        defaultModId={importDefaultModId}
        onClose={() => setImportDialogOpen(false)}
        onConfirm={doImport}
      />
      <ModExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
      />
      <SiiPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        project={project}
      />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={(p) => {
          handleNewProject(p);
          setNewProjectOpen(false);
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApplyGameRootToProject={applyGameRootToProject}
        onOpenRecent={(path) => void openProjectFromPath(path)}
      />
      <DocumentationDialog open={docsOpen} onClose={() => setDocsOpen(false)} light={light} />
      <CanvasSizeDialog
        open={canvasSizeOpen}
        project={project}
        suggestedAspect={canvasSizeSuggestedAspect}
        onClose={() => {
          setCanvasSizeOpen(false);
          setCanvasSizeSuggestedAspect(null);
        }}
        onApply={(next) => {
          const prev = useProjectStore.getState().project;
          if (!prev) return;
          const prevSnapshot = structuredClone(prev);
          executeCommand({
            execute: () => applyProject(structuredClone(next)),
            undo: () => applyProject(prevSnapshot),
            description: `Resize canvas to ${next.canvasWidth}×${next.canvasHeight}`,
          });
        }}
      />
      <header
        className={
          light
            ? "flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-300 bg-slate-200/90 px-4 py-2"
            : "flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-2"
        }
        data-undo-revision={revision}
      >
        <h1
          className={
            light
              ? "mr-2 text-sm font-bold tracking-tight text-slate-900"
              : "mr-2 text-sm font-bold tracking-tight text-slate-100"
          }
        >
          {t("app_title")}
        </h1>
        <div className="flex flex-wrap items-center gap-1">
          <MenuGroup label={t("menu_file")} buttonClass={hdrBtn} light={light}>
            <MenuItem light={light} onClick={() => setNewProjectOpen(true)}>
              {t("file_new")}
            </MenuItem>
            <MenuDivider light={light} />
            <MenuItem
              light={light}
              shortcut="Ctrl+O"
              onClick={() => { void handleOpenProject(); }}
            >
              {t("file_open")}
            </MenuItem>
            {recentFiles.length > 0 ? <MenuDivider light={light} /> : null}
            {recentFiles.slice(0, 5).map((f) => (
              <MenuItem
                key={f}
                light={light}
                onClick={() => void openProjectFromPath(f)}
              >
                {f.split(/[/\\]/).pop() ?? f}
              </MenuItem>
            ))}
            <MenuDivider light={light} />
            <MenuItem
              light={light}
              shortcut="Ctrl+S"
              onClick={() => void handleSaveProject()}
            >
              {t("file_save")}
            </MenuItem>
            <MenuItem light={light} onClick={() => void handleSaveProjectAs()}>
              {t("file_save_as")}
            </MenuItem>
            <MenuDivider light={light} />
            <MenuItem
              light={light}
              onClick={() => {
                setCanvasSizeSuggestedAspect(null);
                setCanvasSizeOpen(true);
              }}
            >
              {t("file_canvas_size")}
            </MenuItem>
            <MenuDivider light={light} />
            <MenuItem light={light} onClick={() => void handleImportSii()}>
              {t("file_import_sii")}
            </MenuItem>
            <MenuItem light={light} onClick={() => void handleImportTemplates()}>
              {t("file_import_templates")}
            </MenuItem>
            <MenuDivider light={light} />
            <MenuItem light={light} onClick={() => setExportOpen(true)}>
              {t("file_export_mod")}
            </MenuItem>
          </MenuGroup>
          <MenuGroup label={t("menu_view")} buttonClass={hdrBtn} light={light}>
            <MenuItem light={light} onClick={() => setPreviewOpen(true)}>
              {t("view_sii_preview")}
            </MenuItem>
            <MenuDivider light={light} />
            <MenuItem light={light} onClick={() => setSettingsOpen(true)}>
              {t("view_settings")}
            </MenuItem>
          </MenuGroup>
          <MenuGroup label={t("menu_help")} buttonClass={hdrBtn} light={light}>
            <MenuItem light={light} onClick={() => setDocsOpen(true)}>
              {t("help_documentation")}
            </MenuItem>
            <MenuDivider light={light} />
            <MenuItem light={light} onClick={() => setAboutOpen(true)}>
              {t("help_about")}
            </MenuItem>
          </MenuGroup>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!manager.canUndo}
            title={
              manager.canUndo
                ? `${t("toolbar_undo")}: ${manager.nextUndoDescription ?? ""}` +
                    (manager.undoCount > 1
                      ? "\n\n" + t("undo_history") + " (" + String(manager.undoCount) + "):\n" +
                        [...manager.undoHistory].reverse().slice(0, 10).join("\n")
                      : "")
                : t("undo_nothing")
            }
            className={hdrBtn + " inline-flex items-center gap-1 disabled:opacity-40"}
            onClick={() => undo()}
          >
            <Undo2 size={14} aria-hidden />
            {t("toolbar_undo")}
            {manager.undoCount > 0 ? (
              <span className="ml-0.5 text-xs opacity-50">({String(manager.undoCount)})</span>
            ) : null}
          </button>
          <button
            type="button"
            disabled={!manager.canRedo}
            title={
              manager.canRedo
                ? `${t("toolbar_redo")}: ${manager.nextRedoDescription ?? ""}` +
                    (manager.redoCount > 1
                      ? "\n\n" + t("redo_next") + " (" + String(manager.redoCount) + "):\n" +
                        manager.redoHistory.slice(0, 10).join("\n")
                      : "")
                : t("redo_nothing")
            }
            className={hdrBtn + " inline-flex items-center gap-1 disabled:opacity-40"}
            onClick={() => redo()}
          >
            <Redo2 size={14} aria-hidden />
            {t("toolbar_redo")}
            {manager.redoCount > 0 ? (
              <span className="ml-0.5 text-xs opacity-50">({String(manager.redoCount)})</span>
            ) : null}
          </button>
          <button
            type="button"
            className={hdrBtn + " inline-flex items-center gap-1"}
            title={t("toolbar_cut") + " (Ctrl+X)"}
            onClick={canvasKeys.cut}
          >
            <Scissors size={14} aria-hidden />
            {t("toolbar_cut")}
          </button>
          <button
            type="button"
            className={hdrBtn + " inline-flex items-center gap-1"}
            title={t("toolbar_copy") + " (Ctrl+C)"}
            onClick={canvasKeys.copy}
          >
            <Copy size={14} aria-hidden />
            {t("toolbar_copy")}
          </button>
          <button
            type="button"
            className={hdrBtn + " inline-flex items-center gap-1"}
            title={t("toolbar_paste") + " (Ctrl+V)"}
            onClick={canvasKeys.paste}
          >
            <Clipboard size={14} aria-hidden />
            {t("toolbar_paste")}
          </button>
        </div>
        {project ? (
          <label
            className={
              light
                ? "flex items-center gap-1.5 text-xs text-slate-700"
                : "flex items-center gap-1.5 text-xs text-slate-400"
            }
          >
            <span>{t("toolbar_screen")}</span>
            <select
              className={
                light
                  ? "rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-900"
                  : "rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              }
              value={activeScreen?.id ?? ""}
              onChange={(e) => setActiveScreen(e.target.value || null)}
            >
              {project.screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.screenId})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label
          title={t("toolbar_grid")}
          className={
            light
              ? "flex cursor-pointer items-center gap-2 text-xs text-slate-700"
              : "flex cursor-pointer items-center gap-2 text-xs text-slate-400"
          }
        >
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          {t("toolbar_grid")}
        </label>
        <label
          className={
            light
              ? "flex items-center gap-2 text-xs text-slate-700"
              : "flex items-center gap-2 text-xs text-slate-400"
          }
        >
          {t("toolbar_size")}
          <input
            type="number"
            min={2}
            max={100}
            className={
              light
                ? "w-16 rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-900"
                : "w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            }
            value={gridSize}
            onChange={(e) => {
              const n = Number(e.target.value) || 10;
              setGridSize(n);
              useSettingsStore.getState().setGridSize(n);
              schedulePersistAppSettings();
            }}
          />
        </label>
        <label
          className={
            light
              ? "flex cursor-pointer items-center gap-2 text-xs text-slate-700"
              : "flex cursor-pointer items-center gap-2 text-xs text-slate-400"
          }
        >
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => {
              const v = e.target.checked;
              setSnapEnabled(v);
              useSettingsStore.getState().setSnapEnabled(v);
              schedulePersistAppSettings();
            }}
          />
          {t("toolbar_snap")}
        </label>
      </header>

      <div className="flex min-h-0 flex-1 flex-row">
        <EditorLeftSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CanvasToolbar />
          <div className="relative flex min-h-0 flex-1 min-w-0 flex-row" style={{ position: "relative" }}>
            <div
              data-canvas-viewport
              style={{
                position: "relative",
                flex: viewMode === "split" ? `${splitLeftPct} 1 0%` : "1 1 100%",
                minWidth: 0,
                minHeight: 0,
                display: viewMode === "3d" ? "none" : "flex",
                flexDirection: "column",
              }}
            >
              <DashboardCanvas
                className="absolute inset-0"
                canvasKeys={canvasKeys}
                onPresetDrop={onPresetDrop}
              />
            </div>
            {viewMode === "split" ? (
              <SplitDivider
                light={light}
                onResize={(deltaXPercent) => {
                  setSplitLeftPct((prev) => {
                    const newPct = Math.max(20, Math.min(80, prev + deltaXPercent));
                    return newPct;
                  });
                }}
              />
            ) : null}
            <div
              style={{
                flex: viewMode === "split" ? `${100 - splitLeftPct} 1 0%` : "1 1 100%",
                minWidth: 0,
                minHeight: 0,
                display: viewMode === "canvas" ? "none" : "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <ModelViewerPanel
                light={light}
                getDashboardSnapshot={getDashboardSnapshot}
                project={project}
                screenId={activeScreen?.screenId ?? null}
                resetSignal={modelViewerResetSignal}
                onRequestCanvasResize={(suggestedAspect) => {
                  setCanvasSizeSuggestedAspect(suggestedAspect);
                  setCanvasSizeOpen(true);
                }}
              />
            </div>
          </div>
          <footer
            className={
              light
                ? "flex shrink-0 flex-wrap items-center gap-6 border-t border-slate-300 px-4 py-2 font-mono text-xs text-slate-600"
                : "flex shrink-0 flex-wrap items-center gap-6 border-t border-slate-800 px-4 py-2 font-mono text-xs text-slate-400"
            }
          >
            <span>
              Canvas: {project?.canvasWidth ?? 800}×{project?.canvasHeight ?? 800} · SCS: (
              {Math.round(mouseScsX)}, {Math.round(mouseScsY)}) · {t("status_origin")}
            </span>
            <span>{t("status_zoom")}: {(zoom * 100).toFixed(0)}%</span>
            <span>{t("status_selected")}: {selectedIds.length ? selectedIds.join(", ") : "—"}</span>
            {currentFilePath ? (
              <span className="max-w-md truncate text-emerald-500/90" title={currentFilePath}>
                {t("status_file")}: {currentFilePath}
              </span>
            ) : (
              <span className="text-slate-600">{t("status_file")}: {t("status_unsaved")}</span>
            )}
            {isDirty ? (
              <span className="text-amber-400/90">{t("status_modified")}</span>
            ) : (
              <span className={light ? "text-slate-500" : "text-slate-600"}>{t("status_saved")}</span>
            )}
          </footer>
        </div>
        <InspectorPanel />
      </div>
      <GameRootWarning />
      {aboutOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAboutOpen(false);
          }}
        >
          <div
            className={
              light
                ? "w-full max-w-sm rounded-lg border border-slate-300 bg-white p-6 shadow-2xl"
                : "w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            }
          >
            <h2
              className={`mb-1 text-lg font-bold ${light ? "text-slate-900" : "text-slate-100"}`}
            >
              ETS2 Dashboard Editor
            </h2>
            <p className={`mb-4 text-sm ${light ? "text-slate-600" : "text-slate-400"}`}>
              {t("about_description")}
            </p>
            <div className={`mb-4 rounded border p-3 text-xs ${light ? "border-slate-200 bg-slate-50 text-slate-700" : "border-slate-700 bg-slate-800/60 text-slate-300"}`}>
              <p className="font-semibold">{t("about_created_by")}</p>
              <p className="mt-0.5 text-sm font-medium">Metehan BİLAL</p>
              <a
                href="https://metehanbilal.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block text-emerald-500 hover:underline"
              >
                metehanbilal.com
              </a>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className={
                  light
                    ? "rounded border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
                    : "rounded border border-slate-600 bg-slate-800 px-4 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                }
                onClick={() => setAboutOpen(false)}
              >
                {t("btn_close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
