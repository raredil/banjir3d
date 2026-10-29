// Rainfall input for the Explore engine. Pure functions, unit-tested.
// Design storm: Mononobe intensity-duration relation (Indonesian practice, see Maitsa et al. 2021) turned into an hourly hyetograph
// with the alternating block method (Chow, Maidment and Mays 1988). Sources and limits: data/methods/methods.md, section 7.

export type Hyetograph = { blockSeconds: number; mm: number[] }; // rain depth (mm) per block, block 0 starts at t = 0
export const MAX_BLOCKS = 72;
export const MAX_BLOCK_MM = 500;

/** Mononobe cumulative depth (mm) of the most intense t hours of a day with 24 h total r24: R24 (t/24)^(1/3). */
export const mononobeDepth = (r24: number, tHours: number) => r24 * Math.cbrt(Math.max(0, tHours) / 24);

/** Hourly alternating block hyetograph: increments of the Mononobe depth, largest block in the middle, then alternately right and left. */
export function alternatingBlock(r24: number, stormHours: number): Hyetograph {
  const n = Math.max(1, Math.min(24, Math.round(stormHours)));
  const inc = Array.from({ length: n }, (_, k) => mononobeDepth(r24, k + 1) - mononobeDepth(r24, k)); // descending
  const mm = new Array<number>(n).fill(0);
  const mid = Math.floor((n - 1) / 2);
  inc.forEach((v, k) => { mm[k % 2 ? mid + (k + 1) / 2 : mid - k / 2] = v; });
  return { blockSeconds: 3600, mm };
}

export const constantRain = (mmH: number, hours: number): Hyetograph => ({ blockSeconds: hours * 3600, mm: [mmH * hours] });

/** Parse typed hourly rain depths ("12, 30.5 8"). Returns null if empty, not numeric, negative, too many or too large. */
export function parseHourly(text: string): Hyetograph | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length || parts.length > MAX_BLOCKS) return null;
  const mm = parts.map((p) => (/^\d+(\.\d+)?$/.test(p) ? Number(p) : NaN));
  if (mm.some((v) => !Number.isFinite(v) || v > MAX_BLOCK_MM)) return null;
  return { blockSeconds: 3600, mm };
}

/** Rain rate (m/s) at time t (s). */
export function rainRate(h: Hyetograph, t: number): number {
  const k = Math.floor(t / h.blockSeconds);
  return k >= 0 && k < h.mm.length ? h.mm[k] / 1000 / h.blockSeconds : 0;
}

export const totalMm = (h: Hyetograph) => h.mm.reduce((a, v) => a + v, 0);
export const durationS = (h: Hyetograph) => h.mm.length * h.blockSeconds;
