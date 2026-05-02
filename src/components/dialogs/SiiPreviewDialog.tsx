import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardProject } from "../../types/scs";

const backdrop =
  "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4";
const panel =
  "flex h-[80vh] w-[min(70vw,960px)] min-w-[min(100%,640px)] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl";

const editorThemeExt = EditorView.theme({
  "&": { fontSize: "11px", height: "100%" },
  ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace" },
});

type Tab = "dashboard" | "template";

export function SiiPreviewDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: DashboardProject | null;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboardSii, setDashboardSii] = useState("");
  const [templateSii, setTemplateSii] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!open || !project) {
      setDashboardSii("");
      setTemplateSii("");
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void invoke<[string, string]>("generate_sii_preview", { project })
      .then(([d, t]) => {
        if (!cancelled) {
          setDashboardSii(d);
          setTemplateSii(t);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project]);

  const content = tab === "dashboard" ? dashboardSii : templateSii;

  useEffect(() => {
    if (!open || !editorRef.current) return;
    const parent = editorRef.current;
    const state = EditorState.create({
      doc: content.replace(/^\uFEFF/, ""),
      extensions: [
        EditorState.readOnly.of(true),
        keymap.of(defaultKeymap),
        oneDark,
        EditorView.lineWrapping,
        editorThemeExt,
      ],
    });
    const view = new EditorView({ state, parent });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- remount when dialog opens

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !open) return;
    const next = content.replace(/^\uFEFF/, "");
    const cur = view.state.doc.toString();
    if (cur !== next) {
      view.dispatch({ changes: { from: 0, to: cur.length, insert: next } });
    }
  }, [content, open]);

  const copyToClipboard = useCallback(async () => {
    const body = content.replace(/^\uFEFF/, "");
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const refresh = useCallback(() => {
    if (!project) return;
    setLoading(true);
    setErr(null);
    void invoke<[string, string]>("generate_sii_preview", { project })
      .then(([d, t]) => {
        setDashboardSii(d);
        setTemplateSii(t);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [project]);

  if (!open) return null;

  const tabBtn = (id: Tab) =>
    `rounded-t px-3 py-1 text-[11px] ${
      tab === id
        ? "border-b-2 border-emerald-500 bg-slate-800 text-slate-100"
        : "text-slate-500 hover:text-slate-300"
    }`;

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
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-100">SII preview</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
              onClick={() => void copyToClipboard()}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button
              type="button"
              className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              disabled={loading || !project}
              onClick={refresh}
            >
              Refresh
            </button>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-200"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-slate-800 px-4 pt-2">
          <button type="button" className={tabBtn("dashboard")} onClick={() => setTab("dashboard")}>
            dashboard.sii
          </button>
          <button type="button" className={tabBtn("template")} onClick={() => setTab("template")}>
            dashboard_text.{project?.modId ?? "mod"}.sii
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1">
          {loading ? <p className="px-2 text-xs text-slate-500">Generating…</p> : null}
          {err ? <p className="px-2 text-[11px] text-red-400">{err}</p> : null}
          <p className="px-2 pb-1 text-[10px] text-slate-500">
            Read-only preview from the Rust exporter (UTF-8 BOM stripped in view). Switch tabs to inspect
            each file.
          </p>
          <div
            ref={editorRef}
            className="min-h-0 flex-1 overflow-hidden rounded border border-slate-800"
            style={{ minHeight: "min(50vh, 420px)" }}
          />
        </div>
      </div>
    </div>
  );
}
