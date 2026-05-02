/** SCS AABBGGRR (8 hex digits, no #). Matches Rust `color_helper`. */

export function scsToRgba(hex: string): [number, number, number, number] | null {
  const h = hex.replace(/^#/, "").trim();
  if (h.length !== 8 || !/^[0-9a-fA-F]{8}$/.test(h)) return null;
  const a = parseInt(h.slice(0, 2), 16);
  const b = parseInt(h.slice(2, 4), 16);
  const g = parseInt(h.slice(4, 6), 16);
  const r = parseInt(h.slice(6, 8), 16);
  return [r, g, b, a];
}

export function rgbaToScs(r: number, g: number, b: number, a: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `${c(a)}${c(b)}${c(g)}${c(r)}`;
}

export const NAMED_SCS_COLORS: { key: string; label: string }[] = [
  { key: "@@clr_sel@@", label: "Selection" },
  { key: "@@clr_txt@@", label: "Text" },
  { key: "@@clr_white@@", label: "White" },
  { key: "@@clr_red@@", label: "Red" },
  { key: "@@clr_green@@", label: "Green" },
  { key: "@@clr_blue@@", label: "Blue" },
  { key: "@@clr_wotr_blue@@", label: "WOTR blue" },
  { key: "@@clr_help@@", label: "Help" },
];

/** Approximate RGBA for picker when value is a named token (editor preview). */
export function namedColorToRgba(key: string): [number, number, number, number] | null {
  const k = key.trim();
  switch (k) {
    case "@@clr_sel@@":
      return scsToRgba("FF0078A0");
    case "@@clr_txt@@":
      return scsToRgba("FFD0D0D0");
    case "@@clr_white@@":
      return [255, 255, 255, 255];
    case "@@clr_red@@":
      return [255, 0, 0, 255];
    case "@@clr_green@@":
      return [0, 255, 0, 255];
    case "@@clr_blue@@":
      return [255, 0, 0, 255];
    case "@@clr_wotr_blue@@":
      return scsToRgba("FFFF8000");
    case "@@clr_help@@":
      return scsToRgba("FF00FF80");
    default:
      return null;
  }
}
