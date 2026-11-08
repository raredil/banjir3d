// Exposure: buildings and people in flooded cells, per kecamatan (pipeline/exposure_pack.py, one value per 30 m pack cell).
import { fetchPackBytes, readPackFile, type PackHeader, type RunGrid } from "../engine/pack";

export type Unit = { name: string | null; kota: string | null; province: string; buildings: number; people: number };
export type Exposure = { units: Unit[]; nx: number; ny: number; kec: Uint8Array; bld: Uint16Array; pop: Uint16Array; header: Record<string, unknown> };
export type ExposureSums = { buildings: number; people: number; perUnit: { unit: Unit; buildings: number; people: number }[] };

export async function loadExposure(url: string): Promise<Exposure> {
  const { header, a } = readPackFile<{ arrays: PackHeader["arrays"]; grid: { nx: number; ny: number }; units: Unit[] }>(await fetchPackBytes(url));
  return { units: header.units, nx: header.grid.nx, ny: header.grid.ny, kec: a.kec as Uint8Array, bld: a.bld as Uint16Array, pop: a.pop as Uint16Array, header };
}

/** Pack cells holding buildings or people inside a run grid, with their run cell: built once per run, summed on every frame.
 *  Fine runs (r > 1): the 30 m cell's buildings and people are spread evenly over its counted run cells (count = 1: not a
 *  channel, sea or building footprint), so a 30 m cell that is half flooded counts half of its buildings and people. */
export function exposureCells(x: Exposure, run: Pick<RunGrid, "nx" | "ny" | "k" | "i0" | "j0"> & { r?: number }, count?: ArrayLike<number>) {
  const cell: number[] = [], unit: number[] = [], bld: number[] = [], pop: number[] = [], w: number[] = [];
  const r = run.r ?? 1, span = r > 1 ? 1 / r : run.k;
  const i1 = Math.min(x.nx, run.i0 + Math.ceil(run.nx * span)), j1 = Math.min(x.ny, run.j0 + Math.ceil(run.ny * span));
  for (let j = run.j0; j < j1; j++) for (let i = run.i0; i < i1; i++) {
    const c = j * x.nx + i;
    if (!x.bld[c] && !x.pop[c]) continue;
    if (r > 1) {
      const sub: number[] = [];
      for (let dj = 0; dj < r; dj++) for (let di = 0; di < r; di++) { const C = ((j - run.j0) * r + dj) * run.nx + (i - run.i0) * r + di; if (!count || count[C]) sub.push(C); }
      for (const C of sub) { cell.push(C); unit.push(x.kec[c]); bld.push(x.bld[c]); pop.push(x.pop[c] / 10); w.push(1 / sub.length); }
      continue;
    }
    cell.push(Math.floor((j - run.j0) / run.k) * run.nx + Math.floor((i - run.i0) / run.k)); unit.push(x.kec[c]); bld.push(x.bld[c]); pop.push(x.pop[c] / 10); w.push(1);
  }
  return { cell: Int32Array.from(cell), unit: Uint8Array.from(unit), bld: Uint16Array.from(bld), pop: Float32Array.from(pop), w: Float32Array.from(w) };
}

/** Buildings and people in run cells counted as flooded (count = 1 and depth above floodM), in total and per unit, largest first. */
export function exposureSums(x: Exposure, cells: ReturnType<typeof exposureCells>, depth: ArrayLike<number>, count: ArrayLike<number>, floodM: number): ExposureSums {
  const nU = x.units.length + 1, b = new Float64Array(nU), p = new Float64Array(nU);
  for (let m = 0; m < cells.cell.length; m++) {
    const c = cells.cell[m];
    if (count[c] && depth[c] > floodM) { const w = cells.w ? cells.w[m] : 1; b[cells.unit[m]] += cells.bld[m] * w; p[cells.unit[m]] += cells.pop[m] * w; }
  }
  const perUnit = x.units.map((unit, k) => ({ unit, buildings: b[k + 1], people: p[k + 1] })).filter((u) => u.buildings > 0 || u.people >= 0.5)
    .sort((u, v) => v.people - u.people || v.buildings - u.buildings);
  return { buildings: b.reduce((s, v) => s + v, 0), people: p.reduce((s, v) => s + v, 0), perUnit };
}
