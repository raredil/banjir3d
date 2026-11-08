// Building footprints for fine runs (10 m and finer): the Overture Maps buildings of the region pack (buildings_overture.pmtiles,
// zoom 14, the same tiles the map draws) are read for the run box and burned into the run grid: a cell is a building when its
// centre lies inside a footprint. Small Mapbox Vector Tile reader (spec 2.1) so no extra library is needed.
import { PMTiles } from "pmtiles";
import { toUtm } from "../util";

type Ring = [number, number][];
export type TileFeature = { type: number; rings: Ring[]; props: Record<string, unknown> };

/** Decode the features of one layer of a Mapbox Vector Tile (geometry in tile units 0..extent). */
export function decodeMvt(buf: Uint8Array, layerName: string): { extent: number; features: TileFeature[] } {
  let pos = 0;
  const varint = (end: number) => { let v = 0, s = 1, b; do { if (pos >= end) throw new Error("bad tile"); b = buf[pos++]; v += (b & 0x7f) * s; s *= 128; } while (b & 0x80); return v; };
  const skip = (wt: number, end: number) => { if (wt === 0) varint(end); else if (wt === 1) pos += 8; else if (wt === 2) { const l = varint(end); pos += l; } else if (wt === 5) pos += 4; else throw new Error("bad tile"); };
  const str = (len: number) => new TextDecoder().decode(buf.subarray(pos, (pos += len)));
  const packed = (end: number) => { const len = varint(end), e = pos + len, out: number[] = []; while (pos < e) out.push(varint(e)); return out; };
  const zz = (v: number) => (v % 2 ? -(v + 1) / 2 : v / 2);
  const out: TileFeature[] = [];
  let extent = 4096;
  while (pos < buf.length) {
    const key = varint(buf.length), wt = key & 7;
    if (key >> 3 !== 3 || wt !== 2) { skip(wt, buf.length); continue; }
    const lend = varint(buf.length) + pos; // length first: pos moves past the varint
    let name = "", ext = 4096;
    const keys: string[] = [], vals: unknown[] = [], feats: { type: number; tags: number[]; geom: number[] }[] = [];
    while (pos < lend) {
      const k2 = varint(lend), f = k2 >> 3, w = k2 & 7;
      if (f === 1 && w === 2) name = str(varint(lend));
      else if (f === 3 && w === 2) keys.push(str(varint(lend)));
      else if (f === 5 && w === 0) ext = varint(lend);
      else if (f === 4 && w === 2) {
        const vend = varint(lend) + pos; let v: unknown = null;
        while (pos < vend) {
          const k3 = varint(vend), f3 = k3 >> 3, w3 = k3 & 7;
          if (f3 === 1 && w3 === 2) v = str(varint(vend));
          else if (f3 === 2 && w3 === 5) { v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getFloat32(0, true); pos += 4; }
          else if (f3 === 3 && w3 === 1) { v = new DataView(buf.buffer, buf.byteOffset + pos, 8).getFloat64(0, true); pos += 8; }
          else if ((f3 === 4 || f3 === 5) && w3 === 0) v = varint(vend);
          else if (f3 === 6 && w3 === 0) v = zz(varint(vend));
          else if (f3 === 7 && w3 === 0) v = varint(vend) === 1;
          else skip(w3, vend);
        }
        vals.push(v);
      } else if (f === 2 && w === 2) {
        const fend = varint(lend) + pos, ft = { type: 0, tags: [] as number[], geom: [] as number[] };
        while (pos < fend) {
          const k3 = varint(fend), f3 = k3 >> 3, w3 = k3 & 7;
          if (f3 === 2 && w3 === 2) ft.tags = packed(fend);
          else if (f3 === 3 && w3 === 0) ft.type = varint(fend);
          else if (f3 === 4 && w3 === 2) ft.geom = packed(fend);
          else skip(w3, fend);
        }
        feats.push(ft);
      } else skip(w, lend);
    }
    pos = lend;
    if (name !== layerName) continue;
    extent = ext;
    for (const ft of feats) {
      const rings: Ring[] = [];
      let x = 0, y = 0, i = 0, cur: Ring = [];
      while (i < ft.geom.length) {
        const cmd = ft.geom[i] & 7, cnt = ft.geom[i++] >> 3;
        if (cmd === 7) { if (cur.length) rings.push(cur); cur = []; continue; }
        for (let c = 0; c < cnt; c++) {
          x += zz(ft.geom[i++]); y += zz(ft.geom[i++]);
          if (cmd === 1) { if (cur.length) rings.push(cur); cur = []; }
          cur.push([x, y]);
        }
      }
      if (cur.length) rings.push(cur);
      const props: Record<string, unknown> = {};
      for (let t = 0; t + 1 < ft.tags.length; t += 2) props[keys[ft.tags[t]]] = vals[ft.tags[t + 1]];
      out.push({ type: ft.type, rings, props });
    }
  }
  return { extent, features: out };
}

/** Mark cells whose centre lies inside the polygon (even-odd over its rings); rings in grid units (column, row). */
export function fillPolygon(mask: Uint8Array, nx: number, ny: number, rings: Ring[]) {
  let y0 = Infinity, y1 = -Infinity;
  for (const r of rings) for (const p of r) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const ja = Math.max(0, Math.ceil(y0 - 0.5)), jb = Math.min(ny - 1, Math.floor(y1 - 0.5));
  const xs: number[] = [];
  for (let j = ja; j <= jb; j++) {
    const yc = j + 0.5;
    xs.length = 0;
    for (const r of rings) for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const [xa, ya] = r[a], [xb, yb] = r[b];
      if ((ya > yc) !== (yb > yc)) xs.push(xa + ((yc - ya) * (xb - xa)) / (yb - ya));
    }
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const ia = Math.max(0, Math.ceil(xs[m] - 0.5)), ib = Math.min(nx - 1, Math.floor(xs[m + 1] - 0.5));
      for (let i = ia; i <= ib; i++) mask[j * nx + i] = 1;
    }
  }
}

const Z = 14; // the building tiles exist at zoom 14 only
const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * 2 ** Z);
const tileY = (lat: number) => Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * 2 ** Z);

/** Building mask (1 = footprint) on a run grid (NW corner x0/y0 in UTM, cell dx), from the region's building tiles. */
export async function buildingMask(url: string, g: { nx: number; ny: number; dx: number; utm: { zone: number; x0: number; y0: number }; corners: [number, number][] }): Promise<{ mask: Uint8Array; footprints: number; cells: number }> {
  const pm = new PMTiles(url);
  const lons = g.corners.map((c) => c[0]), lats = g.corners.map((c) => c[1]);
  const xa = tileX(Math.min(...lons)), xb = tileX(Math.max(...lons)), ya = tileY(Math.max(...lats)), yb = tileY(Math.min(...lats));
  const mask = new Uint8Array(g.nx * g.ny);
  let footprints = 0;
  const jobs: Promise<void>[] = [];
  for (let tx = xa; tx <= xb; tx++) for (let ty = ya; ty <= yb; ty++) jobs.push((async () => {
    const r = await pm.getZxy(Z, tx, ty);
    if (!r?.data) return;
    const { extent, features } = decodeMvt(new Uint8Array(r.data), "buildings");
    for (const f of features) {
      if (f.type !== 3) continue;
      const rings = f.rings.map((ring) => ring.map(([px, py]) => {
        const lon = ((tx + px / extent) / 2 ** Z) * 360 - 180;
        const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + py / extent)) / 2 ** Z))) * 180) / Math.PI;
        const u = toUtm(lon, lat, g.utm.zone);
        return [(u.easting - g.utm.x0) / g.dx, (g.utm.y0 - u.northing) / g.dx] as [number, number];
      }));
      let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity;
      for (const p of rings[0] ?? []) { ax = Math.min(ax, p[0]); bx = Math.max(bx, p[0]); ay = Math.min(ay, p[1]); by = Math.max(by, p[1]); }
      if (bx < 0 || by < 0 || ax > g.nx || ay > g.ny) continue;
      footprints++; // pieces: a footprint crossing a tile edge counts in both tiles
      fillPolygon(mask, g.nx, g.ny, rings);
    }
  })());
  await Promise.all(jobs);
  let cells = 0;
  for (let c = 0; c < mask.length; c++) cells += mask[c];
  return { mask, footprints, cells };
}
