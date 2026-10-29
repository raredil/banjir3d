import { PMTiles } from "pmtiles";

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

export type GridWindow = { x0: number; y0: number; nx: number; ny: number; dx: number; dy: number; corners: [number, number][] };

/** The block of z12 DEM pixels covering bbox [W,S,E,N], its ground cell size and its image corners (lon/lat, NW first). */
export function gridWindow(b: number[]): GridWindow {
  const x0 = Math.floor(lonToPx(b[0])), x1 = Math.ceil(lonToPx(b[2]));
  const y0 = Math.floor(latToPy(b[3])), y1 = Math.ceil(latToPy(b[1]));
  const cell = (EARTH / WORLD) * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180);
  return {
    x0, y0, nx: x1 - x0, ny: y1 - y0, dx: cell, dy: cell,
    corners: [[pxToLon(x0), pxToLat(y0)], [pxToLon(x1), pxToLat(y0)], [pxToLon(x1), pxToLat(y1)], [pxToLon(x0), pxToLat(y1)]],
  };
}

/** Read the DEM window from the FABDEM PMTiles (browser only). Returns metres, row 0 = north. */
export async function loadDem(url: string, b: number[]): Promise<GridWindow & { z: Float64Array }> {
  const w = gridWindow(b);
  const pm = new PMTiles(url);
  const z = new Float64Array(w.nx * w.ny).fill(NaN);
  const tx0 = Math.floor(w.x0 / TS), tx1 = Math.floor((w.x0 + w.nx - 1) / TS);
  const ty0 = Math.floor(w.y0 / TS), ty1 = Math.floor((w.y0 + w.ny - 1) / TS);
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
        if (gy < 0 || gy >= w.ny) continue;
        for (let i = 0; i < TS; i++) {
          const gx = tx * TS + i - w.x0;
          if (gx < 0 || gx >= w.nx) continue;
          const k = (j * TS + i) * 4;
          z[gy * w.nx + gx] = terrarium(px[k], px[k + 1], px[k + 2]);
        }
      }
    }
  }
  let fill = 0, have = false;
  for (const v of z) if (!Number.isNaN(v)) { fill = Number.isNaN(fill) || !have ? v : Math.min(fill, v); have = true; }
  for (let c = 0; c < z.length; c++) if (Number.isNaN(z[c])) z[c] = fill;
  return { ...w, z };
}
