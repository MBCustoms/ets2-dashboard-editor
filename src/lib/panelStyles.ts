/** Dark-theme panel tokens (legacy default). */
export const PANEL = {
  section: "border-b border-slate-800 px-3 py-2",
  sectionTitle: "mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500",
  row: "flex items-center justify-between gap-2 py-0.5",
  label: "text-[11px] text-slate-400",
  input:
    "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-600",
  btn: {
    primary: "rounded bg-emerald-800 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-700",
    danger: "rounded bg-red-900/50 px-2 py-1 text-[11px] text-red-300 hover:bg-red-900",
    ghost: "rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200",
    icon: "rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200",
  },
  badge: {
    id: "rounded bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-400",
    type: "rounded px-1 py-0.5 text-[9px] font-medium",
  },
} as const;

/** Theme-aware panel classes for light/dark UI. */
export function panelTheme(light: boolean) {
  return {
    section: light ? "border-b border-slate-200 px-3 py-2" : PANEL.section,
    label: light ? "text-[11px] text-slate-600" : PANEL.label,
    input: light
      ? "w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-emerald-600"
      : PANEL.input,
    btn: {
      primary: PANEL.btn.primary,
      danger: PANEL.btn.danger,
      ghost: light
        ? "rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        : PANEL.btn.ghost,
      icon: light
        ? "rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
        : PANEL.btn.icon,
    },
    badge: {
      id: light
        ? "rounded bg-slate-200 px-1 py-0.5 font-mono text-[9px] text-slate-700"
        : PANEL.badge.id,
      type: PANEL.badge.type,
    },
  };
}
