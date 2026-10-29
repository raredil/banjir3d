export type Scenario = { rainMmH: number; rainHours: number; drainMmH: number; inflowM3s: number; totalHours: number; manning: number };
export const DEFAULT_SCENARIO: Scenario = { rainMmH: 80, rainHours: 3, drainMmH: 20, inflowM3s: 0, totalHours: 6, manning: 0.05 };
export const FRAME_SECONDS = 300;
export const MM_PER_H = 1 / 3.6e6; // mm/h -> m/s

/** Inflow cells: the lowest cell on the south row and its two row neighbours (the river is assumed to enter at the lowest point). */
export function riverCells(z: Float64Array, nx: number, ny: number): number[] {
  const row = (ny - 1) * nx;
  let best = 0;
  for (let i = 1; i < nx; i++) if (z[row + i] < z[row + best]) best = i;
  return [best - 1, best, best + 1].filter((i) => i >= 0 && i < nx).map((i) => row + i);
}

export function clampScenario(s: Scenario): Scenario {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  return {
    rainMmH: c(s.rainMmH, 0, 300), rainHours: c(s.rainHours, 0.25, 12), drainMmH: c(s.drainMmH, 0, 150),
    inflowM3s: c(s.inflowM3s, 0, 1000), totalHours: c(s.totalHours, 1, 12), manning: c(s.manning, 0.01, 0.2),
  };
}
