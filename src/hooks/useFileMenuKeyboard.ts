import { useEffect, useRef } from "react";

/** Ctrl+O / Ctrl+S (Step 21) — not blocked on editable targets so Save works in inputs too. */
export function useFileMenuKeyboard(onOpen: () => void, onSave: () => void) {
  const openRef = useRef(onOpen);
  const saveRef = useRef(onSave);
  openRef.current = onOpen;
  saveRef.current = onSave;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "o") {
        e.preventDefault();
        openRef.current();
        return;
      }
      if (k === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
