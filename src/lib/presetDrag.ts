export const PRESET_DRAG_START = "ets2-preset-drag-start";
export const PRESET_DRAG_END = "ets2-preset-drag-end";

export function dispatchPresetDragStart(): void {
  window.dispatchEvent(new Event(PRESET_DRAG_START));
}

export function dispatchPresetDragEnd(): void {
  window.dispatchEvent(new Event(PRESET_DRAG_END));
}
