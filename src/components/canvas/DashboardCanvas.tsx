import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { useCanvasKeyboard } from "../../hooks/useCanvasKeyboard";
import { PRESET_DRAG_END, PRESET_DRAG_START } from "../../lib/presetDrag";
import { canvasOverlayLabel, findElementAndScreen, mergedEditorElements } from "../../lib/editorElements";
import {
  BOARD_SIZE,
  boardToScs,
  clientToBoard,
  clampCoord,
  elementBoardRect,
  elementEffectiveVisible,
  elementsByName,
  intersectBoardRect,
  pointInBoardRect,
  rectsOverlap,
  snapCoord,
} from "../../lib/scsBoard";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useTelemetryStore } from "../../store/telemetryStore";
import type { DashboardElement, DashboardProject } from "../../types/scs";

export type CanvasKeys = ReturnType<typeof useCanvasKeyboard>;

const HANDLE_RADIUS = 9;

type Handle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

function handleCenters(r: { x: number; y: number; w: number; h: number }): Record<
  Handle,
  { x: number; y: number }
> {
  const { x, y, w, h } = r;
  return {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  };
}

function nearestHandle(
  px: number,
  py: number,
  r: { x: number; y: number; w: number; h: number },
): { handle: Handle; d2: number } | null {
  const pts = handleCenters(r);
  let best: { handle: Handle; d2: number } | null = null;
  (Object.keys(pts) as Handle[]).forEach((h) => {
    const p = pts[h];
    const dx = px - p.x;
    const dy = py - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= HANDLE_RADIUS * HANDLE_RADIUS && (!best || d2 < best.d2)) {
      best = { handle: h, d2 };
    }
  });
  return best;
}

function normalizeBox(
  L: number,
  R: number,
  T: number,
  B: number,
  canvasW: number,
  canvasH: number,
) {
  let nL = L;
  let nR = R;
  let nT = T;
  let nB = B;
  if (nL > nR) [nL, nR] = [nR, nL];
  if (nB > nT) [nB, nT] = [nT, nB];
  nL = clampCoord(nL, canvasW);
  nR = clampCoord(nR, canvasW);
  nT = clampCoord(nT, canvasH);
  nB = clampCoord(nB, canvasH);
  if (nL >= nR) nR = Math.min(canvasW, nL + 1);
  if (nB >= nT) nT = Math.min(canvasH, nB + 1);
  return { coordsL: nL, coordsR: nR, coordsT: nT, coordsB: nB };
}

function applyResizeDelta(
  handle: Handle,
  L: number,
  R: number,
  T: number,
  B: number,
  dwx: number,
  dwy: number,
  canvasW: number,
  canvasH: number,
) {
  let nL = L;
  let nR = R;
  let nT = T;
  let nB = B;
  switch (handle) {
    case "nw":
      nL += dwx;
      nT -= dwy;
      break;
    case "n":
      nT -= dwy;
      break;
    case "ne":
      nR += dwx;
      nT -= dwy;
      break;
    case "e":
      nR += dwx;
      break;
    case "se":
      nR += dwx;
      nB -= dwy;
      break;
    case "s":
      nB -= dwy;
      break;
    case "sw":
      nL += dwx;
      nB -= dwy;
      break;
    case "w":
      nL += dwx;
      break;
  }
  return normalizeBox(nL, nR, nT, nB, canvasW, canvasH);
}

function fillForType(t: DashboardElement["elementType"]): number {
  switch (t) {
    case "text":
      return 0x3b82f6;
    case "textCommon":
      return 0x8b5cf6;
    case "textBar":
      return 0xf59e0b;
    case "gauge":
      return 0x10b981;
    case "group":
      return 0x64748b;
    case "window":
      return 0x475569;
    default:
      return 0x6b7280;
  }
}

type DragState =
  | {
      kind: "pan";
      startPanX: number;
      startPanY: number;
      startSx: number;
      startSy: number;
    }
  | {
      kind: "move";
      /** element id → owning dashboard screen id (uuid) */
      elementScreen: Map<string, string>;
      startBoxes: Map<string, { L: number; R: number; T: number; B: number }>;
      startWx: number;
      startWy: number;
    }
  | {
      kind: "resize";
      screenId: string;
      elementId: string;
      handle: Handle;
      startL: number;
      startR: number;
      startT: number;
      startB: number;
      startWx: number;
      startWy: number;
    }
  | {
      kind: "band";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };

export type PresetDropPayload = { presetId: string; wx: number; wy: number };

export function DashboardCanvas({
  className,
  onPresetDrop,
  canvasKeys,
}: {
  className?: string;
  onPresetDrop?: (payload: PresetDropPayload) => void;
  canvasKeys: CanvasKeys;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const overlayRef = useRef<Container | null>(null);
  const previewSpriteRef = useRef<Sprite | null>(null);
  const rustDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewTokenRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const dragStartSnapshotRef = useRef<DashboardProject | null>(null);
  const spaceRef = useRef(false);
  const rebuildRef = useRef<() => void>(() => {});
  const onPresetDropRef = useRef(onPresetDrop);
  onPresetDropRef.current = onPresetDrop;

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    elementId: string | null;
  } | null>(null);

  const { executeCommand, executeSilent } = useUndoRedo();
  const executeSilentRef = useRef(executeSilent);
  executeSilentRef.current = executeSilent;
  const {
    copy: copyFn,
    cut: cutFn,
    paste: pasteFn,
    deleteSelected: deleteFn,
    selectAll: selectAllFn,
  } = canvasKeys;

  const changeLayerInline = useCallback(
    (delta: number) => {
      const { project, activeScreenId, applyProject } = useProjectStore.getState();
      const { selectedIds } = useCanvasStore.getState();
      if (!project || selectedIds.length === 0) return;
      const prev = structuredClone(project);
      const next = {
        ...project,
        screens: project.screens.map((s) =>
          s.id === activeScreenId
            ? {
                ...s,
                elements: s.elements.map((el) =>
                  selectedIds.includes(el.id) ? { ...el, layer: el.layer + delta } : el,
                ),
              }
            : s,
        ),
      };
      executeCommand({
        execute: () => applyProject(structuredClone(next)),
        undo: () => applyProject(prev),
        description: delta > 0 ? "Bring forward" : "Send backward",
      });
    },
    [executeCommand],
  );

  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const renderRevision = useTelemetryStore((s) => s.renderRevision);
  const settingsGameRoot = useSettingsStore((s) => s.gameRootPath);
  const modRootPaths = useSettingsStore((s) => s.modRootPaths);
  const wireframeMode = useCanvasStore((s) => s.wireframeMode);
  const isLight = useAppThemeIsLight();
  const isLightRef = useRef(isLight);
  isLightRef.current = isLight;

  const ctxMenuItemCls = isLight
    ? "block w-full px-3 py-1.5 text-left hover:bg-slate-100"
    : "block w-full px-3 py-1.5 text-left hover:bg-slate-800";
  const ctxMenuSepCls = isLight
    ? "mx-2 my-0.5 border-t border-slate-200"
    : "mx-2 my-0.5 border-t border-slate-700";
  const ctxMenuDelCls = isLight
    ? "block w-full px-3 py-1.5 text-left text-red-700 hover:bg-red-50"
    : "block w-full px-3 py-1.5 text-left text-red-300 hover:bg-slate-800";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const app = new Application();

    const rebuildScene = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      overlay.removeChildren();

      const project = useProjectStore.getState().project;
      const activeScreenId = useProjectStore.getState().activeScreenId;
      const screen =
        project?.screens.find((s) => s.id === activeScreenId) ?? project?.screens[0];

      const canvasW = project?.canvasWidth ?? BOARD_SIZE;
      const canvasH = project?.canvasHeight ?? BOARD_SIZE;

      const canvas = useCanvasStore.getState();
      const { showGrid, gridSize, selectedIds, showSelectionChrome } = canvas;

      const gGrid = new Graphics();
      const gBoard = new Graphics();
      gBoard.rect(0, 0, canvasW, canvasH);
      gBoard.stroke({ width: 1, color: 0x475569, alpha: 0.9 });

      if (showGrid) {
        for (let x = 0; x <= canvasW; x += gridSize) {
          gGrid
            .moveTo(x, 0)
            .lineTo(x, canvasH)
            .stroke({ width: 1, color: 0x334155, alpha: 0.35 });
        }
        for (let y = 0; y <= canvasH; y += gridSize) {
          gGrid
            .moveTo(0, y)
            .lineTo(canvasW, y)
            .stroke({ width: 1, color: 0x334155, alpha: 0.35 });
        }
      }

      overlay.addChild(gGrid);
      overlay.addChild(gBoard);

      // UV wireframe overlay — drawn on top of the grid but behind elements so
      // users can line their elements up with the physical display UV regions
      // of the loaded 3D model. V=0 is at the top of the texture (DirectX
      // convention); coordinates outside [0,1] are wrapped with `frac` so tiled
      // UVs collapse onto the board, matching the 3D viewer's sampling.
      const uvEdges = useCanvasStore.getState().uvEdges;
      const showUvOverlay = useCanvasStore.getState().showUvOverlay;
      if (uvEdges && showUvOverlay && uvEdges.length > 0) {
        const gUv = new Graphics();
        const frac = (x: number) => ((x % 1) + 1) % 1;
        for (const [u0, v0, u1, v1] of uvEdges) {
          gUv.moveTo(frac(u0) * canvasW, frac(v0) * canvasH);
          gUv.lineTo(frac(u1) * canvasW, frac(v1) * canvasH);
        }
        gUv.stroke({ width: 1, color: 0x22d3ee, alpha: 0.9 });
        overlay.addChild(gUv);
      }

      if (!screen) return;

      const sharedScreen = project?.screens.find(
        (s) => s.screenId === 950 && s.id !== screen.id,
      );
      const allElements = [...(sharedScreen?.elements ?? []), ...screen.elements];
      const byNameAll = elementsByName(allElements);
      const sorted = [...allElements].sort((a, b) => a.layer - b.layer);
      const vis = allElements.filter((e) => elementEffectiveVisible(e, byNameAll));

      const wireframe = useCanvasStore.getState().wireframeMode ?? false;
      const showColl = useCanvasStore.getState().showCollisions ?? false;
      const FILL_ALPHA = wireframe ? 0.45 : 0.0;
      const STROKE_ALPHA = wireframe ? 0.8 : 0.3;

      const byId = new Map(allElements.map((e) => [e.id, e]));

      if (showColl) {
        for (let i = 0; i < vis.length; i++) {
          for (let j = i + 1; j < vis.length; j++) {
            if (vis[i].layer !== vis[j].layer) continue;
            const ra = elementBoardRect(vis[i], canvasH);
            const rb = elementBoardRect(vis[j], canvasH);
            if (!rectsOverlap(ra, rb)) continue;
            const ix = intersectBoardRect(ra, rb);
            if (!ix) continue;
            const cg = new Graphics();
            cg.rect(ix.x, ix.y, ix.w, ix.h);
            cg.fill({ color: 0xef4444, alpha: wireframe ? 0.3 : 0.15 });
            overlay.addChild(cg);
          }
        }
      }

      const hoveredId = canvas.hoveredId;

      for (const el of sorted) {
        if (!elementEffectiveVisible(el, byNameAll)) continue;
        const r = elementBoardRect(el, canvasH);
        const gr = new Graphics();
        gr.rect(r.x, r.y, r.w, r.h);
        const fill = fillForType(el.elementType);
        const isSel = showSelectionChrome && selectedIds.includes(el.id);
        if (wireframe) {
          const fillAlpha = el.id === hoveredId ? FILL_ALPHA + 0.08 : FILL_ALPHA;
          gr.fill({ color: fill, alpha: fillAlpha });
        }
        gr.stroke({
          width: isSel ? 2 : 0.5,
          color: isSel ? 0xfacc15 : fill,
          alpha: STROKE_ALPHA,
        });
        overlay.addChild(gr);
      }

      const sel = selectedIds
        .map((id) => byId.get(id))
        .filter((e): e is DashboardElement => !!e);

      if (showSelectionChrome && sel.length === 1) {
        const el = sel[0];
        const r = elementBoardRect(el, canvasH);
        const hc = handleCenters(r);
        (Object.values(hc) as { x: number; y: number }[]).forEach((p) => {
          const h = new Graphics();
          h.circle(p.x, p.y, 5);
          h.fill({ color: 0xfacc15, alpha: 1 });
          h.stroke({ width: 1, color: 0x1e293b, alpha: 1 });
          overlay.addChild(h);
        });
      }

      if (showSelectionChrome) {
        for (const el of sel) {
          const r = elementBoardRect(el, canvasH);
          const label = canvasOverlayLabel(el);
          if (!label || r.w < 8) continue;
          const t = new Text({
            text: label,
            style: {
              fontSize: 11,
              fill: 0xfacc15,
              fontFamily: "ui-monospace, monospace",
            },
          });
          t.x = r.x;
          t.y = Math.max(0, r.y - 14);
          overlay.addChild(t);
        }
      }

      const band = dragRef.current;
      if (band?.kind === "band") {
        const x = Math.min(band.x0, band.x1);
        const y = Math.min(band.y0, band.y1);
        const w = Math.abs(band.x1 - band.x0);
        const h = Math.abs(band.y1 - band.y0);
        const bg = new Graphics();
        bg.rect(x, y, w, h);
        bg.fill({ color: 0x22c55e, alpha: 0.12 });
        bg.stroke({ width: 1, color: 0x22c55e, alpha: 0.8 });
        overlay.addChild(bg);
      }
    };

    rebuildRef.current = rebuildScene;

    void (async () => {
      const bg = isLightRef.current ? 0xf1f5f9 : 0x020617;
      await app.init({
        resizeTo: host,
        background: bg,
        antialias: true,
        autoDensity: true,
        resolution: typeof window !== "undefined" ? window.devicePixelRatio : 1,
        preserveDrawingBuffer: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }

      host.appendChild(app.canvas);
      appRef.current = app;

      const world = new Container();
      worldRef.current = world;

      const preview = new Sprite(Texture.EMPTY);
      preview.eventMode = "none";
      preview.width = 0;
      preview.height = 0;
      preview.position.set(0, 0);
      previewSpriteRef.current = preview;

      const overlay = new Container();
      overlayRef.current = overlay;

      world.addChild(preview);
      world.addChild(overlay);
      app.stage.addChild(world);

      const canvasToWorld = (sx: number, sy: number) => {
        const z = useCanvasStore.getState().zoom;
        const px = useCanvasStore.getState().panX;
        const py = useCanvasStore.getState().panY;
        return { wx: (sx - px) / z, wy: (sy - py) / z };
      };

      const hitTestTop = (wx: number, wy: number): DashboardElement | null => {
        const proj = useProjectStore.getState().project;
        const bh = proj?.canvasHeight ?? BOARD_SIZE;
        const st =
          proj?.screens.find(
            (s) => s.id === useProjectStore.getState().activeScreenId,
          ) ?? proj?.screens[0];
        if (!st || !proj) return null;
        const merged = mergedEditorElements(proj, st);
        const byName = elementsByName(merged);
        const vis = merged.filter((e) => elementEffectiveVisible(e, byName));
        const sorted = [...vis].sort((a, b) => b.layer - a.layer);
        for (const el of sorted) {
          if (pointInBoardRect(wx, wy, elementBoardRect(el, bh))) return el;
        }
        return null;
      };

      const onMove = (ev: FederatedPointerEvent) => {
        const sx = ev.globalX;
        const sy = ev.globalY;
        const { wx, wy } = canvasToWorld(sx, sy);
        const proj = useProjectStore.getState().project;
        const cw = proj?.canvasWidth ?? BOARD_SIZE;
        const ch = proj?.canvasHeight ?? BOARD_SIZE;
        const { sx: scsX, sy: scsY } = boardToScs(wx, wy, ch);
        useCanvasStore.getState().setMouseScs(scsX, scsY);

        const hov = hitTestTop(wx, wy);
        useCanvasStore.getState().setHovered(hov?.id ?? null);

        const drag = dragRef.current;
        if (!drag) return;

        if (drag.kind === "pan") {
          const dx = sx - drag.startSx;
          const dy = sy - drag.startSy;
          let newPanX = drag.startPanX + dx;
          let newPanY = drag.startPanY + dy;
          const proj = useProjectStore.getState().project;
          const boardW = proj?.canvasWidth ?? BOARD_SIZE;
          const boardH = proj?.canvasHeight ?? BOARD_SIZE;
          const z = useCanvasStore.getState().zoom;
          const rect = app.canvas.getBoundingClientRect();
          const containerW = rect.width;
          const containerH = rect.height;
          newPanX = Math.max(
            -(boardW * z * 1.5),
            Math.min(containerW + boardW * z * 0.5, newPanX),
          );
          newPanY = Math.max(
            -(boardH * z * 1.5),
            Math.min(containerH + boardH * z * 0.5, newPanY),
          );
          useCanvasStore.getState().setPan(newPanX, newPanY);
          return;
        }

        if (drag.kind === "band") {
          drag.x1 = wx;
          drag.y1 = wy;
          rebuildScene();
          return;
        }

        if (drag.kind === "move") {
          const dwx = wx - drag.startWx;
          const dwy = wy - drag.startWy;
          const g = useCanvasStore.getState().gridSize;
          const snap = useCanvasStore.getState().snapEnabled;
          for (const [id, box] of drag.startBoxes) {
            let L = box.L + dwx;
            let R = box.R + dwx;
            let T = box.T - dwy;
            let B = box.B - dwy;
            if (snap) {
              L = snapCoord(L, g, true);
              R = snapCoord(R, g, true);
              T = snapCoord(T, g, true);
              B = snapCoord(B, g, true);
            }
            const n = normalizeBox(L, R, T, B, cw, ch);
            const sid = drag.elementScreen.get(id);
            if (sid) useProjectStore.getState().updateElement(sid, id, n);
          }
          rebuildScene();
          return;
        }

        if (drag.kind === "resize") {
          const dwx = wx - drag.startWx;
          const dwy = wy - drag.startWy;
          const g = useCanvasStore.getState().gridSize;
          const snap = useCanvasStore.getState().snapEnabled;
          let next = applyResizeDelta(
            drag.handle,
            drag.startL,
            drag.startR,
            drag.startT,
            drag.startB,
            dwx,
            dwy,
            cw,
            ch,
          );
          if (snap) {
            next = {
              coordsL: snapCoord(next.coordsL, g, true),
              coordsR: snapCoord(next.coordsR, g, true),
              coordsT: snapCoord(next.coordsT, g, true),
              coordsB: snapCoord(next.coordsB, g, true),
            };
            next = normalizeBox(next.coordsL, next.coordsR, next.coordsT, next.coordsB, cw, ch);
          }
          useProjectStore.getState().updateElement(drag.screenId, drag.elementId, next);
          rebuildScene();
        }
      };

      const endDrag = () => {
        const drag = dragRef.current;

        if (drag?.kind === "move" || drag?.kind === "resize") {
          const snapshot = dragStartSnapshotRef.current;
          const finalProject = structuredClone(useProjectStore.getState().project);
          if (snapshot && finalProject) {
            const { applyProject } = useProjectStore.getState();
            const prev = snapshot;
            const next = finalProject;
            const desc =
              drag.kind === "move"
                ? `Move ${String(drag.startBoxes.size)} element(s)`
                : "Resize element";
            executeSilentRef.current({
              execute: () => applyProject(structuredClone(next)),
              undo: () => applyProject(structuredClone(prev)),
              description: desc,
            });
          }
          dragStartSnapshotRef.current = null;
        }

        if (drag?.kind === "band") {
          const b = drag;
          const x0 = Math.min(b.x0, b.x1);
          const y0 = Math.min(b.y0, b.y1);
          const x1 = Math.max(b.x0, b.x1);
          const y1 = Math.max(b.y0, b.y1);
          const bandRect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
          const proj = useProjectStore.getState().project;
          const bh = proj?.canvasHeight ?? BOARD_SIZE;
          const st =
            proj?.screens.find(
              (s) => s.id === useProjectStore.getState().activeScreenId,
            ) ?? proj?.screens[0];
          if (st && proj && bandRect.w > 2 && bandRect.h > 2) {
            const picked: string[] = [];
            const merged = mergedEditorElements(proj, st);
            const byNameBand = elementsByName(merged);
            for (const el of merged) {
              if (!elementEffectiveVisible(el, byNameBand)) continue;
              const er = elementBoardRect(el, bh);
              if (rectsOverlap(bandRect, er)) picked.push(el.id);
            }
            if (picked.length) useCanvasStore.getState().setSelection(picked);
          }
        }
        dragRef.current = null;
        rebuildScene();
      };

      const onDown = (ev: FederatedPointerEvent) => {
        // Middle mouse button OR space bar → always pan, no hit testing
        if (ev.button === 1 || spaceRef.current) {
          const sx = ev.globalX;
          const sy = ev.globalY;
          ev.stopPropagation();
          dragRef.current = {
            kind: "pan",
            startPanX: useCanvasStore.getState().panX,
            startPanY: useCanvasStore.getState().panY,
            startSx: sx,
            startSy: sy,
          };
          return;
        }

        const sx = ev.globalX;
        const sy = ev.globalY;
        const { wx, wy } = canvasToWorld(sx, sy);
        const proj = useProjectStore.getState().project;
        const bh = proj?.canvasHeight ?? BOARD_SIZE;
        const screen =
          proj?.screens.find(
            (s) => s.id === useProjectStore.getState().activeScreenId,
          ) ?? proj?.screens[0];
        if (!screen) return;

        const selIds = useCanvasStore.getState().selectedIds;

        if (selIds.length === 1 && proj) {
          const found = findElementAndScreen(proj, selIds[0]);
          const el = found?.element;
          if (el && found.screen) {
            const hr = nearestHandle(wx, wy, elementBoardRect(el, bh));
            if (hr) {
              dragStartSnapshotRef.current = structuredClone(useProjectStore.getState().project!);
              dragRef.current = {
                kind: "resize",
                screenId: found.screen.id,
                elementId: el.id,
                handle: hr.handle,
                startL: el.coordsL,
                startR: el.coordsR,
                startT: el.coordsT,
                startB: el.coordsB,
                startWx: wx,
                startWy: wy,
              };
              ev.stopPropagation();
              return;
            }
          }
        }

        const hit = hitTestTop(wx, wy);
        if (hit) {
          const ctrl = ev.ctrlKey || ev.metaKey;
          if (ctrl) {
            useCanvasStore.getState().toggleSelected(hit.id);
            const nowSel = useCanvasStore.getState().selectedIds;
            if (!nowSel.includes(hit.id)) {
              rebuildScene();
              return;
            }
          } else if (!selIds.includes(hit.id)) {
            useCanvasStore.getState().setSelection([hit.id]);
          }

          const moveIds = useCanvasStore.getState().selectedIds;
          const startBoxes = new Map<string, { L: number; R: number; T: number; B: number }>();
          const elementScreen = new Map<string, string>();
          if (proj) {
            for (const id of moveIds) {
              const found = findElementAndScreen(proj, id);
              if (!found) continue;
              const e = found.element;
              startBoxes.set(id, {
                L: e.coordsL,
                R: e.coordsR,
                T: e.coordsT,
                B: e.coordsB,
              });
              elementScreen.set(id, found.screen.id);
            }
          }
          dragStartSnapshotRef.current = structuredClone(useProjectStore.getState().project!);
          dragRef.current = {
            kind: "move",
            elementScreen,
            startBoxes,
            startWx: wx,
            startWy: wy,
          };
          rebuildScene();
          return;
        }

        if (ev.button === 0) {
          dragRef.current = { kind: "band", x0: wx, y0: wy, x1: wx, y1: wy };
          if (!ev.shiftKey) useCanvasStore.getState().setSelection([]);
          rebuildScene();
        }
      };

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        const z0 = useCanvasStore.getState().zoom;
        const px0 = useCanvasStore.getState().panX;
        const py0 = useCanvasStore.getState().panY;
        const wx = (sx - px0) / z0;
        const wy = (sy - py0) / z0;
        const factor = Math.exp(-ev.deltaY * 0.0015);
        const z1 = Math.min(4, Math.max(0.1, z0 * factor));
        const px1 = sx - wx * z1;
        const py1 = sy - wy * z1;
        useCanvasStore.getState().setZoom(z1);
        useCanvasStore.getState().setPan(px1, py1);
        rebuildScene();
      };

      app.canvas.addEventListener("wheel", onWheel, { passive: false });

      const onNativePointerDown = (e: PointerEvent) => {
        if (e.button === 1) e.preventDefault();
      };
      app.canvas.addEventListener("pointerdown", onNativePointerDown);

      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointermove", onMove);
      app.stage.on("pointerdown", onDown);
      app.stage.on("pointerup", endDrag);
      app.stage.on("pointerupoutside", endDrag);

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          spaceRef.current = true;
          e.preventDefault();
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") spaceRef.current = false;
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      const unsubProject = useProjectStore.subscribe(rebuildScene);
      const unsubCanvas = useCanvasStore.subscribe(rebuildScene);

      rebuildScene();

      const peStart = () => {
        app.canvas.style.pointerEvents = "none";
      };
      const peEnd = () => {
        app.canvas.style.pointerEvents = "auto";
      };
      window.addEventListener(PRESET_DRAG_START, peStart);
      window.addEventListener(PRESET_DRAG_END, peEnd);

      cleanup = () => {
        unsubProject();
        unsubCanvas();
        window.removeEventListener(PRESET_DRAG_START, peStart);
        window.removeEventListener(PRESET_DRAG_END, peEnd);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        app.canvas.removeEventListener("pointerdown", onNativePointerDown);
        app.canvas.removeEventListener("wheel", onWheel);
        app.stage.off("pointermove", onMove);
        app.stage.off("pointerdown", onDown);
        app.stage.off("pointerup", endDrag);
        app.stage.off("pointerupoutside", endDrag);
        app.destroy(true, { children: true, texture: true });
        appRef.current = null;
        worldRef.current = null;
        overlayRef.current = null;
        previewSpriteRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const zoom = useCanvasStore((s) => s.zoom);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.position.set(panX, panY);
    world.scale.set(zoom);
    rebuildRef.current();
  }, [zoom, panX, panY]);

  useEffect(() => {
    const app = appRef.current;
    if (!app?.renderer) return;
    app.renderer.background.color = isLight ? 0xf1f5f9 : 0x020617;
  }, [isLight]);

  useEffect(() => {
    previewTokenRef.current += 1;
    const myToken = previewTokenRef.current;
    const sprite = previewSpriteRef.current;
    const effectiveRoot =
      project?.gameRootPath?.trim() || settingsGameRoot?.trim() || "";

    if (wireframeMode) {
      if (sprite) sprite.texture = Texture.EMPTY;
      return;
    }

    if (!sprite || !effectiveRoot || !project) {
      if (sprite) sprite.texture = Texture.EMPTY;
      return;
    }
    const screen =
      project.screens.find((s) => s.id === activeScreenId) ?? project.screens[0];
    if (!screen) return;

    clearTimeout(rustDebounceRef.current);
    rustDebounceRef.current = setTimeout(() => {
      void (async () => {
        const merged = useTelemetryStore.getState().mergedMap();
        const telemetryOverrides: Record<string, number> = {};
        for (const [k, v] of Object.entries(merged)) {
          telemetryOverrides[String(k)] = v;
        }
        const mods = modRootPaths.map((p) => p.trim()).filter(Boolean);
        try {
          const b64 = await invoke<string | null>("render_screen_preview_png_b64", {
            project: { ...project, gameRootPath: effectiveRoot },
            screenId: screen.screenId,
            size: Math.max(project.canvasWidth ?? 800, project.canvasHeight ?? 800),
            modRoots: mods.length ? mods : null,
            telemetryOverrides:
              Object.keys(telemetryOverrides).length > 0 ? telemetryOverrides : null,
          });
          if (myToken !== previewTokenRef.current) return;
          const sp = previewSpriteRef.current;
          if (!b64 || !sp) return;
          const img = new Image();
          img.decoding = "async";
          img.src = `data:image/png;base64,${b64}`;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("preview image load failed"));
          });
          if (myToken !== previewTokenRef.current) return;
          sp.texture = Texture.from(img);
          sp.position.set(0, 0);
          sp.width = project.canvasWidth ?? 800;
          sp.height = project.canvasHeight ?? 800;
        } catch (e) {
          console.warn("[Canvas] Rust render failed:", e);
        }
      })();
    }, 350);
    return () => clearTimeout(rustDebounceRef.current);
  }, [
    project,
    activeScreenId,
    renderRevision,
    settingsGameRoot,
    modRootPaths,
    wireframeMode,
  ]);

  const onDragOver =
    onPresetDrop != null
      ? (e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      : undefined;

  const onDrop =
    onPresetDrop != null
      ? (e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          const fn = onPresetDropRef.current;
          const host = hostRef.current;
          if (!fn || !host) return;
          const presetId = e.dataTransfer.getData("text/preset");
          if (!presetId) return;
          const rect = host.getBoundingClientRect();
          const z = useCanvasStore.getState().zoom;
          const px = useCanvasStore.getState().panX;
          const py = useCanvasStore.getState().panY;
          const { wx, wy } = clientToBoard(e.clientX, e.clientY, rect, px, py, z);
          fn({ presetId, wx, wy });
        }
      : undefined;

  return (
    <>
      <div
        ref={hostRef}
        className={className}
        style={{ width: "100%", height: "100%", minHeight: 360 }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          const bRect = hostRef.current?.getBoundingClientRect();
          if (!bRect) return;
          const z = useCanvasStore.getState().zoom;
          const px = useCanvasStore.getState().panX;
          const py = useCanvasStore.getState().panY;
          const { wx: bx, wy: by } = clientToBoard(e.clientX, e.clientY, bRect, px, py, z);
          const proj = useProjectStore.getState().project;
          const aid = useProjectStore.getState().activeScreenId;
          const scr = proj?.screens.find((s) => s.id === aid) ?? proj?.screens[0];
          const bh = proj?.canvasHeight ?? BOARD_SIZE;
          const byNameCtx = elementsByName(scr?.elements ?? []);
          const hit = [...(scr?.elements ?? [])]
            .filter((el) => elementEffectiveVisible(el, byNameCtx))
            .sort((a, b) => b.layer - a.layer)
            .find((el) => pointInBoardRect(bx, by, elementBoardRect(el, bh)));
          setCtxMenu({ x: e.clientX, y: e.clientY, elementId: hit?.id ?? null });
        }}
      />
      {ctxMenu ? (
        <>
          <div
            className="fixed inset-0 z-[150]"
            onClick={() => setCtxMenu(null)}
            onContextMenu={(ev) => {
              ev.preventDefault();
              setCtxMenu(null);
            }}
            aria-hidden
          />
          <ul
            className={
              isLight
                ? "fixed z-[160] min-w-[11rem] rounded-lg border border-slate-300 bg-white py-1 text-xs text-slate-800 shadow-2xl"
                : "fixed z-[160] min-w-[11rem] rounded-lg border border-slate-700 bg-slate-900 py-1 text-xs text-slate-200 shadow-2xl"
            }
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 210),
              top: Math.min(ctxMenu.y, window.innerHeight - 280),
            }}
          >
            {ctxMenu.elementId ? (
              <>
                <li>
                  <button
                    type="button"
                    className={ctxMenuItemCls}
                    onClick={() => {
                      copyFn();
                      setCtxMenu(null);
                    }}
                  >
                    Copy{" "}
                    <span className="float-right text-[10px] text-slate-500">Ctrl+C</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={ctxMenuItemCls}
                    onClick={() => {
                      cutFn();
                      setCtxMenu(null);
                    }}
                  >
                    Cut <span className="float-right text-[10px] text-slate-500">Ctrl+X</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={ctxMenuDelCls}
                    onClick={() => {
                      deleteFn();
                      setCtxMenu(null);
                    }}
                  >
                    Delete <span className="float-right text-[10px] text-slate-500">Del</span>
                  </button>
                </li>
                <li className={ctxMenuSepCls} />
                <li>
                  <button
                    type="button"
                    className={ctxMenuItemCls}
                    onClick={() => {
                      changeLayerInline(1);
                      setCtxMenu(null);
                    }}
                  >
                    ▲ Bring Forward
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={ctxMenuItemCls}
                    onClick={() => {
                      changeLayerInline(-1);
                      setCtxMenu(null);
                    }}
                  >
                    ▼ Send Backward
                  </button>
                </li>
                <li className={ctxMenuSepCls} />
              </>
            ) : null}
            <li>
              <button
                type="button"
                className={ctxMenuItemCls}
                onClick={() => {
                  pasteFn();
                  setCtxMenu(null);
                }}
              >
                Paste <span className="float-right text-[10px] text-slate-500">Ctrl+V</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={ctxMenuItemCls}
                onClick={() => {
                  selectAllFn();
                  setCtxMenu(null);
                }}
              >
                Select All{" "}
                <span className="float-right text-[10px] text-slate-500">Ctrl+A</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={ctxMenuItemCls}
                onClick={() => {
                  useCanvasStore.getState().clearSelection();
                  setCtxMenu(null);
                }}
              >
                Deselect
              </button>
            </li>
            <li className={ctxMenuSepCls} />
            <li>
              <button
                type="button"
                className={ctxMenuItemCls}
                onClick={() => {
                  useCanvasStore.getState().setZoom(1);
                  useCanvasStore.getState().setPan(40, 32);
                  setCtxMenu(null);
                }}
              >
                Reset View
              </button>
            </li>
          </ul>
        </>
      ) : null}
    </>
  );
}
