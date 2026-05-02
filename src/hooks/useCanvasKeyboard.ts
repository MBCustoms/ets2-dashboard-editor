import { useCallback, useEffect, useRef } from "react";

import { findElementAndScreen, mergedEditorElements } from "../lib/editorElements";
import { projectAddElement } from "../lib/projectOps";
import type { DashboardElement } from "../types/scs";
import { useCanvasStore } from "../store/canvasStore";
import { useProjectStore } from "../store/projectStore";

export function useCanvasKeyboard(
  executeCommand: (cmd: {
    execute: () => void;
    undo: () => void;
    description: string;
  }) => void,
): {
  copy: () => void;
  paste: () => void;
  cut: () => void;
  deleteSelected: () => void;
  selectAll: () => void;
} {
  const clipboard = useRef<DashboardElement[]>([]);

  const copy = useCallback(() => {
    const { selectedIds } = useCanvasStore.getState();
    const { project } = useProjectStore.getState();
    if (!project || selectedIds.length === 0) return;
    const copied: typeof clipboard.current = [];
    for (const id of selectedIds) {
      const found = findElementAndScreen(project, id);
      if (found) copied.push(structuredClone(found.element));
    }
    clipboard.current = copied;
  }, []);

  const paste = useCallback(() => {
    if (clipboard.current.length === 0) return;
    const { project, activeScreenId, applyProject } = useProjectStore.getState();
    if (!project) return;
    const screen =
      project.screens.find((s) => s.id === activeScreenId) ?? project.screens[0];
    if (!screen) return;

    const cw = project.canvasWidth ?? 800;
    const pasted = clipboard.current.map((el) => ({
      ...structuredClone(el),
      id: crypto.randomUUID(),
      name: el.name ? `${el.name.slice(0, 10)}_cp` : "",
      coordsL: Math.min(el.coordsL + 10, cw - 10),
      coordsR: Math.min(el.coordsR + 10, cw),
      coordsT: Math.max(el.coordsT - 10, 10),
      coordsB: Math.max(el.coordsB - 10, 0),
    }));

    const prev = structuredClone(project);
    const next = pasted.reduce(
      (acc, el) => projectAddElement(acc, screen.id, el),
      project,
    );

    executeCommand({
      execute: () => applyProject(structuredClone(next)),
      undo: () => applyProject(prev),
      description: `Paste ${pasted.length} element(s)`,
    });
    useCanvasStore.getState().setSelection(pasted.map((e) => e.id));
  }, [executeCommand]);

  const deleteSelected = useCallback(() => {
    const { selectedIds, setSelection } = useCanvasStore.getState();
    const { project, applyProject } = useProjectStore.getState();
    if (!project || selectedIds.length === 0) return;

    const prev = structuredClone(project);
    const next = {
      ...project,
      screens: project.screens.map((s) => ({
        ...s,
        elements: s.elements.filter((el) => !selectedIds.includes(el.id)),
      })),
    };
    executeCommand({
      execute: () => {
        applyProject(structuredClone(next));
        setSelection([]);
      },
      undo: () => applyProject(prev),
      description: `Delete ${selectedIds.length} element(s)`,
    });
  }, [executeCommand]);

  const cut = useCallback(() => {
    copy();
    deleteSelected();
  }, [copy, deleteSelected]);

  const selectAll = useCallback(() => {
    const { project, activeScreenId } = useProjectStore.getState();
    if (!project) return;
    const screen =
      project.screens.find((s) => s.id === activeScreenId) ?? project.screens[0];
    if (!screen) return;
    const ids = mergedEditorElements(project, screen).map((e) => e.id);
    useCanvasStore.getState().setSelection(ids);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if ((e.target as HTMLElement)?.closest?.(".cm-editor")) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "c":
            e.preventDefault();
            copy();
            break;
          case "v":
            e.preventDefault();
            paste();
            break;
          case "a":
            e.preventDefault();
            selectAll();
            break;
          case "d":
            e.preventDefault();
            copy();
            paste();
            break;
          case "x":
            e.preventDefault();
            cut();
            break;
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        useCanvasStore.getState().setSelection([]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copy, paste, cut, deleteSelected, selectAll]);

  return { copy, paste, cut, deleteSelected, selectAll };
}
