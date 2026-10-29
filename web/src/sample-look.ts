// Pure helpers for the 3D sample page (no MapLibre import, so they are unit-testable).
export type Look = "sat" | "lc" | "grey";
export const LOOKS: Look[] = ["sat", "lc", "grey"];
export const DEFAULT_LOOK: Look = "sat";
export const SAMPLE_VIEW = { zoom: 12.5, pitch: 45, bearing: 0 };
export const DEFAULTS = { exaggeration: 4, level: 6 };

export function parseLook(v: string | null | undefined): Look {
  return LOOKS.includes(v as Look) ? (v as Look) : DEFAULT_LOOK;
}

/** Per-look paint values. `show` lists the layers that are visible only in this look. */
export const LOOK_PARAMS: Record<Look, { bg: string; hsExag: number; hsShadow: string; wLine: string; wFill: string; show: string[] }> = {
  sat: { bg: "#dfe6ee", hsExag: 0.45, hsShadow: "#1f2933", wLine: "#5ec8f2", wFill: "#3aa6dc", show: ["s2"] },
  lc: { bg: "#dfe6ee", hsExag: 0.5, hsShadow: "#1f2933", wLine: "#1f5fa8", wFill: "#1f5fa8", show: ["lc"] },
  grey: { bg: "#eef0f3", hsExag: 1, hsShadow: "#2f3542", wLine: "#14385f", wFill: "#14385f", show: ["tint", "hs2", "depth"] },
};
export const LOOK_ONLY_LAYERS = ["tint", "s2", "lc", "hs2", "depth"];

/** Colour ramp over elevation (m): illustrative depth below a flat water level, transparent above it. */
export function depthColorExpr(level: number): unknown[] {
  const clear = "rgba(255,255,255,0)";
  return ["interpolate", ["linear"], ["elevation"],
    -30, "#08306b", level - 4, "#08306b", level - 3, "#2171b5", level - 2, "#4292c6", level - 1, "#9ecae1",
    level - 0.05, "#d7e6f4", level, clear, 200, clear];
}

export function sampleCenter(b: number[]): [number, number] {
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

export function sampleOutline(b: number[]) {
  const [w, s, e, n] = b;
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } };
}

/** Start zoom that keeps the 10 km sample in view: the desktop zoom, lowered on narrow maps. */
export function zoomForWidth(px: number): number {
  return SAMPLE_VIEW.zoom - Math.max(0, Math.log2(900 / Math.max(px, 200)));
}

// User-drawn simulation area. Boxes are [W, S, E, N] in degrees and must lie inside the region pack.
export const MIN_BOX_KM = 1;
const KM_PER_DEG = 111.32;

/** Width and height (km) of a box. */
export function boxKm(b: number[]): [number, number] {
  const c = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
  return [(b[2] - b[0]) * KM_PER_DEG * c, (b[3] - b[1]) * KM_PER_DEG];
}

/** Box from two dragged corners, clipped to the region; null if it is smaller than MIN_BOX_KM on a side or outside. */
export function boxFromCorners(a: [number, number], b: [number, number], region: number[]): number[] | null {
  const box = [Math.max(Math.min(a[0], b[0]), region[0]), Math.max(Math.min(a[1], b[1]), region[1]), Math.min(Math.max(a[0], b[0]), region[2]), Math.min(Math.max(a[1], b[1]), region[3])];
  if (box[2] <= box[0] || box[3] <= box[1]) return null;
  const [w, h] = boxKm(box);
  return w >= MIN_BOX_KM && h >= MIN_BOX_KM ? box.map((v) => Math.round(v * 1e5) / 1e5) : null;
}

/** Box from the `box=W,S,E,N` deep-link value, or null if malformed or not usable in the region. */
export function parseBox(v: string | null | undefined, region: number[]): number[] | null {
  if (!v || !/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(v)) return null;
  const n = v.split(",").map(Number);
  return boxFromCorners([n[0], n[1]], [n[2], n[3]], region);
}
