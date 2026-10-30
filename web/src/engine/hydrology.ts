// Upstream inflow: rain over the land that drains into a run area from outside becomes river discharge at the point where the
// stream enters. Lumped NRCS method, as in HEC-HMS: curve-number runoff (NRCS 1986, TR-55), lag time from the NRCS watershed lag
// equation (NEH Part 630, Chapter 15) and the NRCS dimensionless unit hydrograph (NEH Part 630, Chapter 16). Pure functions.
import { retention, scsRunoff } from "./solver";

export type Streams = { x: Float32Array; y: Float32Array; down: Int32Array; area: Float32Array; cn: Float32Array; slope: Float32Array; len: Float32Array };
export type Inflow = { stream: number; x: number; y: number; areaKm2: number; cn: number; lagH: number; q: Float64Array }; // q: m3/s per step of DT_S

export const DT_S = 300; // hydrograph time step (s)

/** NRCS lag (h): l^0.8 (S+1)^0.7 / (1900 Y^0.5), l hydraulic length (ft), S retention (in), Y mean watershed slope (%). */
export function nrcsLagHours(lengthM: number, cn: number, slopePct: number): number {
  const lFt = lengthM / 0.3048, sIn = 1000 / Math.min(99, Math.max(30, cn)) - 10, y = Math.max(0.5, slopePct);
  return (lFt ** 0.8 * (sIn + 1) ** 0.7) / (1900 * Math.sqrt(y));
}

// NRCS dimensionless unit hydrograph, NEH 630 Chapter 16, Table 16-1 (t/Tp, q/qp)
const UH_T = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.5, 5];
const UH_Q = [0, 0.03, 0.1, 0.19, 0.31, 0.47, 0.66, 0.82, 0.93, 0.99, 1, 0.99, 0.93, 0.86, 0.78, 0.68, 0.56, 0.46, 0.39, 0.33, 0.28, 0.207, 0.147, 0.107, 0.077, 0.055, 0.04, 0.029, 0.021, 0.015, 0.011, 0.005, 0];
export function uhRatio(r: number): number {
  if (r <= 0 || r >= 5) return 0;
  let k = 1;
  while (UH_T[k] < r) k++;
  const f = (r - UH_T[k - 1]) / (UH_T[k] - UH_T[k - 1]);
  return UH_Q[k - 1] + f * (UH_Q[k] - UH_Q[k - 1]);
}

/** Discharge (m3/s) every DT_S seconds for `steps` steps from cumulative rain depth at those steps (mm, cumRain[0] = 0). */
export function catchmentHydrograph(areaKm2: number, cn: number, lagH: number, cumRain: Float64Array, steps: number): Float64Array {
  const s = retention(cn), dtH = DT_S / 3600;
  const tp = dtH / 2 + lagH; // time to peak (h)
  // the unit-hydrograph ordinates are integrated over each step so the runoff volume is kept exactly
  const sub = 10, ord: number[] = [];
  for (let k = 0; ; k++) {
    let a = 0;
    for (let m = 0; m < sub; m++) a += uhRatio(((k + (m + 0.5) / sub) * dtH) / tp);
    ord.push(a / sub);
    if ((k * dtH) / tp > 5) break;
  }
  const sum = ord.reduce((x, v) => x + v, 0);
  const vol = (mm: number) => (mm / 1000) * areaKm2 * 1e6; // m3
  const q = new Float64Array(steps);
  for (let k = 1; k < cumRain.length && k <= steps; k++) {
    const ex = scsRunoff(cumRain[k], s) - scsRunoff(cumRain[k - 1], s); // mm in step k-1..k
    if (ex <= 0) continue;
    const v = vol(ex);
    for (let m = 0; m < ord.length && k - 1 + m < steps; m++) q[k - 1 + m] += (v * ord[m]) / sum / DT_S;
  }
  return q;
}

/** Streams that cross into the run area (isIn(x, y) in model metres). Area already simulated or counted at an upstream entry is
 *  removed so no rain is counted twice when a river leaves the area and comes back. */
export function findEntries(st: Streams, isIn: (x: number, y: number) => boolean, minKm2 = 1): { stream: number; effKm2: number }[] {
  const n = st.x.length, ins = new Uint8Array(n);
  for (let k = 0; k < n; k++) ins[k] = +isIn(st.x[k], st.y[k]);
  const entries: number[] = [];
  for (let k = 0; k < n; k++) { const d = st.down[k]; if (!ins[k] && d >= 0 && ins[d]) entries.push(k); }
  const eff = new Map<number, number>(entries.map((k) => [k, st.area[k]]));
  for (const k of entries) {
    let j = st.down[k], guard = 0;
    while (j >= 0 && ins[j] && guard++ < n) j = st.down[j]; // through the run area
    while (j >= 0 && !ins[j] && guard++ < n) { // outside again: the next entry downstream gets this water from the 2D model
      if (eff.has(j)) { eff.set(j, eff.get(j)! - st.area[k]); break; }
      j = st.down[j];
    }
  }
  return entries.map((k) => ({ stream: k, effKm2: eff.get(k)! })).filter((e) => e.effKm2 >= minKm2).sort((a, b) => b.effKm2 - a.effKm2);
}

export function inflowsFor(st: Streams, isIn: (x: number, y: number) => boolean, cumRain: Float64Array, steps: number): Inflow[] {
  return findEntries(st, isIn).map(({ stream: k, effKm2 }) => {
    const lagH = nrcsLagHours(st.len[k], st.cn[k], st.slope[k]);
    return { stream: k, x: st.x[st.down[k]], y: st.y[st.down[k]], areaKm2: effKm2, cn: st.cn[k], lagH, q: catchmentHydrograph(effKm2, st.cn[k], lagH, cumRain, steps) };
  });
}
