import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  Layers,
  Type,
} from "lucide-react";

import { useUndoRedo } from "../../contexts/UndoRedoContext";
import { useAppThemeIsLight } from "../../hooks/useAppThemeIsLight";
import {
  filterLayerTreeElements,
  findElementAndScreen,
  isDirectChildOfSharedScreenRoot,
  mergedEditorElements,
  sharedScreen950,
} from "../../lib/editorElements";
import { useCanvasStore } from "../../store/canvasStore";
import { useProjectStore } from "../../store/projectStore";
import type { DashboardElement, DashboardProject } from "../../types/scs";

const TYPE_ICON: Record<string, { icon: ReactNode; color: string }> = {
  text: { icon: <Type size={10} />, color: "#60a5fa" },
  textCommon: { icon: <span className="text-[8px] font-bold">Tc</span>, color: "#34d399" },
  textBar: { icon: <BarChart2 size={10} />, color: "#fbbf24" },
  gauge: { icon: <Gauge size={10} />, color: "#c084fc" },
  group: { icon: <Layers size={10} />, color: "#94a3b8" },
  window: { icon: <Box size={10} />, color: "#f87171" },
};

type TreeNode =
  | {
      kind: "element";
      element: DashboardElement;
      children: TreeNode[];
      depth: number;
    }
  | {
      kind: "virtual";
      id: string;
      label: string;
      hint: string;
      children: TreeNode[];
      depth: number;
    };

function buildTree(elements: DashboardElement[]): TreeNode[] {
  const byName = new Map<string, DashboardElement>();
  for (const el of elements) {
    if (el.name) byName.set(el.name, el);
  }

  const childrenOf = new Map<string, DashboardElement[]>();
  const rootEls: DashboardElement[] = [];

  for (const el of elements) {
    if (el.parentName && byName.has(el.parentName)) {
      const arr = childrenOf.get(el.parentName) ?? [];
      arr.push(el);
      childrenOf.set(el.parentName, arr);
    } else {
      rootEls.push(el);
    }
  }

  function buildNode(el: DashboardElement, depth: number): TreeNode {
    const kids = (childrenOf.get(el.name) ?? []).sort((a, b) => b.layer - a.layer);
    return {
      kind: "element",
      element: el,
      depth,
      children: kids.map((k) => buildNode(k, depth + 1)),
    };
  }

  return rootEls.sort((a, b) => b.layer - a.layer).map((el) => buildNode(el, 0));
}

function bumpTreeDepth(nodes: TreeNode[], delta: number): TreeNode[] {
  return nodes.map((n) => ({
    ...n,
    depth: n.depth + delta,
    children: bumpTreeDepth(n.children, delta),
  }));
}

/** Groups top-level nodes that were direct children of the (hidden) shared root under a virtual parent row. */
function wrapSharedVirtualParent(project: DashboardProject, roots: TreeNode[]): TreeNode[] {
  const shared = sharedScreen950(project);
  if (!shared) return roots;

  const sharedRoots: TreeNode[] = [];
  const otherRoots: TreeNode[] = [];

  for (const r of roots) {
    if (r.kind === "virtual") {
      otherRoots.push(r);
      continue;
    }
    if (isDirectChildOfSharedScreenRoot(project, r.element)) {
      sharedRoots.push(r);
    } else {
      otherRoots.push(r);
    }
  }

  if (sharedRoots.length === 0) return roots;

  const bumped = bumpTreeDepth(sharedRoots, 1);
  const virtual: TreeNode = {
    kind: "virtual",
    id: "layer-tree-virtual-shared-950",
    label: shared.unitName.trim(),
    hint: "Shared · 950",
    depth: 0,
    children: bumped,
  };

  return [virtual, ...otherRoots];
}

function layerRowCls(isSel: boolean, light: boolean) {
  if (isSel) {
    return light
      ? "flex cursor-pointer select-none items-center gap-1 rounded-sm bg-emerald-100 px-1 py-0.5 text-[11px] text-emerald-900"
      : "flex cursor-pointer select-none items-center gap-1 rounded-sm bg-emerald-900/50 px-1 py-0.5 text-[11px] text-slate-100";
  }
  return light
    ? "flex cursor-pointer select-none items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100"
    : "flex cursor-pointer select-none items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/60";
}

function VirtualLayerRow({
  node,
  light,
  children,
}: {
  node: Extract<TreeNode, { kind: "virtual" }>;
  light: boolean;
  children: (n: TreeNode) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasKids = node.children.length > 0;
  const grp = TYPE_ICON.group;

  return (
    <>
      <div
        className={
          light
            ? "flex cursor-default select-none items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-slate-500"
            : "flex cursor-default select-none items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] text-slate-500"
        }
        style={{ paddingLeft: `${node.depth * 12 + 4}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`flex w-4 shrink-0 items-center justify-center text-slate-500 ${!hasKids ? "invisible" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        <span className="w-[13px] shrink-0" aria-hidden />

        <span
          className="flex h-[14px] w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold opacity-70"
          style={{ color: grp.color, backgroundColor: `${grp.color}22` }}
        >
          {grp.icon}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono" title={node.label}>
          {node.label}
        </span>

        <span
          className={
            light ? "shrink-0 text-[9px] text-slate-400 italic" : "shrink-0 text-[9px] text-slate-500 italic"
          }
        >
          {node.hint}
        </span>

        <span className="w-6 shrink-0" />
        <span className="w-6 shrink-0" />
      </div>

      {hasKids && expanded ? node.children.map((child) => <div key={treeNodeKey(child)}>{children(child)}</div>) : null}
    </>
  );
}

function treeNodeKey(node: TreeNode): string {
  if (node.kind === "virtual") return node.id;
  return node.element.id;
}

function LayerRow({
  node,
  selectedIds,
  onSelect,
  onToggleVis,
  onChangeLayer,
  light,
}: {
  node: TreeNode;
  selectedIds: string[];
  onSelect: (id: string, multi: boolean) => void;
  onToggleVis: (id: string) => void;
  onChangeLayer: (id: string, delta: number) => void;
  light: boolean;
}) {
  if (node.kind === "virtual") {
    return (
      <VirtualLayerRow node={node} light={light}>
        {(child) => (
          <LayerRow
            node={child}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onToggleVis={onToggleVis}
            onChangeLayer={onChangeLayer}
            light={light}
          />
        )}
      </VirtualLayerRow>
    );
  }

  const el = node.element;
  const [expanded, setExpanded] = useState(true);
  const isSel = selectedIds.includes(el.id);
  const typeInfo = TYPE_ICON[el.elementType] ?? {
    icon: <span className="text-[9px]">?</span>,
    color: "#94a3b8",
  };
  const hasKids = node.children.length > 0;

  const label =
    el.defaultValue?.split("|")[0] ||
    el.lookTemplate?.split(".").pop() ||
    el.name?.split(".").pop() ||
    el.id.slice(0, 8);

  return (
    <>
      <div
        className={layerRowCls(isSel, light)}
        style={{ paddingLeft: `${node.depth * 12 + 4}px` }}
        onClick={(e) => onSelect(el.id, e.ctrlKey || e.metaKey)}
      >
        <button
          type="button"
          className={`flex w-4 shrink-0 items-center justify-center text-slate-500 ${!hasKids ? "invisible" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        <button
          type="button"
          className="flex shrink-0 items-center text-slate-400 opacity-80 hover:opacity-100"
          title={el.isVisible ? "Hide" : "Show"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVis(el.id);
          }}
        >
          {el.isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>

        <span
          className="flex h-[14px] w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold"
          style={{ color: typeInfo.color, backgroundColor: `${typeInfo.color}22` }}
        >
          {typeInfo.icon}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono" title={el.name}>
          {label}
        </span>

        {el.dashboardId !== 0 ? (
          <span className="shrink-0 rounded bg-slate-800 px-1 text-[9px] text-slate-500">
            #{el.dashboardId}
          </span>
        ) : null}

        <span className="w-6 shrink-0 text-right text-[9px] text-slate-600">{el.layer}</span>

        <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="rounded px-0.5 text-slate-600 hover:bg-slate-700 hover:text-slate-300"
            title="Bring forward"
            onClick={() => onChangeLayer(el.id, 1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            className="rounded px-0.5 text-slate-600 hover:bg-slate-700 hover:text-slate-300"
            title="Send backward"
            onClick={() => onChangeLayer(el.id, -1)}
          >
            <ArrowDown size={12} />
          </button>
        </div>
      </div>

      {hasKids && expanded
        ? node.children.map((child) => (
            <LayerRow
              key={treeNodeKey(child)}
              node={child}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onToggleVis={onToggleVis}
              onChangeLayer={onChangeLayer}
              light={light}
            />
          ))
        : null}
    </>
  );
}

export function LayersPanel() {
  const light = useAppThemeIsLight();
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useProjectStore((s) => s.activeScreenId);
  const applyProject = useProjectStore((s) => s.applyProject);
  const { executeCommand } = useUndoRedo();
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const toggleSelected = useCanvasStore((s) => s.toggleSelected);

  const screen =
    project?.screens.find((s) => s.id === activeScreenId) ?? project?.screens[0];
  const tree = useMemo(() => {
    if (!project || !screen) return [];
    const merged = mergedEditorElements(project, screen);
    const filtered = filterLayerTreeElements(project, merged);
    const roots = buildTree(filtered);
    return wrapSharedVirtualParent(project, roots);
  }, [project, screen]);

  const changeLayer = (id: string, delta: number) => {
    if (!project) return;
    const found = findElementAndScreen(project, id);
    if (!found) return;
    const prev = structuredClone(project);
    const next = {
      ...project,
      screens: project.screens.map((s) =>
        s.id === found.screen.id
          ? {
              ...s,
              elements: s.elements.map((el) =>
                el.id === id ? { ...el, layer: el.layer + delta } : el,
              ),
            }
          : s,
      ),
    };
    executeCommand({
      execute: () => applyProject(structuredClone(next)),
      undo: () => applyProject(prev),
      description: delta > 0 ? "Bring forward" : "Send backward",
    });
  };

  const toggleVis = (id: string) => {
    if (!project) return;
    const found = findElementAndScreen(project, id);
    if (!found) return;
    const prev = structuredClone(project);
    const next = {
      ...project,
      screens: project.screens.map((s) =>
        s.id === found.screen.id
          ? {
              ...s,
              elements: s.elements.map((el) =>
                el.id === id ? { ...el, isVisible: !el.isVisible } : el,
              ),
            }
          : s,
      ),
    };
    executeCommand({
      execute: () => applyProject(structuredClone(next)),
      undo: () => applyProject(prev),
      description: "Toggle visibility",
    });
  };

  const handleSelect = (id: string, multi: boolean) => {
    if (multi) toggleSelected(id);
    else setSelection([id]);
  };

  if (!screen) {
    return (
      <p className={`px-2 py-3 text-[11px] ${light ? "text-slate-500" : "text-slate-600"}`}>
        No screen.
      </p>
    );
  }

  const total = project
    ? filterLayerTreeElements(project, mergedEditorElements(project, screen)).length
    : 0;

  return (
    <div className="flex flex-col">
      <div
        className={
          light
            ? "border-b border-slate-200 px-2 py-1 text-[10px] text-slate-500"
            : "border-b border-slate-800 px-2 py-1 text-[10px] text-slate-500"
        }
      >
        {total} elements · sorted by layer (top = front)
      </div>
      <div className="flex flex-col">
        {tree.map((node) => (
          <LayerRow
            key={treeNodeKey(node)}
            node={node}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onToggleVis={toggleVis}
            onChangeLayer={changeLayer}
            light={light}
          />
        ))}
      </div>
    </div>
  );
}
