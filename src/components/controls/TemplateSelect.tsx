import type { TextTemplate } from "../../types/scs";

interface Props {
  value: string;
  onChange: (v: string) => void;
  templates: TextTemplate[];
  className?: string;
  light?: boolean;
}

export function TemplateSelect({ value, onChange, templates, className, light = false }: Props) {
  const missing = value.trim() !== "" && !templates.find((t) => t.name === value);
  const base = light
    ? missing
      ? "border-amber-500 bg-amber-50 text-amber-900 ring-amber-500/30"
      : "border-slate-300 bg-white text-slate-900 ring-emerald-600/30"
    : missing
      ? "border-amber-600 bg-amber-950/30 text-amber-300 ring-amber-600/30"
      : "border-slate-700 bg-slate-900 text-slate-100 ring-emerald-600/30";
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 ${base} ${className ?? ""}`}
      >
        <option value="">— none —</option>
        {templates.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
        {missing ? <option value={value}>⚠ {value} (not in project)</option> : null}
      </select>
      {missing ? (
        <p className={`mt-0.5 text-[10px] ${light ? "text-amber-800" : "text-amber-400"}`}>
          Template <code className="font-mono">{value}</code> not found. Import via{" "}
          <em>Import templates…</em> in the toolbar.
        </p>
      ) : null}
    </div>
  );
}
