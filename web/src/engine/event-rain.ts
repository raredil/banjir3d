// Observed-event rain: hourly rain on a regular lon/lat grid of points (IMERG 0.1 degree, data/events/), each model cell and each
// upstream stream cell takes the rain of its nearest point, as in verification/observed/run_event.ts (validation runs; there the
// lookup is per cell, here per ~300 m block: differences only within 300 m of a zone edge).
import { fromUtm } from "../util";
import { DT_S } from "./hydrology";
import type { Hyetograph } from "../explore/rain";

export type EventRain = {
  id: string; wib: [string, string]; start_utc: string; hours: number; source: string;
  lon: number[]; lat: number[]; mm: number[][]; // mm[point][hour]: rain in the hour ending at start + (hour + 1) h; point = row (lat) * lon.length + col
  reports: { source: string; n: number; hit_rate: number; model: string };
  reported_km2: number | null; reported_rw: number | null;
};

const nearest = (v: number, arr: number[]) => { let b = 0; for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i] - v) < Math.abs(arr[b] - v)) b = i; return b; };
/** Index of the rain point nearest to a lon/lat. */
export const pointAt = (ev: Pick<EventRain, "lon" | "lat">, lon: number, lat: number) => nearest(lat, ev.lat) * ev.lon.length + nearest(lon, ev.lon);

/** Rain point per cell of a UTM grid (NW corner x0, y0). Looked up every ~300 m and filled in blocks: points are ~11 km apart. */
export function zoneGrid(ev: Pick<EventRain, "lon" | "lat">, g: { nx: number; ny: number; dx: number; utm: { zone: number; x0: number; y0: number } }): Uint16Array {
  const zone = new Uint16Array(g.nx * g.ny), s = Math.max(1, Math.floor(300 / g.dx));
  for (let J = 0; J < g.ny; J += s) for (let I = 0; I < g.nx; I += s) {
    const ll = fromUtm(g.utm.x0 + (I + s / 2) * g.dx, g.utm.y0 - (J + s / 2) * g.dx, g.utm.zone, true);
    const z = pointAt(ev, ll.lon, ll.lat);
    for (let j = J; j < Math.min(g.ny, J + s); j++) zone.fill(z, j * g.nx + I, j * g.nx + Math.min(g.nx, I + s));
  }
  return zone;
}

/** Cumulative rain (mm) at the hydrograph steps (every DT_S s) from hourly depths, for steps 0..steps. */
export function cumAtSteps(hourly: ArrayLike<number>, steps: number): Float64Array {
  const c = new Float64Array(steps + 1), H = hourly.length;
  for (let s = 1; s <= steps; s++) c[s] = c[s - 1] + (hourly[Math.min(H - 1, Math.floor(((s - 0.5) * DT_S) / 3600))] ?? 0) * (DT_S / 3600);
  return c;
}

/** Area-mean hourly rain over the counted cells (for the summary, the chart and the rain KPI). */
export function meanHyetograph(ev: Pick<EventRain, "mm">, zone: Uint16Array, count: ArrayLike<number>): Hyetograph {
  const nPts = ev.mm.length, w = new Float64Array(nPts);
  let tot = 0;
  for (let c = 0; c < zone.length; c++) if (count[c]) { w[zone[c]]++; tot++; }
  const H = Math.max(...ev.mm.map((v) => v.length));
  const mm = Array.from({ length: H }, (_, h) => { let v = 0; for (let p = 0; p < nPts; p++) if (w[p]) v += (w[p] * (ev.mm[p][h] ?? 0)) / tot; return v; });
  return { blockSeconds: 3600, mm };
}
