import { createElement } from "./projectDefaults";
import type { DashboardElement, ElementType } from "../types/scs";

export type PresetCategory =
  | "backgrounds"
  | "textIndicators"
  | "bars"
  | "gauges"
  | "indicators"
  | "screens";

export interface ElementPreset {
  id: string;
  label: string;
  category: PresetCategory;
  width: number;
  height: number;
  build: () => DashboardElement;
}

const blackBg =
  '<img src=/material/ui/white.mat xscale=stretch yscale=stretch color=ff000000>';

const barMat =
  '<color value=FF9FB200><img src=/material/ui/white.mat xscale=stretch yscale=stretch>';

const TEXT_INDICATOR_DEFS: { id: string; label: string; did: number; def: string }[] = [
  { id: "ti-1000", label: "Ambient temp", did: 1000, def: "22|°C" },
  { id: "ti-1010", label: "Oil temp", did: 1010, def: "80|°C" },
  { id: "ti-1020", label: "Speed", did: 1020, def: "80|km/h" },
  { id: "ti-1030", label: "Odometer", did: 1030, def: "123456|km" },
  { id: "ti-1040", label: "Gear", did: 1040, def: "5" },
  { id: "ti-1050", label: "Clock", did: 1050, def: "12:00" },
  { id: "ti-1060", label: "Fuel amount", did: 1060, def: "400|l" },
  { id: "ti-1080", label: "Operating range", did: 1080, def: "650|km" },
  { id: "ti-1090", label: "Water temp", did: 1090, def: "85|°C" },
  { id: "ti-1100", label: "Cruise speed", did: 1100, def: "90|km/h" },
  { id: "ti-1160", label: "Consumption", did: 1160, def: "30|l/h" },
  { id: "ti-1170", label: "Avg consumption", did: 1170, def: "25|l/h" },
  { id: "ti-1210", label: "Trip distance", did: 1210, def: "250|km" },
  { id: "ti-1220", label: "Compass", did: 1220, def: "NW" },
  { id: "ti-1280", label: "Engine hours", did: 1280, def: "1500|h" },
  { id: "ti-1300", label: "Gear (raw)", did: 1300, def: "5" },
  { id: "ti-1310", label: "Trans. mode", did: 1310, def: "A" },
  { id: "ti-1320", label: "Battery voltage", did: 1320, def: "24.5|V" },
  { id: "ti-1370", label: "Air pressure PSI", did: 1370, def: "120|psi" },
  { id: "ti-1380", label: "Trans. mode D", did: 1380, def: "D" },
  { id: "ti-1390", label: "Trip time", did: 1390, def: "02:30" },
  { id: "ti-1400", label: "Avg speed", did: 1400, def: "75|km/h" },
  { id: "ti-1510", label: "Fuel %", did: 1510, def: "75|%" },
  { id: "ti-1520", label: "AdBlue %", did: 1520, def: "90|%" },
  { id: "ti-1610", label: "Speed limit", did: 1610, def: "90" },
];

const BAR_DEFS: { id: string; label: string; did: number; min: number; max: number }[] = [
  { id: "br-1070", label: "Fuel bar", did: 1070, min: 0, max: 1 },
  { id: "br-1110", label: "Oil pressure", did: 1110, min: 0, max: 8 },
  { id: "br-1120", label: "Air pressure", did: 1120, min: 0, max: 12 },
  { id: "br-1130", label: "Turbo", did: 1130, min: 0, max: 1 },
  { id: "br-1140", label: "AdBlue", did: 1140, min: 0, max: 1 },
  { id: "br-1150", label: "Water temp bar", did: 1150, min: 0, max: 130 },
  { id: "br-1160", label: "Consumption bar", did: 1160, min: 0, max: 50 },
  { id: "br-1180", label: "Brake pedal", did: 1180, min: 0, max: 1 },
  { id: "br-1350", label: "Instant fuel eco", did: 1350, min: 0, max: 100 },
  { id: "br-1360", label: "Avg fuel eco", did: 1360, min: 0, max: 100 },
  { id: "br-1550", label: "Diff temp", did: 1550, min: 0, max: 1 },
  { id: "br-1560", label: "Axle load", did: 1560, min: 0, max: 1 },
  { id: "br-1600", label: "Oil temp bar", did: 1600, min: 0, max: 130 },
  { id: "br-1690", label: "Power (EV)", did: 1690, min: 0, max: 1 },
  { id: "br-1700", label: "RPM bar", did: 1700, min: 0, max: 1 },
];

const INDICATOR_DEFS: { id: string; label: string; did: number }[] = [
  { id: "in-1190", label: "Damage warning", did: 1190 },
  { id: "in-1200", label: "Low fuel warning", did: 1200 },
  { id: "in-1230", label: "Engine brake icon", did: 1230 },
  { id: "in-1240", label: "Cruise control icon", did: 1240 },
  { id: "in-1250", label: "CC memory icon", did: 1250 },
  { id: "in-1260", label: "Low air pressure", did: 1260 },
  { id: "in-1270", label: "Parking brake", did: 1270 },
  { id: "in-1290", label: "Retarder icon", did: 1290 },
  { id: "in-1420", label: "Damage stop", did: 1420 },
  { id: "in-1470", label: "Parking lights", did: 1470 },
  { id: "in-1480", label: "Low beam", did: 1480 },
  { id: "in-1490", label: "Diff lock", did: 1490 },
  { id: "in-1540", label: "Time until rest", did: 1540 },
  { id: "in-1570", label: "Left blinker", did: 1570 },
  { id: "in-1580", label: "Right blinker", did: 1580 },
  { id: "in-1590", label: "High beam", did: 1590 },
  { id: "in-1620", label: "Digital main mirrors", did: 1620 },
  { id: "in-1630", label: "Digital side mirror", did: 1630 },
  { id: "in-1640", label: "Digital front mirror", did: 1640 },
  { id: "in-1650", label: "Digital hood mirrors", did: 1650 },
  { id: "in-1660", label: "Close blind spot", did: 1660 },
  { id: "in-1670", label: "Far blind spot", did: 1670 },
];

const GAUGE_DEFS: { id: string; label: string; did: number }[] = [
  { id: "ga-1330", label: "Battery voltage gauge", did: 1330 },
  { id: "ga-1340", label: "Oil temp gauge", did: 1340 },
  { id: "ga-1430", label: "Speed gauge", did: 1430 },
  { id: "ga-1440", label: "RPM gauge", did: 1440 },
  { id: "ga-1450", label: "Cruise speed gauge", did: 1450 },
  { id: "ga-1460", label: "Water temp gauge", did: 1460 },
];

function gaugePreset(id: string, label: string, did: number): ElementPreset {
  return {
    id,
    label,
    category: "gauges",
    width: 180,
    height: 180,
    build: () =>
      createElement(crypto.randomUUID(), "gauge", {
        name: `.${id.replace(/[^a-z0-9]/gi, "_")}`,
        coordsL: 320,
        coordsR: 500,
        coordsT: 500,
        coordsB: 320,
        dashboardId: did,
        layer: 2,
        gaugeMinAngle: -90,
        gaugeMaxAngle: 90,
        gaugeValueMin: 0,
        gaugeValueMax: 1,
        gaugeValueOff: 0,
        gaugeMaterial: "/material/ui/white.mat",
        gaugeXrefPos: 90,
        gaugeYrefPos: 90,
        gaugeOffX: 0,
        gaugeOffY: 0,
        gaugeSmoothMove: true,
      }),
  };
}

export const ELEMENT_PRESETS: ElementPreset[] = [
  {
    id: "bg-off",
    label: "Electricity off (id 10)",
    category: "backgrounds",
    width: 800,
    height: 800,
    build: () =>
      createElement(crypto.randomUUID(), "text", {
        name: ".bg10",
        coordsL: 0,
        coordsR: 800,
        coordsT: 800,
        coordsB: 0,
        dashboardId: 10,
        layer: -5,
        textContent: blackBg,
      }),
  },
  {
    id: "bg-on",
    label: "Electricity on (id 20)",
    category: "backgrounds",
    width: 800,
    height: 800,
    build: () =>
      createElement(crypto.randomUUID(), "text", {
        name: ".bg20",
        coordsL: 0,
        coordsR: 800,
        coordsT: 800,
        coordsB: 0,
        dashboardId: 20,
        layer: -5,
        textContent: blackBg,
      }),
  },
  ...TEXT_INDICATOR_DEFS.map((t) => ({
    id: t.id,
    label: t.label,
    category: "textIndicators" as const,
    width: 200,
    height: 64,
    build: () =>
      createElement(crypto.randomUUID(), "textCommon" as ElementType, {
        name: `.${t.id}`,
        coordsL: 300,
        coordsR: 500,
        coordsT: 500,
        coordsB: 420,
        dashboardId: t.did,
        layer: 2,
        defaultValue: t.def,
        lookTemplate: "",
        textContent: "",
      }),
  })),
  ...BAR_DEFS.map((b) => ({
    id: b.id,
    label: b.label,
    category: "bars" as const,
    width: 400,
    height: 40,
    build: () =>
      createElement(crypto.randomUUID(), "textBar", {
        name: `.${b.id}`,
        coordsL: 200,
        coordsR: 600,
        coordsT: 300,
        coordsB: 260,
        dashboardId: b.did,
        layer: 1,
        barMinValue: b.min,
        barMaxValue: b.max,
        barMinSize: 0,
        barMaxSize: 100,
        textContent: barMat,
      }),
  })),
  ...GAUGE_DEFS.map((g) => gaugePreset(g.id, g.label, g.did)),
  {
    id: "ind-cc",
    label: "Cruise icon (group)",
    category: "indicators",
    width: 48,
    height: 48,
    build: () =>
      createElement(crypto.randomUUID(), "group", {
        name: ".ccgrp",
        coordsL: 400,
        coordsR: 448,
        coordsT: 500,
        coordsB: 452,
        dashboardId: 1240,
        layer: 3,
        fitting: false,
      }),
  },
  ...INDICATOR_DEFS.map((ind) => ({
    id: ind.id,
    label: ind.label,
    category: "indicators" as const,
    width: 64,
    height: 64,
    build: () =>
      createElement(crypto.randomUUID(), "text", {
        name: `.${ind.id}`,
        coordsL: 360,
        coordsR: 424,
        coordsT: 520,
        coordsB: 456,
        dashboardId: ind.did,
        layer: 4,
        textContent: '<color value=FFFFFFFF>!</color>',
      }),
  })),
];

const SCREEN_PRESETS: {
  id: string;
  label: string;
  screenId: number;
}[] = [
  { id: "scr-basic", label: "Screen 100–800", screenId: 100 },
  { id: "scr-shared", label: "Shared 950", screenId: 950 },
  { id: "scr-warn", label: "Warning 900", screenId: 900 },
];

export function getScreenPresets() {
  return SCREEN_PRESETS;
}

export function findPreset(presetId: string): ElementPreset | undefined {
  return ELEMENT_PRESETS.find((p) => p.id === presetId);
}
