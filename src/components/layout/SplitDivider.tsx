import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";

export function SplitDivider({
  light,
  onResize,
}: {
  light: boolean;
  onResize: (deltaXPercent: number) => void;
}) {
  const dividerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Measure the REAL split container (divider's parent row) once at drag
      // start. Previously we used `window.innerWidth`, but the container is
      // narrower than the window (sidebars + inspector eat horizontal space),
      // so dragging felt inconsistent — a fixed pixel delta produced a too-small
      // percentage shift, and flex recomputation with stale percentages could
      // make the split "snap" back unexpectedly on window resize / zoom change.
      const container = dividerRef.current?.parentElement;
      const containerWidth = Math.max(
        1,
        container?.getBoundingClientRect().width ?? window.innerWidth,
      );
      let lastX = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        onResize((dx / containerWidth) * 100);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      // Prevent text selection / cursor flicker while dragging.
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [onResize],
  );

  return (
    <div
      ref={dividerRef}
      onMouseDown={onMouseDown}
      style={{ width: 4, cursor: "col-resize", flexShrink: 0, zIndex: 10 }}
      className={
        light
          ? "bg-slate-300 transition-colors hover:bg-emerald-400 active:bg-emerald-500"
          : "bg-slate-700 transition-colors hover:bg-emerald-600 active:bg-emerald-500"
      }
      title="Drag to resize"
    />
  );
}
