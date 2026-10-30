import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl, Map as MlMap, NavigationControl, ScaleControl,
  type LayerSpecification, type StyleSpecification,
} from "maplibre-gl";
import { ensurePmtiles } from "./pmtiles-init";
import { t, type Key } from "./i18n";
import { LAYERS, type LayerDef, type LegendItem } from "./layers";
import type { Catalog, Manifest } from "./types";
import { MAX_ZOOM, esc, rasterResampling, toUtm } from "./util";

const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FONT = ["Noto Sans Regular"];

type Ctx = { regionId: string; region: { bbox: number[]; name: string; domain?: string }; manifest: Manifest | null; catalog: Catalog; dataBase: string; at?: string | null; sample?: number[] | null };

function attributionFor(def: LayerDef, catalog: Catalog): string {
  const d = catalog.datasets.find((x) => x.id === def.catalogId);
  return d?.licence.attribution ? esc(d.licence.attribution) : "";
}

function displayFiles(manifest: Manifest | null): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  manifest?.layers.forEach((l) => l.display?.forEach((d) => m.set(d.file, d)));
  return m;
}

function emptyStyle(): StyleSpecification {
  return { version: 8, glyphs: GLYPHS, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef1f4" } }] };
}

async function loadBasemap(kind: string): Promise<StyleSpecification> {
  if (kind === "none") return emptyStyle();
  try {
    const r = await fetch(BASEMAP);
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as StyleSpecification;
  } catch {
    return emptyStyle();
  }
}

/** MapLibre layers for one definition. Returned layers are inserted under the basemap labels. */
function mlLayers(def: LayerDef, src: string, zoom: number): LayerSpecification[] {
  const vis = def.visible ? "visible" : "none";
  const o = def.opacity;
  switch (def.kind) {
    case "raster":
      return [{ id: def.id, type: "raster", source: src, layout: { visibility: vis }, paint: { "raster-opacity": o, "raster-resampling": rasterResampling(def.id === "s2", zoom) } }];
    case "hillshade":
      return [{ id: def.id, type: "hillshade", source: src, layout: { visibility: vis }, paint: { "hillshade-exaggeration": o, "hillshade-shadow-color": "#2b3440", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#5b6573" } }];
    case "relief": {
      const stops = (def.ramp?.stops ?? []).flatMap(([v, c]) => [v, c]);
      return [{ id: def.id, type: "color-relief", source: src, layout: { visibility: vis }, paint: { "color-relief-opacity": o, "color-relief-color": ["interpolate", ["linear"], ["elevation"], ...stops] } } as LayerSpecification];
    }
    case "water":
      return [
        { id: `${def.id}-fill`, type: "fill", source: src, "source-layer": "water", filter: ["==", ["get", "geom"], "area"], layout: { visibility: vis },
          paint: { "fill-color": ["match", ["get", "kind"], "wetland", "#5fb3a6", "#2f7fd1"], "fill-opacity": 0.75 * o, "fill-outline-color": "#1f5fa8" } },
        { id: `${def.id}-line`, type: "line", source: src, "source-layer": "water", filter: ["==", ["get", "geom"], "line"], layout: { visibility: vis, "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["match", ["get", "kind"], ["river", "canal"], "#1f5fa8", "#5aa4e6"], "line-opacity": o,
            "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "kind"], ["river", "canal"], 1.2, 0.4], 15, ["match", ["get", "kind"], ["river", "canal"], 4, 1.6]] } },
      ];
    case "buildings":
      return [{ id: def.id, type: "fill", source: src, "source-layer": "buildings", minzoom: 13.5, layout: { visibility: vis }, paint: { "fill-color": "#6b6f7a", "fill-opacity": o, "fill-outline-color": "#3d4049" } }];
    case "admin":
      return [
        { id: `${def.id}-adm3`, type: "line", source: src, "source-layer": "admin", filter: ["==", ["get", "level"], "ADM3"], minzoom: 9, layout: { visibility: vis }, paint: { "line-color": "#8a8f9c", "line-width": 0.8, "line-dasharray": [3, 2], "line-opacity": o } },
        { id: `${def.id}-adm2`, type: "line", source: src, "source-layer": "admin", filter: ["==", ["get", "level"], "ADM2"], layout: { visibility: vis }, paint: { "line-color": "#3a3f4b", "line-width": 1.6, "line-opacity": o } },
        { id: `${def.id}-label`, type: "symbol", source: src, "source-layer": "admin", filter: ["==", ["get", "level"], "ADM3"], minzoom: 11, layout: { visibility: vis, "text-field": ["get", "shapeName"], "text-font": FONT, "text-size": 11 }, paint: { "text-color": "#3a3f4b", "text-halo-color": "#ffffff", "text-halo-width": 1.2 } },
      ];
    case "demnas-grid":
      return [
        { id: `${def.id}-line`, type: "line", source: src, layout: { visibility: vis }, paint: { "line-color": "#d9480f", "line-width": 1.5 } },
        { id: `${def.id}-label`, type: "symbol", source: src, layout: { visibility: vis, "text-field": ["get", "code"], "text-font": FONT, "text-size": 13 }, paint: { "text-color": "#d9480f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } },
      ];
    case "region": {
      const base = { id: def.id, type: "line" as const, source: src, layout: { visibility: vis as "visible" | "none" } };
      if (def.role === "admin") return [{ ...base, filter: ["==", ["get", "role"], "admin"], paint: { "line-color": "#7a2e0b", "line-width": 1.5, "line-dasharray": [4, 2] } }];
      if (def.role === "sample") return [{ ...base, filter: ["==", ["get", "role"], "sample"], paint: { "line-color": "#9c36b5", "line-width": 2.2, "line-dasharray": [2, 1.5] } }];
      return [{ ...base, filter: ["==", ["get", "role"], "domain"], paint: { "line-color": "#e8590c", "line-width": 2.5 } }];
    }
  }
}

function legendHtml(def: LayerDef, display: Record<string, unknown> | undefined): string {
  let items: LegendItem[] | undefined = def.legend;
  const fromPack = display?.legend as Record<string, LegendItem> | undefined;
  if (fromPack) items = Object.values(fromPack);
  if (items?.length) {
    return `<ul class="legend">${items.map((i) => `<li><span class="swatch" style="background:${esc(i.color)}"></span>${esc(i.label)}</li>`).join("")}</ul>`;
  }
  if (def.ramp) {
    const s = def.ramp.stops;
    const grad = s.map(([, c], i) => `${esc(c)} ${Math.round((i / (s.length - 1)) * 100)}%`).join(",");
    return `<div class="ramp"><div class="ramp-bar" style="background:linear-gradient(90deg,${grad})"></div><div class="ramp-labels"><span>${esc(s[0][0])}</span><span>${esc(def.ramp.unit)}</span><span>${esc(s[s.length - 1][0])}</span></div></div>`;
  }
  return "";
}

export async function renderMap(root: HTMLElement, ctx: Ctx) {
  ensurePmtiles();
  const files = displayFiles(ctx.manifest);
  const available = (d: LayerDef) => (d.role === "sample" ? !!ctx.sample : !d.file || files.has(d.file));
  const packInfo = ctx.manifest
    ? `<div class="pack-info">${t("pack.built")}: <span class="mono">${esc(ctx.manifest.created.slice(0, 10))}</span>${ctx.manifest.layers.filter((l) => l.status === "failed").length ? ` · <span class="warn">${ctx.manifest.layers.filter((l) => l.status === "failed").map((l) => esc(l.dataset)).join(", ")}: ${t("status.failed")}</span>` : ""}</div>`
    : `<div class="notice">${t("nopack")}</div>`;

  const groups = [...new Set(LAYERS.map((l) => l.group))];
  root.innerHTML = `
    <section class="map-page">
      <aside class="panel" aria-label="${t("layers")}">
        <div class="panel-head"><h2>${t("layers")}</h2><span class="region-name">${esc(ctx.region.name)}</span></div>
        ${packInfo}
        <label class="basemap">${t("basemap")}
          <select id="basemap"><option value="light">${t("basemap.light")}</option><option value="none">${t("basemap.none")}</option></select>
        </label>
        ${groups.map((g) => `
          <div class="group"><h3>${t(g as Key)}</h3>
          ${LAYERS.filter((l) => l.group === g).map((l) => `
            <div class="layer ${available(l) ? "" : "missing"}" data-id="${l.id}">
              <label class="layer-row"><input type="checkbox" ${l.visible && available(l) ? "checked" : ""} ${available(l) ? "" : "disabled"} data-toggle="${l.id}"><span>${esc(l.title)}</span></label>
              <div class="layer-extra">
                ${l.kind === "region" || l.kind === "demnas-grid" ? "" : `<label class="opacity">${t("opacity")} <input type="range" min="0" max="1" step="0.05" value="${l.opacity}" data-opacity="${l.id}"></label>`}
                ${legendHtml(l, l.file ? files.get(l.file) : undefined)}
                ${l.catalogId ? `<a class="src-link" href="#/catalog?d=${esc(l.catalogId)}">${t("source")} ↗</a>` : ""}
              </div>
            </div>`).join("")}
          </div>`).join("")}
        <p class="crs-note">${t("crs.note")}</p>
      </aside>
      <div class="map-wrap"><div id="map"></div><div class="coords mono" id="coords"></div></div>
    </section>`;

  const [w, s, e, n] = ctx.region.bbox;
  const at = (ctx.at ?? "").split(",").map(Number);
  const view = at.length === 3 && at.every(Number.isFinite)
    ? { center: [at[0], at[1]] as [number, number], zoom: at[2] }
    : { bounds: [[w, s], [e, n]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 24 } };
  const map = new MlMap({
    container: "map",
    style: await loadBasemap("light"),
    ...view,
    attributionControl: false,
    maxPitch: 0,
    maxZoom: MAX_ZOOM,
  });
  map.addControl(new NavigationControl({ visualizePitch: false }), "top-right");
  map.addControl(new ScaleControl({ unit: "metric", maxWidth: 160 }), "bottom-right");
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");

  const tileGrid = new URL(`meta/${ctx.regionId}_tiles.geojson`, location.href).href;
  const domain = ctx.region.domain ? new URL(`meta/${ctx.region.domain.split("/").pop()}`, location.href).href : null;
  const addOverlays = () => {
    const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    for (const def of LAYERS) {
      if (!available(def)) continue;
      const src = def.kind === "region" ? (def.role === "sample" ? "src-sample" : "src-region") : `src-${def.file ?? def.id}`;
      if (!map.getSource(src)) {
        const attribution = attributionFor(def, ctx.catalog);
        if (def.kind === "demnas-grid") map.addSource(src, { type: "geojson", data: tileGrid });
        else if (def.kind === "region" && def.role === "sample") {
          const [sw, ss, se, sn] = ctx.sample!;
          map.addSource(src, { type: "geojson", data: { type: "Feature", properties: { role: "sample" }, geometry: { type: "Polygon", coordinates: [[[sw, ss], [se, ss], [se, sn], [sw, sn], [sw, ss]]] } } });
        }
        else if (def.kind === "region") map.addSource(src, { type: "geojson", data: domain ?? { type: "Feature", properties: { role: "domain" }, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } } });
        else {
          const url = `pmtiles://${new URL(`${ctx.dataBase}/${def.file}`, location.href).href}`;
          const meta = files.get(def.file!) ?? {};
          if (def.kind === "hillshade" || def.kind === "relief") map.addSource(src, { type: "raster-dem", url, encoding: "terrarium", tileSize: 256, attribution });
          else if (meta.kind === "vector") map.addSource(src, { type: "vector", url, attribution });
          else map.addSource(src, { type: "raster", url, tileSize: 256, attribution });
        }
      }
      for (const layer of mlLayers(def, src, map.getZoom())) map.addLayer(layer, def.kind === "demnas-grid" || def.kind === "region" ? undefined : firstSymbol);
    }
  };
  map.on("zoom", () => {
    const r = rasterResampling(true, map.getZoom());
    if (map.getLayer("s2") && map.getPaintProperty("s2", "raster-resampling") !== r) map.setPaintProperty("s2", "raster-resampling", r);
  });
  map.on("load", () => {
    addOverlays();
    map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  });

  const layerIds = (id: string) => (map.getStyle()?.layers ?? []).filter((l) => l.id === id || l.id.startsWith(`${id}-`)).map((l) => l.id);
  root.querySelectorAll<HTMLInputElement>("[data-toggle]").forEach((cb) =>
    cb.addEventListener("change", () => {
      const def = LAYERS.find((l) => l.id === cb.dataset.toggle)!;
      def.visible = cb.checked;
      layerIds(def.id).forEach((id) => map.setLayoutProperty(id, "visibility", cb.checked ? "visible" : "none"));
    }));
  root.querySelectorAll<HTMLInputElement>("[data-opacity]").forEach((r) =>
    r.addEventListener("input", () => {
      const def = LAYERS.find((l) => l.id === r.dataset.opacity)!;
      def.opacity = Number(r.value);
      for (const id of layerIds(def.id)) {
        const type = map.getLayer(id)?.type;
        const props: Record<string, Parameters<MlMap["setPaintProperty"]>[1]> = {
          raster: "raster-opacity", hillshade: "hillshade-exaggeration", "color-relief": "color-relief-opacity", fill: "fill-opacity", line: "line-opacity",
        };
        const prop = props[type ?? ""];
        if (prop) map.setPaintProperty(id, prop, def.opacity);
      }
    }));
  root.querySelector<HTMLSelectElement>("#basemap")!.addEventListener("change", async (ev) => {
    map.setStyle(await loadBasemap((ev.target as HTMLSelectElement).value));
    map.once("style.load", addOverlays);
  });

  const coords = root.querySelector<HTMLElement>("#coords")!;
  map.on("mousemove", (ev) => {
    const { lng, lat } = ev.lngLat;
    const u = toUtm(lng, lat);
    coords.textContent = `${t("coords")}  ${lat.toFixed(5)}°, ${lng.toFixed(5)}°  ·  UTM ${u.zone}${u.hemisphere} E ${u.easting.toFixed(0)} N ${u.northing.toFixed(0)}  ·  z${map.getZoom().toFixed(1)}`;
  });
  return map;
}
