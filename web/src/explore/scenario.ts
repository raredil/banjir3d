import type { Edge } from "./local-inertial";
import { MAX_BLOCKS, alternatingBlock, constantRain, type Hyetograph } from "./rain";

export type RainMode = "design" | "hourly" | "constant";
export type Scenario = {
  rainMode: RainMode; r24: number; stormHours: number; hourly: number[]; rainMmH: number; rainHours: number;
  drainMmH: number; inflowM3s: number; totalHours: number; manning: number; open: boolean;
};
// Default = documented event: 1 January 2020, 377 mm in a day at Halim Perdanakusuma (Lubis et al. 2022), Mononobe design-storm shape.
// Drainage 0 = rain on the grid with no sewer loss (sewer capacity in Jakarta is not openly documented), an upper bound.
export const DEFAULT_SCENARIO: Scenario = {
  rainMode: "design", r24: 377, stormHours: 24, hourly: [], rainMmH: 100, rainHours: 3,
  drainMmH: 0, inflowM3s: 0, totalHours: 30, manning: 0.05, open: true,
};
/** Seconds between stored frames: every 5 min, coarser for long runs so at most about 120 frames are kept in memory. */
export const frameSeconds = (totalHours: number) => Math.max(300, Math.ceil((totalHours * 3600) / 120 / 300) * 300);
export const MM_PER_H = 1 / 3.6e6; // mm/h -> m/s

export function hyetographOf(s: Scenario): Hyetograph {
  if (s.rainMode === "hourly") return { blockSeconds: 3600, mm: s.hourly.slice(0, MAX_BLOCKS) };
  if (s.rainMode === "constant") return constantRain(s.rainMmH, s.rainHours);
  return alternatingBlock(s.r24, s.stormHours);
}

export const edgesOf = (s: Scenario): Edge[] => (s.open ? ["n", "s", "e", "w"] : []);

/** Inflow cells: the lowest cell on the south row and its two row neighbours (the river is assumed to enter at the lowest point). */
export function riverCells(z: Float64Array, nx: number, ny: number): number[] {
  const row = (ny - 1) * nx;
  let best = 0;
  for (let i = 1; i < nx; i++) if (z[row + i] < z[row + best]) best = i;
  return [best - 1, best, best + 1].filter((i) => i >= 0 && i < nx).map((i) => row + i);
}

export function clampScenario(s: Scenario): Scenario {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  const mode: RainMode = s.rainMode === "hourly" || s.rainMode === "constant" ? s.rainMode : "design";
  return {
    rainMode: mode, r24: c(s.r24, 0, 1000), stormHours: Math.round(c(s.stormHours, 1, 24)),
    hourly: (Array.isArray(s.hourly) ? s.hourly : []).slice(0, MAX_BLOCKS).map((v) => c(v, 0, 500)),
    rainMmH: c(s.rainMmH, 0, 300), rainHours: c(s.rainHours, 0.25, 12), drainMmH: c(s.drainMmH, 0, 150),
    inflowM3s: c(s.inflowM3s, 0, 1000), totalHours: c(s.totalHours, 1, 48), manning: c(s.manning, 0.01, 0.2), open: s.open !== false,
  };
}
