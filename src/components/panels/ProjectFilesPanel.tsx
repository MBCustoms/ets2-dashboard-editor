import {
  AlertCircle,
  FileText,
  Filter,
  FolderInput,
  Image,
  Link,
  RefreshCw,
  Type,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { DdsUploadDialog } from "../dialogs/DdsUploadDialog";

import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { PANEL } from "../../lib/panelStyles";
import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";

interface ProjectFile {
  type: string;
  virtualPath: string;
  realPath: string | null;
  found: boolean;
  sizeBytes: number;
}

interface ImportDdsResult {
  destPath: string;
  virtualDdsPath: string;
}

const TYPE_ICON: Record<string, ReactNode> = {
  SII: <FileText size={10} className="text-emerald-400" />,
  TEMPLATE: <FileText size={10} className="text-sky-400" />,
  DDS: <Image size={10} className="text-orange-400" />,
  MAT: <Link size={10} className="text-purple-400" />,
  TOBJ: <Link size={10} className="text-teal-400" />,
  FONT: <Type size={10} className="text-yellow-400" />,
};

function fmtSize(b: number): string {
  if (b <= 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectFilesPanel() {
  const light = useAppThemeIsLight();
  const project = useProjectStore((s) => s.project);
  const gameRoot = useSettingsStore((s) => s.gameRootPath);
  const modRoots = useSettingsStore((s) => s.modRootPaths ?? []);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [ddsDialogOpen, setDdsDialogOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const result = await invoke<ProjectFile[]>("collect_project_files", {
        project,
        gameRoot: gameRoot?.trim() || null,
        modRoots: modRoots.filter(Boolean),
      });
      setFiles(result);
    } catch (e) {
      console.error("collect_project_files:", e);
    } finally {
      setLoading(false);
    }
  }, [project, gameRoot, modRoots]);

  // Auto-scan whenever project identity or game root changes.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.modId, project?.dashboardFileName, gameRoot]);

  const importDdsIntoProject = async () => {
    if (!project) return;
    setImportBusy(true);
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: "DDS texture", extensions: ["dds"] }],
      });
      if (!picked || Array.isArray(picked)) return;
      const result = await invoke<ImportDdsResult>("import_dds_into_project", {
        project,
        sourceDdsPath: picked,
      });
      window.alert(
        `DDS copied into your mod:\n${result.destPath}\n\nVirtual path:\n${result.virtualDdsPath}`,
      );
      void refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const types = ["all", "SII", "TEMPLATE", "DDS", "MAT", "TOBJ", "FONT"];
  const shown = filter === "all" ? files : files.filter((f) => f.type === filter);
  const missing = files.filter((f) => !f.found).length;

  const filterBtn = (active: boolean) =>
    active
      ? light
        ? "rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-900"
        : "rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-100"
      : light
        ? "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500 hover:text-slate-800"
        : "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500 hover:text-slate-300";

  const rowCls = (found: boolean) =>
    found
      ? light
        ? "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
        : "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/50"
      : light
        ? "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] text-slate-500 opacity-70"
        : "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] text-slate-500 opacity-60";

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <DdsUploadDialog
        open={ddsDialogOpen}
        onClose={() => {
          setDdsDialogOpen(false);
          // Rescan after dialog closes in case new files were created.
          void refresh();
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Refresh file list"
          className={`${PANEL.btn.primary} inline-flex items-center gap-1 disabled:opacity-40`}
          disabled={loading || !project}
          onClick={() => void refresh()}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Scanning…" : "Refresh"}
        </button>
        <button
          type="button"
          title="Generate MAT + TOBJ for a DDS texture"
          className={`${PANEL.btn.primary} inline-flex items-center gap-1`}
          onClick={() => setDdsDialogOpen(true)}
        >
          <Upload size={11} />
          DDS → MAT
        </button>
        <button
          type="button"
          title="Copy a DDS into this mod under material/ui (needs SII source folder on project)"
          disabled={!project || importBusy}
          className={`${PANEL.btn.primary} inline-flex items-center gap-1 disabled:opacity-40`}
          onClick={() => void importDdsIntoProject()}
        >
          <FolderInput size={11} className={importBusy ? "animate-pulse" : ""} />
          {importBusy ? "…" : "Add DDS"}
        </button>
        {files.length > 0 ? (
          <span className={`text-[10px] ${light ? "text-slate-600" : "text-slate-500"}`}>
            {files.length} files
            {missing > 0 ? (
              <span className="ml-1 font-medium text-red-400">· {missing} missing</span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-0.5">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            className={filterBtn(filter === t)}
            onClick={() => setFilter(t)}
          >
            {t === "all" ? "All" : t}
          </button>
        ))}
      </div>

      {shown.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Filter size={20} className={light ? "text-slate-400" : "text-slate-700"} />
          <p className={`text-[11px] ${light ? "text-slate-600" : "text-slate-600"}`}>
            {files.length === 0 ? "Click Scan to discover assets." : "No files match filter."}
          </p>
        </div>
      ) : (
        <ul className="flex max-h-[55vh] flex-col gap-px overflow-y-auto">
          {shown.map((f, i) => (
            <li
              key={`${f.type}-${f.virtualPath}-${i}`}
              className={rowCls(f.found)}
              title={f.realPath ?? f.virtualPath}
            >
              <span className="shrink-0">{TYPE_ICON[f.type] ?? <FileText size={10} className="text-slate-500" />}</span>
              <span className="min-w-0 flex-1 truncate font-mono">
                {f.virtualPath.split("/").pop() ?? f.virtualPath}
              </span>
              {f.found ? (
                <span className={`shrink-0 text-[9px] ${light ? "text-slate-500" : "text-slate-600"}`}>
                  {fmtSize(f.sizeBytes)}
                </span>
              ) : (
                <AlertCircle size={10} className="shrink-0 text-red-500" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
