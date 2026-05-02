import { findPreset } from "./elementPresets";
import { BOARD_SIZE } from "./scsBoard";
import { scsBoxFromBoardCenter } from "./projectOps";
import type { DashboardElement } from "../types/scs";

export function createPlacedElement(
  presetId: string,
  wx: number,
  wy: number,
  screenUnitName?: string,
  boardW: number = BOARD_SIZE,
  boardH: number = BOARD_SIZE,
): DashboardElement | null {
  const preset = findPreset(presetId);
  if (!preset) return null;
  const el = preset.build();
  const box = scsBoxFromBoardCenter(wx, wy, preset.width, preset.height, boardW, boardH);
  const parentName = screenUnitName?.trim() || el.parentName;
  return { ...el, ...box, parentName };
}
