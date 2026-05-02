import { FileCode2, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { StreamLanguage } from "@codemirror/language";
import { invoke } from "@tauri-apps/api/core";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { panelTheme } from "../../lib/panelStyles";
import { useCanvasStore } from "../../store/canvasStore";
import { MarkupToolbar } from "../controls/MarkupToolbar";
import { projectSetTemplates } from "../../lib/projectOps";
import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { DashboardProject, TextTemplate } from "../../types/scs";

const TMPL_PREVIEW_W = 400;
const TMPL_PREVIEW_H = 80;

const scsMarkupLang = StreamLanguage.define({
  name: "scs-markup",
  token(stream) {
    if (stream.match(/<color\b[^>]*>/i)) return "keyword";
    if (stream.match(/<img\b[^>]*>/i)) return "string";
    if (stream.match(/<\/font>/i)) return "def";
    if (stream.match(/<font\b[^>]*>/i)) return "def";
    if (stream.match(/<\/align>/i)) return "meta";
    if (stream.match(/<align\b[^>]*>/i)) return "meta";
    if (stream.match(/<ret>/i)) return "atom";
    if (stream.match(/<br>/i)) return "atom";
    if (stream.match(/<offset\b[^>]*>/i)) return "variable";
    if (stream.match(/%[0-9]/)) return "number";
    if (stream.match(/@@\w+@@/)) return "propertyName";
    if (stream.match(/\b(?:left|right|top|bottom|xscale|yscale|width|height|src)=/i))
      return "attributeName";
    stream.next();
    return null;
  },
  languageData: {},
});

const editorThemeExt: Extension = EditorView.theme({
  "&": { fontSize: "11px", height: "180px" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  ".cm-content": { padding: "4px 0" },
});

const lightCmTheme: Extension = EditorView.theme({
  "&": {
    fontSize: "11px",
    height: "180px",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: "#ffffff",
  },
  ".cm-content": { padding: "4px 0", caretColor: "#0f172a" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0f172a" },
  "&.cm-focused .cm-selectionBackground, &::selection .cm-selectionBackground": {
    backgroundColor: "#93c5fd",
  },
  ".cm-selectionBackground": { backgroundColor: "#cbd5e1" },
  ".cm-gutters": {
    backgroundColor: "#f8fafc",
    color: "#64748b",
    borderRight: "1px solid #e2e8f0",
  },
});

function MarkupEditor({
  value,
  onChange,
  exposeViewRef,
  light,
}: {
  value: string;
  onChange: (v: string) => void;
  exposeViewRef?: React.MutableRefObject<EditorView | null>;
  light: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        ...(light ? [lightCmTheme] : [oneDark]),
        scsMarkupLang,
        editorThemeExt,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newVal = update.state.doc.toString();
            onChangeRef.current(newVal);
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    innerViewRef.current = view;
    if (exposeViewRef) exposeViewRef.current = view;
    return () => {
      view.destroy();
      innerViewRef.current = null;
      if (exposeViewRef) exposeViewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — parent `key` remounts when theme changes

  useEffect(() => {
    const view = innerViewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={
        light
          ? "w-full overflow-hidden rounded border border-slate-300"
          : "w-full overflow-hidden rounded border border-slate-700"
      }
    />
  );
}

function countUsages(project: DashboardProject, name: string): number {
  const n = name.trim();
  if (!n) return 0;
  let c = 0;
  for (const s of project.screens) {
    for (const e of s.elements) {
      if (e.lookTemplate.trim() === n) c++;
    }
  }
  return c;
}

export function TemplateEditorPanel() {
  const light = useAppThemeIsLight();
  const th = panelTheme(light);
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const applyProject = useProjectStore((s) => s.applyProject);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const { executeCommand } = useUndoRedo();
  const gameRoot = useSettingsStore((s) => s.gameRootPath);

  const templates = useMemo(() => project?.templates ?? [], [project?.templates]);
  const [templateSearch, setTemplateSearch] = useState("");
  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    const rows = templates.map((t, i) => ({ t, i }));
    if (!q) return rows;
    return rows.filter(({ t }) => (t.name || "").toLowerCase().includes(q));
  }, [templates, templateSearch]);

  const [sel, setSel] = useState(0);
  const [nameDraft, setNameDraft] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const templateEditorViewRef = useRef<EditorView | null>(null);

  const idx = Math.min(sel, Math.max(0, templates.length - 1));
  const current = templates[idx];

  useEffect(() => {
    if (templates.length === 0) {
      setNameDraft("");
      setTextDraft("");
      return;
    }
    const t = templates[Math.min(sel, templates.length - 1)];
    setNameDraft(t.name);
    setTextDraft(t.text);
    setPreviewB64(null);
  }, [templates, sel]);

  useEffect(() => {
    if (!project || templates.length === 0) return;
    const screen =
      project.screens.find((s) => s.id === activeScreenId) ?? project.screens[0];
    if (!screen) return;
    const sid = selectedIds[0];
    if (!sid) return;
    const el = screen.elements.find((e) => e.id === sid);
    const name = el?.lookTemplate?.trim();
    if (!name) return;
    const i = templates.findIndex((t) => t.name === name);
    if (i >= 0) setSel(i);
  }, [project, activeScreenId, selectedIds, templates]);

  const usages = useMemo(
    () => (project && current ? countUsages(project, current.name) : 0),
    [project, current],
  );

  const run = (description: string, next: TextTemplate[]) => {
    if (!project) return;
    const prev = structuredClone(project);
    const nextP = projectSetTemplates(project, next);
    executeCommand({
      execute: () => applyProject(structuredClone(nextP)),
      undo: () => applyProject(prev),
      description,
    });
  };

  const commitEdit = useCallback(() => {
    if (!project || !current) return;
    const name = nameDraft.trim();
    if (!name) return;
    if (name === current.name && textDraft === current.text) return;
    const next = templates.map((t, i) => (i === idx ? { name, text: textDraft } : t));
    run("Edit template", next);
  }, [project, current, nameDraft, textDraft, templates, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTextChange = (v: string) => {
    setTextDraft(v);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commitEdit(), 800);
  };

  const loadPreview = useCallback(async () => {
    if (!current || !gameRoot?.trim() || !project) return;
    setPreviewLoading(true);
    const resolved = current.text.replace("%0", "88").replace("%1", "km/h");
    const projectPayload = { ...project, gameRootPath: gameRoot.trim() };
    try {
      const b64 = await invoke<string | null>("render_screen_preview_png_b64", {
        project: {
          ...projectPayload,
          canvasWidth: TMPL_PREVIEW_W,
          canvasHeight: TMPL_PREVIEW_H,
          screens: [
            {
              id: "preview-screen",
              unitName: "_nameless._.preview",
              screenId: 9999,
              displayName: "Preview",
              elements: [
                {
                  id: "preview-el",
                  elementType: "text",
                  name: "_nameless._.prev",
                  parentName: "",
                  childNames: [],
                  coordsL: 0,
                  coordsR: TMPL_PREVIEW_W,
                  coordsT: TMPL_PREVIEW_H,
                  coordsB: 0,
                  dashboardId: 0,
                  layer: 0,
                  textContent: resolved,
                  lookTemplate: "",
                  defaultValue: "",
                  isVertical: false,
                  barMinValue: 0,
                  barMaxValue: 1,
                  barMinSize: 0,
                  barMaxSize: 400,
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
                },
              ],
            },
          ],
        },
        screenId: 9999,
        size: TMPL_PREVIEW_W,
      });
      setPreviewB64(b64 ?? null);
    } catch (e) {
      console.warn("Template preview failed:", e);
      setPreviewB64(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [current, gameRoot, project]);

  if (!project) {
    return (
      <p className={`px-2 py-2 text-xs ${light ? "text-slate-600" : "text-slate-500"}`}>
        No project open.
      </p>
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 px-2 py-2 ${light ? "text-slate-800" : "text-slate-200"}`}
    >
      <div
        className={`flex flex-wrap gap-1 border-b pb-2 ${light ? "border-slate-200" : "border-slate-800"}`}
      >
        <button
          type="button"
          className={`${th.btn.primary} inline-flex items-center gap-1`}
          onClick={() => {
            const t: TextTemplate = {
              name: `new.template.${templates.length + 1}`,
              text: "<color value=FFFFFFFF>%0</color>",
            };
            run("Add template", [...templates, t]);
            setSel(templates.length);
          }}
        >
          <Plus size={12} />
          New
        </button>
        {current ? (
          <button
            type="button"
            className={`${th.btn.danger} inline-flex items-center gap-1`}
            onClick={() => {
              if (
                current &&
                countUsages(project, current.name) > 0 &&
                !window.confirm("Template is used by elements. Remove anyway?")
              ) {
                return;
              }
              run(
                "Remove template",
                templates.filter((_, i) => i !== idx),
              );
              setSel(Math.max(0, idx - 1));
            }}
          >
            <Trash2 size={12} />
            Remove
          </button>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FileCode2 size={28} className={light ? "text-slate-400" : "text-slate-600"} />
          <p className={`text-[11px] ${light ? "text-slate-600" : "text-slate-500"}`}>
            No templates — click New to add one.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <input
              type="search"
              placeholder="Search templates…"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className={th.input}
            />
            <div className={`rounded border ${light ? "border-slate-300" : "border-slate-700"}`}>
              {filteredTemplates.length === 0 ? (
                <p
                  className={`px-2 py-3 text-center text-[10px] ${light ? "text-slate-500" : "text-slate-500"}`}
                >
                  No templates match this search.
                </p>
              ) : (
                <select
                  className={`w-full rounded border px-2 py-1 text-[11px] outline-none ${
                    light
                      ? "border-slate-300 bg-white text-slate-800"
                      : "border-slate-700 bg-slate-900 text-slate-200"
                  }`}
                  size={Math.min(Math.max(filteredTemplates.length, 1), 8)}
                  value={
                    filteredTemplates.some(({ i }) => i === idx)
                      ? idx
                      : (filteredTemplates[0]?.i ?? 0)
                  }
                  onChange={(e) => setSel(Number(e.target.value))}
                >
                  {filteredTemplates.map(({ t, i }) => (
                    <option key={`${t.name}-${i}`} value={i}>
                      {t.name || "(unnamed)"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {current ? (
            <>
              <div>
                <label className={th.label}>Key name</label>
                <input
                  className={`${th.input} mt-0.5 font-mono`}
                  value={nameDraft}
                  spellCheck={false}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitEdit}
                />
              </div>

              <div>
                <label className={th.label}>Markup (SCS)</label>
                <div className="mt-0.5 flex flex-col gap-1">
                  <MarkupToolbar
                    light={light}
                    onInsert={(s) => {
                      const view = templateEditorViewRef.current;
                      if (!view) {
                        setTextDraft((d) => d + s);
                        return;
                      }
                      const { from, to } = view.state.selection.main;
                      view.dispatch({
                        changes: { from, to, insert: s },
                        selection: { anchor: from + s.length },
                      });
                      view.focus();
                    }}
                  />
                  <div className={light ? "rounded border border-slate-300" : ""}>
                    <MarkupEditor
                      key={light ? "cm-light" : "cm-dark"}
                      light={light}
                      exposeViewRef={templateEditorViewRef}
                      value={textDraft}
                      onChange={handleTextChange}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 rounded px-2 py-1 text-[10px] ${
                  light ? "bg-slate-100 text-slate-500" : "bg-slate-900/60 text-slate-500"
                }`}
              >
                <span>
                  Usages:{" "}
                  <span className={usages > 0 ? "font-medium text-emerald-400" : ""}>{usages}</span>
                </span>
                <span className={light ? "text-slate-600" : "text-slate-600"}>%0 = value · %1 = unit</span>
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={th.label}>Preview (88 | km/h)</span>
                  <button
                    type="button"
                    disabled={!gameRoot?.trim() || previewLoading}
                    className={`${th.btn.ghost} inline-flex items-center gap-1 disabled:opacity-40`}
                    onClick={() => void loadPreview()}
                  >
                    <Play size={10} />
                    {previewLoading ? "Rendering…" : "Render"}
                  </button>
                  {!gameRoot?.trim() ? (
                    <span className="text-[10px] text-amber-500">Set game root in Settings</span>
                  ) : null}
                </div>
                {previewB64 ? (
                  <img
                    src={`data:image/png;base64,${previewB64}`}
                    className={`w-full rounded border bg-black ${
                      light ? "border-slate-300" : "border-slate-700"
                    }`}
                    alt="template preview"
                  />
                ) : (
                  <div
                    className={`flex h-16 items-center justify-center rounded border text-[10px] ${
                      light
                        ? "border-slate-300 bg-slate-50 text-slate-500"
                        : "border-slate-800 bg-slate-950 text-slate-600"
                    }`}
                  >
                    {gameRoot?.trim() ? "Click Render" : "Set game root in Settings"}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
