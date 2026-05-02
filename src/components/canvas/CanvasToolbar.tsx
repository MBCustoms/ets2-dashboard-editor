import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Box,
  Download,
  Eye,
  EyeOff,
  Focus,
  Grid3x3,
  ImageDown,
  Maximize2,
  Minus,
  Scan,
  ZoomIn,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { AppTooltip } from "../ui/AppTooltip";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { DashboardElement } from "../../types/scs";
import { useT } from "../../i18n";

const sep = <span className="mx-1 h-4 w-px shrink-0 bg-slate-500/40" />;

export function CanvasToolbar() {
  const light = useAppThemeIsLight();
  const t = useT();
  const btn = useMemo(
    () =>
      light
        ? "inline-flex items-center justify-center rounded border border-slate-300 bg-white px-1.5 py-0.5 text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        : "inline-flex items-center justify-center rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40",
    [light],
  );
  const bar = light
    ? "flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-300 bg-slate-50/95 px-3 py-1.5 text-xs text-slate-800"
    : "flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-300";

  const zoom = useCanvasStore((s) => s.zoom);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const wireframeMode = useCanvasStore((s) => s.wireframeMode);
  const setWireframeMode = useCanvasStore((s) => s.setWireframeMode);
  const showCollisions = useCanvasStore((s) => s.showCollisions);
  const setShowCollisions = useCanvasStore((s) => s.setShowCollisions);
  const showSelectionChrome = useCanvasStore((s) => s.showSelectionChrome);
  const setShowSelectionChrome = useCanvasStore((s) => s.setShowSelectionChrome);
  const viewMode = useCanvasStore((s) => s.viewMode);
  const setViewMode = useCanvasStore((s) => s.setViewMode);
  const uvEdges = useCanvasStore((s) => s.uvEdges);
  const showUvOverlay = useCanvasStore((s) => s.showUvOverlay);
  const setShowUvOverlay = useCanvasStore((s) => s.setShowUvOverlay);
  const hasUv = !!uvEdges && uvEdges.length > 0;
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const applyProject = useProjectStore((s) => s.applyProject);
  const { executeCommand } = useUndoRedo();

  const gameRoot = useSettingsStore((s) => s.gameRootPath);
  const modRoots = useSettingsStore((s) => s.modRootPaths ?? []);

  const activeScreen =
    project?.screens.find((s) => s.id === activeScreenId) ?? project?.screens[0];
  const selectedElements =
    activeScreen?.elements.filter((el) => selectedIds.includes(el.id)) ?? [];
  const hasSelection = selectedElements.length > 0;
  const hasMulti = selectedElements.length >= 2;
  const hasMulti3 = selectedElements.length >= 3;

  const activeAccent = (on: boolean, lightOn: string, darkOn: string) =>
    on ? (light ? lightOn : darkOn) : "";

  const align = useCallback(
    (mode: "left" | "right" | "top" | "bottom" | "centerH" | "centerV") => {
      if (!project || !activeScreen || selectedElements.length < 2) return;

      const els = selectedElements;
      const refL = Math.min(...els.map((e) => e.coordsL));
      const refR = Math.max(...els.map((e) => e.coordsR));
      const refT = Math.max(...els.map((e) => e.coordsT));
      const refB = Math.min(...els.map((e) => e.coordsB));
      const refCH = Math.round((refL + refR) / 2);
      const refCV = Math.round((refT + refB) / 2);

      const prev = structuredClone(project);
      const next = {
        ...project,
        screens: project.screens.map((s) =>
          s.id !== activeScreen.id
            ? s
            : {
                ...s,
                elements: s.elements.map((el) => {
                  if (!selectedIds.includes(el.id)) return el;
                  const w = el.coordsR - el.coordsL;
                  const h = el.coordsT - el.coordsB;
                  let nL = el.coordsL;
                  let nR = el.coordsR;
                  let nT = el.coordsT;
                  let nB = el.coordsB;
                  switch (mode) {
                    case "left":
                      nL = refL;
                      nR = refL + w;
                      break;
                    case "right":
                      nR = refR;
                      nL = refR - w;
                      break;
                    case "top":
                      nT = refT;
                      nB = refT - h;
                      break;
                    case "bottom":
                      nB = refB;
                      nT = refB + h;
                      break;
                    case "centerH":
                      nL = refCH - Math.round(w / 2);
                      nR = nL + w;
                      break;
                    case "centerV":
                      nT = refCV + Math.round(h / 2);
                      nB = nT - h;
                      break;
                  }
                  return { ...el, coordsL: nL, coordsR: nR, coordsT: nT, coordsB: nB };
                }),
              },
        ),
      };
      executeCommand({
        execute: () => applyProject(structuredClone(next)),
        undo: () => applyProject(prev),
        description: `Align ${mode}`,
      });
    },
    [project, activeScreen, selectedElements, selectedIds, executeCommand, applyProject],
  );

  const distribute = useCallback(
    (horizontal: boolean) => {
      if (!project || !activeScreen || selectedElements.length < 3) return;

      const sorted = [...selectedElements].sort((a, b) =>
        horizontal
          ? a.coordsL + a.coordsR - (b.coordsL + b.coordsR)
          : a.coordsT + a.coordsB - (b.coordsT + b.coordsB),
      );
      const n = sorted.length;
      const first = sorted[0];
      const last = sorted[n - 1];

      const prev = structuredClone(project);
      const newPositions = new Map<string, Partial<DashboardElement>>();

      if (horizontal) {
        const c0 = (first.coordsL + first.coordsR) / 2;
        const c1 = (last.coordsL + last.coordsR) / 2;
        const step = (c1 - c0) / (n - 1);
        for (let i = 1; i < n - 1; i++) {
          const el = sorted[i];
          const w = el.coordsR - el.coordsL;
          const nc = c0 + step * i;
          const nL = Math.round(nc - w / 2);
          newPositions.set(el.id, { coordsL: nL, coordsR: nL + w });
        }
      } else {
        const c0 = (first.coordsT + first.coordsB) / 2;
        const c1 = (last.coordsT + last.coordsB) / 2;
        const step = (c1 - c0) / (n - 1);
        for (let i = 1; i < n - 1; i++) {
          const el = sorted[i];
          const h = el.coordsT - el.coordsB;
          const nc = c0 + step * i;
          const nT = Math.round(nc + h / 2);
          newPositions.set(el.id, { coordsT: nT, coordsB: nT - h });
        }
      }

      const next = {
        ...project,
        screens: project.screens.map((s) =>
          s.id !== activeScreen.id
            ? s
            : {
                ...s,
                elements: s.elements.map((el) => {
                  const upd = newPositions.get(el.id);
                  return upd ? { ...el, ...upd } : el;
                }),
              },
        ),
      };
      executeCommand({
        execute: () => applyProject(structuredClone(next)),
        undo: () => applyProject(prev),
        description: `Distribute ${horizontal ? "H" : "V"}`,
      });
    },
    [project, activeScreen, selectedElements, executeCommand, applyProject],
  );

  const changeLayer = useCallback(
    (delta: number) => {
      if (!project || !activeScreen || selectedElements.length === 0) return;
      const prev = structuredClone(project);
      const next = {
        ...project,
        screens: project.screens.map((s) =>
          s.id !== activeScreen.id
            ? s
            : {
                ...s,
                elements: s.elements.map((el) =>
                  selectedIds.includes(el.id) ? { ...el, layer: el.layer + delta } : el,
                ),
              },
        ),
      };
      executeCommand({
        execute: () => applyProject(structuredClone(next)),
        undo: () => applyProject(prev),
        description: delta > 0 ? "Bring forward" : "Send backward",
      });
    },
    [project, activeScreen, selectedElements.length, selectedIds, executeCommand, applyProject],
  );

  const exportPng = useCallback(async () => {
    if (!project || !activeScreen || !gameRoot?.trim()) {
      window.alert(t("export_png_no_root"));
      return;
    }
    const out = await save({
      defaultPath: `${activeScreen.displayName || "screen"}.png`,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (out === null) return;

    try {
      const mods = modRoots.filter(Boolean);
      const size = Math.max(project.canvasWidth ?? 800, project.canvasHeight ?? 800);
      const b64 = await invoke<string | null>("render_screen_preview_png_b64", {
        project: { ...project, gameRootPath: gameRoot.trim() },
        screenId: activeScreen.screenId,
        size,
        modRoots: mods.length ? mods : null,
        telemetryOverrides: null,
      });
      if (!b64) {
        window.alert("Render returned empty result.");
        return;
      }

      await invoke("write_binary_file", {
        path: out,
        data: b64,
        isBase64: true,
      });
      window.alert(`PNG saved: ${out}`);
    } catch (e) {
      window.alert(`Export failed: ${e}`);
    }
  }, [project, activeScreen, gameRoot, modRoots, t]);

  const fitToWindow = useCallback(() => {
    const cw = project?.canvasWidth ?? 800;
    const ch = project?.canvasHeight ?? 800;
    const el = document.querySelector("[data-canvas-viewport]");
    const rect = el?.getBoundingClientRect();
    const containerW = rect && rect.width > 0 ? rect.width : window.innerWidth * 0.6;
    const containerH = rect && rect.height > 0 ? rect.height : window.innerHeight * 0.8;
    const scaleX = containerW / cw;
    const scaleY = containerH / ch;
    const newZoom = Math.min(scaleX, scaleY, 2.0);
    const centerX = Math.max(0, (containerW - cw * newZoom) / 2);
    const centerY = Math.max(0, (containerH - ch * newZoom) / 2);
    setZoom(Math.max(0.1, newZoom));
    setPan(centerX, centerY);
  }, [project, setZoom, setPan]);

  const setAllVisibility = useCallback(
    (visible: boolean) => {
      if (!project || !activeScreen) return;
      const prev = structuredClone(project);
      const next = {
        ...project,
        screens: project.screens.map((s) =>
          s.id !== activeScreen.id
            ? s
            : {
                ...s,
                elements: s.elements.map((el) => ({ ...el, isVisible: visible })),
              },
        ),
      };
      executeCommand({
        execute: () => applyProject(structuredClone(next)),
        undo: () => applyProject(prev),
        description: visible ? "Show all" : "Hide all",
      });
    },
    [project, activeScreen, executeCommand, applyProject],
  );

  const tipMuted = light ? "text-slate-500" : "text-slate-400";

  return (
    <div className={bar}>
      <AppTooltip
        light={light}
        title={t("zoom_out")}
        description={t("zoom_level")}
      >
        <button type="button" className={btn} onClick={() => setZoom(Math.max(0.1, zoom / 1.2))}>
          <Minus size={13} />
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("zoom_level")}
        description={t("zoom_level")}
      >
        <input
          type="range"
          min={0.1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-1 w-28 max-w-[35vw] accent-emerald-600"
          aria-label={t("zoom_level")}
        />
      </AppTooltip>
      <AppTooltip light={light} title={t("zoom_in")} description={t("zoom_in")}>
        <button type="button" className={btn} onClick={() => setZoom(Math.min(4, zoom * 1.2))}>
          <ZoomIn size={13} />
        </button>
      </AppTooltip>
      <span className={`w-10 text-right font-mono text-[10px] ${tipMuted}`}>
        {(zoom * 100).toFixed(0)}%
      </span>
      <AppTooltip
        light={light}
        title={t("zoom_actual")}
        description={t("zoom_actual_desc")}
      >
        <button
          type="button"
          className={btn}
          onClick={() => {
            setZoom(1);
            setPan(40, 32);
          }}
        >
          1:1
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("zoom_fit")}
        description={t("zoom_fit_desc")}
      >
        <button type="button" className={btn} onClick={fitToWindow}>
          <Maximize2 size={13} />
        </button>
      </AppTooltip>

      {sep}

      <span className={`text-[10px] ${tipMuted}`}>{t("layer_label")}</span>
      <AppTooltip
        light={light}
        title={t("bring_forward")}
        description={t("bring_forward_desc")}
      >
        <button
          type="button"
          className={btn}
          disabled={!hasSelection}
          onClick={() => changeLayer(1)}
        >
          <ArrowUp size={13} />
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("send_backward")}
        description={t("send_backward_desc")}
      >
        <button
          type="button"
          className={btn}
          disabled={!hasSelection}
          onClick={() => changeLayer(-1)}
        >
          <ArrowDown size={13} />
        </button>
      </AppTooltip>

      {sep}

      <span className={`text-[10px] ${tipMuted}`}>{t("align_label")}</span>
      <AppTooltip light={light} title={t("align_left")} description={t("align_left_desc")}>
        <button type="button" className={btn} disabled={!hasMulti} onClick={() => align("left")}>
          <AlignLeft size={13} />
        </button>
      </AppTooltip>
      <AppTooltip light={light} title={t("align_right")} description={t("align_right_desc")}>
        <button type="button" className={btn} disabled={!hasMulti} onClick={() => align("right")}>
          <AlignRight size={13} />
        </button>
      </AppTooltip>
      <AppTooltip light={light} title={t("align_top")} description={t("align_top_desc")}>
        <button type="button" className={btn} disabled={!hasMulti} onClick={() => align("top")}>
          <AlignVerticalJustifyStart size={13} />
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("align_bottom")}
        description={t("align_bottom_desc")}
      >
        <button type="button" className={btn} disabled={!hasMulti} onClick={() => align("bottom")}>
          <AlignVerticalJustifyEnd size={13} />
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("align_center_h")}
        description={t("align_center_h_desc")}
      >
        <button type="button" className={btn} disabled={!hasMulti} onClick={() => align("centerH")}>
          <AlignHorizontalJustifyCenter size={13} />
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("align_center_v")}
        description={t("align_center_v_desc")}
      >
        <button type="button" className={btn} disabled={!hasMulti} onClick={() => align("centerV")}>
          <AlignVerticalJustifyCenter size={13} />
        </button>
      </AppTooltip>

      {sep}

      <AppTooltip
        light={light}
        title={t("dist_h")}
        description={t("dist_h_desc")}
      >
        <button type="button" className={btn} disabled={!hasMulti3} onClick={() => distribute(true)}>
          <BetweenHorizontalEnd size={13} />
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("dist_v")}
        description={t("dist_v_desc")}
      >
        <button type="button" className={btn} disabled={!hasMulti3} onClick={() => distribute(false)}>
          <BetweenVerticalEnd size={13} />
        </button>
      </AppTooltip>

      {sep}

      <AppTooltip light={light} title={t("show_all")} description={t("show_all_desc")}>
        <button type="button" className={btn} onClick={() => setAllVisibility(true)}>
          <Eye size={13} />
        </button>
      </AppTooltip>
      <AppTooltip light={light} title={t("hide_all")} description={t("hide_all_desc")}>
        <button type="button" className={btn} onClick={() => setAllVisibility(false)}>
          <EyeOff size={13} />
        </button>
      </AppTooltip>

      {sep}

      <AppTooltip
        light={light}
        title={wireframeMode ? t("wireframe_off") : t("wireframe_on")}
        description={wireframeMode ? t("wireframe_off_desc") : t("wireframe_on_desc")}
      >
        <button
          type="button"
          className={`${btn} ${activeAccent(wireframeMode, "border-sky-500 text-sky-700", "border-sky-600 text-sky-300")}`}
          onClick={() => setWireframeMode(!wireframeMode)}
        >
          {wireframeMode ? <Scan size={13} /> : <Box size={13} />}
        </button>
      </AppTooltip>

      <AppTooltip
        light={light}
        title={t("collision")}
        description={t("collision_desc")}
      >
        <button
          type="button"
          className={`${btn} ${activeAccent(showCollisions, "border-red-500 text-red-700", "border-red-600 text-red-400")}`}
          onClick={() => setShowCollisions(!showCollisions)}
        >
          <span className="font-mono text-[10px]">{showCollisions ? "⊠" : "⊡"}</span>
        </button>
      </AppTooltip>

      <AppTooltip
        light={light}
        title={showSelectionChrome ? t("selection_chrome_hide") : t("selection_chrome_show")}
        description={showSelectionChrome ? t("selection_chrome_hide_desc") : t("selection_chrome_show_desc")}
      >
        <button
          type="button"
          className={`${btn} ${activeAccent(showSelectionChrome, "border-violet-500 text-violet-700", "border-violet-500 text-violet-300")}`}
          onClick={() => setShowSelectionChrome(!showSelectionChrome)}
        >
          <Focus size={13} />
        </button>
      </AppTooltip>

      <AppTooltip
        light={light}
        title={
          !hasUv
            ? t("uv_no_model")
            : showUvOverlay
              ? t("uv_hide")
              : t("uv_show")
        }
        description={
          !hasUv
            ? t("uv_no_model_desc")
            : t("uv_show_desc")
        }
      >
        <button
          type="button"
          className={`${btn} ${activeAccent(showUvOverlay && hasUv, "border-cyan-500 text-cyan-700", "border-cyan-500 text-cyan-300")}`}
          disabled={!hasUv}
          onClick={() => setShowUvOverlay(!showUvOverlay)}
        >
          <Grid3x3 size={13} />
        </button>
      </AppTooltip>

      {sep}

      <AppTooltip
        light={light}
        title={t("export_png")}
        description={t("export_png_desc")}
      >
        <button
          type="button"
          className={btn}
          disabled={!gameRoot?.trim()}
          onClick={() => void exportPng()}
        >
          <ImageDown size={13} />
        </button>
      </AppTooltip>
      {!gameRoot?.trim() ? (
        <span className={`text-[10px] ${light ? "text-amber-700" : "text-amber-400"}`}>
          {t("export_png_no_root")}
        </span>
      ) : null}

      {sep}
      <AppTooltip light={light} title={t("view_2d")} description={t("view_2d_desc")}>
        <button
          type="button"
          className={`${btn} ${viewMode === "canvas" ? (light ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-emerald-600 bg-emerald-950/40 text-emerald-300") : ""}`}
          onClick={() => setViewMode("canvas")}
        >
          <span className="px-0.5 text-[10px] font-semibold">2D</span>
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("view_3d")}
        description={t("view_3d_desc")}
      >
        <button
          type="button"
          className={`${btn} ${viewMode === "3d" ? (light ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-emerald-600 bg-emerald-950/40 text-emerald-300") : ""}`}
          onClick={() => setViewMode("3d")}
        >
          <span className="px-0.5 text-[10px] font-semibold">3D</span>
        </button>
      </AppTooltip>
      <AppTooltip
        light={light}
        title={t("view_split")}
        description={t("view_split_desc")}
      >
        <button
          type="button"
          className={`${btn} ${viewMode === "split" ? (light ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-emerald-600 bg-emerald-950/40 text-emerald-300") : ""}`}
          onClick={() => setViewMode("split")}
        >
          <span className="px-0.5 text-[10px] font-semibold">2D|3D</span>
        </button>
      </AppTooltip>

      <span className={`ml-auto inline-flex items-center gap-1 font-mono text-[10px] ${tipMuted}`}>
        <Download size={11} className="opacity-50" />
        pan {Math.round(panX)},{Math.round(panY)}
      </span>
    </div>
  );
}
