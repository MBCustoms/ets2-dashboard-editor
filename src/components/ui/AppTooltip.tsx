import type { ReactNode } from "react";

/**
 * Rich hover tooltip: short title + longer description. Wraps any focusable control.
 */
export function AppTooltip({
  title,
  description,
  children,
  light = false,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  light?: boolean;
  className?: string;
}) {
  const bubble = light
    ? "border border-slate-200/90 bg-white/95 text-slate-900 shadow-lg backdrop-blur-sm"
    : "border border-slate-500/60 bg-slate-800/95 text-slate-50 shadow-xl backdrop-blur-sm";

  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-[600] w-max max-w-[min(240px,calc(100vw-24px))] -translate-x-1/2 rounded-lg px-2.5 py-2 text-left opacity-0 shadow-md ring-1 ring-black/5 transition duration-150 ease-out group-hover:opacity-100 group-hover:delay-100 group-focus-within:opacity-100 group-focus-within:delay-75 ${bubble}`}
      >
        <span className="block font-semibold leading-snug tracking-tight">{title}</span>
        <span className="mt-1 block text-[10px] font-normal leading-snug opacity-90">
          {description}
        </span>
        <span
          className={`absolute left-1/2 bottom-full h-2 w-2 -translate-x-1/2 translate-y-1 rotate-45 border border-b-0 border-r-0 ${
            light ? "border-slate-200/90 bg-white" : "border-slate-500/60 bg-slate-800"
          }`}
          aria-hidden
        />
      </span>
    </span>
  );
}
