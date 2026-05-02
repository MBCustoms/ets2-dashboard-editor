import { create } from "zustand";

/**
 * A single UV wireframe edge: `[u0, v0, u1, v1]` where (u,v) are raw UV
 * coordinates from the loaded 3D model. V=0 is at the TOP of the texture
 * (DirectX / ZModeler convention), which matches how the dashboard PNG is
 * rendered (y=0 at top).
 */
export type UvEdge = readonly [number, number, number, number];

interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  selectedIds: string[];
  hoveredId: string | null;
  showGrid: boolean;
  gridSize: number;
  snapEnabled: boolean;
  mouseScsX: number;
  mouseScsY: number;
  wireframeMode: boolean;
  showCollisions: boolean;
  /** When false, selection outline, resize handles, and selection labels are hidden on the canvas. */
  showSelectionChrome: boolean;
  viewMode: "canvas" | "3d" | "split";
  /** UV edges extracted from the currently loaded 3D model (or null if no model loaded). */
  uvEdges: UvEdge[] | null;
  /** When true and a model is loaded, the dashboard canvas overlays the model UV wireframe. */
  showUvOverlay: boolean;
  setViewMode: (mode: "canvas" | "3d" | "split") => void;

  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  setSelection: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  setShowGrid: (v: boolean) => void;
  setGridSize: (n: number) => void;
  setSnapEnabled: (v: boolean) => void;
  setMouseScs: (sx: number, sy: number) => void;
  setWireframeMode: (v: boolean) => void;
  setShowCollisions: (v: boolean) => void;
  setShowSelectionChrome: (v: boolean) => void;
  setUvEdges: (edges: UvEdge[] | null) => void;
  setShowUvOverlay: (v: boolean) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  zoom: 0.85,
  panX: 40,
  panY: 32,
  selectedIds: [],
  hoveredId: null,
  showGrid: true,
  gridSize: 10,
  snapEnabled: true,
  mouseScsX: 0,
  mouseScsY: 0,
  wireframeMode: false,
  showCollisions: false,
  showSelectionChrome: true,
  viewMode: "canvas",
  uvEdges: null,
  showUvOverlay: false,

  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.1, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  setSelection: (selectedIds) => set({ selectedIds }),
  toggleSelected: (id) => {
    const cur = get().selectedIds;
    if (cur.includes(id)) {
      set({ selectedIds: cur.filter((x) => x !== id) });
    } else {
      set({ selectedIds: [...cur, id] });
    }
  },
  clearSelection: () => set({ selectedIds: [] }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setGridSize: (gridSize) => set({ gridSize: Math.max(2, Math.min(100, gridSize)) }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setMouseScs: (mouseScsX, mouseScsY) => set({ mouseScsX, mouseScsY }),
  setWireframeMode: (wireframeMode) => set({ wireframeMode }),
  setShowCollisions: (showCollisions) => set({ showCollisions }),
  setShowSelectionChrome: (showSelectionChrome) => set({ showSelectionChrome }),
  setViewMode: (viewMode) => set({ viewMode }),
  setUvEdges: (uvEdges) =>
    set((s) => ({
      uvEdges,
      // Auto-hide the overlay when UV data is cleared (e.g. model removed).
      showUvOverlay: uvEdges ? s.showUvOverlay : false,
    })),
  setShowUvOverlay: (showUvOverlay) => set({ showUvOverlay }),
}));
