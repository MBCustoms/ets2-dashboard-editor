/** Mirrors Rust `core::models` (serde camelCase). */

export type ElementType =
  | "window"
  | "group"
  | "text"
  | "textCommon"
  | "textBar"
  | "gauge";

export interface DashboardElement {
  id: string;
  elementType: ElementType;
  name: string;
  parentName: string;
  childNames: string[];
  coordsL: number;
  coordsR: number;
  coordsT: number;
  coordsB: number;
  dashboardId: number;
  layer: number;
  fitting?: boolean;
  textContent: string;
  lookTemplate: string;
  defaultValue: string;
  isVertical: boolean;
  barMinValue: number;
  barMaxValue: number;
  barMinSize: number;
  barMaxSize: number;
  gaugeMinAngle: number;
  gaugeMaxAngle: number;
  gaugeValueMin: number;
  gaugeValueMax: number;
  gaugeValueOff: number;
  gaugeMaterial: string;
  gaugeXrefPos: number;
  gaugeYrefPos: number;
  gaugeOffX: number;
  gaugeOffY: number;
  gaugeSmoothMove: boolean;
  isVisible: boolean;
}

export interface DashboardScreen {
  id: string;
  unitName: string;
  screenId: number;
  displayName: string;
  elements: DashboardElement[];
}

export interface TextTemplate {
  name: string;
  text: string;
}

export interface DashboardProject {
  windowUnitName: string;
  modId: string;
  dashboardFileName: string;
  screens: DashboardScreen[];
  templates: TextTemplate[];
  siiSourceDirectory?: string;
  gameRootPath?: string;
  /** Virtual canvas width (SCS coords), default 800 */
  canvasWidth?: number;
  /** Virtual canvas height (SCS coords), default 800 */
  canvasHeight?: number;
}

/** Mirrors Rust `ValidationSeverity` (serde PascalCase). */
export type ValidationSeverity = "Error" | "Warning" | "Info";

export interface ValidationError {
  severity: ValidationSeverity;
  message: string;
  elementId?: string;
}

export interface ExportSummary {
  warnings: ValidationError[];
  outputPath: string;
  fileCount: number;
}

export interface AppSettings {
  gameRootPath: string;
  /** Mod workspace folders — searched before `gameRootPath` for .mat / .font / .dds. */
  modRootPaths: string[];
  recentFiles: string[];
  gridSize: number;
  snapEnabled: boolean;
  defaultZoom: number;
  autoSaveIntervalSeconds: number;
  theme: "light" | "dark" | "system";
  language: "en" | "tr";
}

/** Rust `TelemetrySnapshot` (camelCase). */
export interface TelemetryEntry {
  id: number;
  value: number;
}

export interface TelemetrySnapshot {
  connected: boolean;
  sdkActive: number;
  entries: TelemetryEntry[];
}
