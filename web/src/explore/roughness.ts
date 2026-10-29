// Per-cell Manning n from ESA WorldCover classes. Table and sources: data/roughness/worldcover-manning.json (single source of truth,
// also read by verification/explore-vs-sfincs/make_roughness.py). Pure functions, unit-tested.
import table from "../../../data/roughness/worldcover-manning.json";

export type RoughMode = "n" | "low" | "high" | "uniform";
type Cls = { label: string; n: number; low: number; high: number };
const CLASSES = table.classes as Record<string, Cls>;
const CODES = Object.keys(CLASSES).map(Number);
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const PAL = CODES.map((c) => hex((table.colors as Record<string, string>)[String(c)]));
export const DEFAULT_N_NODATA = table.default_n_for_nodata;
export const UNIFORM_N = 0.05;
export const WORLDCOVER_FACTOR = 4; // z14 pixels per z12 DEM pixel along one axis

/** WorldCover class of an RGB tile colour (nearest palette colour). */
export function classify(r: number, g: number, b: number): number {
  let best = 0, bd = Infinity;
  for (let k = 0; k < PAL.length; k++) {
    const d = (r - PAL[k][0]) ** 2 + (g - PAL[k][1]) ** 2 + (b - PAL[k][2]) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return CODES[best];
}

export function nOfClass(code: number, mode: Exclude<RoughMode, "uniform">): number {
  const c = CLASSES[String(code)];
  return c ? c[mode] : DEFAULT_N_NODATA;
}

/** Mean n over the f x f class pixels inside every model cell (row 0 = north). code 0 = no data. */
export function nFieldFromCodes(codes: Uint8Array, nx: number, ny: number, f: number, mode: RoughMode): Float64Array {
  const out = new Float64Array(nx * ny);
  if (mode === "uniform") return out.fill(UNIFORM_N);
  const lut = new Float64Array(256).fill(DEFAULT_N_NODATA);
  for (const c of CODES) lut[c] = nOfClass(c, mode);
  const W = nx * f;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let s = 0;
      for (let dj = 0; dj < f; dj++) {
        const row = (j * f + dj) * W + i * f;
        for (let di = 0; di < f; di++) s += lut[codes[row + di]];
      }
      out[j * nx + i] = s / (f * f);
    }
  }
  return out;
}

export function classFractions(codes: Uint8Array): Record<string, number> {
  const cnt: Record<string, number> = {};
  for (let k = 0; k < codes.length; k++) { const c = codes[k]; if (c) cnt[CLASSES[String(c)]?.label ?? String(c)] = (cnt[CLASSES[String(c)]?.label ?? String(c)] ?? 0) + 1; }
  for (const k of Object.keys(cnt)) cnt[k] /= codes.length;
  return cnt;
}
