import { useState } from "react";

import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { useT } from "../../i18n";
import { ElementLibraryPanel } from "../panels/ElementLibraryPanel";
import { LayersPanel } from "../panels/LayersPanel";
import { ProjectFilesPanel } from "../panels/ProjectFilesPanel";
import { ScreensPanel } from "../panels/ScreensPanel";
import { TelemetryPanel } from "../panels/TelemetryPanel";
import { TemplateEditorPanel } from "../panels/TemplateEditorPanel";

type Tab = "screens" | "library" | "templates" | "files" | "telemetry";

export function EditorLeftSidebar() {
  const [tab, setTab] = useState<Tab>("screens");
  const light = useAppThemeIsLight();
  const t = useT();

  const TOP_TABS: { id: Tab; label: string }[] = [
    { id: "screens", label: t("sidebar_screens") },
    { id: "library", label: t("sidebar_library") },
    { id: "templates", label: t("sidebar_templates") },
    { id: "files", label: t("sidebar_files") },
    { id: "telemetry", label: t("sidebar_telemetry") },
  ];

  const tabActive = light
    ? "border-b-2 border-emerald-600 text-emerald-800"
    : "border-b-2 border-emerald-500 text-emerald-300";
  const tabIdle = light
    ? "text-slate-500 hover:text-slate-700"
    : "text-slate-500 hover:text-slate-300";
  const layersHeader = light
    ? "shrink-0 border-t border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
    : "shrink-0 border-t border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <aside
      className={
        light
          ? "flex w-72 shrink-0 flex-col border-r border-slate-300 bg-white"
          : "flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950"
      }
    >
      <div className={light ? "flex shrink-0 border-b border-slate-300" : "flex shrink-0 border-b border-slate-800"}>
        {TOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`flex-1 px-1 py-2 text-[10px] font-medium sm:text-[11px] ${tab === t.id ? tabActive : tabIdle}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={
          light
            ? "min-h-0 flex-1 overflow-y-auto bg-slate-50 text-slate-800"
            : "min-h-0 flex-1 overflow-y-auto"
        }
        style={{ maxHeight: "55%" }}
      >
        {tab === "screens" ? <ScreensPanel /> : null}
        {tab === "library" ? <ElementLibraryPanel /> : null}
        {tab === "templates" ? <TemplateEditorPanel /> : null}
        {tab === "files" ? <ProjectFilesPanel /> : null}
        <div className={tab === "telemetry" ? "" : "hidden"}>
          <TelemetryPanel isVisible={tab === "telemetry"} />
        </div>
      </div>

      <div className={layersHeader}>{t("sidebar_layers")}</div>

      <div
        className={light ? "min-h-0 flex-1 overflow-y-auto bg-slate-50" : "min-h-0 flex-1 overflow-y-auto"}
        style={{ maxHeight: "42%" }}
      >
        <LayersPanel />
      </div>
    </aside>
  );
}
