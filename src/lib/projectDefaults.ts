import type { DashboardElement, DashboardProject, DashboardScreen, ElementType } from "../types/scs";

/** Root `ui::group` for a screen (`name` must equal screen `unitName` for SII export). */
export function createScreenRootGroup(
  id: string,
  unitName: string,
  windowUnitName: string,
  screenId: number,
  canvasWidth = 800,
  canvasHeight = 800,
): DashboardElement {
  return createElement(id, "group", {
    name: unitName,
    parentName: windowUnitName,
    childNames: [],
    coordsL: 0,
    coordsR: canvasWidth,
    coordsT: canvasHeight,
    coordsB: 0,
    dashboardId: screenId,
    layer: 0,
    fitting: false,
  });
}

/** SCS electricity overlay texts (dashboard ids 10 / 20), parent = shared screen root. */
const ELEC_BG_MARKUP =
  "<img src=/material/ui/white.mat xscale=stretch yscale=stretch color=ff000000>";

/**
 * Shared screen 950 with root group + id 10/20 full-screen backgrounds (matches export `ensure_defaults`).
 * Layers UI hides only the root group row — see `filterLayerTreeElements`.
 */
export function createSharedScreen950(
  windowUnitName: string,
  canvasWidth: number,
  canvasHeight: number,
): DashboardScreen {
  const cw = Math.max(1, Math.round(canvasWidth));
  const ch = Math.max(1, Math.round(canvasHeight));
  const sharedUnit = ".display950";
  const offName = "_nameless._.elec_off_bg";
  const onName = "_nameless._.elec_on_bg";
  const root = createScreenRootGroup(crypto.randomUUID(), sharedUnit, windowUnitName, 950, cw, ch);
  const rootWithChildren: DashboardElement = {
    ...root,
    layer: -1,
    fitting: false,
    childNames: [offName, onName],
  };
  const offBg = createElement(crypto.randomUUID(), "text", {
    name: offName,
    parentName: sharedUnit,
    coordsL: 0,
    coordsR: cw,
    coordsT: ch,
    coordsB: 0,
    dashboardId: 10,
    layer: -10,
    textContent: ELEC_BG_MARKUP,
  });
  const onBg = createElement(crypto.randomUUID(), "text", {
    name: onName,
    parentName: sharedUnit,
    coordsL: 0,
    coordsR: cw,
    coordsT: ch,
    coordsB: 0,
    dashboardId: 20,
    layer: -10,
    textContent: ELEC_BG_MARKUP,
  });
  return {
    id: crypto.randomUUID(),
    unitName: sharedUnit,
    screenId: 950,
    displayName: "Shared",
    elements: [rootWithChildren, offBg, onBg],
  };
}

/** Blank starter project — main (100) + shared (950) with electricity backgrounds. */
export function createNewProject(
  modId: string,
  dashboardFileName: string,
  windowUnitName: string,
  gameRootPath?: string,
  canvasWidth = 800,
  canvasHeight = 800,
): DashboardProject {
  const cw = Math.max(200, Math.min(3840, Math.round(canvasWidth)));
  const ch = Math.max(200, Math.min(2160, Math.round(canvasHeight)));
  const wu = windowUnitName.trim() || `.${dashboardFileName.trim() || "dashboard"}`;

  const unit = ".display100";
  const screen100: DashboardScreen = {
    id: crypto.randomUUID(),
    unitName: unit,
    screenId: 100,
    displayName: "Main",
    elements: [createScreenRootGroup(crypto.randomUUID(), unit, wu, 100, cw, ch)],
  };
  const screen950 = createSharedScreen950(wu, cw, ch);

  return {
    windowUnitName: wu,
    modId: modId.trim() || "my_mod",
    dashboardFileName: dashboardFileName.trim() || "my_dashboard",
    screens: [screen100, screen950],
    templates: [],
    gameRootPath: gameRootPath?.trim() || undefined,
    canvasWidth: cw,
    canvasHeight: ch,
  };
}

export function baseElementFields(): Omit<DashboardElement, "id" | "elementType"> {
  return {
    name: ".el",
    parentName: "",
    childNames: [],
    coordsL: 0,
    coordsR: 100,
    coordsT: 100,
    coordsB: 0,
    dashboardId: 0,
    layer: 0,
    textContent: "",
    lookTemplate: "",
    defaultValue: "",
    isVertical: false,
    barMinValue: 0,
    barMaxValue: 1,
    barMinSize: 0,
    barMaxSize: 0,
    gaugeMinAngle: 0,
    gaugeMaxAngle: 360,
    gaugeValueMin: 0,
    gaugeValueMax: 1,
    gaugeValueOff: 0,
    gaugeMaterial: "",
    gaugeXrefPos: 0,
    gaugeYrefPos: 0,
    gaugeOffX: 0,
    gaugeOffY: 0,
    gaugeSmoothMove: false,
    isVisible: true,
  };
}

export function createElement(
  id: string,
  elementType: ElementType,
  patch: Partial<DashboardElement> = {},
): DashboardElement {
  return {
    ...baseElementFields(),
    id,
    elementType,
    ...patch,
  };
}

/** Minimal project for canvas / UI development (two overlapping elements on layer 0 for collision demo). */
export function createDemoProject(): DashboardProject {
  const win = ".demo_dash";
  const unit = ".display100";
  const root = createScreenRootGroup("el-root", unit, win, 100);
  const rootWithChildren: DashboardElement = {
    ...root,
    childNames: [".speed", ".fuel", ".bar"],
  };
  const main: DashboardScreen = {
    id: "scr-main",
    unitName: unit,
    screenId: 100,
    displayName: "Main",
    elements: [
      rootWithChildren,
      createElement("el-a", "text", {
        name: ".speed",
        parentName: unit,
        coordsL: 120,
        coordsR: 380,
        coordsT: 520,
        coordsB: 360,
        layer: 2,
        dashboardId: 1020,
        textContent: '<color value=FFFFFFFF>88</color>',
      }),
      createElement("el-b", "textCommon", {
        name: ".fuel",
        parentName: unit,
        coordsL: 280,
        coordsR: 520,
        coordsT: 480,
        coordsB: 320,
        layer: 2,
        dashboardId: 1060,
        lookTemplate: "demo.template",
        defaultValue: "400|l",
      }),
      createElement("el-c", "textBar", {
        name: ".bar",
        parentName: unit,
        coordsL: 80,
        coordsR: 720,
        coordsT: 200,
        coordsB: 140,
        layer: 1,
        dashboardId: 1070,
        barMinValue: 0,
        barMaxValue: 1,
        barMinSize: 0,
        barMaxSize: 100,
        textContent:
          '<color value=FF9FB200><img src=/material/ui/white.mat xscale=stretch yscale=stretch>',
      }),
    ],
  };

  const shared950 = createSharedScreen950(win, 800, 800);

  return {
    windowUnitName: win,
    modId: "demo",
    dashboardFileName: "demo",
    screens: [main, shared950],
    templates: [{ name: "demo.template", text: "<color value=FFFFFFFF>%0 %1</color>" }],
    canvasWidth: 800,
    canvasHeight: 800,
  };
}
