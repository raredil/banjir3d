// Export of the map's own data layers (Ekspor > Data peta): whole dataset, the area on screen, or the drawn simulation box.
// Vector layers come from GeoJSON files next to the tiles and are filtered in the browser (features touching the area are
// kept whole); rasters are offered as the full GeoTIFF from the data release (clipping rasters needs GIS software).
import { LAYERS, type LayerDef } from "./layers";

const RELEASES = "https://github.com/raredil/banjir3d/releases/download";
export type Scope = "all" | "view" | "box";
export const exportable = (): LayerDef[] => LAYERS.filter((l) => l.dl);

type Pos = number[];
function bboxOf(g: { type: string; coordinates?: unknown; geometries?: unknown[] } | null): number[] | null {
  if (!g) return null;
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") { const p = c as Pos; b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }
    else if (Array.isArray(c)) c.forEach(walk);
  };
  if (g.type === "GeometryCollection") (g.geometries as typeof g[]).forEach((x) => walk(x.coordinates)); else walk(g.coordinates);
  return Number.isFinite(b[0]) ? b : null;
}
const touches = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** The download for one layer: a GeoJSON blob (vector) or the release URL of the full raster file. */
export async function exportLayer(def: LayerDef, scope: Scope, area: number[] | null, base: string, tag: string | null):
  Promise<{ name: string; blob?: Blob; url?: string; n?: number; total?: number }> {
  const dl = def.dl!;
  if (dl.file) {
    if (!tag) throw new Error("no data release");
    return { name: dl.file, url: `${RELEASES}/${encodeURIComponent(tag)}/${encodeURIComponent(dl.file)}` };
  }
  const feats: { geometry: Parameters<typeof bboxOf>[0] }[] = [];
  for (const f of dl.geojson!) {
    const r = await fetch(f.startsWith("meta/") ? new URL(f, location.href).href : `${base}/${f}`); // meta/: files shipped with the app
    if (!r.ok) throw new Error(`${f} ${r.status}`);
    feats.push(...((await r.json()) as { features: typeof feats }).features);
  }
  const keep = scope === "all" || !area ? feats : feats.filter((f) => { const b = bboxOf(f.geometry); return b && touches(b, area); });
  const fc = { type: "FeatureCollection", name: def.id, source: def.title, area: scope === "all" ? "whole dataset" : { scope, bbox_wgs84: area?.map((v) => +v.toFixed(5)) }, features: keep };
  return { name: `${def.id}_${scope}.geojson`, blob: new Blob([JSON.stringify(fc)], { type: "application/geo+json" }), n: keep.length, total: feats.length };
}
