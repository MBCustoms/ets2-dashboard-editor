import { useEffect } from "react";

import { useUndoRedo } from "../contexts/UndoRedoContext";

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
}

/** Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — skipped when focus is inside a text field (browser handles text undo). */
export function useUndoKeyboard(): void {
  const { undo, redo, manager } = useUndoRedo();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        if (!manager.canUndo) return;
        e.preventDefault();
        undo();
        return;
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        if (!manager.canRedo) return;
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, manager]);
}
