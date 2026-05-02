import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { UndoRedoManager, type UndoCommand } from "../lib/undoRedo";

type UndoRedoValue = {
  manager: UndoRedoManager;
  executeCommand: (cmd: UndoCommand) => void;
  executeSilent: (cmd: UndoCommand) => void;
  undo: () => void;
  redo: () => void;
  revision: number;
};

const UndoRedoContext = createContext<UndoRedoValue | null>(null);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const manager = useMemo(() => new UndoRedoManager(), []);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const executeCommand = useCallback(
    (cmd: UndoCommand) => {
      manager.executeCommand(cmd);
      bump();
    },
    [manager, bump],
  );

  const executeSilent = useCallback(
    (cmd: UndoCommand) => {
      manager.executeSilent(cmd);
      bump();
    },
    [manager, bump],
  );

  const undo = useCallback(() => {
    manager.undo();
    bump();
  }, [manager, bump]);

  const redo = useCallback(() => {
    manager.redo();
    bump();
  }, [manager, bump]);

  const value = useMemo(
    () => ({ manager, executeCommand, executeSilent, undo, redo, revision }),
    [manager, executeCommand, executeSilent, undo, redo, revision],
  );

  return (
    <UndoRedoContext.Provider value={value}>{children}</UndoRedoContext.Provider>
  );
}

export function useUndoRedo(): UndoRedoValue {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) {
    throw new Error("useUndoRedo must be used within UndoRedoProvider");
  }
  return ctx;
}
