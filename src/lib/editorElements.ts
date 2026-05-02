import type { DashboardElement, DashboardProject, DashboardScreen } from "../types/scs";

/** Shared dashboard screen (SCS id 950), if present in the project. */
export function sharedScreen950(project: DashboardProject | null): DashboardScreen | null {
  if (!project) return null;
  return project.screens.find((s) => s.screenId === 950) ?? null;
}

/**
 * Drops the shared (950) screen root `ui::group` from the flat element list so Layers does not show a
 * redundant “display950” group row; children (e.g. elec 10/20) stay listed.
 */
export function filterLayerTreeElements(
  project: DashboardProject,
  elements: DashboardElement[],
): DashboardElement[] {
  const shared = sharedScreen950(project);
  if (!shared) return elements;
  const rootName = shared.unitName.trim();
  return elements.filter(
    (e) =>
      !(
        e.elementType === "group" &&
        e.name.trim() === rootName &&
        e.dashboardId === 950
      ),
  );
}

/** True when `el` is a direct child of the shared (950) screen root (parent = screen unit name). */
export function isDirectChildOfSharedScreenRoot(
  project: DashboardProject,
  el: DashboardElement,
): boolean {
  const shared = sharedScreen950(project);
  if (!shared) return false;
  const unit = shared.unitName.trim();
  const pn = el.parentName?.trim() ?? "";
  return pn === unit && el.name.trim() !== unit;
}

/**
 * Elements shown in the layer tree and hit-tested on the canvas when editing a normal screen:
 * shared (950) elements first, then the active screen (matches composited preview order).
 */
export function mergedEditorElements(
  project: DashboardProject,
  activeScreen: DashboardScreen,
): DashboardElement[] {
  const shared = sharedScreen950(project);
  if (!shared || activeScreen.screenId === 950 || shared.id === activeScreen.id) {
    return activeScreen.elements;
  }
  return [...shared.elements, ...activeScreen.elements];
}

export function findElementAndScreen(
  project: DashboardProject,
  elementId: string,
): { screen: DashboardScreen; element: DashboardElement } | null {
  for (const s of project.screens) {
    const element = s.elements.find((e) => e.id === elementId);
    if (element) return { screen: s, element };
  }
  return null;
}

/**
 * Short label above a selected element on the canvas (not full default_value — hide `|` slot separators).
 */
export function canvasOverlayLabel(el: DashboardElement): string {
  const dv = el.defaultValue?.trim();
  if (dv) {
    const first = dv.split("|")[0]?.trim() ?? "";
    if (first) return truncateLabel(first);
  }
  if (el.lookTemplate?.trim()) {
    const t = el.lookTemplate.split(".").pop()?.trim() ?? "";
    if (t) return truncateLabel(t);
  }
  if (el.name?.trim()) {
    const n = el.name.split(".").pop()?.trim() ?? "";
    if (n) return truncateLabel(n);
  }
  return el.id.slice(0, 8);
}

function truncateLabel(s: string): string {
  return s.length > 36 ? `${s.slice(0, 36)}…` : s;
}
