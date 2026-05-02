import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import type { DashboardProject, ExportSummary, ValidationError } from "../../types/scs";
import { useT } from "../../i18n";

const backdrop =
  "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4";
const panel =
  "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl";
const btn =
  "rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800";
const btnPrimary =
  "rounded bg-emerald-800 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-40";

function severityClass(s: ValidationError["severity"]): string {
  if (s === "Error") return "text-red-400";
  if (s === "Warning") return "text-amber-300";
  return "text-slate-400";
}

export function ModExportDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: DashboardProject | null;
}) {
  const t = useT();
  const [issues, setIssues] = useState<ValidationError[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastSummary, setLastSummary] = useState<ExportSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIssues([]);
      setLastSummary(null);
      setErr(null);
      return;
    }
    setIssues([]);
    setLastSummary(null);
    setErr(null);
  }, [open, project]);

  if (!open) return null;

  const hasErrors = issues.some((i) => i.severity === "Error");

  const handleExport = async () => {
    if (!project) return;
    setErr(null);
    setBusy(true);
    let errors: ValidationError[] = [];
    try {
      errors = await invoke<ValidationError[]>("validate_project", { project });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
      return;
    }
    setIssues(errors);
    const hardErrors = errors.filter((e) => e.severity === "Error");
    if (hardErrors.length > 0) {
      setBusy(false);
      return;
    }

    const outputPath = await save({
      defaultPath: `mod_${project.modId || "dashboard"}.zip`,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!outputPath) {
      setBusy(false);
      return;
    }

    try {
      const result = await invoke<ExportSummary>("export_mod_zip", {
        project,
        outputPath,
      });
      setLastSummary(result);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">{t("export_title")}</h2>
          <button type="button" className={btn} onClick={onClose}>
            {t("btn_close")}
          </button>
        </div>
        <p className="mb-2 text-[10px] text-slate-500">{t("export_desc")}</p>
        {busy ? <p className="mb-2 text-xs text-slate-500">{t("export_working")}</p> : null}
        {!project ? (
          <p className="mb-2 text-[11px] text-amber-400">{t("export_no_project")}</p>
        ) : null}
        {err ? <p className="mb-2 text-[11px] text-red-400">{err}</p> : null}
        <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto font-mono text-[10px]">
          {issues.map((i, idx) => (
            <li key={idx} className={severityClass(i.severity)}>
              <span className="font-semibold">[{i.severity}]</span> {i.message}
              {i.elementId ? (
                <span className="text-slate-500"> · {i.elementId}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {project && issues.length === 0 && !busy && !lastSummary ? (
          <p className="mb-2 text-[11px] text-slate-500">{t("export_run_validate")}</p>
        ) : null}
        {project && issues.length > 0 && !hasErrors && !busy ? (
          <p className="mb-2 text-[11px] text-amber-400/90">{t("export_warnings_only")}</p>
        ) : null}
        {lastSummary ? (
          <p className="mb-2 text-[11px] text-slate-400">
            {t("export_wrote")} {lastSummary.fileCount} {t("export_files_to")}{" "}
            <span className="text-slate-200">{lastSummary.outputPath}</span>
            {lastSummary.warnings.length ? (
              <span> ({lastSummary.warnings.length} {t("export_warnings")})</span>
            ) : null}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>
            {t("btn_cancel")}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!project || busy}
            onClick={() => void handleExport()}
          >
            {t("export_validate_zip")}
          </button>
        </div>
      </div>
    </div>
  );
}
