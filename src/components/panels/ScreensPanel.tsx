import { AlertCircle, ChevronDown, ChevronUp, Monitor, Plus, Share2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { panelTheme } from "../../lib/panelStyles";
import { createScreenRootGroup, createSharedScreen950 } from "../../lib/projectDefaults";
import {
  compareScreens,
  projectAddScreen,
  projectRemoveScreen,
  projectReorderScreens,
} from "../../lib/projectOps";
import { useProjectStore } from "../../store/projectStore";
import type { DashboardProject, DashboardScreen } from "../../types/scs";

const VALID_SCREEN_IDS = [100, 200, 300, 400, 500, 600, 700, 800] as const;
const MAX_SWITCHABLE_SCREENS = 8;

export function ScreensPanel() {
  const light = useAppThemeIsLight();
  const th = panelTheme(light);
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);
  const applyProject = useProjectStore((s) => s.applyProject);
  const { executeCommand } = useUndoRedo();
  const [err, setErr] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!project) return [];
    return [...project.screens].sort(compareScreens);
  }, [project]);

  const run = (description: string, next: DashboardProject) => {
    if (!project) return;
    const prev = structuredClone(project);
    executeCommand({
      execute: () => applyProject(structuredClone(next)),
      undo: () => applyProject(prev),
      description,
    });
  };

  const addScreen = () => {
    if (!project) return;
    const usedIds = new Set(project.screens.map((s) => s.screenId));
    const switchableScreens = project.screens.filter(
      (s) => s.screenId >= 100 && s.screenId <= 800 && s.screenId !== 950 && s.screenId !== 900,
    );

    if (switchableScreens.length >= MAX_SWITCHABLE_SCREENS) {
      setErr(`Maximum ${MAX_SWITCHABLE_SCREENS} switchable screens (100–800) reached.`);
      return;
    }

    const nextId = VALID_SCREEN_IDS.find((id) => !usedIds.has(id));
    if (nextId === undefined) {
      setErr("All screen IDs (100–800) are in use.");
      return;
    }

    setErr(null);
    const unitName = `_nameless._.display${nextId}`;
    const cw = project.canvasWidth ?? 800;
    const ch = project.canvasHeight ?? 800;
    const root = createScreenRootGroup(
      crypto.randomUUID(),
      unitName,
      project.windowUnitName,
      nextId,
      cw,
      ch,
    );
    const newScreen: DashboardScreen = {
      id: crypto.randomUUID(),
      unitName,
      screenId: nextId,
      displayName: `Display ${nextId}`,
      elements: [root],
    };
    run(`Add screen ${nextId}`, projectAddScreen(project, newScreen));
    setActiveScreen(newScreen.id);
  };

  const hasShared950 = project?.screens.some((s) => s.screenId === 950) ?? false;

  const addSharedScreen = () => {
    if (!project || hasShared950) return;
    const cw = project.canvasWidth ?? 800;
    const ch = project.canvasHeight ?? 800;
    const newScreen = createSharedScreen950(project.windowUnitName, cw, ch);
    run("Add shared screen (950)", projectAddScreen(project, newScreen));
    setActiveScreen(newScreen.id);
  };

  const removeScreen = (screenId: string) => {
    if (!project) return;
    const screen = project.screens.find((s) => s.id === screenId);
    if (!screen) return;
    if (screen.screenId === 950) {
      window.alert("Cannot remove shared screen (950).");
      return;
    }
    if (project.screens.length <= 1) {
      setErr("Cannot remove the last screen.");
      return;
    }
    if (!window.confirm(`Remove screen "${screen.displayName}"?`)) return;
    setErr(null);
    const next = projectRemoveScreen(project, screenId);
    run("Remove screen", next);
    setActiveScreen(next.screens[0]?.id ?? null);
  };

  const move = (id: string, dir: -1 | 1) => {
    if (!project) return;
    const ids = sorted.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const order = [...ids];
    [order[i], order[j]] = [order[j], order[i]];
    run("Reorder screens", projectReorderScreens(project, order));
  };

  if (!project) {
    return (
      <p className={`px-2 text-xs ${light ? "text-slate-600" : "text-slate-500"}`}>No project.</p>
    );
  }

  const itemCls = (isActive: boolean) =>
    `flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] ${
      isActive
        ? light
          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
          : "border-emerald-700 bg-emerald-900/30 text-emerald-200"
        : light
          ? "border-transparent text-slate-700 hover:bg-slate-100"
          : "border-transparent bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
    }`;

  return (
    <div className={`flex flex-col gap-2 ${th.section}`}>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={th.btn.primary}
          onClick={addScreen}
        >
          <span className="inline-flex items-center gap-1">
            <Plus size={12} />
            Add screen
          </span>
        </button>
        {!hasShared950 ? (
          <button
            type="button"
            className={`${th.btn.primary} inline-flex items-center gap-1`}
            onClick={addSharedScreen}
          >
            <Share2 size={12} />
            Add shared screen
          </button>
        ) : null}
      </div>
      {err ? (
        <p className="inline-flex items-center gap-1 text-[11px] text-amber-400">
          <AlertCircle size={12} />
          {err}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {sorted.map((s) => (
          <li key={s.id} className={itemCls(s.id === activeScreenId)}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
              onClick={() => setActiveScreen(s.id)}
            >
              <Monitor size={12} className="shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate font-medium">{s.displayName}</span>
              <span
                className={th.badge.id}
              >
                {s.screenId}
              </span>
            </button>
            <button
              type="button"
              className={th.btn.icon}
              title="Move up"
              onClick={() => move(s.id, -1)}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className={th.btn.icon}
              title="Move down"
              onClick={() => move(s.id, 1)}
            >
              <ChevronDown size={14} />
            </button>
            {s.screenId !== 950 ? (
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-slate-600 hover:bg-red-900/40 hover:text-red-400"
                title="Remove"
                onClick={() => removeScreen(s.id)}
              >
                <Trash2 size={12} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
