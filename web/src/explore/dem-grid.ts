import { PMTiles } from "pmtiles";
import { WORLDCOVER_FACTOR, classify } from "./roughness";

// Geometry on the Web Mercator pixel grid of the FABDEM tiles (z12, 256 px tiles). Pure functions are unit-tested.
export const DEM_Z = 12;
const TS = 256;
const WORLD = TS * 2 ** DEM_Z;
const EARTH = 40075016.686;

export const lonToPx = (lon: number) => ((lon + 180) / 360) * WORLD;
export const latToPy = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD;
};
export const pxToLon = (x: number) => (x / WORLD) * 360 - 180;
export const pxToLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD))) * 180) / Math.PI;
export const terrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;

export type GridWindow = { x0: number; y0: number; k: number; nx: number; ny: number; dx: number; dy: number; corners: [number, number][] };
export const MAX_CELLS = 160_000; // keeps one run within about a minute on a normal laptop CPU

/** Model grid over bbox [W,S,E,N]: blocks of k x k z12 DEM pixels (k = 1 gives about 38 m cells at Jakarta), its ground cell
 *  size and its image corners (lon/lat, NW first). x0, y0 are z12 pixel coordinates. */
export function gridWindow(b: number[], k = 1): GridWindow {
  const x0 = Math.floor(lonToPx(b[0])), y0 = Math.floor(latToPy(b[3]));
  const nx = Math.ceil((Math.ceil(lonToPx(b[2])) - x0) / k), ny = Math.ceil((Math.ceil(latToPy(b[1])) - y0) / k);
  const x1 = x0 + nx * k, y1 = y0 + ny * k;
  const cell = (EARTH / WORLD) * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180) * k;
  return {
    x0, y0, k, nx, ny, dx: cell, dy: cell,
    corners: [[pxToLon(x0), pxToLat(y0)], [pxToLon(x1), pxToLat(y0)], [pxToLon(x1), pxToLat(y1)], [pxToLon(x0), pxToLat(y1)]],
  };
}

/** Smallest aggregation factor k whose grid has at most maxCells cells. */
export function aggregationFor(b: number[], maxCells = MAX_CELLS): number {
  let k = 1;
  for (;;) { const w = gridWindow(b, k); if (w.nx * w.ny <= maxCells || k >= 16) return k; k++; }
}

/** Mean of k x k blocks of a fine grid (row 0 = north), NaN ignored. */
export function blockMean(fine: Float64Array, nx: number, ny: number, k: number): Float64Array {
  if (k === 1) return fine;
  const W = nx * k, out = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0, n = 0;
    for (let dj = 0; dj < k; dj++) for (let di = 0; di < k; di++) { const v = fine[(j * k + dj) * W + i * k + di]; if (!Number.isNaN(v)) { s += v; n++; } }
    out[j * nx + i] = n ? s / n : NaN;
  }
  return out;
}

/** Read the DEM window from the FABDEM PMTiles (browser only). Returns metres, row 0 = north. */
export async function loadDem(url: string, b: number[], k = 1): Promise<GridWindow & { z: Float64Array }> {
  const w = gridWindow(b, k);
  const W = w.nx * k, H = w.ny * k;
  const pm = new PMTiles(url);
  const fine = new Float64Array(W * H).fill(NaN);
  const tx0 = Math.floor(w.x0 / TS), tx1 = Math.floor((w.x0 + W - 1) / TS);
  const ty0 = Math.floor(w.y0 / TS), ty1 = Math.floor((w.y0 + H - 1) / TS);
  const canvas = document.createElement("canvas");
  canvas.width = TS; canvas.height = TS;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = await pm.getZxy(DEM_Z, tx, ty);
      if (!tile) continue;
      const bmp = await createImageBitmap(new Blob([tile.data], { type: "image/png" }));
      ctx.clearRect(0, 0, TS, TS);
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, TS, TS).data;
      for (let j = 0; j < TS; j++) {
        const gy = ty * TS + j - w.y0;
        if (gy < 0 || gy >= H) continue;
        for (let i = 0; i < TS; i++) {
          const gx = tx * TS + i - w.x0;
          if (gx < 0 || gx >= W) continue;
          const p = (j * TS + i) * 4;
          fine[gy * W + gx] = terrarium(px[p], px[p + 1], px[p + 2]);
        }
      }
    }
  }
  const z = blockMean(fine, w.nx, w.ny, k);
  let fill = 0, have = false;
  for (const v of z) if (!Number.isNaN(v)) { fill = Number.isNaN(fill) || !have ? v : Math.min(fill, v); have = true; }
  for (let c = 0; c < z.length; c++) if (Number.isNaN(z[c])) z[c] = fill;
  return { ...w, z };
}

/** WorldCover class code (0 = no data) for every z14 pixel inside the DEM window, row 0 = north (browser only). */
export async function loadLandCover(url: string, b: number[], k = 1): Promise<{ codes: Uint8Array; nx: number; ny: number; f: number }> {
  const w = gridWindow(b, k);
  const f = WORLDCOVER_FACTOR * k, zt = DEM_Z + Math.log2(WORLDCOVER_FACTOR);
  const W = w.nx * f, H = w.ny * f, gx0 = w.x0 * WORLDCOVER_FACTOR, gy0 = w.y0 * WORLDCOVER_FACTOR;
  const codes = new Uint8Array(W * H);
  const pm = new PMTiles(url);
  const canvas = document.createElement("canvas");
  canvas.width = TS; canvas.height = TS;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  for (let ty = Math.floor(gy0 / TS); ty <= Math.floor((gy0 + H - 1) / TS); ty++) {
    for (let tx = Math.floor(gx0 / TS); tx <= Math.floor((gx0 + W - 1) / TS); tx++) {
      const tile = await pm.getZxy(zt, tx, ty);
      if (!tile) continue;
      const bmp = await createImageBitmap(new Blob([tile.data], { type: "image/png" }));
      ctx.clearRect(0, 0, TS, TS);
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, TS, TS).data;
      for (let j = 0; j < TS; j++) {
        const y = ty * TS + j - gy0;
        if (y < 0 || y >= H) continue;
        for (let i = 0; i < TS; i++) {
          const x = tx * TS + i - gx0;
          if (x < 0 || x >= W) continue;
          const k = (j * TS + i) * 4;
          if (px[k + 3] > 0) codes[y * W + x] = classify(px[k], px[k + 1], px[k + 2]);
        }
      }
    }
  }
  return { codes, nx: w.nx, ny: w.ny, f };
}
