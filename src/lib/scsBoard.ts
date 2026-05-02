import type { DashboardElement } from "../types/scs";

/** Default virtual board edge when project has no canvas size (legacy 800×800). */
export const BOARD_SIZE = 800;

/** Top-left origin, Y downward (matches Pixi / screen), units = SCS virtual px. */
export type BoardRect = { x: number; y: number; w: number; h: number };

export function elementBoardRect(el: DashboardElement, boardH: number): BoardRect {
  const L = el.coordsL;
  const R = el.coordsR;
  const T = el.coordsT;
  const B = el.coordsB;
  return {
    x: L,
    y: boardH - T,
    w: R - L,
    h: T - B,
  };
}

export function boardToScs(
  x: number,
  y: number,
  boardH: number,
): { sx: number; sy: number } {
  return { sx: x, sy: boardH - y };
}

export function scsToBoard(sx: number, sy: number, boardH: number): { x: number; y: number } {
  return { x: sx, y: boardH - sy };
}

export function pointInBoardRect(px: number, py: number, r: BoardRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function rectsOverlap(a: BoardRect, b: BoardRect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function intersectBoardRect(a: BoardRect, b: BoardRect): BoardRect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return null;
  return { x: x1, y: y1, w, h };
}

/** Clamp a coordinate to `[0, max]` (use `canvasWidth` for L/R, `canvasHeight` for T/B). */
export function clampCoord(v: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(v)));
}

export function snapCoord(v: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return Math.round(v);
  return Math.round(v / grid) * grid;
}

/** Pointer position relative to canvas host → board (world) coords. */
export function clientToBoard(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  panX: number,
  panY: number,
  zoom: number,
): { wx: number; wy: number } {
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return { wx: (sx - panX) / zoom, wy: (sy - panY) / zoom };
}

const MAX_VIS_DEPTH = 128;

/** `name` → element (last wins if duplicate names). */
export function elementsByName(elements: DashboardElement[]): Map<string, DashboardElement> {
  const m = new Map<string, DashboardElement>();
  for (const e of elements) {
    if (e.name) m.set(e.name, e);
  }
  return m;
}

/**
 * True when this element and every named `parentName` ancestor is locally visible.
 * Missing parent names do not hide the element.
 */
export function elementEffectiveVisible(
  el: DashboardElement,
  byName: Map<string, DashboardElement>,
): boolean {
  let cur: DashboardElement | undefined = el;
  for (let d = 0; d < MAX_VIS_DEPTH && cur; d++) {
    if (!cur.isVisible) return false;
    const pn = cur.parentName?.trim();
    if (!pn) return true;
    cur = byName.get(pn);
    if (!cur) return true;
  }
  return false;
}
