import "maplibre-gl/dist/maplibre-gl.css";
import { AttributionControl, Map as MlMap, NavigationControl, ScaleControl, type ExpressionSpecification, type GeoJSONSource, type LayerSpecification, type MapMouseEvent, type MapTouchEvent, type StyleSpecification } from "maplibre-gl";
import { t, type Key } from "./i18n";
import { mountExplore } from "./explore/ui";
import { ensurePmtiles } from "./pmtiles-init";
import {
  DEFAULTS, LOOKS, LOOK_ONLY_LAYERS, LOOK_PARAMS, SAMPLE_VIEW, boxFromCorners, boxKm, depthColorExpr, parseBox, parseLook, sampleCenter, sampleOutline, zoomForWidth, type Look,
} from "./sample-look";
import type { Catalog, Manifest } from "./types";
import { esc } from "./util";

type Ctx = { manifest: Manifest | null; catalog: Catalog; dataBase: string; sample?: number[] | null; region?: number[] | null; look?: string | null; box?: string | null };

const NEEDED = ["dem_fabdem.pmtiles", "imagery_s2.pmtiles", "lulc_io_latest.pmtiles", "water_osm.pmtiles"];
const RAMP = "linear-gradient(90deg,#d7e6f4,#9ecae1,#4292c6,#2171b5,#08306b)";

export async function renderSample(root: HTMLElement, ctx: Ctx) {
  ensurePmtiles();
  const have = new Set<string>();
  ctx.manifest?.layers.forEach((l) => l.display?.forEach((d) => have.add(d.file)));
  if (!ctx.sample || !NEEDED.every((f) => have.has(f))) {
    root.innerHTML = `<section class="map-page"><aside class="panel"><div class="notice">${t("s3.nodata")}</div></aside><div class="map-wrap"></div></section>`;
    return { remove() {} };
  }
  const sampleBox = ctx.sample;
  const region = ctx.region ?? sampleBox;
  let bbox = parseBox(ctx.box, region) ?? sampleBox; // simulation area: the 10 km sample or a box the user drew
  const center = sampleCenter(bbox);
  let look: Look = parseLook(ctx.look);
  let level: number = DEFAULTS.level;
  let simActive = false;
  let explore: { destroy(): void } | null = null;

  const attr = (id: string) => {
    const a = ctx.catalog.datasets.find((d) => d.id === id)?.licence.attribution;
    return a ? esc(a) : "";
  };
  const url = (f: string) => `pmtiles://${new URL(`${ctx.dataBase}/${f}`, location.href).href}`;
  const dem = (attribution = "") => ({ type: "raster-dem" as const, url: url("dem_fabdem.pmtiles"), encoding: "terrarium" as const, tileSize: 256, attribution });
  const style: StyleSpecification = {
    version: 8,
    sources: {
      dem: dem(attr("fabdem")), demhs: dem(), demcr: dem(),
      s2: { type: "raster", url: url("imagery_s2.pmtiles"), tileSize: 256, attribution: attr("sentinel-2-l2a") },
      lc: { type: "raster", url: url("lulc_io_latest.pmtiles"), tileSize: 256, attribution: attr("io-lulc-annual") },
      water: { type: "vector", url: url("water_osm.pmtiles"), attribution: attr("osm-water") },
      sample: { type: "geojson", data: sampleOutline(bbox) },
      draft: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": LOOK_PARAMS[look].bg } },
      { id: "tint", type: "color-relief", source: "demcr", layout: { visibility: "none" }, paint: { "color-relief-opacity": 1, "color-relief-color": ["interpolate", ["linear"], ["elevation"], 0, "#f3f4f6", 12, "#e0e3e8", 30, "#c4c9d1", 60, "#a2a9b4"] } },
      { id: "s2", type: "raster", source: "s2", layout: { visibility: "none" } },
      { id: "lc", type: "raster", source: "lc", layout: { visibility: "none" }, paint: { "raster-resampling": "nearest" } },
      { id: "hs", type: "hillshade", source: "demhs", paint: { "hillshade-exaggeration": 0.5, "hillshade-shadow-color": "#1f2933", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#5b6573", "hillshade-illumination-direction": 315 } },
      { id: "hs2", type: "hillshade", source: "demhs", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 1, "hillshade-shadow-color": "#2f3542", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#5b6573", "hillshade-illumination-direction": 315 } },
      { id: "depth", type: "color-relief", source: "demcr", layout: { visibility: "none" }, paint: { "color-relief-opacity": 0.92, "color-relief-color": depthColorExpr(level) } },
      { id: "wfill", type: "fill", source: "water", "source-layer": "water", filter: ["==", ["get", "geom"], "area"], paint: { "fill-color": "#3aa6dc", "fill-opacity": 0.85 } },
      { id: "wline", type: "line", source: "water", "source-layer": "water", filter: ["all", ["==", ["get", "geom"], "line"], ["match", ["get", "kind"], ["river", "canal"], true, false]],
        layout: { "line-cap": "round" }, paint: { "line-color": "#5ec8f2", "line-opacity": 0.9, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 3] } },
      { id: "outline", type: "line", source: "sample", paint: { "line-color": "#c026d3", "line-width": 2.4, "line-dasharray": [2, 1.5] } },
      { id: "draft", type: "line", source: "draft", paint: { "line-color": "#f97316", "line-width": 2.4 } },
    ] as LayerSpecification[],
  };

  const opt = (l: Look) => `
    <label class="layer-row s3-opt"><input type="radio" name="look" value="${l}" ${l === look ? "checked" : ""}>
      <span><b>${t(`s3.${l}` as Key)}</b><small>${t(`s3.${l}.d` as Key)}</small></span></label>`;
  root.innerHTML = `
    <section class="map-page">
      <aside class="panel" aria-label="${t("s3.title")}">
        <div class="panel-head s3-head"><h2>${t("s3.title")}</h2><span class="region-name">${t("s3.name")}</span></div>
        <div class="group"><h3>${t("s3.looks")}</h3>${LOOKS.map(opt).join("")}</div>
        <div class="group"><h3>${t("s3.view")}</h3>
          <label class="opacity s3-ctl"><span>${t("s3.exag")}</span><input type="range" id="s3-exag" min="1" max="12" step="0.5" value="${DEFAULTS.exaggeration}"><output id="s3-exag-v">×${DEFAULTS.exaggeration}</output></label>
          <label class="opacity s3-ctl"><span>${t("s3.tilt")}</span><input type="range" id="s3-tilt" min="0" max="70" step="1" value="${SAMPLE_VIEW.pitch}"><output id="s3-tilt-v">${SAMPLE_VIEW.pitch}°</output></label>
          <div id="s3-level-box">
            <label class="opacity s3-ctl"><span>${t("s3.level")}</span><input type="range" id="s3-level" min="1" max="15" step="0.5" value="${level}"><output id="s3-level-v">${level} m</output></label>
            <div class="ramp"><div class="ramp-bar" style="background:${RAMP}"></div><div class="ramp-labels"><span>0</span><span>${t("s3.depth")}</span><span>4+</span></div></div>
            <div class="notice">${t("s3.warn")}</div>
          </div>
          <button class="chip" id="s3-reset" type="button">${t("s3.reset")}</button>
        </div>
        <div class="group"><h3>${t("s3.area")}</h3>
          <p class="crs-note" id="s3-area-txt"></p>
          <div class="ex-actions"><button class="chip" id="s3-draw" type="button">${t("s3.draw")}</button><button class="chip" id="s3-back" type="button">${t("s3.back")}</button></div>
          <p class="crs-note" id="s3-draw-hint" hidden>${t("s3.drawhint")}</p>
        </div>
        <div id="explore-box"></div>
        <p class="crs-note">${t("s3.note")}</p>
      </aside>
      <div class="map-wrap"><div id="map"></div><div class="s3-caption" id="s3-cap"></div></div>
    </section>`;

  const startZoom = zoomForWidth(root.querySelector<HTMLElement>("#map")!.clientWidth);
  const map = new MlMap({
    container: "map", style, center, zoom: startZoom, pitch: SAMPLE_VIEW.pitch, bearing: SAMPLE_VIEW.bearing,
    maxPitch: 75, attributionControl: false,
  });
  map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new ScaleControl({ unit: "metric", maxWidth: 160 }), "bottom-right");
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const apply = () => {
    const p = LOOK_PARAMS[look];
    map.setPaintProperty("bg", "background-color", p.bg);
    for (const id of LOOK_ONLY_LAYERS) map.setLayoutProperty(id, "visibility", p.show.includes(id) && !(id === "depth" && simActive) ? "visible" : "none");
    map.setPaintProperty("hs", "hillshade-exaggeration", p.hsExag);
    map.setPaintProperty("hs", "hillshade-shadow-color", p.hsShadow);
    map.setPaintProperty("wline", "line-color", p.wLine);
    map.setPaintProperty("wfill", "fill-color", p.wFill);
    const grey = look === "grey";
    $("s3-level-box").hidden = !grey || simActive;
    if (!simActive) $("s3-cap").textContent = grey ? t("s3.cap").replace("{n}", String(level)) : "";
  };
  const mount = () => {
    explore?.destroy();
    explore = mountExplore(map, $("explore-box"), {
      demUrl: new URL(`${ctx.dataBase}/dem_fabdem.pmtiles`, location.href).href,
      landUrl: new URL(`${ctx.dataBase}/lulc_worldcover_2021.pmtiles`, location.href).href, bbox, cap: $("s3-cap"),
      onActive: (a) => { simActive = a; apply(); },
    });
    const [w, h] = boxKm(bbox);
    const isSample = bbox.join() === sampleBox.join();
    $("s3-area-txt").textContent = t(isSample ? "s3.area.sample" : "s3.area.own").replace("{w}", w.toFixed(1)).replace("{h}", h.toFixed(1)).replace("{b}", bbox.map((v) => v.toFixed(4)).join(", "));
    $<HTMLButtonElement>("s3-back").hidden = isSample;
  };
  const setBox = (b: number[]) => {
    bbox = b;
    (map.getSource("sample") as GeoJSONSource).setData(sampleOutline(b));
    const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
    if (b.join() === sampleBox.join()) q.delete("box"); else q.set("box", b.join(","));
    history.replaceState(null, "", `#/sample${q.toString() ? "?" + q.toString().replace(/%2C/g, ",") : ""}`);
    mount();
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, pitch: SAMPLE_VIEW.pitch, bearing: 0, duration: 800 });
  };
  map.on("load", () => {
    // start with the attribution folded into its (i) button so it does not cover the map; one click opens it
    map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
    map.setTerrain({ source: "dem", exaggeration: DEFAULTS.exaggeration });
    apply();
    mount();
    if (bbox !== sampleBox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, pitch: SAMPLE_VIEW.pitch, bearing: 0, duration: 0 });
  });

  // Drawing a box: the map turns flat and north-up so a dragged rectangle is a true lon/lat box, then the old view returns.
  let drawing = false, start: [number, number] | null = null;
  const draft = (a: [number, number], b: [number, number]) => (map.getSource("draft") as GeoJSONSource).setData(sampleOutline([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]));
  const endDraw = () => {
    drawing = false; start = null;
    map.dragPan.enable(); map.touchZoomRotate.enable();
    map.getCanvas().style.cursor = "";
    $("s3-draw-hint").hidden = true;
    $<HTMLButtonElement>("s3-draw").textContent = t("s3.draw");
    (map.getSource("draft") as GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
  };
  const down = (e: MapMouseEvent | MapTouchEvent) => { if (!drawing) return; e.preventDefault(); start = [e.lngLat.lng, e.lngLat.lat]; };
  const move = (e: MapMouseEvent | MapTouchEvent) => { if (drawing && start) draft(start, [e.lngLat.lng, e.lngLat.lat]); };
  const up = (e: MapMouseEvent | MapTouchEvent) => {
    if (!drawing || !start) return;
    const b = boxFromCorners(start, [e.lngLat.lng, e.lngLat.lat], region);
    endDraw();
    if (b) setBox(b); else $("s3-area-txt").textContent = t("s3.toosmall");
  };
  map.on("mousedown", down); map.on("touchstart", down);
  map.on("mousemove", move); map.on("touchmove", move);
  map.on("mouseup", up); map.on("touchend", up);
  $("s3-draw").addEventListener("click", () => {
    if (drawing) { endDraw(); return; }
    drawing = true;
    map.dragPan.disable(); map.touchZoomRotate.disable();
    map.getCanvas().style.cursor = "crosshair";
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    $("s3-draw-hint").hidden = false;
    $<HTMLButtonElement>("s3-draw").textContent = t("s3.drawcancel");
  });
  $("s3-back").addEventListener("click", () => setBox(sampleBox));

  root.querySelectorAll<HTMLInputElement>('input[name="look"]').forEach((r) =>
    r.addEventListener("change", () => { look = parseLook(r.value); if (map.isStyleLoaded() || map.loaded()) apply(); }));
  $<HTMLInputElement>("s3-exag").addEventListener("input", (ev) => {
    const v = Number((ev.target as HTMLInputElement).value);
    $("s3-exag-v").textContent = `×${v}`;
    map.setTerrain({ source: "dem", exaggeration: v });
  });
  $<HTMLInputElement>("s3-tilt").addEventListener("input", (ev) => {
    const v = Number((ev.target as HTMLInputElement).value);
    $("s3-tilt-v").textContent = `${v}°`;
    map.setPitch(v);
  });
  map.on("pitch", () => {
    const v = Math.round(map.getPitch());
    $<HTMLInputElement>("s3-tilt").value = String(v);
    $("s3-tilt-v").textContent = `${v}°`;
  });
  $<HTMLInputElement>("s3-level").addEventListener("input", (ev) => {
    level = Number((ev.target as HTMLInputElement).value);
    $("s3-level-v").textContent = `${level} m`;
    map.setPaintProperty("depth", "color-relief-color", depthColorExpr(level) as ExpressionSpecification);
    $("s3-cap").textContent = t("s3.cap").replace("{n}", String(level));
  });
  $("s3-reset").addEventListener("click", () => map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, pitch: SAMPLE_VIEW.pitch, bearing: SAMPLE_VIEW.bearing }));
  return { remove() { explore?.destroy(); map.remove(); } };
}
