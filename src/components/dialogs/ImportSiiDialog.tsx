import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  filePath: string;
  defaultModId: string;
  onClose: () => void;
  onConfirm: (modId: string) => void;
}

export function ImportSiiDialog({ open, filePath, defaultModId, onClose, onConfirm }: Props) {
  const [modId, setModId] = useState(defaultModId);

  useEffect(() => {
    if (open) setModId(defaultModId);
  }, [open, defaultModId]);

  if (!open) return null;

  const filename = filePath.split(/[/\\]/).pop() ?? filePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-96 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="mb-1 text-sm font-semibold text-slate-100">Import SII Dashboard</h2>
        <p className="mb-4 truncate text-[11px] text-slate-500" title={filePath}>
          {filename}
        </p>

        <label className="mb-1 block text-[11px] font-medium text-slate-400">Mod ID</label>
        <input
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600"
          value={modId}
          placeholder="e.g. scania_2025"
          autoFocus
          onChange={(e) => setModId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(modId.trim() || defaultModId);
            if (e.key === "Escape") onClose();
          }}
        />
        <p className="mt-1 text-[10px] text-slate-500">
          Used to find{" "}
          <code className="text-slate-400">dashboard_text.{"{mod_id}"}.sii</code> in the same directory.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-4 py-1.5 text-xs text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            onClick={() => onConfirm(modId.trim() || defaultModId)}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
