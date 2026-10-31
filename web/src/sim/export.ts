// Exports of a simulation result: GeoTIFF (depth in metres or coloured), a self-contained HTML map, a PNG map figure and the
// provenance record. GeoTIFFs are in the model grid (WGS 84 / UTM 48S, EPSG:32748) and open directly in QGIS or ArcGIS.
import type { Map as MlMap } from "maplibre-gl";
import { CLASSES, CLASS_COLORS, downscale } from "./flood-layer";
import { fromUtm, toUtm } from "../util";

export type Grid = { nx: number; ny: number; dx: number; zone: number; x0: number; y0: number; z: Float32Array; mask: Uint8Array };

export function save(name: string, data: BlobPart, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Baseline GeoTIFF (uncompressed, one strip per row) with GeoKeys for a projected EPSG code. */
export function geotiff(g: Grid, bands: { data: ArrayLike<number>; type: "f32" | "u8" }[], nodata: number | null, epsg = 32700 + g.zone): Uint8Array<ArrayBuffer> {
  const w = g.nx, h = g.ny, nb = bands.length, f32 = bands[0].type === "f32", bps = f32 ? 4 : 1;
  const rowBytes = w * nb * bps, imgBytes = rowBytes * h;
  const geoKeys = [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, epsg]; // model projected, raster pixel-is-area, projected CRS
  const tags: [number, number, number, number[] | string][] = [ // tag, type (3 short, 4 long, 12 double, 2 ascii), count, values
    [256, 4, 1, [w]], [257, 4, 1, [h]], [258, 3, nb, Array(nb).fill(bps * 8)], [259, 3, 1, [1]], [262, 3, 1, [nb >= 3 ? 2 : 1]],
    [273, 4, h, []], [277, 3, 1, [nb]], [278, 4, 1, [1]], [279, 4, h, Array(h).fill(rowBytes)], [284, 3, 1, [1]],
    ...(nb === 4 ? [[338, 3, 1, [2]] as [number, number, number, number[]]] : []), [339, 3, nb, Array(nb).fill(f32 ? 3 : 1)],
    [33550, 12, 3, [g.dx, g.dx, 0]], [33922, 12, 6, [0, 0, 0, g.x0, g.y0, 0]], [34735, 3, geoKeys.length, geoKeys],
    ...(nodata !== null ? [[42113, 2, 0, `${nodata}\0`] as [number, number, number, string]] : []),
  ];
  tags.sort((a, b) => a[0] - b[0]);
  const size = (t: number) => (t === 3 ? 2 : t === 4 ? 4 : t === 12 ? 8 : 1);
  const ifdOff = 8, ifdBytes = 2 + tags.length * 12 + 4;
  let extra = ifdOff + ifdBytes;
  const extraOff: number[] = [];
  for (const [tag, type, , vals] of tags) {
    const n = typeof vals === "string" ? vals.length : tag === 273 ? h : vals.length;
    const bytes = n * size(type);
    extraOff.push(bytes > 4 ? extra : -1);
    if (bytes > 4) extra += bytes + (bytes % 2);
  }
  const imgOff = extra;
  const buf = new ArrayBuffer(imgOff + imgBytes), dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint16(0, 0x4949); dv.setUint16(2, 42, true); dv.setUint32(4, ifdOff, true);
  dv.setUint16(ifdOff, tags.length, true);
  const put = (off: number, type: number, v: number) => (type === 3 ? dv.setUint16(off, v, true) : type === 4 ? dv.setUint32(off, v, true) : type === 12 ? dv.setFloat64(off, v, true) : dv.setUint8(off, v));
  tags.forEach(([tag, type, , vals0], k) => {
    const vals = tag === 273 ? Array.from({ length: h }, (_, r) => imgOff + r * rowBytes) : vals0;
    const n = typeof vals === "string" ? vals.length : vals.length;
    const e = ifdOff + 2 + k * 12;
    dv.setUint16(e, tag, true); dv.setUint16(e + 2, type, true); dv.setUint32(e + 4, n, true);
    const at = extraOff[k] >= 0 ? extraOff[k] : e + 8;
    if (extraOff[k] >= 0) dv.setUint32(e + 8, at, true);
    if (typeof vals === "string") for (let i = 0; i < n; i++) u8[at + i] = vals.charCodeAt(i);
    else vals.forEach((v, i) => put(at + i * size(type), type, v));
  });
  let o = imgOff;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) for (let b = 0; b < nb; b++) {
    const v = bands[b].data[r * w + c];
    if (f32) dv.setFloat32(o, v, true); else dv.setUint8(o, v);
    o += bps;
  }
  return u8;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function classColor(d: number): number[] | null {
  if (d < CLASSES[0]) return null;
  let k = 0;
  for (let i = 1; i < CLASSES.length; i++) if (d >= CLASSES[i]) k = i;
  return rgb(CLASS_COLORS[k]);
}

/** Depth GeoTIFF in metres (float32, nodata -9999 outside the run area). */
export function depthTiff(g: Grid, d: Float32Array): Uint8Array<ArrayBuffer> {
  const v = new Float32Array(d.length);
  for (let c = 0; c < d.length; c++) v[c] = g.mask[c] ? d[c] : -9999;
  return geotiff(g, [{ data: v, type: "f32" }], -9999);
}

/** Coloured GeoTIFF (RGBA, depth classes) at 3x the model resolution with the smooth water-surface rule of the map. */
export function colourTiff(g: Grid, d: Float32Array, f = 3): Uint8Array<ArrayBuffer> {
  const fine = downscale(g, g.z, d, g.mask, f), W = g.nx * f, H = g.ny * f;
  const R = new Uint8Array(W * H), G = new Uint8Array(W * H), B = new Uint8Array(W * H), A = new Uint8Array(W * H);
  for (let i = 0; i < fine.length; i++) { const c = classColor(fine[i]); if (c) { R[i] = c[0]; G[i] = c[1]; B[i] = c[2]; A[i] = 255; } }
  return geotiff({ ...g, nx: W, ny: H, dx: g.dx / f }, [{ data: R, type: "u8" }, { data: G, type: "u8" }, { data: B, type: "u8" }, { data: A, type: "u8" }], null);
}

/** Web-Mercator-aligned transparent PNG of the depth classes and its lon/lat bounds (for the HTML map). */
export async function mercatorPng(g: Grid, d: Float32Array, maxW = 2400): Promise<{ url: string; bounds: [[number, number], [number, number]] }> {
  const f = 2, fine = downscale(g, g.z, d, g.mask, f), FW = g.nx * f, FH = g.ny * f, fdx = g.dx / f;
  const cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => fromUtm(g.x0 + u * g.nx * g.dx, g.y0 - v * g.ny * g.dx, g.zone, true));
  const W0 = Math.min(...cs.map((c) => c.lon)), E0 = Math.max(...cs.map((c) => c.lon)), S0 = Math.min(...cs.map((c) => c.lat)), N0 = Math.max(...cs.map((c) => c.lat));
  const my = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const lat = (y: number) => (Math.atan(Math.exp(y)) * 360) / Math.PI - 90;
  const W = Math.min(maxW, FW), H = Math.round((W * (my(N0) - my(S0))) / (((E0 - W0) * Math.PI) / 180));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!, img = ctx.createImageData(W, H);
  for (let Y = 0; Y < H; Y++) {
    const la = lat(my(N0) - ((Y + 0.5) / H) * (my(N0) - my(S0)));
    for (let X = 0; X < W; X++) {
      const lo = W0 + ((X + 0.5) / W) * (E0 - W0), u = toUtm(lo, la, g.zone);
      const i = Math.floor((u.easting - g.x0) / fdx), j = Math.floor((g.y0 - u.northing) / fdx);
      if (i < 0 || j < 0 || i >= FW || j >= FH) continue;
      const c = classColor(fine[j * FW + i]);
      if (!c) continue;
      const p = (Y * W + X) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 210;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: cv.toDataURL("image/png"), bounds: [[S0, W0], [N0, E0]] };
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Self-contained HTML map (Leaflet from a CDN + OpenStreetMap background, flood layer embedded). */
export function htmlMap(title: string, png: { url: string; bounds: [[number, number], [number, number]] }, lines: string[], legendTitle: string): string {
  const leg = CLASS_COLORS.slice(0, 5).map((c, i) => `<div><i style="background:${c}"></i>${CLASSES[i]}${i < 4 ? `–${CLASSES[i + 1]}` : "+"} m</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;font:13px system-ui,sans-serif}.box{background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 1px 6px #0003;max-width:320px}.box i{display:inline-block;width:12px;height:12px;margin-right:6px;border-radius:2px;vertical-align:-1px}.box h1{font-size:14px;margin:0 0 4px}.box p{margin:2px 0;color:#444}</style></head>
<body><div id="m"></div><script>
var m=L.map('m');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(m);
var b=${JSON.stringify(png.bounds)};var o=L.imageOverlay(${JSON.stringify(png.url)},b,{opacity:0.85}).addTo(m);m.fitBounds(b);L.control.scale({imperial:false}).addTo(m);
var info=L.control({position:'topright'});info.onAdd=function(){var d=L.DomUtil.create('div','box');d.innerHTML=${JSON.stringify(`<h1>${escHtml(title)}</h1>${lines.map((l) => `<p>${escHtml(l)}</p>`).join("")}`)};return d};info.addTo(m);
var lg=L.control({position:'bottomright'});lg.onAdd=function(){var d=L.DomUtil.create('div','box');d.innerHTML=${JSON.stringify(`<b>${escHtml(legendTitle)}</b>${leg}`)};return d};lg.addTo(m);
</script></body></html>`;
}

/** PNG map figure: the current map view with title, legend, scale bar, north arrow and source lines burned in. */
export function mapPng(map: MlMap, title: string, sub: string, lines: string[], legendTitle: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    map.once("render", () => {
      try {
        const src = map.getCanvas(), dpr = src.width / src.clientWidth, pad = 18 * dpr, head = 64 * dpr, foot = (22 + lines.length * 15) * dpr;
        const cv = document.createElement("canvas");
        cv.width = src.width + 2 * pad; cv.height = src.height + head + foot + pad;
        const c = cv.getContext("2d")!;
        c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
        c.drawImage(src, pad, head);
        c.strokeStyle = "#222"; c.lineWidth = 1 * dpr; c.strokeRect(pad, head, src.width, src.height);
        c.fillStyle = "#111"; c.font = `600 ${18 * dpr}px "IBM Plex Sans", sans-serif`; c.fillText(title, pad, 28 * dpr);
        c.fillStyle = "#444"; c.font = `${12.5 * dpr}px "IBM Plex Sans", sans-serif`; c.fillText(sub, pad, 48 * dpr);
        // legend
        const lx = pad + 12 * dpr, ly = head + 12 * dpr, lw = 150 * dpr, lh = (26 + 5 * 17) * dpr;
        c.fillStyle = "rgba(255,255,255,.92)"; c.fillRect(lx, ly, lw, lh); c.strokeStyle = "#999"; c.strokeRect(lx, ly, lw, lh);
        c.fillStyle = "#111"; c.font = `600 ${11.5 * dpr}px "IBM Plex Sans", sans-serif`; c.fillText(legendTitle, lx + 8 * dpr, ly + 17 * dpr);
        c.font = `${11 * dpr}px "IBM Plex Sans", sans-serif`;
        for (let i = 0; i < 5; i++) {
          const y = ly + (26 + i * 17) * dpr;
          c.fillStyle = CLASS_COLORS[i]; c.fillRect(lx + 8 * dpr, y, 14 * dpr, 12 * dpr);
          c.fillStyle = "#222"; c.fillText(`${CLASSES[i]}${i < 4 ? `–${CLASSES[i + 1]}` : "+"} m`, lx + 28 * dpr, y + 10 * dpr);
        }
        // scale bar
        const lat = map.getCenter().lat, mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom()) / dpr;
        const target = 120 * dpr * mpp, nice = [1, 2, 5].flatMap((k) => [k, k * 10, k * 100, k * 1000, k * 10000]).sort((a, b) => a - b).filter((v) => v <= target).pop() ?? 1;
        const bw = nice / mpp, bx = pad + src.width - bw - 16 * dpr, by = head + src.height - 22 * dpr;
        c.fillStyle = "rgba(255,255,255,.9)"; c.fillRect(bx - 6 * dpr, by - 16 * dpr, bw + 12 * dpr, 28 * dpr);
        c.fillStyle = "#111"; c.fillRect(bx, by, bw, 4 * dpr);
        c.font = `${11 * dpr}px "IBM Plex Sans", sans-serif`; c.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, bx, by - 4 * dpr);
        // north arrow, turned by the map bearing (the user can rotate the map)
        const nx = pad + src.width - 28 * dpr, ny = head + 30 * dpr;
        c.fillStyle = "rgba(255,255,255,.9)"; c.beginPath(); c.arc(nx, ny, 22 * dpr, 0, 2 * Math.PI); c.fill();
        c.save(); c.translate(nx, ny); c.rotate((-map.getBearing() * Math.PI) / 180);
        c.fillStyle = "#111"; c.beginPath(); c.moveTo(0, -16 * dpr); c.lineTo(-8 * dpr, 6 * dpr); c.lineTo(0, 1 * dpr); c.lineTo(8 * dpr, 6 * dpr); c.closePath(); c.fill();
        c.font = `600 ${10 * dpr}px "IBM Plex Sans", sans-serif`; c.textAlign = "center"; c.fillText("U/N", 0, 17 * dpr);
        c.restore();
        c.fillStyle = "#444"; c.font = `${10.5 * dpr}px "IBM Plex Sans", sans-serif`;
        lines.forEach((l, i) => c.fillText(l, pad, head + src.height + (18 + i * 15) * dpr));
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
      } catch (e) { reject(e); }
    });
    map.triggerRepaint();
  });
}
