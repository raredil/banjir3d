// Engine pack: the conditioned terrain, roughness, curve number, masks and upstream stream network built by pipeline/engine_pack.py.
import { fromUtm, toUtm } from "../util";
import type { Streams } from "./hydrology";

export type PackHeader = {
  version: number; region: string; created: string;
  grid: { crs: string; nx: number; ny: number; dx: number; origin: [number, number]; corners_lonlat: [number, number][] };
  arrays: { name: string; dtype: string; offset: number; length: number }[];
  landcover_year: number; soil: { source: string; WARNING?: string }; [k: string]: unknown;
};
export type Pack = {
  header: PackHeader; nx: number; ny: number; dx: number; ox: number; oy: number; zone: number;
  z: Float32Array; n: Float32Array; cn: Uint8Array; flags: Uint8Array; streams: Streams;
};
export const CHANNEL = 1, SEA = 2, DOMAIN = 4;

const VIEW: Record<string, (b: ArrayBuffer, o: number, n: number) => ArrayLike<number>> = {
  uint8: (b, o, n) => new Uint8Array(b, o, n), uint16: (b, o, n) => new Uint16Array(b, o, n), uint32: (b, o, n) => new Uint32Array(b, o, n),
  int32: (b, o, n) => new Int32Array(b, o, n), float32: (b, o, n) => new Float32Array(b, o, n),
};

/** Parse the uncompressed pack bytes. */
export function parsePack(buf: ArrayBuffer): Pack {
  const hl = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as PackHeader;
  const base = 4 + hl;
  const a: Record<string, ArrayLike<number>> = {};
  for (const d of header.arrays) a[d.name] = VIEW[d.dtype](buf, base + d.offset, d.length);
  const { nx, ny, dx, origin } = header.grid;
  const zone = Number(/327(\d\d)/.exec(header.grid.crs)?.[1] ?? 48);
  const z = Float32Array.from(a.z as Uint16Array, (v) => v / 100 - 20);
  const n = Float32Array.from(a.n as Uint8Array, (v) => v / 1000);
  return {
    header, nx, ny, dx, ox: origin[0], oy: origin[1], zone, z, n, cn: a.cn as Uint8Array, flags: a.flags as Uint8Array,
    streams: { x: a.st_x as Float32Array, y: a.st_y as Float32Array, down: a.st_down as Int32Array, area: a.st_area_km2 as Float32Array, cn: a.st_cn as Float32Array, slope: a.st_slope_pct as Float32Array, len: a.st_length_m as Float32Array },
  };
}

export async function loadPack(url: string): Promise<Pack> {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`engine pack ${r.status}`);
  const raw = url.endsWith(".gz") ? await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer() : await r.arrayBuffer();
  return parsePack(raw);
}

export type RunGrid = {
  nx: number; ny: number; dx: number; k: number; i0: number; j0: number;
  z: Float64Array; n: Float64Array; cn: Float64Array; active: Uint8Array; sea: Uint8Array; channel: Uint8Array;
  corners: [number, number][]; // lon/lat of the outer grid corners NW, NE, SE, SW
  utm: { zone: number; x0: number; y0: number }; // UTM of the NW corner
  isIn: (x: number, y: number) => boolean; // pack metres (east, south of the pack origin) inside the active area
  cellAt: (x: number, y: number) => number; // lowest active cell within one cell of a point, -1 if none
};

/** Run grid for the whole region (domain polygon) or for a lon/lat box, aggregated by k x k pack cells (k = 1: 30 m). */
export function buildRun(p: Pack, box: number[] | null, k: number): RunGrid {
  let i0 = 0, j0 = 0, i1 = p.nx, j1 = p.ny;
  if (box) {
    const pts = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(([lo, la]) => toUtm(lo, la, p.zone));
    i0 = Math.max(0, Math.floor((Math.min(...pts.map((q) => q.easting)) - p.ox) / p.dx));
    i1 = Math.min(p.nx, Math.ceil((Math.max(...pts.map((q) => q.easting)) - p.ox) / p.dx));
    j0 = Math.max(0, Math.floor((p.oy - Math.max(...pts.map((q) => q.northing))) / p.dx));
    j1 = Math.min(p.ny, Math.ceil((p.oy - Math.min(...pts.map((q) => q.northing))) / p.dx));
  }
  const nx = Math.max(1, Math.ceil((i1 - i0) / k)), ny = Math.max(1, Math.ceil((j1 - j0) / k)), N = nx * ny;
  const z = new Float64Array(N), n = new Float64Array(N), cn = new Float64Array(N);
  const active = new Uint8Array(N), sea = new Uint8Array(N), channel = new Uint8Array(N);
  for (let J = 0; J < ny; J++) for (let I = 0; I < nx; I++) {
    let cnt = 0, inDom = 0, nSea = 0, nCh = 0, zs = 0, zch = 0, ns = 0, cs = 0;
    for (let dj = 0; dj < k; dj++) for (let di = 0; di < k; di++) {
      const i = i0 + I * k + di, j = j0 + J * k + dj;
      if (i >= i1 || j >= j1) continue;
      const c = j * p.nx + i, f = p.flags[c];
      cnt++; zs += p.z[c]; ns += p.n[c]; cs += p.cn[c];
      if (box || f & DOMAIN) inDom++;
      if (f & SEA) nSea++;
      if (f & CHANNEL) { nCh++; zch += p.z[c]; }
    }
    const C = J * nx + I;
    if (!cnt) continue;
    // a block holding a mapped channel keeps the channel level so the river stays connected at coarse resolution
    z[C] = nCh ? zch / nCh : zs / cnt; n[C] = ns / cnt; cn[C] = cs / cnt;
    active[C] = +(inDom * 2 > cnt); sea[C] = +(nSea * 2 > cnt); channel[C] = +(nCh > 0);
  }
  const dx = p.dx * k, x0 = p.ox + i0 * p.dx, y0 = p.oy - j0 * p.dx;
  const ll = (x: number, y: number) => { const g = fromUtm(x, y, p.zone, true); return [g.lon, g.lat] as [number, number]; };
  const cell = (x: number, y: number) => {
    const I = Math.floor((x - i0 * p.dx) / dx), J = Math.floor((y - j0 * p.dx) / dx);
    return I >= 0 && J >= 0 && I < nx && J < ny ? J * nx + I : -1;
  };
  return {
    nx, ny, dx, k, i0, j0, z, n, cn, active, sea, channel,
    corners: [ll(x0, y0), ll(x0 + nx * dx, y0), ll(x0 + nx * dx, y0 - ny * dx), ll(x0, y0 - ny * dx)],
    utm: { zone: p.zone, x0, y0 },
    isIn: (x, y) => { const c = cell(x, y); return c >= 0 && active[c] === 1 && !sea[c]; },
    cellAt: (x, y) => {
      const c0 = cell(x, y);
      if (c0 < 0) return -1;
      const I = c0 % nx, J = (c0 - I) / nx;
      let best = -1;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = I + di, b = J + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const c = b * nx + a;
        if (active[c] && !sea[c] && (best < 0 || z[c] < z[best])) best = c;
      }
      return best;
    },
  };
}
