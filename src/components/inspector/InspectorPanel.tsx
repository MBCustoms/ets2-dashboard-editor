import {
  BarChart2,
  Box,
  ChevronDown,
  ChevronRight,
  Database,
  Gauge,
  Layout,
  Palette,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import { CoordEditor, type CoordPatch } from "../controls/CoordEditor";
import { DashboardIdSelect } from "../controls/DashboardIdSelect";
import { MarkupToolbar } from "../controls/MarkupToolbar";
import { ScsColorPicker } from "../controls/ScsColorPicker";
import { TemplateSelect } from "../controls/TemplateSelect";
import { SpritePickerDialog } from "../dialogs/SpritePickerDialog";
import { DASHBOARD_ID_SELECT_OPTIONS } from "../../lib/dashboardIds";
import { findElementAndScreen } from "../../lib/editorElements";
import { namedColorToRgba, rgbaToScs, scsToRgba } from "../../lib/scsColors";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useTelemetryStore } from "../../store/telemetryStore";
import type { DashboardElement, DashboardProject, ElementType } from "../../types/scs";

const TYPE_LABELS: Record<ElementType, string> = {
  window: "Window",
  group: "Group",
  text: "Text (ui::text)",
  textCommon: "Text common",
  textBar: "Text bar",
  gauge: "Gauge (ui_gauge)",
};

function Section({
  title,
  icon,
  children,
  light = false,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  light?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`border-b py-2 last:border-b-0 ${light ? "border-slate-200" : "border-slate-800"}`}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide hover:opacity-80 ${
          light ? "text-slate-600" : "text-slate-400"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown size={11} className="shrink-0 opacity-60" />
        ) : (
          <ChevronRight size={11} className="shrink-0 opacity-60" />
        )}
        {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
        {title}
      </button>
      {open ? <div className="flex flex-col gap-2 pt-1">{children}</div> : null}
    </section>
  );
}

function FieldLabel({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <span className={`text-[11px] ${light ? "text-slate-600" : "text-slate-400"}`}>{children}</span>
  );
}

const inputCls = (light: boolean) =>
  light
    ? "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-emerald-500/30 focus:ring-1"
    : "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";

const inspectorShell = (light: boolean) =>
  light
    ? "flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-300 bg-white"
    : "flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-950";

export function InspectorPanel() {
  const light = useAppThemeIsLight();
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const { executeSilent } = useUndoRedo();
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  const pendingTextUndoRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    prev: DashboardProject;
    description: string;
  } | null>(null);

  const commitPendingUndo = useCallback(() => {
    if (!pendingTextUndoRef.current) return;
    clearTimeout(pendingTextUndoRef.current.timer);
    const { prev, description } = pendingTextUndoRef.current;
    pendingTextUndoRef.current = null;
    const next = structuredClone(useProjectStore.getState().project);
    if (!next) return;
    executeSilent({
      execute: () => useProjectStore.getState().applyProject(structuredClone(next)),
      undo: () => useProjectStore.getState().applyProject(structuredClone(prev)),
      description,
    });
  }, [executeSilent]);

  const screen = useMemo(() => {
    if (!project) return null;
    return (
      project.screens.find((s) => s.id === activeScreenId) ?? project.screens[0] ?? null
    );
  }, [project, activeScreenId]);

  const selection = useMemo(() => {
    if (!project || selectedIds.length !== 1) return null;
    return findElementAndScreen(project, selectedIds[0]);
  }, [project, selectedIds]);

  const element = selection?.element ?? null;
  const ownerScreen = selection?.screen ?? null;

  const onLiveTextPatch = useCallback(
    (patch: Partial<DashboardElement>, fieldLabel: string) => {
      if (!ownerScreen || !element) return;
      const sid = ownerScreen.id;
      const eid = element.id;
      if (!pendingTextUndoRef.current) {
        const preEdit = structuredClone(useProjectStore.getState().project!);
        useProjectStore.getState().updateElement(sid, eid, patch);
        pendingTextUndoRef.current = {
          prev: preEdit,
          description: `Edit ${fieldLabel}`,
          timer: setTimeout(() => {
            commitPendingUndo();
          }, 800),
        };
      } else {
        useProjectStore.getState().updateElement(sid, eid, patch);
        clearTimeout(pendingTextUndoRef.current.timer);
        pendingTextUndoRef.current.description = `Edit ${fieldLabel}`;
        pendingTextUndoRef.current.timer = setTimeout(() => {
          commitPendingUndo();
        }, 800);
      }
    },
    [ownerScreen, element, commitPendingUndo],
  );

  const commit = useCallback(
    (description: string, patch: Partial<DashboardElement>, _previous: Partial<DashboardElement>) => {
      if (!ownerScreen || !element) return;
      commitPendingUndo();
      const sid = ownerScreen.id;
      const eid = element.id;
      const prev = structuredClone(useProjectStore.getState().project!);
      useProjectStore.getState().updateElement(sid, eid, patch);
      const next = structuredClone(useProjectStore.getState().project!);
      executeSilent({
        execute: () => useProjectStore.getState().applyProject(structuredClone(next)),
        undo: () => useProjectStore.getState().applyProject(structuredClone(prev)),
        description,
      });
    },
    [ownerScreen, element, executeSilent, commitPendingUndo],
  );

  useEffect(() => {
    commitPendingUndo();
  }, [element?.id, commitPendingUndo]);

  const allNames = useMemo(() => {
    if (!project) return [];
    const set = new Set<string>();
    for (const s of project.screens) {
      for (const e of s.elements) {
        if (e.name.trim()) set.add(e.name);
      }
    }
    return Array.from(set).sort();
  }, [project]);

  const templates = project?.templates ?? [];

  if (!project) {
    return (
      <aside className={inspectorShell(light) + " p-3"}>
        <p className={light ? "text-xs text-slate-600" : "text-xs text-slate-500"}>
          No project loaded.
        </p>
      </aside>
    );
  }

  if (!screen) {
    return (
      <aside className={inspectorShell(light) + " p-3"}>
        <p className={light ? "text-xs text-slate-600" : "text-xs text-slate-500"}>No screen.</p>
      </aside>
    );
  }

  if (selectedIds.length === 0) {
    return (
      <aside className={inspectorShell(light) + " p-3"}>
        <h2 className={`mb-2 text-sm font-semibold ${light ? "text-slate-900" : "text-slate-100"}`}>
          Inspector
        </h2>
        <p className={light ? "text-xs text-slate-600" : "text-xs text-slate-500"}>
          Select an element on the canvas.
        </p>
      </aside>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <aside className={inspectorShell(light) + " p-3"}>
        <h2 className={`mb-2 text-sm font-semibold ${light ? "text-slate-900" : "text-slate-100"}`}>
          Inspector
        </h2>
        <p className={light ? "text-xs text-slate-600" : "text-xs text-slate-500"}>
          {selectedIds.length} elements selected. Choose one to edit properties.
        </p>
      </aside>
    );
  }

  if (!element || !ownerScreen) {
    return (
      <aside className={inspectorShell(light) + " p-3"}>
        <p className="text-xs text-amber-500">Selection points to a missing element.</p>
      </aside>
    );
  }

  return (
    <aside className={inspectorShell(light)}>
      <div
        className={
          light
            ? "sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur"
            : "sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur"
        }
      >
        <h2 className={`text-sm font-semibold ${light ? "text-slate-900" : "text-slate-100"}`}>
          Inspector
        </h2>
        <p
          className={`truncate font-mono text-[10px] ${light ? "text-slate-600" : "text-slate-500"}`}
        >
          {element.name}
        </p>
      </div>
      <div className="px-3 pb-6">
        <IdentitySection
          element={element}
          allNames={allNames}
          commit={commit}
          light={light}
        />
        <LayoutSection element={element} commit={commit} light={light} />
        <DataBindingSection
          element={element}
          commit={commit}
          onLiveTextPatch={onLiveTextPatch}
          commitPendingUndo={commitPendingUndo}
          light={light}
        />
        {(element.elementType === "text" ||
          element.elementType === "textCommon") && (
          <AppearanceSection
            element={element}
            templates={templates}
            commit={commit}
            onLiveTextPatch={onLiveTextPatch}
            commitPendingUndo={commitPendingUndo}
            gameRoot={project.gameRootPath ?? ""}
            light={light}
          />
        )}
        {element.elementType === "textBar" && (
          <BarSection element={element} commit={commit} light={light} />
        )}
        {element.elementType === "gauge" && (
          <GaugeSection element={element} commit={commit} light={light} />
        )}
        {element.elementType === "group" && (
          <GroupSection
            element={element}
            commit={commit}
            onLiveTextPatch={onLiveTextPatch}
            commitPendingUndo={commitPendingUndo}
            light={light}
          />
        )}
      </div>
    </aside>
  );
}

function IdentitySection({
  element,
  allNames,
  commit,
  light,
}: {
  element: DashboardElement;
  allNames: string[];
  light: boolean;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
}) {
  const [nameDraft, setNameDraft] = useState(element.name);
  const [parentDraft, setParentDraft] = useState(element.parentName);

  useEffect(() => {
    setNameDraft(element.name);
    setParentDraft(element.parentName);
  }, [element.id, element.name, element.parentName]);

  return (
    <Section title="Identity" icon={<User size={11} />} light={light}>
      <div>
        <FieldLabel light={light}>Unit name (SCS)</FieldLabel>
        <input
          className={inputCls(light) + " mt-0.5 font-mono"}
          value={nameDraft}
          placeholder="_nameless._.element"
          spellCheck={false}
          maxLength={48}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            const cleaned = nameDraft
              .replace(/[^a-zA-Z0-9._\-]/g, "")
              .slice(0, 48)
              .trim();
            if (cleaned !== nameDraft.trim()) {
              setNameDraft(cleaned);
            }
            if (cleaned !== element.name) {
              commit("Unit name", { name: cleaned }, { name: element.name });
            }
          }}
        />
        <p className={`mt-0.5 text-[10px] ${light ? "text-slate-500" : "text-slate-600"}`}>
          Max 48 chars · dots and underscores allowed · SCS unit identifier
        </p>
      </div>
      <div>
        <FieldLabel light={light}>Type</FieldLabel>
        <div
          className={
            light
              ? "mt-0.5 rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs text-slate-700"
              : "mt-0.5 rounded border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-400"
          }
        >
          {TYPE_LABELS[element.elementType]}
        </div>
      </div>
      <div>
        <FieldLabel light={light}>Parent name</FieldLabel>
        <input
          className={inputCls(light) + " mt-0.5 font-mono"}
          value={parentDraft}
          spellCheck={false}
          list="inspector-parent-names"
          onChange={(e) => setParentDraft(e.target.value)}
          onBlur={() => {
            const v = parentDraft.trim();
            if (v !== element.parentName) {
              commit("Parent name", { parentName: v }, { parentName: element.parentName });
            }
          }}
        />
        <datalist id="inspector-parent-names">
          {allNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={element.isVisible}
          onChange={(e) => {
            const on = e.target.checked;
            commit("Visibility", { isVisible: on }, { isVisible: element.isVisible });
          }}
        />
        <span className={light ? "text-xs text-slate-700" : "text-xs text-slate-300"}>Visible</span>
      </label>
    </Section>
  );
}

function LayoutSection({
  element,
  commit,
  light,
}: {
  element: DashboardElement;
  light: boolean;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
}) {
  const project = useProjectStore((s) => s.project);
  const cw = project?.canvasWidth ?? 800;
  const ch = project?.canvasHeight ?? 800;
  return (
    <Section title="Layout" icon={<Layout size={11} />} light={light}>
      <CoordEditor
        coordsL={element.coordsL}
        coordsR={element.coordsR}
        coordsT={element.coordsT}
        coordsB={element.coordsB}
        layer={element.layer}
        canvasWidth={cw}
        canvasHeight={ch}
        light={light}
        onCommit={(desc, patch: CoordPatch, revert) =>
          commit(desc, patch as Partial<DashboardElement>, revert as Partial<DashboardElement>)
        }
      />
    </Section>
  );
}

const TELEMETRY_VALUE_PRESETS: { label: string; id: number; sample: string }[] = [
  { label: "Speed", id: 1020, sample: "88|km/h" },
  { label: "Gear", id: 1040, sample: "12" },
  { label: "Fuel", id: 1060, sample: "400|l" },
  { label: "Clock", id: 1050, sample: "12:00" },
  { label: "Cruise", id: 1100, sample: "90|km/h" },
];

/** Count the maximum %N index in a template string, returns number of slots (max+1). */
function countTemplateSlots(text: string): number {
  let max = -1;
  const re = /%(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function DataBindingSection({
  element,
  commit,
  onLiveTextPatch,
  commitPendingUndo,
  light,
}: {
  element: DashboardElement;
  light: boolean;
  onLiveTextPatch: (p: Partial<DashboardElement>, field: string) => void;
  commitPendingUndo: () => void;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
}) {
  const project = useProjectStore((s) => s.project);
  const [defaultDraft, setDefaultDraft] = useState(element.defaultValue);
  const defaultSnap = useRef(element.defaultValue);

  useEffect(() => {
    setDefaultDraft(element.defaultValue);
    defaultSnap.current = element.defaultValue;
  }, [element.id, element.defaultValue]);

  // Per-slot default value support
  const template = project?.templates.find((t) => t.name === element.lookTemplate);
  const slotCount = template ? countTemplateSlots(template.text) : 0;

  const slotInputs =
    slotCount > 0 ? (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: slotCount }, (_, i) => {
          const parts = defaultDraft.split("|");
          const slotVal = parts[i] ?? "";
          return (
            <div key={i}>
              <FieldLabel light={light}>Slot %{i}</FieldLabel>
              <input
                className={inputCls(light) + " mt-0.5 font-mono"}
                value={slotVal}
                placeholder={`%${i} value`}
                onChange={(e) => {
                  const parts2 = defaultDraft.split("|");
                  while (parts2.length <= i) parts2.push("");
                  parts2[i] = e.target.value;
                  const joined = parts2.join("|");
                  setDefaultDraft(joined);
                  onLiveTextPatch({ defaultValue: joined }, "defaultValue");
                }}
                onBlur={() => {
                  commitPendingUndo();
                  defaultSnap.current = defaultDraft;
                }}
              />
            </div>
          );
        })}
        <p className={`text-[10px] ${light ? "text-slate-500" : "text-slate-600"}`}>
          Each slot maps to <code>%0</code>, <code>%1</code>… in template <code>{element.lookTemplate}</code>. Joined with <code>|</code> as default value.
        </p>
      </div>
    ) : null;

  return (
    <Section title="Data binding" icon={<Database size={11} />} light={light}>
      <div>
        <FieldLabel light={light}>Dashboard ID</FieldLabel>
        <div className="mt-0.5 flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <DashboardIdSelect
              light={light}
              value={element.dashboardId}
              onChange={(n) =>
                commit(
                  "Dashboard ID",
                  { dashboardId: n },
                  { dashboardId: element.dashboardId },
                )
              }
            />
          </div>
          <button
            type="button"
            title="Auto-assign a free dashboard ID"
            className={
              light
                ? "shrink-0 rounded border border-slate-300 bg-slate-100 px-1.5 py-1 text-[10px] text-emerald-700 hover:bg-slate-200"
                : "shrink-0 rounded bg-slate-800 px-1.5 py-1 text-[10px] text-emerald-400 hover:bg-slate-700"
            }
            onClick={() => {
              if (!project) return;
              const usedIds = new Set<number>();
              for (const s of project.screens) {
                for (const el of s.elements) {
                  if (el.id !== element.id && el.dashboardId > 0) {
                    usedIds.add(el.dashboardId);
                  }
                }
              }
              const free = DASHBOARD_ID_SELECT_OPTIONS.find(
                (id) => id > 0 && !usedIds.has(id),
              );
              if (free !== undefined) {
                commit(
                  "Dashboard ID (auto)",
                  { dashboardId: free },
                  { dashboardId: element.dashboardId },
                );
              } else {
                commit(
                  "Dashboard ID (auto)",
                  { dashboardId: 0 },
                  { dashboardId: element.dashboardId },
                );
              }
            }}
          >
            Auto
          </button>
        </div>
      </div>
      <div>
        <FieldLabel light={light}>Default value</FieldLabel>
        {slotInputs ?? (
          <>
            <input
              className={inputCls(light) + " mt-0.5 font-mono"}
              value={defaultDraft}
              placeholder='e.g. "88|km/h" for templates'
              onChange={(e) => {
                const v = e.target.value;
                setDefaultDraft(v);
                onLiveTextPatch({ defaultValue: v }, "defaultValue");
              }}
              onBlur={() => {
                commitPendingUndo();
                defaultSnap.current = defaultDraft;
              }}
            />
            <p className={`mt-0.5 text-[10px] ${light ? "text-slate-500" : "text-slate-600"}`}>
              Preview for <code>text_common</code> / template slots. Updates canvas live.
            </p>
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {TELEMETRY_VALUE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                light
                  ? "rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                  : "rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
              }
              onClick={() => {
                commit(
                  `Telemetry preset ${p.label}`,
                  { dashboardId: p.id, defaultValue: p.sample },
                  {
                    dashboardId: element.dashboardId,
                    defaultValue: element.defaultValue,
                  },
                );
                setDefaultDraft(p.sample);
                defaultSnap.current = p.sample;
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function scsHexForColorTag(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("@@")) {
    const rgba = namedColorToRgba(t);
    return rgba ? rgbaToScs(rgba[0], rgba[1], rgba[2], rgba[3]) : "FFFFFFFF";
  }
  const rgba = scsToRgba(t);
  if (rgba) {
    return rgbaToScs(rgba[0], rgba[1], rgba[2], rgba[3]);
  }
  const hex = t.replace(/^#/, "").toUpperCase();
  return hex.length === 8 ? hex : "FFFFFFFF";
}

function AppearanceSection({
  element,
  templates,
  commit,
  onLiveTextPatch,
  commitPendingUndo,
  gameRoot,
  light,
}: {
  element: DashboardElement;
  templates: { name: string; text: string }[];
  onLiveTextPatch: (p: Partial<DashboardElement>, field: string) => void;
  commitPendingUndo: () => void;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
  gameRoot: string;
  light: boolean;
}) {
  const modRootPaths = useSettingsStore((s) => s.modRootPaths);
  const [textDraft, setTextDraft] = useState(element.textContent);
  const [colorDraft, setColorDraft] = useState("FFFFFFFF");
  const [spriteOpen, setSpriteOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const textSnap = useRef(element.textContent);

  useEffect(() => {
    setTextDraft(element.textContent);
    textSnap.current = element.textContent;
  }, [element.id, element.textContent]);

  const insertAtCursor = (snippet: string, description: string) => {
    const ta = taRef.current;
    const base = ta ? ta.value : textDraft;
    const start = ta?.selectionStart ?? base.length;
    const end = ta?.selectionEnd ?? start;
    const next = base.slice(0, start) + snippet + base.slice(end);
    setTextDraft(next);
    commit(description, { textContent: next }, { textContent: base });
    textSnap.current = next;
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <Section title="Appearance" icon={<Palette size={11} />} light={light}>
      <SpritePickerDialog
        open={spriteOpen}
        onClose={() => setSpriteOpen(false)}
        gameRoot={gameRoot}
        modRootPaths={modRootPaths}
        defaultMatPath="/material/ui/white.mat"
        onConfirm={(markup) => insertAtCursor(markup, "Insert img markup")}
      />
      <div>
        <FieldLabel light={light}>Look template</FieldLabel>
        <TemplateSelect
          className="mt-0.5"
          light={light}
          value={element.lookTemplate}
          templates={templates}
          onChange={(v) =>
            commit("Look template", { lookTemplate: v }, { lookTemplate: element.lookTemplate })
          }
        />
      </div>
      <div>
        <FieldLabel light={light}>SCS color (insert)</FieldLabel>
        <ScsColorPicker
          light={light}
          value={colorDraft}
          onChange={setColorDraft}
          className="mt-1"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={
              light
                ? "rounded border border-slate-400 px-2 py-1 text-[11px] text-slate-800 hover:bg-slate-100"
                : "rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            }
            onClick={() =>
              insertAtCursor(
                `<color value=${scsHexForColorTag(colorDraft)}>`,
                "Insert color tag",
              )
            }
          >
            Insert &lt;color&gt;…
          </button>
          <button
            type="button"
            className={
              light
                ? "rounded border border-slate-400 px-2 py-1 text-[11px] text-slate-800 hover:bg-slate-100"
                : "rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            }
            onClick={() => insertAtCursor("</color>", "Insert closing color tag")}
          >
            Insert &lt;/color&gt;
          </button>
          <button
            type="button"
            className={
              light
                ? "rounded border border-emerald-600 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900 hover:bg-emerald-100"
                : "rounded border border-emerald-800/80 bg-emerald-950/50 px-2 py-1 text-[11px] text-emerald-200/90 hover:bg-emerald-900/40"
            }
            onClick={() => setSpriteOpen(true)}
          >
            Sprite picker…
          </button>
        </div>
      </div>
      <div>
        <FieldLabel light={light}>Text content (markup)</FieldLabel>
        <MarkupToolbar light={light} onInsert={(s) => insertAtCursor(s, "Markup quick-insert")} />
        <textarea
          ref={taRef}
          className={inputCls(light) + " mt-0.5 min-h-[120px] resize-y font-mono"}
          value={textDraft}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value;
            setTextDraft(v);
            onLiveTextPatch({ textContent: v }, "textContent");
          }}
          onBlur={() => {
            commitPendingUndo();
            textSnap.current = textDraft;
          }}
        />
        <p className={`mt-0.5 text-[10px] ${light ? "text-slate-500" : "text-slate-600"}`}>
          For <code>text_common</code>, in-game text usually comes from the template; this field
          is still editable for export / mixed workflows. Edits update the canvas immediately.
        </p>
      </div>
    </Section>
  );
}

function BarSection({
  element,
  commit,
  light,
}: {
  element: DashboardElement;
  light: boolean;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
}) {
  const [minV, setMinV] = useState(String(element.barMinValue));
  const [maxV, setMaxV] = useState(String(element.barMaxValue));
  const [minS, setMinS] = useState(String(element.barMinSize));
  const [maxS, setMaxS] = useState(String(element.barMaxSize));

  useEffect(() => {
    setMinV(String(element.barMinValue));
    setMaxV(String(element.barMaxValue));
    setMinS(String(element.barMinSize));
    setMaxS(String(element.barMaxSize));
  }, [element.id, element.barMinValue, element.barMaxValue, element.barMinSize, element.barMaxSize]);

  const blurF = (
    label: string,
    field: "barMinValue" | "barMaxValue",
    raw: string,
    setRaw: (s: string) => void,
    cur: number,
  ) => {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n)) {
      setRaw(String(cur));
      return;
    }
    if (n !== cur) {
      commit(label, { [field]: n }, { [field]: cur });
    }
  };

  const blurI = (
    label: string,
    field: "barMinSize" | "barMaxSize",
    raw: string,
    setRaw: (s: string) => void,
    cur: number,
  ) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setRaw(String(cur));
      return;
    }
    if (n !== cur) {
      commit(label, { [field]: n }, { [field]: cur });
    }
  };

  return (
    <details
      open
      className={`group border-b py-3 last:border-b-0 ${light ? "border-slate-200" : "border-slate-800"}`}
    >
      <summary
        className={`flex cursor-pointer select-none list-none items-center gap-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 ${
          light ? "text-slate-600" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <BarChart2 size={11} className="shrink-0 opacity-70" />
        Bar settings
      </summary>
      <div className="mt-1 flex flex-col gap-2 pl-2">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={element.isVertical}
          onChange={(e) => {
            const v = e.target.checked;
            commit("Bar vertical", { isVertical: v }, { isVertical: element.isVertical });
          }}
        />
        <span className={light ? "text-xs text-slate-700" : "text-xs text-slate-300"}>
          Vertical orientation
        </span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel light={light}>Min value</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={minV}
            onChange={(e) => setMinV(e.target.value)}
            onBlur={() => blurF("Bar min value", "barMinValue", minV, setMinV, element.barMinValue)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Max value</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={maxV}
            onChange={(e) => setMaxV(e.target.value)}
            onBlur={() => blurF("Bar max value", "barMaxValue", maxV, setMaxV, element.barMaxValue)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Min size (px)</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={minS}
            inputMode="numeric"
            onChange={(e) => setMinS(e.target.value)}
            onBlur={() => blurI("Bar min size", "barMinSize", minS, setMinS, element.barMinSize)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Max size (px)</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={maxS}
            inputMode="numeric"
            onChange={(e) => setMaxS(e.target.value)}
            onBlur={() => blurI("Bar max size", "barMaxSize", maxS, setMaxS, element.barMaxSize)}
          />
        </div>
      </div>
      <p className={light ? "text-[10px] text-slate-500" : "text-[10px] text-slate-600"}>
        Bar fills from min_size to max_size based on telemetry value (min_value → max_value).
      </p>
      <BarTestSlider element={element} light={light} />
      </div>
    </details>
  );
}

function BarTestSlider({
  element,
  light,
}: {
  element: DashboardElement;
  light: boolean;
}) {
  const simulationMode = useTelemetryStore((s) => s.simulationMode);
  const setSimulationMode = useTelemetryStore((s) => s.setSimulationMode);
  const setSimulationValue = useTelemetryStore((s) => s.setSimulationValue);
  const simValue = useTelemetryStore(
    (s) => s.simulation[element.dashboardId],
  );

  // Slider range rules:
  // - max value = element.barMaxValue if it is a usable positive integer; otherwise
  //   round it (so e.g. 1.7 becomes 2, 0.4 becomes 0). Always at least 1, so the
  //   slider is interactive even when the user typed 0 / a fractional max.
  // - min value follows the same idea but defaults to 0 / floor(barMinValue).
  const sliderMax = useMemo(
    () => Math.max(1, Math.round(element.barMaxValue || 0)),
    [element.barMaxValue],
  );
  const sliderMin = useMemo(() => {
    const m = Math.round(element.barMinValue || 0);
    return Math.min(m, sliderMax - 1);
  }, [element.barMinValue, sliderMax]);

  // Step heuristic: finer granularity for small ranges so percentages, ratios etc.
  // remain testable, integer steps for big ranges (rpm, speed, fuel, …).
  const span = sliderMax - sliderMin;
  const step = span <= 1 ? 0.01 : span <= 10 ? 0.1 : 1;

  const initial =
    typeof simValue === "number" && Number.isFinite(simValue)
      ? simValue
      : sliderMin;
  const clampedInitial = Math.min(sliderMax, Math.max(sliderMin, initial));
  const [value, setValue] = useState<number>(clampedInitial);

  useEffect(() => {
    if (typeof simValue === "number" && Number.isFinite(simValue)) {
      const c = Math.min(sliderMax, Math.max(sliderMin, simValue));
      setValue(c);
    } else {
      setValue(sliderMin);
    }
  }, [element.id, simValue, sliderMin, sliderMax]);

  const apply = (n: number) => {
    setValue(n);
    setSimulationValue(element.dashboardId, n);
    if (!simulationMode) setSimulationMode(true);
  };

  const reset = () => {
    apply(sliderMin);
  };

  const dashboardId = element.dashboardId;
  const disabled = !dashboardId;

  return (
    <div
      className={`mt-2 rounded border px-2 py-2 ${
        light ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <FieldLabel light={light}>Test value (canvas preview)</FieldLabel>
        <span
          className={`font-mono text-[11px] ${light ? "text-slate-700" : "text-slate-200"}`}
        >
          {disabled ? "—" : value.toFixed(step >= 1 ? 0 : 2)}
        </span>
      </div>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => apply(parseFloat(e.target.value))}
        className={`w-full ${light ? "accent-emerald-600" : "accent-emerald-500"} ${
          disabled ? "opacity-50" : ""
        }`}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`font-mono text-[10px] ${light ? "text-slate-500" : "text-slate-500"}`}>
          {sliderMin} … {sliderMax}
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={disabled}
          className={`rounded border px-1.5 py-0.5 text-[10px] ${
            light
              ? "border-slate-300 text-slate-600 hover:bg-slate-100"
              : "border-slate-700 text-slate-400 hover:bg-slate-800"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Reset
        </button>
      </div>
      {disabled ? (
        <p className={`mt-1 text-[10px] ${light ? "text-slate-500" : "text-slate-500"}`}>
          Bu bara bir Dashboard ID atanmadığı için test değeri uygulanamıyor.
        </p>
      ) : !simulationMode ? (
        <p className={`mt-1 text-[10px] ${light ? "text-amber-700" : "text-amber-300/90"}`}>
          Slider kullanıldığında simülasyon modu otomatik açılır; canvas önizlemesi
          bu değerle yenilenir.
        </p>
      ) : (
        <p className={`mt-1 text-[10px] ${light ? "text-slate-500" : "text-slate-500"}`}>
          Simülasyon modu açık — telemetri panelindeki diğer kanallar da kullanılır.
        </p>
      )}
    </div>
  );
}

function GaugeSection({
  element,
  commit,
  light,
}: {
  element: DashboardElement;
  light: boolean;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
}) {
  const [gFields, setGFields] = useState({
    minA: String(element.gaugeMinAngle),
    maxA: String(element.gaugeMaxAngle),
    vmin: String(element.gaugeValueMin),
    vmax: String(element.gaugeValueMax),
    voff: String(element.gaugeValueOff),
    mat: element.gaugeMaterial,
    xr: String(element.gaugeXrefPos),
    yr: String(element.gaugeYrefPos),
    ox: String(element.gaugeOffX),
    oy: String(element.gaugeOffY),
  });

  useEffect(() => {
    setGFields({
      minA: String(element.gaugeMinAngle),
      maxA: String(element.gaugeMaxAngle),
      vmin: String(element.gaugeValueMin),
      vmax: String(element.gaugeValueMax),
      voff: String(element.gaugeValueOff),
      mat: element.gaugeMaterial,
      xr: String(element.gaugeXrefPos),
      yr: String(element.gaugeYrefPos),
      ox: String(element.gaugeOffX),
      oy: String(element.gaugeOffY),
    });
  }, [
    element.id,
    element.gaugeMinAngle,
    element.gaugeMaxAngle,
    element.gaugeValueMin,
    element.gaugeValueMax,
    element.gaugeValueOff,
    element.gaugeMaterial,
    element.gaugeXrefPos,
    element.gaugeYrefPos,
    element.gaugeOffX,
    element.gaugeOffY,
  ]);

  const blurAngle = (field: "gaugeMinAngle" | "gaugeMaxAngle", raw: string, cur: number) => {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n)) return;
    if (n !== cur) commit(field, { [field]: n }, { [field]: cur });
  };

  const blurVal = (
    field: "gaugeValueMin" | "gaugeValueMax" | "gaugeValueOff",
    raw: string,
    cur: number,
  ) => {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n)) return;
    if (n !== cur) commit(field, { [field]: n }, { [field]: cur });
  };

  const blurI = (
    field: "gaugeXrefPos" | "gaugeYrefPos" | "gaugeOffX" | "gaugeOffY",
    raw: string,
    cur: number,
  ) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    if (n !== cur) commit(field, { [field]: n }, { [field]: cur });
  };

  return (
    <details
      open
      className={`group border-b py-3 last:border-b-0 ${light ? "border-slate-200" : "border-slate-800"}`}
    >
      <summary
        className={`flex cursor-pointer select-none list-none items-center gap-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 ${
          light ? "text-slate-600" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <Gauge size={11} className="shrink-0 opacity-70" />
        Gauge settings
      </summary>
      <div className="mt-1 flex flex-col gap-2 pl-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel light={light}>Min angle °</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.minA}
            onChange={(e) => setGFields((s) => ({ ...s, minA: e.target.value }))}
            onBlur={() => {
              blurAngle("gaugeMinAngle", gFields.minA, element.gaugeMinAngle);
            }}
          />
        </div>
        <div>
          <FieldLabel light={light}>Max angle °</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.maxA}
            onChange={(e) => setGFields((s) => ({ ...s, maxA: e.target.value }))}
            onBlur={() => {
              blurAngle("gaugeMaxAngle", gFields.maxA, element.gaugeMaxAngle);
            }}
          />
        </div>
        <div>
          <FieldLabel light={light}>Value min</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.vmin}
            onChange={(e) => setGFields((s) => ({ ...s, vmin: e.target.value }))}
            onBlur={() => blurVal("gaugeValueMin", gFields.vmin, element.gaugeValueMin)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Value max</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.vmax}
            onChange={(e) => setGFields((s) => ({ ...s, vmax: e.target.value }))}
            onBlur={() => blurVal("gaugeValueMax", gFields.vmax, element.gaugeValueMax)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Value off</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.voff}
            onChange={(e) => setGFields((s) => ({ ...s, voff: e.target.value }))}
            onBlur={() => blurVal("gaugeValueOff", gFields.voff, element.gaugeValueOff)}
          />
        </div>
      </div>
      <div>
        <FieldLabel light={light}>Material (.mat path)</FieldLabel>
        <input
          className={inputCls(light) + " mt-0.5 font-mono"}
          value={gFields.mat}
          spellCheck={false}
          onChange={(e) => setGFields((s) => ({ ...s, mat: e.target.value }))}
          onBlur={() => {
            if (gFields.mat !== element.gaugeMaterial) {
              commit(
                "Gauge material",
                { gaugeMaterial: gFields.mat },
                { gaugeMaterial: element.gaugeMaterial },
              );
            }
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel light={light}>Ref X</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.xr}
            inputMode="numeric"
            onChange={(e) => setGFields((s) => ({ ...s, xr: e.target.value }))}
            onBlur={() => blurI("gaugeXrefPos", gFields.xr, element.gaugeXrefPos)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Ref Y</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.yr}
            inputMode="numeric"
            onChange={(e) => setGFields((s) => ({ ...s, yr: e.target.value }))}
            onBlur={() => blurI("gaugeYrefPos", gFields.yr, element.gaugeYrefPos)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Offset X</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.ox}
            inputMode="numeric"
            onChange={(e) => setGFields((s) => ({ ...s, ox: e.target.value }))}
            onBlur={() => blurI("gaugeOffX", gFields.ox, element.gaugeOffX)}
          />
        </div>
        <div>
          <FieldLabel light={light}>Offset Y</FieldLabel>
          <input
            className={inputCls(light) + " mt-0.5"}
            value={gFields.oy}
            inputMode="numeric"
            onChange={(e) => setGFields((s) => ({ ...s, oy: e.target.value }))}
            onBlur={() => blurI("gaugeOffY", gFields.oy, element.gaugeOffY)}
          />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={element.gaugeSmoothMove}
          onChange={(e) => {
            const v = e.target.checked;
            commit("Gauge smooth move", { gaugeSmoothMove: v }, { gaugeSmoothMove: element.gaugeSmoothMove });
          }}
        />
        <span className={light ? "text-xs text-slate-700" : "text-xs text-slate-300"}>Smooth move</span>
      </label>
      </div>
    </details>
  );
}

function GroupSection({
  element,
  commit,
  onLiveTextPatch,
  commitPendingUndo,
  light,
}: {
  element: DashboardElement;
  light: boolean;
  onLiveTextPatch: (p: Partial<DashboardElement>, field: string) => void;
  commitPendingUndo: () => void;
  commit: (
    d: string,
    p: Partial<DashboardElement>,
    prev: Partial<DashboardElement>,
  ) => void;
}) {
  const [textDraft, setTextDraft] = useState(element.textContent ?? "");
  const textSnap = useRef(element.textContent ?? "");

  useEffect(() => {
    setTextDraft(element.textContent ?? "");
    textSnap.current = element.textContent ?? "";
  }, [element.id, element.textContent]);

  return (
    <Section title="Group" icon={<Box size={11} />} light={light}>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={element.fitting === false}
          onChange={(e) => {
            const suppress = e.target.checked;
            commit(
              "Group fitting",
              { fitting: suppress ? false : undefined },
              { fitting: element.fitting },
            );
          }}
        />
        <span className={light ? "text-xs text-slate-700" : "text-xs text-slate-300"}>
          Suppress fitting (<code>fitting: false</code>)
        </span>
      </label>
      <div>
        <FieldLabel light={light}>Text content (markup)</FieldLabel>
        <textarea
          className={inputCls(light) + " mt-0.5 min-h-[80px] resize-y font-mono"}
          value={textDraft}
          spellCheck={false}
          placeholder="Optional markup content for this group"
          onChange={(e) => {
            const v = e.target.value;
            setTextDraft(v);
            onLiveTextPatch({ textContent: v }, "textContent");
          }}
          onBlur={() => {
            commitPendingUndo();
            textSnap.current = textDraft;
          }}
        />
      </div>
    </Section>
  );
}
