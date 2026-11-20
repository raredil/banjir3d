// Sensitivity variants of a run grid (review 2026-11-20, R-08; BLUEPRINT §7): research runs only, never the app's default.
//   none     the run as built
//   n0.7     Manning n x 0.7 on every cell (rivers and land); n1.3: x 1.3 (the +-30 % the review asked for)
//   cnb92    curve number of the built part of each cell 98 -> 92 (built pixels not fully sealed: yards, gaps, porous paving)
//   dem<s>   terrain + a smooth random error field, seed s (1..10): standard deviation 0.5 m over the active cells, smoothed with a
//            kernel of about 250 m standard deviation (errors alike over roughly 0.5-1 km). Both numbers are ASSUMPTIONS for a
//            sensitivity test (half the FABDEM error in built areas quoted in Methods §8, about 1 m), not a measured error model.
import type { RunGrid } from "./pack";

export const SENS_RE = /^(none|n0\.7|n1\.3|cnb92|dem([1-9]|10))$/;
export const DEM_SIGMA_M = 0.5, DEM_SMOOTH_M = 250, BUILT_CN = 98, BUILT_CN_SENS = 92;

/** Small seeded generator (mulberry32) so a member can be re-run exactly. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth random field on nx x ny cells: white Gaussian noise, three box blurs of radius r (close to a Gaussian kernel of standard
 *  deviation sqrt(r (r + 1)) cells),
 *  then scaled to standard deviation sigma and mean 0 over the cells where `mask` is 1. */
export function smoothNoise(nx: number, ny: number, r: number, sigma: number, seed: number, mask: ArrayLike<number>): Float64Array {
  const R = rng(seed), N = nx * ny;
  let f = new Float64Array(N);
  for (let c = 0; c < N; c++) { const u = Math.max(1e-12, R()), v = R(); f[c] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const blur = (src: Float64Array, horiz: boolean) => {
    const out = new Float64Array(N), L = horiz ? nx : ny, M = horiz ? ny : nx;
    for (let m = 0; m < M; m++) {
      const at = (l: number) => (horiz ? m * nx + l : l * nx + m);
      let s = 0, cnt = 0;
      for (let l = 0; l <= Math.min(r, L - 1); l++) { s += src[at(l)]; cnt++; }
      for (let l = 0; l < L; l++) {
        out[at(l)] = s / cnt;
        const add = l + r + 1, del = l - r;
        if (add < L) { s += src[at(add)]; cnt++; }
        if (del >= 0) { s -= src[at(del)]; cnt--; }
      }
    }
    return out;
  };
  if (r > 0) for (let k = 0; k < 3; k++) f = blur(blur(f, true), false);
  let n = 0, s = 0, s2 = 0;
  for (let c = 0; c < N; c++) if (mask[c]) { n++; s += f[c]; s2 += f[c] * f[c]; }
  const mean = n ? s / n : 0, sd = n ? Math.sqrt(Math.max(1e-30, s2 / n - mean * mean)) : 1;
  for (let c = 0; c < N; c++) f[c] = ((f[c] - mean) / sd) * sigma;
  return f;
}

/** The run grid with one sensitivity change applied (a copy; the input is not changed). */
export function applySensitivity(run: RunGrid, sens: string): RunGrid {
  if (!SENS_RE.test(sens)) throw new Error(`--sens must match ${SENS_RE}`);
  if (sens === "none") return run;
  if (sens === "n0.7" || sens === "n1.3") { const f = Number(sens.slice(1)); return { ...run, n: run.n.map((v) => v * f) }; }
  if (sens === "cnb92") return { ...run, cn: run.cn.map((v, c) => (run.channel[c] || run.sea[c] ? v : Math.max(0, v - (BUILT_CN - BUILT_CN_SENS) * run.built[c]))) };
  const seed = Number(sens.slice(3));
  const ok = Uint8Array.from(run.active, (a, c) => (a && !run.sea[c] ? 1 : 0));
  const dz = smoothNoise(run.nx, run.ny, Math.max(1, Math.round(DEM_SMOOTH_M / run.dx)), DEM_SIGMA_M, seed, ok);
  const z = run.z.map((v, c) => (ok[c] ? v + dz[c] : v));
  const landZ = run.landZ ? run.landZ.map((v, c) => (ok[c] ? v + dz[c] : v)) : undefined;
  return { ...run, z, ...(landZ ? { landZ } : {}) };
}
