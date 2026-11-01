import "maplibre-gl/dist/maplibre-gl.css";
import { AttributionControl, Map as MlMap, NavigationControl, Popup, ScaleControl, type ExpressionSpecification, type FilterSpecification, type LayerSpecification, type StyleSpecification } from "maplibre-gl";
import { ensurePmtiles } from "./pmtiles-init";
import { lang, t, type Key } from "./i18n";
import { LAYERS, OBS_CLASSES, type LayerDef, type LegendItem } from "./layers";
import type { Catalog, Manifest } from "./types";
import { MAX_ZOOM, esc, rasterResampling, toUtm } from "./util";

const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FONT = ["Noto Sans Regular"];
// Esri World Imagery (owner's choice, 2026-10-31) with Esri's place-name overlay; attribution as Esri requires.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const ESRI_ATTR = 'Powered by <a href="https://www.esri.com">Esri</a> | Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export type MapCtx = { regionId: string; region: { bbox: number[]; name: string; domain?: string }; manifest: Manifest | null; catalog: Catalog; dataBase: string; at?: string | null };
export type MapPage = { el: HTMLElement; map: MlMap; dockBody: HTMLElement; kpis: HTMLElement; timeline: HTMLElement; legend: HTMLElement; tools: HTMLElement; setTab(tab: "layers" | "sim"): void; onOverlays(f: () => void): void; onTab?: (tab: "layers" | "sim") => void;
  /** Show only the recorded floods (DSDA polygons, citizen reports) of one observed event, or all of them (null). */
  setObservedEvent(ev: { id: string; dates: string[] } | null, show?: boolean): void;
  /** A simulation result in the active-layers list (on top, can be hidden, reordered, removed). */
  addResult(r: ResultEntry): void; removeResult(id: string): void; refreshLayers(): void };
export type ResultEntry = { id: string; name: () => string; ids: () => string[]; remove: () => void; onVisible?: (on: boolean) => void };

// filters for the Jakarta Satu layer (one vector layer "js", feature type in "t") and the recorded-flood layers
const isT = (...t: string[]) => ["in", ["get", "t"], ["literal", t]] as ExpressionSpecification;
const obsColor = (): unknown => ["step", ["coalesce", ["get", "depth_cm"], 0], ...OBS_CLASSES.flatMap(([v, c], i) => (i === 0 ? [c] : [v, c]))];
let genanganFilter: FilterSpecification = isT("genangan"), reportsFilter: FilterSpecification | null = null;
const hiddenR = new Set<string>(); // switched on in the left list but hidden in the active-layers card
let order: string[] = [], labelAnchor: string | undefined; // active layer ids, top first; first basemap label layer

const displayFiles = (m: Manifest | null) => { const r = new Map<string, Record<string, unknown>>(); m?.layers.forEach((l) => l.display?.forEach((d) => r.set(d.file, d))); return r; };
const emptyStyle = (): StyleSpecification => ({ version: 8, glyphs: GLYPHS, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef1f4" } }] });
async function loadBasemap(kind: string): Promise<StyleSpecification> {
  if (kind === "none") return emptyStyle();
  if (kind === "sat") return {
    version: 8, glyphs: GLYPHS,
    sources: {
      esri: { type: "raster", tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: ESRI_ATTR },
      esriLabels: { type: "raster", tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
    },
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#1b2430" } }, { id: "esri", type: "raster", source: "esri" }, { id: "esri-labels", type: "raster", source: "esriLabels" }],
  };
  try { const r = await fetch(BASEMAP); if (!r.ok) throw new Error(String(r.status)); return (await r.json()) as StyleSpecification; } catch { return emptyStyle(); }
}

function mlLayers(def: LayerDef, src: string, zoom: number): LayerSpecification[] {
  const vis = def.visible && !hiddenR.has(def.id) ? "visible" : "none", o = def.opacity;
  switch (def.kind) {
    case "raster": return [{ id: def.id, type: "raster", source: src, layout: { visibility: vis }, paint: { "raster-opacity": o, "raster-resampling": rasterResampling(def.id === "s2", zoom) } }];
    case "hillshade": return [{ id: def.id, type: "hillshade", source: src, layout: { visibility: vis }, paint: { "hillshade-exaggeration": o, "hillshade-shadow-color": "#2b3440", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#5b6573" } }];
    case "relief": {
      const stops = (def.ramp?.stops ?? []).flatMap(([v, c]) => [v, c]);
      return [{ id: def.id, type: "color-relief", source: src, layout: { visibility: vis }, paint: { "color-relief-opacity": o, "color-relief-color": ["interpolate", ["linear"], ["elevation"], ...stops] } } as LayerSpecification];
    }
    case "water": return [
      { id: `${def.id}-fill`, type: "fill", source: src, "source-layer": "water", filter: ["==", ["get", "geom"], "area"], layout: { visibility: vis }, paint: { "fill-color": ["match", ["get", "kind"], "wetland", "#5fb3a6", "#2f7fd1"], "fill-opacity": 0.6 * o } },
      { id: `${def.id}-line`, type: "line", source: src, "source-layer": "water", filter: ["==", ["get", "geom"], "line"], layout: { visibility: vis, "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["match", ["get", "kind"], ["river", "canal"], "#1f5fa8", "#5aa4e6"], "line-opacity": o, "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "kind"], ["river", "canal"], 1.2, 0.4], 15, ["match", ["get", "kind"], ["river", "canal"], 4, 1.6]] } },
    ];
    case "buildings": return [{ id: def.id, type: "fill", source: src, "source-layer": "buildings", minzoom: 13.5, layout: { visibility: vis }, paint: { "fill-color": "#6b6f7a", "fill-opacity": o, "fill-outline-color": "#3d4049" } }];
    case "admin": return [
      { id: `${def.id}-adm2`, type: "line", source: src, "source-layer": "admin", filter: ["==", ["get", "level"], "ADM2"], layout: { visibility: vis }, paint: { "line-color": "#3a3f4b", "line-width": 1.3, "line-opacity": o } },
      { id: `${def.id}-label`, type: "symbol", source: src, "source-layer": "admin", filter: ["==", ["get", "level"], "ADM2"], minzoom: 9, layout: { visibility: vis, "text-field": ["get", "shapeName"], "text-font": FONT, "text-size": 11 }, paint: { "text-color": "#3a3f4b", "text-halo-color": "#ffffff", "text-halo-width": 1.2 } },
    ];
    case "demnas-grid": return [
      { id: `${def.id}-line`, type: "line", source: src, layout: { visibility: vis }, paint: { "line-color": "#d9480f", "line-width": 1.5 } },
      { id: `${def.id}-label`, type: "symbol", source: src, layout: { visibility: vis, "text-field": ["get", "code"], "text-font": FONT, "text-size": 13 }, paint: { "text-color": "#d9480f", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } },
    ];
    case "js-drains": return [{ id: def.id, type: "line", source: src, "source-layer": "js", filter: isT("drain1", "drain2"), layout: { visibility: vis, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["match", ["get", "t"], "drain1", "#0b7285", "#3bc9db"], "line-opacity": o, "line-width": ["interpolate", ["linear"], ["zoom"], 10, ["match", ["get", "t"], "drain1", 2, 1.2], 16, ["match", ["get", "t"], "drain1", 7, 4]] } }];
    case "js-walls": return [{ id: def.id, type: "line", source: src, "source-layer": "js", filter: isT("wall"), layout: { visibility: vis, "line-cap": "round" }, paint: { "line-color": "#5c3d2e", "line-opacity": o, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 6] } }];
    case "js-polders": return [
      { id: `${def.id}-fill`, type: "fill", source: src, "source-layer": "js", filter: isT("polder"), layout: { visibility: vis }, paint: { "fill-color": "#845ef7", "fill-opacity": 0.18 * o } },
      { id: `${def.id}-line`, type: "line", source: src, "source-layer": "js", filter: isT("polder"), layout: { visibility: vis }, paint: { "line-color": "#6741d9", "line-opacity": o, "line-width": 1.4 } },
    ];
    case "js-pumps": return [{ id: def.id, type: "circle", source: src, "source-layer": "js", filter: isT("pump"), layout: { visibility: vis },
      paint: { "circle-color": "#c2255c", "circle-opacity": o, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-radius": ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "cap_m3s"], 0]], 0, 3, 3, 6, 6, 10] } }];
    case "genangan": return [
      { id: `${def.id}-fill`, type: "fill", source: src, "source-layer": "js", filter: genanganFilter, layout: { visibility: vis }, paint: { "fill-color": obsColor() as string, "fill-opacity": o } },
      { id: `${def.id}-line`, type: "line", source: src, "source-layer": "js", filter: genanganFilter, layout: { visibility: vis }, paint: { "line-color": "#7f0000", "line-opacity": o, "line-width": 0.7 } },
    ];
    case "reports": return [{ id: def.id, type: "circle", source: src, "source-layer": "reports", ...(reportsFilter ? { filter: reportsFilter } : {}), layout: { visibility: vis },
      paint: { "circle-color": obsColor() as string, "circle-opacity": o, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.2, "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 15, 7] } }];
    case "region": {
      const base = { id: def.id, type: "line" as const, source: src, layout: { visibility: vis as "visible" | "none" } };
      if (def.role === "admin") return [{ ...base, filter: ["==", ["get", "role"], "admin"], paint: { "line-color": "#334155", "line-width": 1.4, "line-dasharray": [4, 2] } }];
      return [{ ...base, filter: ["==", ["get", "role"], "domain"], paint: { "line-color": "#1d63d8", "line-width": 2 } }];
    }
  }
}

function legendHtml(def: LayerDef, display: Record<string, unknown> | undefined): string {
  let items: LegendItem[] | undefined = def.legend;
  const fromPack = display?.legend as Record<string, LegendItem> | undefined;
  if (fromPack) items = Object.values(fromPack);
  if (items?.length) return `<ul class="legend">${items.map((i) => `<li><span class="swatch" style="background:${esc(i.color)}"></span>${esc(i.label)}</li>`).join("")}</ul>`;
  if (def.ramp) {
    const s = def.ramp.stops, grad = s.map(([, c], i) => `${esc(c)} ${Math.round((i / (s.length - 1)) * 100)}%`).join(",");
    return `<div class="ramp-bar" style="background:linear-gradient(90deg,${grad})"></div><div class="ramp-labels"><span>${esc(s[0][0])}</span><span>${esc(def.ramp.unit)}</span><span>${esc(s[s.length - 1][0])}</span></div>`;
  }
  return "";
}

export async function createMapPage(root: HTMLElement, ctx: MapCtx): Promise<MapPage> {
  ensurePmtiles();
  const files = displayFiles(ctx.manifest);
  const available = (d: LayerDef) => !d.file || files.has(d.file);
  const groups = [...new Set(LAYERS.map((l) => l.group))];
  const built = ctx.manifest?.created.slice(0, 10) ?? "–";
  const el = document.createElement("section");
  el.className = "map-page";
  el.innerHTML = `
    <div id="map"></div>
    <aside class="dock card" aria-label="Panel">
      <div class="dock-head">
        <div class="where">${t("region")} · ${t("updated")} <span class="mono">${esc(built)}</span></div>
        <h1 id="dock-title"></h1>
        <div class="seg dock-tabs" role="tablist"><button type="button" data-tab="layers">${t("tab.layers")}</button><button type="button" data-tab="sim">${t("tab.sim")}</button></div>
      </div>
      <div class="dock-body" id="dock-layers">
        ${ctx.manifest ? "" : `<div class="note warn">${t("nopack")}</div>`}
        <div class="sec"><h3>${t("basemap")}</h3><select id="basemap"><option value="sat">${t("basemap.sat")}</option><option value="light">${t("basemap.light")}</option><option value="none">${t("basemap.none")}</option></select></div>
        ${groups.map((g) => `<div class="sec"><h3>${t(g as Key)}</h3>${LAYERS.filter((l) => l.group === g).map((l) => `
          <div class="layer ${available(l) ? "" : "missing"}">
            <input type="checkbox" ${l.visible && available(l) ? "checked" : ""} ${available(l) ? "" : "disabled"} data-toggle="${l.id}" aria-label="${esc(l.name[lang])}">
            <span title="${esc(l.title)}"><b>${esc(l.name[lang])}</b>${l.catalogId ? `<small><a href="#/data?d=${esc(l.catalogId)}">${t("source")}</a></small>` : ""}</span>
            ${l.kind === "region" || l.kind === "demnas-grid" ? "<span></span>" : `<input type="range" min="0" max="1" step="0.05" value="${l.opacity}" data-opacity="${l.id}" style="width:70px" aria-label="${t("opacity")}">`}
            <div class="more">${l.id === "genangan" && available(l) ? `<select id="genangan-year" aria-label="${t("obs.year")}"><option value="">${t("obs.all")}</option>${Array.from({ length: 10 }, (_, i) => 2016 + i).map((y) => `<option>${y}</option>`).join("")}</select>` : ""}${legendHtml(l, l.file ? files.get(l.file) : undefined)}</div>
          </div>`).join("")}</div>`).join("")}
      </div>
      <div class="dock-body" id="dock-sim" hidden></div>
    </aside>
    <div class="kpis" id="kpis"></div>
    <div class="timeline card" id="timeline" hidden></div>
    <div class="map-legend card" id="map-legend" hidden></div>
    <div class="map-tools" id="map-tools"></div>
    <div class="lyr card" id="lyr" aria-label="${t("lyr.title")}"><div class="lyr-head"><b>${t("lyr.title")}</b><button type="button" id="focus-btn" class="focus-btn"></button><button type="button" id="lyr-min" title="${t("lyr.min")}" aria-label="${t("lyr.min")}">–</button></div><ol id="lyr-list"></ol></div>
    <div class="coords" id="coords"></div>`;
  root.append(el);

  const [w, s, e, n] = ctx.region.bbox;
  const at = (ctx.at ?? "").split(",").map(Number);
  const view = at.length === 3 && at.every(Number.isFinite) ? { center: [at[0], at[1]] as [number, number], zoom: at[2] } : { bounds: [[w, s], [e, n]] as [[number, number], [number, number]], fitBoundsOptions: { padding: { left: 400, right: 60, top: 40, bottom: 40 } } };
  const map = new MlMap({ container: el.querySelector<HTMLElement>("#map")!, style: await loadBasemap("sat"), ...view, attributionControl: false, maxPitch: 0, pitchWithRotate: false, maxZoom: MAX_ZOOM });
  // rotation: right-click drag, two fingers, the compass (click = north up) or the 15° buttons; the PNG export turns its north arrow with the map
  map.addControl(new NavigationControl({ showCompass: true, visualizePitch: false }), "top-right");
  map.addControl({
    onAdd() {
      const c = document.createElement("div");
      c.className = "maplibregl-ctrl maplibregl-ctrl-group";
      c.innerHTML = `<button type="button" data-r="-15" title="${t("rotate.h")}" aria-label="-15°">⟲</button><button type="button" data-r="15" title="${t("rotate.h")}" aria-label="+15°">⟳</button>`;
      c.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => map.rotateTo(map.getBearing() + Number(b.dataset.r), { duration: 250 })));
      return c;
    },
    onRemove() {},
  }, "top-right");
  map.addControl(new ScaleControl({ unit: "metric", maxWidth: 140 }), "bottom-right");
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");

  const domain = ctx.region.domain ? new URL(`meta/${ctx.region.domain.split("/").pop()}`, location.href).href : null;
  const tileGrid = new URL(`meta/${ctx.regionId}_tiles.geojson`, location.href).href;
  const attr = (def: LayerDef) => { const d = ctx.catalog.datasets.find((x) => x.id === def.catalogId); return d?.licence.attribution ? esc(d.licence.attribution) : ""; };
  const overlayHooks: (() => void)[] = [];
  const addOverlays = () => {
    const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    labelAnchor = firstSymbol;
    for (const def of LAYERS) {
      if (!available(def)) continue;
      const src = def.kind === "region" ? "src-region" : `src-${def.file ?? def.id}`;
      if (!map.getSource(src)) {
        if (def.kind === "demnas-grid") map.addSource(src, { type: "geojson", data: tileGrid });
        else if (def.kind === "region") map.addSource(src, { type: "geojson", data: domain ?? { type: "Feature", properties: { role: "domain" }, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } } });
        else {
          const url = `pmtiles://${new URL(`${ctx.dataBase}/${def.file}`, location.href).href}`;
          const meta = files.get(def.file!) ?? {};
          if (def.kind === "hillshade" || def.kind === "relief") map.addSource(src, { type: "raster-dem", url, encoding: "terrarium", tileSize: 256, attribution: attr(def) });
          else if (meta.kind === "vector") map.addSource(src, { type: "vector", url, attribution: attr(def) });
          else map.addSource(src, { type: "raster", url, tileSize: 256, attribution: attr(def) });
        }
      }
      for (const layer of mlLayers(def, src, map.getZoom())) map.addLayer(layer, def.kind === "demnas-grid" || def.kind === "region" ? undefined : firstSymbol);
    }
    overlayHooks.forEach((f) => f());
    refresh();
  };
  map.on("zoom", () => {
    const r = rasterResampling(true, map.getZoom());
    if (map.getLayer("s2") && map.getPaintProperty("s2", "raster-resampling") !== r) map.setPaintProperty("s2", "raster-resampling", r);
  });
  map.on("load", () => { addOverlays(); map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"); });

  const layerIds = (id: string) => (map.getStyle()?.layers ?? []).filter((l) => l.id === id || l.id.startsWith(`${id}-`)).map((l) => l.id);
  el.querySelectorAll<HTMLInputElement>("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
    const def = LAYERS.find((l) => l.id === cb.dataset.toggle)!;
    def.visible = cb.checked;
    hiddenR.delete(def.id);
    if (cb.checked) order = [def.id, ...order.filter((x) => x !== def.id)]; // newly switched on: drawn on top
    refresh();
  }));
  el.querySelectorAll<HTMLInputElement>("[data-opacity]").forEach((r) => r.addEventListener("input", () => {
    const def = LAYERS.find((l) => l.id === r.dataset.opacity)!;
    def.opacity = Number(r.value);
    const props: Record<string, Parameters<MlMap["setPaintProperty"]>[1]> = { raster: "raster-opacity", hillshade: "hillshade-exaggeration", "color-relief": "color-relief-opacity", fill: "fill-opacity", line: "line-opacity", circle: "circle-opacity" };
    for (const id of layerIds(def.id)) { const p = props[map.getLayer(id)?.type ?? ""]; if (p) map.setPaintProperty(id, p, def.opacity); }
  }));
  el.querySelector<HTMLSelectElement>("#basemap")!.addEventListener("change", async (ev) => {
    const style = await loadBasemap((ev.target as HTMLSelectElement).value);
    // full reload (no diff): with a diff MapLibre patches the style in place, drops our overlays and never fires style.load
    map.once("style.load", addOverlays);
    map.setStyle(style, { diff: false });
  });
  const coords = el.querySelector<HTMLElement>("#coords")!;
  map.on("mousemove", (ev) => {
    const { lng, lat } = ev.lngLat, u = toUtm(lng, lat);
    coords.textContent = `${lat.toFixed(5)}°, ${lng.toFixed(5)}° · UTM ${u.zone}${u.hemisphere} ${u.easting.toFixed(0)} E ${u.northing.toFixed(0)} N`;
  });

  // click on infrastructure or a recorded flood: what the source says about it (values escaped)
  const POP: Record<string, string> = { "js-drains": "js-drains", "js-pumps": "js-pumps", "js-polders-fill": "js-polders", "js-walls": "js-walls", "genangan-fill": "genangan", reports: "reports" };
  map.on("click", (ev) => {
    const ids = Object.keys(POP).filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
    const f = ids.length ? map.queryRenderedFeatures(ev.point, { layers: ids })[0] : undefined;
    if (!f) return;
    const p = f.properties as Record<string, string | number | null>, row = (k: string, v: unknown) => (v === null || v === undefined || v === "" ? "" : `<div><span>${esc(k)}</span> <b>${esc(v)}</b></div>`);
    const kind = POP[f.layer.id], name = LAYERS.find((l) => l.id === kind)!.name[lang];
    const body = kind === "reports" ? row(t("obs.event"), p.event) + row(t("obs.time"), `${p.time_wib ?? ""} WIB`) + row(t("obs.depth"), p.depth_cm ? `${p.depth_cm} cm` : "") + row(t("obs.via"), p.source)
      : kind === "genangan" ? row(t("obs.date"), p.date) + row(t("obs.depth"), p.depth_cm ? `${p.depth_cm} cm` : "") + row("", p.info)
      : row(t("obs.width"), p.width_m ? `${p.width_m} m` : "") + row(t("obs.ddepth"), p.depth_m ? `${p.depth_m} m` : "") + row(t("obs.cap"), p.cap_m3s ? `${p.cap_m3s} m³/s` : "") + row("", p.info);
    new Popup({ maxWidth: "300px" }).setLngLat(ev.lngLat).setHTML(`<div class="pop"><h4>${esc(name)}</h4>${body}</div>`).addTo(map);
  });
  const applyObs = () => {
    for (const id of ["genangan-fill", "genangan-line"]) if (map.getLayer(id)) map.setFilter(id, genanganFilter);
    if (map.getLayer("reports")) map.setFilter("reports", reportsFilter);
  };
  const yearSel = el.querySelector<HTMLSelectElement>("#genangan-year");
  yearSel?.addEventListener("change", () => {
    genanganFilter = yearSel.value ? ["all", isT("genangan"), ["==", ["get", "year"], Number(yearSel.value)]] as ExpressionSpecification : isT("genangan");
    applyObs();
  });
  const show = (id: string, on: boolean) => {
    const def = LAYERS.find((l) => l.id === id)!, cb = el.querySelector<HTMLInputElement>(`[data-toggle="${id}"]`);
    if (!cb || cb.disabled) return;
    def.visible = cb.checked = on;
    hiddenR.delete(id);
    if (on) order = [id, ...order.filter((x) => x !== id)];
    refresh();
  };

  // ---------- active layers card: list, order (top = drawn on top), own hide, results ----------
  const results = new Map<string, ResultEntry>();
  const idsOf = (id: string) => results.get(id)?.ids().filter((x) => map.getLayer(x)) ?? layerIds(id);
  const nameOf = (id: string) => results.get(id)?.name() ?? LAYERS.find((l) => l.id === id)!.name[lang];
  const activeIds = () => [...results.keys(), ...LAYERS.filter((l) => l.visible && available(l)).map((l) => l.id)];
  const lyr = el.querySelector<HTMLElement>("#lyr")!, list = el.querySelector<HTMLOListElement>("#lyr-list")!;
  function refresh() {
    if (!map.isStyleLoaded() && !map.getStyle()) return;
    const act = activeIds();
    if (!order.length) order = [...act].reverse(); // first time: the stacking the layers were added in
    order = [...act.filter((x) => !order.includes(x)), ...order.filter((x) => act.includes(x))];
    for (const id of [...order].reverse()) for (const x of idsOf(id)) map.moveLayer(x, labelAnchor && map.getLayer(labelAnchor) ? labelAnchor : undefined);
    for (const l of LAYERS) if (available(l)) { const v = l.visible && !hiddenR.has(l.id) ? "visible" : "none"; for (const x of layerIds(l.id)) if (map.getLayoutProperty(x, "visibility") !== v) map.setLayoutProperty(x, "visibility", v); }
    for (const [id, r] of results) { const on = !hiddenR.has(id); for (const x of idsOf(id)) map.setLayoutProperty(x, "visibility", on ? "visible" : "none"); r.onVisible?.(on); }
    list.innerHTML = order.length ? order.map((id, i) => `<li class="${results.has(id) ? "res" : ""} ${hiddenR.has(id) ? "off" : ""}" data-id="${esc(id)}">
      <input type="checkbox" ${hiddenR.has(id) ? "" : "checked"} data-a="vis" aria-label="${t("lyr.show")}"><span title="${esc(nameOf(id))}">${esc(nameOf(id))}</span>
      <button type="button" data-a="up" ${i === 0 ? "disabled" : ""} title="${t("lyr.up")}" aria-label="${t("lyr.up")}">↑</button><button type="button" data-a="down" ${i === order.length - 1 ? "disabled" : ""} title="${t("lyr.down")}" aria-label="${t("lyr.down")}">↓</button>${results.has(id) ? `<button type="button" data-a="rm" title="${t("lyr.rm")}" aria-label="${t("lyr.rm")}">✕</button>` : ""}</li>`).join("") : `<li class="empty">${t("lyr.empty")}</li>`;
  }
  list.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-a]"), id = b?.closest<HTMLElement>("li")?.dataset.id;
    if (!b || !id) return;
    const i = order.indexOf(id);
    if (b.dataset.a === "vis") { if ((b as HTMLInputElement).checked) hiddenR.delete(id); else hiddenR.add(id); }
    else if (b.dataset.a === "up" && i > 0) [order[i - 1], order[i]] = [order[i], order[i - 1]];
    else if (b.dataset.a === "down" && i < order.length - 1) [order[i + 1], order[i]] = [order[i], order[i + 1]];
    else if (b.dataset.a === "rm") { const r = results.get(id); results.delete(id); hiddenR.delete(id); r?.remove(); }
    refresh();
  });
  el.querySelector("#lyr-min")!.addEventListener("click", () => { const m = lyr.classList.toggle("min"); el.querySelector("#lyr-min")!.textContent = m ? "+" : "–"; });
  // focus mode: hide the floating cards (dock, figures, timeline, legend, conclusion) to look at the map; the button stays
  const focusBtn = el.querySelector<HTMLButtonElement>("#focus-btn")!;
  const setFocusLbl = () => { focusBtn.textContent = el.classList.contains("focus") ? t("focus.off") : t("focus.on"); };
  focusBtn.addEventListener("click", () => { el.classList.toggle("focus"); setFocusLbl(); });
  setFocusLbl();

  const page: MapPage = {
    addResult(r) { results.set(r.id, r); hiddenR.delete(r.id); order = [r.id, ...order.filter((x) => x !== r.id)]; refresh(); },
    removeResult(id) { if (results.delete(id)) { hiddenR.delete(id); refresh(); } },
    refreshLayers: () => refresh(),
    setObservedEvent(ev, on) {
      genanganFilter = ev ? ["all", isT("genangan"), ["in", ["get", "date"], ["literal", ev.dates]]] as ExpressionSpecification : isT("genangan");
      reportsFilter = ev ? ["==", ["get", "event"], ev.id] : null;
      if (yearSel) yearSel.value = "";
      applyObs();
      if (on !== undefined) { show("genangan", on); show("reports", on); }
    },
    el, map, dockBody: el.querySelector<HTMLElement>("#dock-sim")!, kpis: el.querySelector<HTMLElement>("#kpis")!, timeline: el.querySelector<HTMLElement>("#timeline")!,
    legend: el.querySelector<HTMLElement>("#map-legend")!, tools: el.querySelector<HTMLElement>("#map-tools")!,
    onOverlays: (f) => { overlayHooks.push(f); },
    setTab(tab) {
      el.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      el.querySelector<HTMLElement>("#dock-layers")!.hidden = tab !== "layers";
      el.querySelector<HTMLElement>("#dock-sim")!.hidden = tab !== "sim";
      el.querySelector<HTMLElement>("#dock-title")!.textContent = t(tab === "sim" ? "tab.sim" : "tab.layers");
      page.onTab?.(tab);
    },
  };
  el.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.tab === "sim" ? "#/sim" : "#/map"; }));
  return page;
}
