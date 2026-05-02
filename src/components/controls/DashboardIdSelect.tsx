import { DASHBOARD_ID_SELECT_OPTIONS, dashboardIdLabel } from "../../lib/dashboardIds";

const inputClsDark =
  "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-emerald-500/30 focus:ring-1";
const inputClsLight =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-emerald-500/30 focus:ring-1";

export function DashboardIdSelect({
  value,
  onChange,
  id: inputId,
  disabled,
  light = false,
}: {
  value: number;
  onChange: (id: number) => void;
  id?: string;
  disabled?: boolean;
  light?: boolean;
}) {
  const options = DASHBOARD_ID_SELECT_OPTIONS.includes(value)
    ? DASHBOARD_ID_SELECT_OPTIONS
    : [value, ...DASHBOARD_ID_SELECT_OPTIONS].sort((a, b) => a - b);

  return (
    <select
      id={inputId}
      className={light ? inputClsLight : inputClsDark}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((id) => (
        <option key={id} value={id}>
          {id} — {dashboardIdLabel(id)}
        </option>
      ))}
    </select>
  );
}
