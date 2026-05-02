export interface UndoCommand {
  execute(): void;
  undo(): void;
  description: string;
}

export class UndoRedoManager {
  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  executeCommand(cmd: UndoCommand): void {
    cmd.execute();
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** Push a command that has already been executed (e.g. committed drag). */
  executeSilent(cmd: UndoCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get nextUndoDescription(): string | null {
    const i = this.undoStack.length - 1;
    return i >= 0 ? this.undoStack[i].description : null;
  }

  get nextRedoDescription(): string | null {
    const i = this.redoStack.length - 1;
    return i >= 0 ? this.redoStack[i].description : null;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Full undo history, most recent last. */
  get undoHistory(): ReadonlyArray<string> {
    return this.undoStack.map((c) => c.description);
  }

  /** Full redo history, next to execute first. */
  get redoHistory(): ReadonlyArray<string> {
    return [...this.redoStack].reverse().map((c) => c.description);
  }
}
