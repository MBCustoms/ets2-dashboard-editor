import {
  AlertTriangle,
  BarChart2,
  Gauge,
  Grid3x3,
  Image,
  Type,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { ELEMENT_PRESETS, type PresetCategory } from "../../lib/elementPresets";
import { createPlacedElement } from "../../lib/presetPlacement";
import { dispatchPresetDragEnd, dispatchPresetDragStart } from "../../lib/presetDrag";
import { projectAddElement } from "../../lib/projectOps";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";


const CATS: {
  id: PresetCategory | "all";
  label: string;
  icon: ReactNode;
}[] = [
  { id: "all", label: "All", icon: <Grid3x3 size={11} /> },
  { id: "backgrounds", label: "BG", icon: <Image size={11} /> },
  { id: "textIndicators", label: "Text", icon: <Type size={11} /> },
  { id: "bars", label: "Bars", icon: <BarChart2 size={11} /> },
  { id: "gauges", label: "Gauge", icon: <Gauge size={11} /> },
  { id: "indicators", label: "Icons", icon: <AlertTriangle size={11} /> },
];

export function ElementLibraryPanel() {
  const light = useAppThemeIsLight();
  const [cat, setCat] = useState<PresetCategory | "all">("all");
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const applyProject = useProjectStore((s) => s.applyProject);
  const { executeCommand } = useUndoRedo();
  const setSelection = useCanvasStore((s) => s.setSelection);

  const filtered = useMemo(() => {
    if (cat === "all") return ELEMENT_PRESETS;
    return ELEMENT_PRESETS.filter((p) => p.category === cat);
  }, [cat]);

  const screen = project?.screens.find((s) => s.id === activeScreenId) ?? project?.screens[0];

  const place = (presetId: string, wx: number, wy: number) => {
    if (!project || !screen) return;
    const bw = project.canvasWidth ?? 800;
    const bh = project.canvasHeight ?? 800;
    const placed = createPlacedElement(presetId, wx, wy, screen.unitName, bw, bh);
    if (!placed) return;
    const prev = structuredClone(project);
    const next = projectAddElement(project, screen.id, placed);
    executeCommand({
      execute: () => applyProject(structuredClone(next)),
      undo: () => applyProject(prev),
      description: `Add element`,
    });
    setSelection([placed.id]);
  };

  const addCenter = (presetId: string) => {
    const bw = project?.canvasWidth ?? 800;
    const bh = project?.canvasHeight ?? 800;
    place(presetId, bw / 2, bh / 2);
  };

  const catBar = (p: (typeof ELEMENT_PRESETS)[number]) =>
    p.category === "backgrounds"
      ? "bg-slate-500"
      : p.category === "textIndicators"
        ? "bg-blue-500"
        : p.category === "bars"
          ? "bg-amber-500"
          : p.category === "gauges"
            ? "bg-purple-500"
            : "bg-slate-600";

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="flex flex-wrap gap-1">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
              cat === c.id
                ? "bg-emerald-800 text-white"
                : light
                  ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
            onClick={() => setCat(c.id)}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>
      <p
        className={`text-[10px] leading-snug ${light ? "text-slate-600" : "text-slate-500"}`}
      >
        Drag onto the canvas or use <span className={light ? "text-slate-800" : "text-slate-400"}>Add</span>.
        Drops use pointer position (canvas ignores pointer events while dragging a preset).
      </p>
      <ul className="flex max-h-[min(50vh,420px)] flex-col gap-0.5 overflow-y-auto pr-1">
        {filtered.map((p) => (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/preset", p.id);
              e.dataTransfer.effectAllowed = "copy";
              dispatchPresetDragStart();
            }}
            onDragEnd={() => dispatchPresetDragEnd()}
            className={`flex cursor-grab items-center gap-2 rounded border px-2 py-1.5 text-[11px] active:cursor-grabbing ${
              light
                ? "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/60"
            }`}
          >
            <div className={`h-6 w-0.5 shrink-0 rounded-full ${catBar(p)}`} />
            <span
              className={`min-w-0 flex-1 truncate ${light ? "text-slate-700" : "text-slate-200"}`}
            >
              {p.label}
            </span>
            <button
              type="button"
              className="shrink-0 rounded bg-emerald-800/80 px-1.5 py-0.5 text-[9px] font-medium text-emerald-100 hover:bg-emerald-700"
              onClick={() => addCenter(p.id)}
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
