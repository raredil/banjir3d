// Exposure: buildings and people in flooded cells, per kecamatan (pipeline/exposure_pack.py, one value per 30 m pack cell).
import { fetchPackBytes, readPackFile, type PackHeader, type RunGrid } from "../engine/pack";

export type Unit = { name: string | null; kota: string | null; province: string; buildings: number; people: number };
export type Exposure = { units: Unit[]; nx: number; ny: number; kec: Uint8Array; bld: Uint16Array; pop: Uint16Array; header: Record<string, unknown> };
export type ExposureSums = { buildings: number; people: number; perUnit: { unit: Unit; buildings: number; people: number }[] };

export async function loadExposure(url: string): Promise<Exposure> {
  const { header, a } = readPackFile<{ arrays: PackHeader["arrays"]; grid: { nx: number; ny: number }; units: Unit[] }>(await fetchPackBytes(url));
  return { units: header.units, nx: header.grid.nx, ny: header.grid.ny, kec: a.kec as Uint8Array, bld: a.bld as Uint16Array, pop: a.pop as Uint16Array, header };
}

/** Pack cells holding buildings or people inside a run grid, with their run cell: built once per run, summed on every frame. */
export function exposureCells(x: Exposure, run: Pick<RunGrid, "nx" | "ny" | "k" | "i0" | "j0">) {
  const cell: number[] = [], unit: number[] = [], bld: number[] = [], pop: number[] = [];
  const i1 = Math.min(x.nx, run.i0 + run.nx * run.k), j1 = Math.min(x.ny, run.j0 + run.ny * run.k);
  for (let j = run.j0; j < j1; j++) for (let i = run.i0; i < i1; i++) {
    const c = j * x.nx + i;
    if (!x.bld[c] && !x.pop[c]) continue;
    cell.push(Math.floor((j - run.j0) / run.k) * run.nx + Math.floor((i - run.i0) / run.k)); unit.push(x.kec[c]); bld.push(x.bld[c]); pop.push(x.pop[c] / 10);
  }
  return { cell: Int32Array.from(cell), unit: Uint8Array.from(unit), bld: Uint16Array.from(bld), pop: Float32Array.from(pop) };
}

/** Buildings and people in run cells counted as flooded (count = 1 and depth above floodM), in total and per unit, largest first. */
export function exposureSums(x: Exposure, cells: ReturnType<typeof exposureCells>, depth: ArrayLike<number>, count: ArrayLike<number>, floodM: number): ExposureSums {
  const nU = x.units.length + 1, b = new Float64Array(nU), p = new Float64Array(nU);
  for (let m = 0; m < cells.cell.length; m++) {
    const c = cells.cell[m];
    if (count[c] && depth[c] > floodM) { b[cells.unit[m]] += cells.bld[m]; p[cells.unit[m]] += cells.pop[m]; }
  }
  const perUnit = x.units.map((unit, k) => ({ unit, buildings: b[k + 1], people: p[k + 1] })).filter((u) => u.buildings > 0 || u.people >= 0.5)
    .sort((u, v) => v.people - u.people || v.buildings - u.buildings);
  return { buildings: b.reduce((s, v) => s + v, 0), people: p.reduce((s, v) => s + v, 0), perUnit };
}
