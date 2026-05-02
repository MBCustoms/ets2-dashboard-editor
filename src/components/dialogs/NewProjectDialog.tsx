import { useEffect, useState } from "react";

import { createNewProject } from "../../lib/projectDefaults";
import { useSettingsStore } from "../../store/settingsStore";
import type { DashboardProject } from "../../types/scs";
import { useT } from "../../i18n";

const backdrop =
  "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4";
const panel =
  "w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl";
const inputCls =
  "mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

const CANVAS_PRESETS = [
  { label: "800×800 (Classic)", w: 800, h: 800 },
  { label: "1280×480 (Wide)", w: 1280, h: 480 },
  { label: "1440×540 (Scania S/R)", w: 1440, h: 540 },
  { label: "1152×864 (DAF XF)", w: 1152, h: 864 },
  { label: "1024×600 (MAN TGX)", w: 1024, h: 600 },
  { label: "Custom", w: 0, h: 0 },
] as const;

export function NewProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (project: DashboardProject) => void;
}) {
  const t = useT();
  const settingsGameRoot = useSettingsStore((s) => s.gameRootPath);
  const [modId, setModId] = useState("my_mod");
  const [dashboardFileName, setDashboardFileName] = useState("my_dashboard");
  const [windowUnitName, setWindowUnitName] = useState(".my_dashboard");
  const [canvasPreset, setCanvasPreset] = useState(0);
  const [customW, setCustomW] = useState(800);
  const [customH, setCustomH] = useState(800);

  useEffect(() => {
    if (open) {
      setModId("my_mod");
      setDashboardFileName("my_dashboard");
      setWindowUnitName(".my_dashboard");
      setCanvasPreset(0);
      setCustomW(800);
      setCustomH(800);
    }
  }, [open]);

  if (!open) return null;

  const preset = CANVAS_PRESETS[canvasPreset];
  const finalW = preset.w || customW;
  const finalH = preset.h || customH;

  const submit = () => {
    const p = createNewProject(
      modId,
      dashboardFileName,
      windowUnitName,
      settingsGameRoot,
      finalW,
      finalH,
    );
    onCreate(p);
    onClose();
  };

  return (
    <div
      className={backdrop}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={panel}>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">{t("new_project_title")}</h2>
        <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
          {t("new_project_desc")}
        </p>
        <div className="mb-2">
          <label className="text-[11px] text-slate-400">{t("new_project_mod_id")}</label>
          <input
            className={inputCls}
            value={modId}
            onChange={(e) => setModId(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="mb-2">
          <label className="text-[11px] text-slate-400">{t("new_project_filename")}</label>
          <input
            className={inputCls}
            value={dashboardFileName}
            onChange={(e) => setDashboardFileName(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="mb-2">
          <label className="text-[11px] text-slate-400">{t("new_project_unit_name")}</label>
          <input
            className={inputCls}
            value={windowUnitName}
            onChange={(e) => setWindowUnitName(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="mb-2">
          <label className="text-[11px] text-slate-400">{t("new_project_canvas_size")}</label>
          <select
            className={inputCls}
            value={canvasPreset}
            onChange={(e) => setCanvasPreset(Number(e.target.value))}
          >
            {CANVAS_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {preset.w === 0 && (
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400">{t("new_project_width")}</label>
              <input
                type="number"
                className={inputCls}
                min={200}
                max={3840}
                value={customW}
                onChange={(e) => setCustomW(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-slate-400">{t("new_project_height")}</label>
              <input
                type="number"
                className={inputCls}
                min={200}
                max={2160}
                value={customH}
                onChange={(e) => setCustomH(Number(e.target.value))}
              />
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            {t("btn_cancel")}
          </button>
          <button
            type="button"
            className="rounded bg-emerald-800 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
            onClick={submit}
          >
            {t("btn_create")}
          </button>
        </div>
      </div>
    </div>
  );
}
