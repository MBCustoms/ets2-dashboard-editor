import { invoke } from "@tauri-apps/api/core";

import type { DashboardElement, DashboardProject, DashboardScreen, TextTemplate } from "../types/scs";

import { clampCoord } from "./scsBoard";

/** Export / UI order: 950, then 100–800 ascending, then 900. */
export function compareScreens(a: DashboardScreen, b: DashboardScreen): number {
  const ka = sortKey(a.screenId);
  const kb = sortKey(b.screenId);
  if (ka !== kb) return ka - kb;
  return a.displayName.localeCompare(b.displayName);
}

function sortKey(screenId: number): number {
  if (screenId === 950) return -1000;
  if (screenId === 900) return 100000;
  if (screenId >= 100 && screenId <= 800) return screenId;
  return screenId + 50000;
}

export function sortScreensInPlace(project: DashboardProject): DashboardProject {
  return {
    ...project,
    screens: [...project.screens].sort(compareScreens),
  };
}

export function nextAvailableScreenId(screens: DashboardScreen[]): number {
  const used = new Set(screens.map((s) => s.screenId));
  for (let id = 100; id <= 800; id += 100) {
    if (!used.has(id)) return id;
  }
  for (let id = 100; id <= 800; id++) {
    if (!used.has(id)) return id;
  }
  return 801;
}

export function projectAddScreen(
  project: DashboardProject,
  screen: DashboardScreen,
): DashboardProject {
  return sortScreensInPlace({
    ...project,
    screens: [...project.screens, screen],
  });
}

export function projectRemoveScreen(
  project: DashboardProject,
  screenId: string,
): DashboardProject {
  return {
    ...project,
    screens: project.screens.filter((s) => s.id !== screenId),
  };
}

export function projectReorderScreens(
  project: DashboardProject,
  orderedScreenIds: string[],
): DashboardProject {
  const map = new Map(project.screens.map((s) => [s.id, s]));
  const next: DashboardScreen[] = [];
  for (const id of orderedScreenIds) {
    const s = map.get(id);
    if (s) next.push(s);
  }
  for (const s of project.screens) {
    if (!orderedScreenIds.includes(s.id)) next.push(s);
  }
  return { ...project, screens: next };
}

export function projectAddElement(
  project: DashboardProject,
  screenId: string,
  element: DashboardElement,
): DashboardProject {
  return {
    ...project,
    screens: project.screens.map((s) => {
      if (s.id !== screenId) return s;
      const rootName = s.unitName;
      const rootIdx = s.elements.findIndex(
        (e) => e.name === rootName && e.elementType === "group",
      );
      const parentName = element.parentName?.trim() || rootName;
      const newEl: DashboardElement = { ...element, parentName };
      if (rootIdx >= 0 && parentName === rootName) {
        const root = s.elements[rootIdx];
        const childNames = root.childNames.includes(newEl.name)
          ? root.childNames
          : [...root.childNames, newEl.name];
        const newRoot: DashboardElement = { ...root, childNames };
        const elems = s.elements.map((e, i) => (i === rootIdx ? newRoot : e));
        return { ...s, elements: [...elems, newEl] };
      }
      return { ...s, elements: [...s.elements, newEl] };
    }),
  };
}

export function projectRemoveElement(
  project: DashboardProject,
  screenId: string,
  elementId: string,
): DashboardProject {
  return {
    ...project,
    screens: project.screens.map((s) =>
      s.id === screenId
        ? { ...s, elements: s.elements.filter((e) => e.id !== elementId) }
        : s,
    ),
  };
}

export function projectSetTemplates(
  project: DashboardProject,
  templates: TextTemplate[],
): DashboardProject {
  return { ...project, templates };
}

/** Board-space center (cx, cy) → SCS L/R/T/B; clamps to canvas size. */
export function scsBoxFromBoardCenter(
  cx: number,
  cy: number,
  width: number,
  height: number,
  boardW: number,
  boardH: number,
): { coordsL: number; coordsR: number; coordsT: number; coordsB: number } {
  const halfW = width / 2;
  const halfH = height / 2;
  let L = Math.round(cx - halfW);
  let R = Math.round(cx + halfW);
  let T = Math.round(boardH - cy + halfH);
  let B = Math.round(boardH - cy - halfH);
  L = clampCoord(L, boardW);
  R = clampCoord(R, boardW);
  T = clampCoord(T, boardH);
  B = clampCoord(B, boardH);
  if (L >= R) R = Math.min(boardW, L + 1);
  if (B >= T) T = Math.min(boardH, B + 1);
  return { coordsL: L, coordsR: R, coordsT: T, coordsB: B };
}

/** Merge templates from a standalone `dashboard_text.*.sii` (or any SII with `ui::text_template`). */
export async function importTemplatesFromSii(
  path: string,
  project: DashboardProject,
): Promise<DashboardProject> {
  const templates = await invoke<TextTemplate[]>("import_templates_from_sii", { path });
  const merged = [...project.templates];
  for (const t of templates) {
    const idx = merged.findIndex((m) => m.name === t.name);
    if (idx >= 0) merged[idx] = t;
    else merged.push(t);
  }
  return { ...project, templates: merged };
}
