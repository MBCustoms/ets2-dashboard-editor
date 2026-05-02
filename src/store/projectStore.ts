import { create } from "zustand";

import {
  projectAddElement as opAddElement,
  projectAddScreen as opAddScreen,
  projectRemoveElement as opRemoveElement,
  projectRemoveScreen as opRemoveScreen,
  projectReorderScreens as opReorderScreens,
} from "../lib/projectOps";
import { createDemoProject } from "../lib/projectDefaults";
import type { DashboardElement, DashboardProject, DashboardScreen } from "../types/scs";

const demo = createDemoProject();

interface ProjectState {
  project: DashboardProject | null;
  currentFilePath: string | null;
  isDirty: boolean;
  activeScreenId: string | null;

  setProject: (p: DashboardProject | null) => void;
  setCurrentFilePath: (path: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setActiveScreen: (id: string | null) => void;
  updateElement: (
    screenId: string,
    elementId: string,
    patch: Partial<DashboardElement>,
  ) => void;
  /** Full replace (used by undo from panels + inspector batch ops). */
  applyProject: (project: DashboardProject) => void;
  addScreen: (screen: DashboardScreen) => void;
  removeScreen: (screenId: string) => void;
  reorderScreens: (orderedIds: string[]) => void;
  addElement: (screenId: string, element: DashboardElement) => void;
  removeElement: (screenId: string, elementId: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: demo,
  currentFilePath: null,
  isDirty: false,
  activeScreenId: demo.screens[0]?.id ?? null,

  setProject: (p) => set({ project: p, isDirty: false }),
  setCurrentFilePath: (currentFilePath) => set({ currentFilePath }),
  setDirty: (isDirty) => set({ isDirty }),
  setActiveScreen: (activeScreenId) => set({ activeScreenId }),

  updateElement: (screenId, elementId, patch) =>
    set((state) => {
      if (!state.project) return state;
      const screens = state.project.screens.map((s) => {
        if (s.id !== screenId) return s;
        return {
          ...s,
          elements: s.elements.map((e) =>
            e.id === elementId ? { ...e, ...patch } : e,
          ),
        };
      });
      return {
        project: { ...state.project, screens },
        isDirty: true,
      };
    }),

  applyProject: (project) => set({ project, isDirty: true }),

  addScreen: (screen) =>
    set((state) => {
      if (!state.project) return state;
      return { project: opAddScreen(state.project, screen), isDirty: true };
    }),

  removeScreen: (screenId) =>
    set((state) => {
      if (!state.project) return state;
      return { project: opRemoveScreen(state.project, screenId), isDirty: true };
    }),

  reorderScreens: (orderedIds) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: opReorderScreens(state.project, orderedIds),
        isDirty: true,
      };
    }),

  addElement: (screenId, element) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: opAddElement(state.project, screenId, element),
        isDirty: true,
      };
    }),

  removeElement: (screenId, elementId) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: opRemoveElement(state.project, screenId, elementId),
        isDirty: true,
      };
    }),
}));
