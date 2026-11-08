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
  built: Uint8Array | null; // built-area share (%) per cell; packs before 2026-10-31 do not have it
  sub: Int16Array | null; // land subsidence rate (mm/year, positive = sinking) per cell; packs before 2026-11-01 do not have it
  subEpoch: number; // decimal year the terrain was measured (subsidence is counted from here)
  h0: Float32Array | null; // initial depth (m) in carved drains; packs before 2026-11-01 do not have it
  pump: Float32Array | null; // polder pump sink (m/s) per cell; packs before 2026-11-02 do not have it
};
export const CHANNEL = 1, SEA = 2, DOMAIN = 4;

const VIEW: Record<string, (b: ArrayBuffer, o: number, n: number) => ArrayLike<number>> = {
  uint8: (b, o, n) => new Uint8Array(b, o, n), uint16: (b, o, n) => new Uint16Array(b, o, n), uint32: (b, o, n) => new Uint32Array(b, o, n),
  int16: (b, o, n) => new Int16Array(b, o, n), int32: (b, o, n) => new Int32Array(b, o, n), float32: (b, o, n) => new Float32Array(b, o, n),
};

/** Header and named arrays of a pack file (4-byte header length, JSON header, arrays): engine and exposure packs. */
export function readPackFile<H extends { arrays: PackHeader["arrays"] }>(buf: ArrayBuffer): { header: H; a: Record<string, ArrayLike<number>> } {
  const hl = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as H;
  const base = 4 + hl;
  const a: Record<string, ArrayLike<number>> = {};
  for (const d of header.arrays) a[d.name] = VIEW[d.dtype](buf, base + d.offset, d.length);
  return { header, a };
}

/** Parse the uncompressed pack bytes. */
export function parsePack(buf: ArrayBuffer): Pack {
  const { header, a } = readPackFile<PackHeader>(buf);
  const { nx, ny, dx, origin } = header.grid;
  const zone = Number(/327(\d\d)/.exec(header.grid.crs)?.[1] ?? 48);
  const z = Float32Array.from(a.z as Uint16Array, (v) => v / 100 - 20);
  const n = Float32Array.from(a.n as Uint8Array, (v) => v / 1000);
  return {
    header, nx, ny, dx, ox: origin[0], oy: origin[1], zone, z, n, cn: a.cn as Uint8Array, flags: a.flags as Uint8Array, built: (a.built as Uint8Array) ?? null,
    sub: (a.sub as Int16Array) ?? null, h0: a.h0 ? Float32Array.from(a.h0 as Uint16Array, (v) => v / 100) : null,
    pump: a.pump ? Float32Array.from(a.pump as Uint16Array, (v) => v / 100 / 3.6e6) : null, subEpoch: Number((header.subsidence as { epoch?: number } | undefined)?.epoch ?? 0),
    streams: { x: a.st_x as Float32Array, y: a.st_y as Float32Array, down: a.st_down as Int32Array, area: a.st_area_km2 as Float32Array, cn: a.st_cn as Float32Array, slope: a.st_slope_pct as Float32Array, len: a.st_length_m as Float32Array },
  };
}

/** Fetch a .bin.gz pack: some servers send it with Content-Encoding (the browser already unpacked it), others as a plain file. */
export async function fetchPackBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url.split("/").pop()} ${r.status}`);
  const raw = await r.arrayBuffer();
  const b = new Uint8Array(raw, 0, 2);
  return b[0] === 0x1f && b[1] === 0x8b ? new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer() : raw;
}

export const loadPack = async (url: string): Promise<Pack> => parsePack(await fetchPackBytes(url));

export type RunGrid = {
  nx: number; ny: number; dx: number; k: number; i0: number; j0: number;
  r: number; // run cells per pack cell side: 1 for 30 m and coarser (k pack cells per run cell), 3 for 10 m ... 30 for 1 m
  building: Uint8Array | null; // fine runs: 1 = building footprint (solid block, Schubert and Sanders 2012), null otherwise
  z: Float64Array; n: Float64Array; cn: Float64Array; active: Uint8Array; sea: Uint8Array; channel: Uint8Array;
  built: Float64Array; // built-area share 0..1 (0 where the pack has no share: no drains)
  h0: Float64Array | null; // initial depth (m), mean over the block (channel cells only in a block holding a channel)
  pump: Float64Array | null; // polder pump sink (m/s), mean over the block, so a coarse cell removes the same volume
  // dual-grid fine runs (buildDualRun): building porosity of each compute cell and the fine grid the result is shown on
  phi?: Float32Array; psiX?: Float32Array; psiY?: Float32Array; rainW?: Float32Array;
  fine?: FineGrid;
  corners: [number, number][]; // lon/lat of the outer grid corners NW, NE, SE, SW
  utm: { zone: number; x0: number; y0: number }; // UTM of the NW corner
  isIn: (x: number, y: number) => boolean; // pack metres (east, south of the pack origin) inside the active area
  cellAt: (x: number, y: number) => number; // lowest active cell within one cell of a point, -1 if none
};

/** Terrain lowering (m) of one pack cell from the terrain epoch to `year` (0 without subsidence data or year). */
export const sinkM = (p: Pack, c: number, year: number | undefined): number =>
  p.sub && year ? (p.sub[c] / 1000) * (year - p.subEpoch) : 0;

/** Run grid for the whole region (domain polygon) or for a lon/lat box, aggregated by k x k pack cells (k = 1: 30 m).
 *  `year` (decimal) shifts the terrain by the mapped subsidence rate from the terrain epoch to that year. */
export function buildRun(p: Pack, box: number[] | null, k: number, year?: number): RunGrid {
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
  const active = new Uint8Array(N), sea = new Uint8Array(N), channel = new Uint8Array(N), built = new Float64Array(N);
  const h0 = p.h0 ? new Float64Array(N) : null, pump = p.pump ? new Float64Array(N) : null;
  for (let J = 0; J < ny; J++) for (let I = 0; I < nx; I++) {
    let cnt = 0, inDom = 0, nSea = 0, nCh = 0, zs = 0, zch = 0, ns = 0, cs = 0, bs = 0, hs = 0, hch = 0, ps = 0;
    for (let dj = 0; dj < k; dj++) for (let di = 0; di < k; di++) {
      const i = i0 + I * k + di, j = j0 + J * k + dj;
      if (i >= i1 || j >= j1) continue;
      const c = j * p.nx + i, f = p.flags[c];
      const zc = p.z[c] - sinkM(p, c, year);
      const hc = p.h0 ? p.h0[c] : 0;
      cnt++; zs += zc; hs += hc; ps += p.pump ? p.pump[c] : 0; ns += p.n[c]; cs += p.cn[c]; bs += p.built ? p.built[c] / 100 : 0;
      if (box || f & DOMAIN) inDom++;
      if (f & SEA) nSea++;
      if (f & CHANNEL) { nCh++; zch += zc; hch += hc; }
    }
    const C = J * nx + I;
    if (!cnt) continue;
    // a block holding a mapped channel keeps the channel level so the river stays connected at coarse resolution
    z[C] = nCh ? zch / nCh : zs / cnt; if (h0) h0[C] = nCh ? hch / nCh : hs / cnt; n[C] = ns / cnt; cn[C] = cs / cnt; built[C] = bs / cnt; if (pump) pump[C] = ps / cnt;
    active[C] = +(inDom * 2 > cnt); sea[C] = +(nSea * 2 > cnt); channel[C] = +(nCh > 0);
  }
  const dx = p.dx * k, x0 = p.ox + i0 * p.dx, y0 = p.oy - j0 * p.dx;
  const ll = (x: number, y: number) => { const g = fromUtm(x, y, p.zone, true); return [g.lon, g.lat] as [number, number]; };
  const cell = (x: number, y: number) => {
    const I = Math.floor((x - i0 * p.dx) / dx), J = Math.floor((y - j0 * p.dx) / dx);
    return I >= 0 && J >= 0 && I < nx && J < ny ? J * nx + I : -1;
  };
  return {
    nx, ny, dx, k, i0, j0, r: 1, building: null, z, n, cn, active, sea, channel, built, h0, pump,
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

/** Pack cell (column, row) holding run cell c, for coarse (k) and fine (r) runs alike. */
export const packCellOf = (g: Pick<RunGrid, "nx" | "k" | "r" | "i0" | "j0">, c: number): [number, number] => {
  const I = c % g.nx, J = (c - I) / g.nx;
  return g.r > 1 ? [g.i0 + Math.floor(I / g.r), g.j0 + Math.floor(J / g.r)] : [g.i0 + I * g.k + (g.k >> 1), g.j0 + J * g.k + (g.k >> 1)];
};

/** Fine grid of a dual-grid run: the compute grid solves the flow, the result is drawn and exported on these cells. */
export type FineGrid = {
  r: number; // fine cells per 30 m pack cell side
  s: number; // fine cells per compute cell side
  nx: number; ny: number; dx: number;
  building: Uint8Array; // 1 = building footprint (no water drawn there)
  base: { nx: number; ny: number; z: Float32Array; channel: Uint8Array }; // the 30 m cells of the box (ground of the fine cells)
};

/** Ground (m) of fine cell (I, J) with r fine cells per 30 m cell: bilinear between the centres of the neighbouring land cells;
 *  a channel cell keeps its own bed level (channels keep their 30 m width and volume). The same rule runs in the map shader. */
export function fineGround(base: { nx: number; ny: number; z: ArrayLike<number>; channel: ArrayLike<number> }, r: number, I: number, J: number): number {
  const pnx = base.nx, pny = base.ny, P = Math.floor(J / r) * pnx + Math.floor(I / r);
  if (base.channel[P]) return base.z[P];
  const u = (I + 0.5) / r - 0.5, v = (J + 0.5) / r - 0.5, a0 = Math.floor(u), b0 = Math.floor(v), fx = u - a0, fy = v - b0;
  let ws = 0, wz = 0;
  for (let q = 0; q < 4; q++) {
    const a = a0 + (q & 1), b = b0 + (q >> 1);
    if (a < 0 || b < 0 || a >= pnx || b >= pny || base.channel[b * pnx + a]) continue;
    const w = ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy);
    ws += w; wz += w * base.z[b * pnx + a];
  }
  return ws > 1e-9 ? wz / ws : base.z[P];
}

export const BUILDING_RAISE_M = 10; // building block: roof cells raised above any modelled water, so water flows around buildings

/** Run grid finer than the 30 m pack for a lon/lat box: r run cells per pack cell side (3 = 10 m, 6 = 5 m, 15 = 2 m, 30 = 1 m).
 *  The pack has no terrain detail below 30 m, so the ground is interpolated bilinearly between the centres of neighbouring
 *  land cells (channel cells keep their own bed level, so channels keep their 30 m width and volume); roughness, curve
 *  number, built share, sea and channel flags come from the pack cell holding the run cell. The detail that is real at this
 *  size are the building footprints (`bld`, 1 = building, Overture Maps): those cells are raised as solid blocks (building-block
 *  method, Schubert and Sanders 2012) so water flows in the streets between them; rain on a roof runs off to the street. */
export function buildFineRun(p: Pack, box: number[], r: number, year?: number, bld?: Uint8Array | null): RunGrid {
  const base = buildRun(p, box, 1, year);
  const { i0, j0 } = base, pnx = base.nx, pny = base.ny;
  const nx = pnx * r, ny = pny * r, N = nx * ny, dx = p.dx / r;
  if (bld && bld.length !== N) throw new Error("building mask size does not match the run grid");
  const z = new Float64Array(N), n = new Float64Array(N), cn = new Float64Array(N), built = new Float64Array(N);
  const active = new Uint8Array(N), sea = new Uint8Array(N), channel = new Uint8Array(N), building = bld ? new Uint8Array(N) : null;
  const h0 = base.h0 ? new Float64Array(N) : null, pump = base.pump ? new Float64Array(N) : null;
  for (let J = 0; J < ny; J++) {
    const pj = Math.floor(J / r);
    for (let I = 0; I < nx; I++) {
      const P = pj * pnx + Math.floor(I / r), C = J * nx + I;
      let zz = fineGround(base, r, I, J);
      n[C] = base.n[P]; cn[C] = base.cn[P]; built[C] = base.built[P]; active[C] = base.active[P]; sea[C] = base.sea[P]; channel[C] = base.channel[P];
      if (h0) h0[C] = base.h0![P];
      if (bld?.[C] && !channel[C] && !sea[C]) { building![C] = 1; zz += BUILDING_RAISE_M; }
      z[C] = zz;
    }
  }
  // pump sink: the same volume per pack cell, spread over its cells that are not buildings
  if (pump) for (let P = 0; P < pnx * pny; P++) {
    if (!base.pump![P]) continue;
    const pi = P % pnx, pj = (P - pi) / pnx;
    let free = 0;
    for (let dj = 0; dj < r; dj++) for (let di = 0; di < r; di++) if (!building?.[(pj * r + dj) * nx + pi * r + di]) free++;
    if (free) for (let dj = 0; dj < r; dj++) for (let di = 0; di < r; di++) { const C = (pj * r + dj) * nx + pi * r + di; if (!building?.[C]) pump[C] = (base.pump![P] * r * r) / free; }
  }
  const x0 = base.utm.x0, y0 = base.utm.y0;
  const cell = (x: number, y: number) => {
    const I = Math.floor((x - i0 * p.dx) / dx), J = Math.floor((y - j0 * p.dx) / dx);
    return I >= 0 && J >= 0 && I < nx && J < ny ? J * nx + I : -1;
  };
  return {
    nx, ny, dx, k: 1, i0, j0, r, building, z, n, cn, active, sea, channel, built, h0, pump, corners: base.corners, utm: { zone: p.zone, x0, y0 },
    isIn: (x, y) => { const c = cell(x, y); return c >= 0 && active[c] === 1 && !sea[c]; },
    // river inflow points are 30 m stream cells: search one pack cell around the point for the lowest open run cell
    cellAt: (x, y) => {
      const c0 = cell(x, y);
      if (c0 < 0) return -1;
      const I = c0 % nx, J = (c0 - I) / nx;
      let best = -1;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const a = I + di, b = J + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const c = b * nx + a;
        if (active[c] && !sea[c] && !building?.[c] && (best < 0 || z[c] < z[best])) best = c;
      }
      return best;
    },
  };
}

export const PHI_DONOR = 0.1; // compute cells with less open ground than this hand the rain on their roofs to open neighbours

/** Dual-grid run for a lon/lat box (Sanders and Schubert 2019): the result is drawn on fine cells (r per 30 m cell side, e.g.
 *  30 = 1 m), the flow is solved on coarser compute cells (rc per 30 m cell side, rc divides r) that carry the buildings of
 *  their fine cells as porosity (Sanders et al. 2008): the open share of the cell stores water, the open share between two
 *  cell centres conveys it (harmonic mean of the open share of each fine column or row in between, so a closed row of
 *  buildings blocks the flow), and rain on roofs reaches the open ground of the cell, or of the nearest open neighbours when
 *  the cell is almost all roof. Ground: open fine cells averaged (fineGround). rc = r gives the building-block grid instead. */
export function buildDualRun(p: Pack, box: number[], r: number, rc: number, year: number | undefined, bld: Uint8Array): RunGrid {
  if (rc >= r) return buildFineRun(p, box, r, year, bld);
  if (r % rc) throw new Error("compute cells must divide the fine cells");
  const base = buildRun(p, box, 1, year);
  const { i0, j0 } = base, pnx = base.nx, pny = base.ny, s = r / rc;
  const nfx = pnx * r, nfy = pny * r, nx = pnx * rc, ny = pny * rc, N = nx * ny, dx = p.dx / rc;
  if (bld.length !== nfx * nfy) throw new Error("building mask size does not match the run grid");
  const z = new Float64Array(N), n = new Float64Array(N), cn = new Float64Array(N), built = new Float64Array(N);
  const active = new Uint8Array(N), sea = new Uint8Array(N), channel = new Uint8Array(N);
  const h0 = base.h0 ? new Float64Array(N) : null, pump = base.pump ? new Float64Array(N) : null;
  const phi = new Float32Array(N), psiX = new Float32Array(N), psiY = new Float32Array(N), rainW = new Float32Array(N).fill(1);
  const building = new Uint8Array(nfx * nfy);
  const bz = Float32Array.from(base.z), bch = base.channel;
  // fine cells: building where a footprint covers the centre (not on channels or the sea)
  for (let J = 0; J < nfy; J++) for (let I = 0; I < nfx; I++) {
    const F = J * nfx + I, P = Math.floor(J / r) * pnx + Math.floor(I / r);
    if (bld[F] && !base.channel[P] && !base.sea[P]) building[F] = 1;
  }
  // open fine cells per fine column within each compute row band, and per fine row within each compute column band
  const colOpen = new Uint16Array(ny * nfx), rowOpen = new Uint16Array(nx * nfy);
  for (let J = 0; J < nfy; J++) for (let I = 0; I < nfx; I++) if (!building[J * nfx + I]) { colOpen[Math.floor(J / s) * nfx + I]++; rowOpen[Math.floor(I / s) * nfy + J]++; }
  for (let Jc = 0; Jc < ny; Jc++) for (let Ic = 0; Ic < nx; Ic++) {
    const C = Jc * nx + Ic, P = Math.floor(Jc / rc) * pnx + Math.floor(Ic / rc);
    let open = 0, zo = 0, za = 0;
    for (let dj = 0; dj < s; dj++) for (let di = 0; di < s; di++) {
      const I = Ic * s + di, J = Jc * s + dj, zg = fineGround(base, r, I, J);
      za += zg;
      if (!building[J * nfx + I]) { open++; zo += zg; }
    }
    z[C] = open ? zo / open : za / (s * s); phi[C] = open / (s * s);
    n[C] = base.n[P]; cn[C] = base.cn[P]; built[C] = base.built[P]; active[C] = base.active[P]; sea[C] = base.sea[P]; channel[C] = base.channel[P];
    if (h0) h0[C] = base.h0![P];
    // conveyance between this cell centre and the next: the fine columns (rows) in between act in series (weighted harmonic
    // mean of their open share; with an odd s the two centre columns count half)
    const h2 = Math.floor(s / 2), odd = s % 2, span = s + odd;
    const harm = (get: (k: number) => number) => {
      let ws = 0, sum = 0;
      for (let k = 0; k < span; k++) { const w = odd && (k === 0 || k === span - 1) ? 0.5 : 1, f = get(k) / s; if (f <= 0) return 0; ws += w; sum += w / f; }
      return ws / sum;
    };
    if (Ic < nx - 1) psiX[C] = harm((k) => colOpen[Jc * nfx + Ic * s + h2 + k]);
    if (Jc < ny - 1) psiY[C] = harm((k) => rowOpen[Ic * nfy + Jc * s + h2 + k]);
  }
  // pump sink: the same volume per 30 m cell, on the open ground of its compute cells
  if (pump) for (let P = 0; P < pnx * pny; P++) {
    if (!base.pump![P]) continue;
    const pi = P % pnx, pj = (P - pi) / pnx;
    let open = 0;
    for (let dj = 0; dj < rc; dj++) for (let di = 0; di < rc; di++) open += phi[(pj * rc + dj) * nx + pi * rc + di];
    if (open > 0) for (let dj = 0; dj < rc; dj++) for (let di = 0; di < rc; di++) pump[(pj * rc + dj) * nx + pi * rc + di] = (base.pump![P] * rc * rc) / open;
  }
  // roof rain of cells that are almost all roof goes to the nearest ring (up to 3 cells) of cells with open ground
  const recv = (c: number) => active[c] === 1 && !sea[c] && phi[c] >= PHI_DONOR;
  for (let Jc = 0; Jc < ny; Jc++) for (let Ic = 0; Ic < nx; Ic++) {
    const C = Jc * nx + Ic;
    if (!active[C] || sea[C] || phi[C] >= PHI_DONOR) continue;
    for (let d = 1; d <= 3; d++) {
      const ring: number[] = [];
      let ws = 0;
      for (let b = Jc - d; b <= Jc + d; b++) for (let a = Ic - d; a <= Ic + d; a++) {
        if (a < 0 || b < 0 || a >= nx || b >= ny || (Math.abs(a - Ic) < d && Math.abs(b - Jc) < d)) continue;
        const c = b * nx + a;
        if (recv(c)) { ring.push(c); ws += phi[c]; }
      }
      if (!ring.length) continue;
      const give = 1 - phi[C];
      for (const c of ring) rainW[c] += (give * phi[c]) / ws;
      rainW[C] = phi[C];
      break;
    }
  }
  const x0 = base.utm.x0, y0 = base.utm.y0;
  const cell = (x: number, y: number) => {
    const I = Math.floor((x - i0 * p.dx) / dx), J = Math.floor((y - j0 * p.dx) / dx);
    return I >= 0 && J >= 0 && I < nx && J < ny ? J * nx + I : -1;
  };
  return {
    nx, ny, dx, k: 1, i0, j0, r: rc, building: null, z, n, cn, active, sea, channel, built, h0, pump, phi, psiX, psiY, rainW,
    fine: { r, s, nx: nfx, ny: nfy, dx: p.dx / r, building, base: { nx: pnx, ny: pny, z: bz, channel: bch } },
    corners: base.corners, utm: { zone: p.zone, x0, y0 },
    isIn: (x, y) => { const c = cell(x, y); return c >= 0 && active[c] === 1 && !sea[c]; },
    cellAt: (x, y) => {
      const c0 = cell(x, y);
      if (c0 < 0) return -1;
      const I = c0 % nx, J = (c0 - I) / nx;
      let best = -1;
      for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
        const a = I + di, b = J + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const c = b * nx + a;
        if (active[c] && !sea[c] && phi[c] >= PHI_DONOR && (best < 0 || z[c] < z[best])) best = c;
      }
      return best;
    },
  };
}

/** Compute cells per 30 m cell side for a fine run of r cells per side: the finest divisor of r whose estimated run time fits
 *  `budgetS` (cells x time steps / speed; the time step follows the deepest water, estimated from the carved channels).
 *  rc = r is the building-block grid itself. */
export function chooseCompute(p: Pack, box: number[], r: number, hours: number, cellStepsPerS: number, budgetS: number, maxCells = Infinity): { rc: number; estS: number } {
  const base = buildRun(p, box, 1);
  let h0max = 0;
  if (base.h0) for (let c = 0; c < base.h0.length; c++) if (base.active[c] && !base.sea[c] && base.h0[c] > h0max) h0max = base.h0[c];
  const hEst = h0max + 1.5, landCells = base.nx * base.ny;
  const est = (rc: number) => { const dx = p.dx / rc, dt = Math.min(15, (0.5 * dx) / Math.sqrt(G_EST * hEst)); return (landCells * rc * rc * ((hours * 3600) / dt)) / cellStepsPerS; };
  const divs = Array.from({ length: r }, (_, i) => r - i).filter((d) => r % d === 0); // finest first
  for (const rc of divs) { const e = est(rc); if (e <= budgetS && landCells * rc * rc <= maxCells) return { rc, estS: e }; }
  return { rc: 1, estS: est(1) };
}
const G_EST = 9.81;
