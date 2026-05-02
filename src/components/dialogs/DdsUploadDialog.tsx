/**
 * DdsUploadDialog — Upload a DDS texture and auto-generate a .mat + .tobj pair.
 *
 * Writes the TOBJ (UI Icon) and MAT files next to the DDS file on disk.
 * The generated virtual paths can be used in <img src=…> markup and in
 * the material (Sprite picker) field.
 */

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

const inputCls =
  "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

export function DdsUploadDialog({
  open: isOpen,
  onClose,
  onInsertMarkup,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with `<img src=…>` markup when the user confirms after generation. */
  onInsertMarkup?: (markup: string) => void;
}) {
  const [ddsPath, setDdsPath] = useState("");
  const [virtualPath, setVirtualPath] = useState("/material/ui/");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [result, setResult] = useState<{
    tobjReal: string;
    matReal: string;
    virtualMat: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const browseForDds = async () => {
    const sel = await open({
      multiple: false,
      filters: [{ name: "DDS Texture", extensions: ["dds"] }],
    });
    if (!sel || Array.isArray(sel)) return;
    setDdsPath(sel);
    // Auto-fill virtual path if empty / is just the prefix
    if (virtualPath === "/material/ui/") {
      const fname = sel.split(/[\\/]/).pop() ?? "texture.dds";
      setVirtualPath(`/material/ui/${fname}`);
    }
    setStatus(null);
    setResult(null);
  };

  const generate = async () => {
    if (!ddsPath.trim() || !virtualPath.trim()) {
      setStatus({ ok: false, msg: "Select a DDS file and enter a virtual path." });
      return;
    }
    setBusy(true);
    setStatus(null);
    setResult(null);
    try {
      const [tobjReal, matReal, virtualMat] = await invoke<[string, string, string]>(
        "create_tobj_mat_for_dds",
        {
          ddsRealPath: ddsPath.trim(),
          virtualDdsPath: virtualPath.trim(),
        },
      );
      setResult({ tobjReal, matReal, virtualMat });
      setStatus({ ok: true, msg: "MAT and TOBJ files created successfully." });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">DDS Asset Generator</h2>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mb-4 text-[11px] text-slate-500">
          Select a <code className="text-slate-400">.dds</code> file and specify its virtual path.
          A matching <code className="text-slate-400">.tobj</code> and{" "}
          <code className="text-slate-400">.mat</code> will be created alongside it.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] text-slate-500">DDS file (on disk)</label>
            <div className="mt-0.5 flex gap-2">
              <input
                className={inputCls + " font-mono"}
                value={ddsPath}
                placeholder="C:\...\my_icon.dds"
                readOnly
              />
              <button
                type="button"
                className="shrink-0 rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
                onClick={() => void browseForDds()}
              >
                Browse…
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500">
              Virtual DDS path (used in mod)
            </label>
            <input
              className={inputCls + " mt-0.5 font-mono"}
              value={virtualPath}
              placeholder="/material/ui/my_icon.dds"
              onChange={(e) => {
                setVirtualPath(e.target.value);
                setStatus(null);
                setResult(null);
              }}
            />
            <p className="mt-0.5 text-[10px] text-slate-600">
              Must start with <code>/material/</code> and end with <code>.dds</code>.
            </p>
          </div>
        </div>

        {status ? (
          <p
            className={`mt-3 rounded border px-3 py-2 text-[11px] ${
              status.ok
                ? "border-emerald-800 bg-emerald-950/60 text-emerald-300"
                : "border-red-800 bg-red-950/60 text-red-300"
            }`}
          >
            {status.msg}
          </p>
        ) : null}

        {result ? (
          <div className="mt-3 rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-[10px]">
            <p className="font-semibold text-slate-300">Generated files:</p>
            <p className="mt-1 font-mono text-slate-400 break-all">{result.tobjReal}</p>
            <p className="mt-0.5 font-mono text-slate-400 break-all">{result.matReal}</p>
            <p className="mt-1 font-semibold text-slate-400">
              Virtual MAT path:{" "}
              <code className="text-emerald-400">{result.virtualMat}</code>
            </p>
            <p className="mt-1 text-slate-500">
              Copy these files into your mod folder so they are included in the export.
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            Cancel
          </button>
          {result && onInsertMarkup ? (
            <button
              type="button"
              className="rounded bg-sky-800 px-3 py-1.5 text-xs text-white hover:bg-sky-700"
              onClick={() => {
                onInsertMarkup(`<img src=${result.virtualMat} xscale=stretch yscale=stretch>`);
                onClose();
              }}
            >
              Insert &lt;img&gt; markup
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !ddsPath.trim() || !virtualPath.trim()}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
            onClick={() => void generate()}
          >
            {busy ? "Generating…" : "Generate MAT + TOBJ"}
          </button>
        </div>
      </div>
    </div>
  );
}
