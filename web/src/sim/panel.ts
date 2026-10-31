// Simulation panel on the main map: inputs (only external forcing: rain, sea level, time), run, timeline, KPIs, exports.
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import { lang, t, type Key } from "../i18n";
import type { MapPage } from "../map";
import { buildRun, loadPack, CHANNEL, type Pack, type RunGrid } from "../engine/pack";
import { DT_S, inflowsFor, inflowsForSpatial, type Inflow } from "../engine/hydrology";
import { cumAtSteps, meanHyetograph, pointAt, zoneGrid, type EventRain } from "../engine/event-rain";
import { alternatingBlock, parseHourly, totalMm, type Hyetograph } from "../explore/rain";
import { CLASSES, CLASS_COLORS, FloodLayer } from "./flood-layer";
import { buildConclusion, type Facts } from "./conclusion";
import { exposureCells, exposureSums, loadExposure, type Exposure, type ExposureSums } from "./exposure";
import { colourTiff, depthTiff, htmlMap, mapPng, mercatorPng, save, type Grid } from "./export";
import type { OutMsg, RunMsg } from "./worker";
import { esc, fromUtm } from "../util";
import calibration from "../../../data/engine/calibration.json";

const FLOOD_M = 0.15; // flooded = deeper than the lower bound of the second depth class (BLUEPRINT §8)
// city-drain sink (m/s) per cell: calibrated capacity x built share, none on channels and sea; undefined when the capacity is 0
const drainOf = (run: RunGrid): Float64Array | undefined => {
  if (!(calibration.drain_mm_h > 0)) return undefined;
  const d = new Float64Array(run.nx * run.ny);
  for (let c = 0; c < d.length; c++) if (!run.channel[c] && !run.sea[c]) d[c] = (calibration.drain_mm_h / 3.6e6) * run.built[c];
  return d;
};
// observed events (IMERG hourly rain per 0.1 degree point, verification/observed/event_rain.py), loaded only when chosen
const EVENTS = import.meta.glob<EventRain>("../../../data/events/*_imerg.json", { import: "default" });
const eventIds = Object.keys(EVENTS).map((f) => /([\d-]+)_imerg\.json$/.exec(f)![1]).sort();
const loadEvent = (id: string) => EVENTS[`../../../data/events/${id}_imerg.json`]();
type Result = { run: RunGrid; grid: Grid; frames: Uint16Array[]; times: number[]; area: number[]; max: Float32Array | null; inflows: Inflow[]; hy: Hyetograph; scenario: Record<string, unknown>; event: EventRain | null; zone?: Uint16Array; count: Uint8Array; cells?: ReturnType<typeof exposureCells>; totals?: Record<string, number>; mass?: number; wall?: number; gpu?: boolean };

export function mountSim(page: MapPage, o: { packUrl: string; regionBbox: number[]; releaseTag: string | null }) {
  const { map } = page;
  const box = page.dockBody;
  const q = (key: string) => `<button type="button" class="qm" data-tip="${key}" aria-label="?">?</button>`;
  const tip = (key: string) => `<p class="help tip" data-tipfor="${key}" hidden>${t(`${key}.h` as Key)}</p>`;
  const sl = (id: string, key: string, min: number, max: number, step: number, v: number, unit: string) => `
    <div class="field"><div class="lbl"><span>${t(key as Key)} ${q(key)}</span><output id="${id}-v">${v} ${unit}</output></div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}" data-unit="${unit}">${tip(key)}</div>`;
  box.innerHTML = `
    <div class="sec"><h3>${t("sim.area")} ${q("sim.area.region")}</h3>${tip("sim.area.region")}
      <div class="seg" id="s-area"><button type="button" data-a="region" class="on">${t("sim.area.region")}</button><button type="button" data-a="box">${t("sim.area.box")}</button></div>
      <div class="row" id="s-draw-row" hidden><button class="btn small" id="s-draw" type="button">${t("sim.draw")}</button><span class="help" id="s-box-txt"></span></div>
    </div>
    <div class="sec"><h3>${t("sim.rain")}</h3>
      <div class="row"><button class="btn small" id="s-preset" type="button">${t("sim.preset")}</button>${q("sim.preset")}</div>${tip("sim.preset")}
      <div class="field"><div class="lbl"><span>${t("sim.mode")}</span></div><select id="s-mode"><option value="design">${t("sim.mode.design")}</option><option value="hourly">${t("sim.mode.hourly")}</option><option value="event">${t("sim.mode.event")}</option></select></div>
      <div data-mode="design">${sl("s-r24", "sim.r24", 0, 500, 1, 150, "mm")}${sl("s-dur", "sim.dur", 1, 24, 1, 6, "h")}</div>
      <div data-mode="hourly" hidden><div class="field"><div class="lbl"><span>${t("sim.hourly")}</span></div><textarea id="s-hourly" rows="2" placeholder="5, 20, 60, 35, 10"></textarea></div></div>
      <div data-mode="event" hidden><div class="field"><div class="lbl"><span>${t("sim.event")} ${q("sim.event")}</span></div>
        <select id="s-event">${eventIds.map((id) => `<option value="${id}">${new Date(`${id}T12:00:00+07:00`).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</option>`).join("")}</select>${tip("sim.event")}</div></div>
      <p class="help" id="s-rainsum"></p>
      <label class="layer"><input type="checkbox" id="s-up" checked><span><b id="s-up-lbl">${t("sim.up")}</b></span>${q("sim.up")}</label>${tip("sim.up")}
    </div>
    <div class="sec">${sl("s-sea", "sim.sea", 0, 1.5, 0.1, 0, "m")}</div>
    <div class="sec">${sl("s-hours", "sim.hours", 3, 72, 1, 12, "h")}
      <div class="field"><div class="lbl"><span>${t("sim.res")} ${q("sim.res")}</span></div><div class="seg" id="s-res"><button type="button" data-k="1" class="on">30 m</button><button type="button" data-k="2">60 m</button><button type="button" data-k="3">90 m</button></div>${tip("sim.res")}</div>
    </div>
    <details class="sec"><summary>${t("sim.auto")}</summary><ul class="legend" id="s-auto"><li>${t("sim.loading")}</li></ul></details><div id="s-soilwarn"></div>
    <div class="sec">
      <div class="row"><button class="btn primary" id="s-run" type="button">${t("sim.run")}</button><button class="btn" id="s-cancel" type="button" hidden>${t("sim.cancel")}</button><button class="btn" id="s-clear" type="button" hidden>${t("sim.clear")}</button></div>
      <div class="progress" id="s-prog" hidden><i></i></div>
      <p class="help" id="s-status" role="status"></p>
      <div id="s-cpuwarn"></div>
      <details id="s-expo-box" open hidden><summary>${t("sim.expo")} ${q("sim.expo")}</summary>${tip("sim.expo")}<div id="s-expo"></div></details>
      <details id="s-stats-box" hidden><summary>${lang === "id" ? "Neraca air" : "Water balance"}</summary><dl class="stat-list" id="s-stats"></dl></details>
    </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => box.querySelector<T>(`#${id}`)!;
  box.querySelectorAll<HTMLButtonElement>("[data-tip]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); const p = box.querySelector<HTMLElement>(`[data-tipfor="${b.dataset.tip}"]`); if (p) p.hidden = !p.hidden; }));
  const num = (id: string) => Number($<HTMLInputElement>(id).value);
  const fmt = (v: number, d = 0) => v.toLocaleString(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  let area: "region" | "box" = "region", bbox: number[] | null = null, k = 1, pack: Pack | null = null, worker: Worker | null = null, res: Result | null = null, layer: FloodLayer | null = null;
  let showMax = false, frame = 0, playTimer = 0;
  const gpuAvailable = "gpu" in navigator;

  // ---------- inputs ----------
  const hyeto = (): Hyetograph | null => ($<HTMLSelectElement>("s-mode").value === "hourly" ? parseHourly($<HTMLTextAreaElement>("s-hourly").value) : alternatingBlock(num("s-r24"), num("s-dur")));
  const mode = () => $<HTMLSelectElement>("s-mode").value;
  let evShown = "";
  const summarizeEvent = async () => {
    const id = $<HTMLSelectElement>("s-event").value, ev = await loadEvent(id);
    if (mode() !== "event" || $<HTMLSelectElement>("s-event").value !== id) return;
    if (evShown !== id) { evShown = id; setVal("s-hours", ev.hours); } // the observed rain covers the event window
    const tot = ev.mm.map((v) => v.reduce((a, x) => a + x, 0)), mean = tot.reduce((a, x) => a + x, 0) / tot.length;
    $("s-rainsum").textContent = t("sim.event.info", { mm: fmt(mean), h: ev.hours, mx: fmt(Math.max(...tot)), n: ev.reports.n, p: Math.round(ev.reports.hit_rate * 100) })
      + (ev.reported_km2 ? ` ${t("sim.event.rep", { km2: ev.reported_km2, rw: ev.reported_rw ?? "?" })}` : "");
  };
  const summarize = () => {
    box.querySelectorAll<HTMLElement>("[data-mode]").forEach((el) => (el.hidden = el.dataset.mode !== mode()));
    $("s-up-lbl").textContent = t(mode() === "event" ? "sim.up.ev" : "sim.up");
    if (mode() === "event") { summarizeEvent().catch((e) => ($("s-rainsum").textContent = t("sim.err", { m: String(e) }))); return; }
    evShown = "";
    const hy = hyeto();
    if (!hy) { $("s-rainsum").textContent = t("sim.hourly.bad"); return; }
    const peak = Math.max(0, ...hy.mm.map((v) => (v * 3600) / hy.blockSeconds));
    $("s-rainsum").textContent = lang === "id" ? `Total ${totalMm(hy).toFixed(0)} mm selama ${(hy.mm.length * hy.blockSeconds) / 3600} jam, jam terderas ${peak.toFixed(0)} mm.` : `Total ${totalMm(hy).toFixed(0)} mm over ${(hy.mm.length * hy.blockSeconds) / 3600} h, wettest hour ${peak.toFixed(0)} mm.`;
  };
  box.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((el) => el.addEventListener("input", () => { $(`${el.id}-v`).textContent = `${el.value} ${el.dataset.unit}`; summarize(); }));
  $("s-mode").addEventListener("change", summarize);
  $("s-event").addEventListener("change", summarize);
  $("s-hourly").addEventListener("input", summarize);
  const setVal = (id: string, v: number) => { const el = $<HTMLInputElement>(id); el.value = String(v); el.dispatchEvent(new Event("input")); };
  $("s-preset").addEventListener("click", () => { $<HTMLSelectElement>("s-mode").value = "event"; $<HTMLSelectElement>("s-event").value = "2020-01-01"; evShown = ""; setVal("s-sea", 0); summarize(); });
  // deep link: #/sim?event=2020-01-01 opens with that observed flood chosen
  const qe = new URLSearchParams(location.hash.split("?")[1] ?? "").get("event");
  if (qe && eventIds.includes(qe)) { $<HTMLSelectElement>("s-mode").value = "event"; $<HTMLSelectElement>("s-event").value = qe; }
  summarize();
  $("s-res").querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { k = Number(b.dataset.k); $("s-res").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); }));

  // ---------- area: whole region or a drawn box ----------
  const whenLoaded = (f: () => void) => (map.isStyleLoaded() ? f() : map.once("idle", f));
  const addBoxLayer = () => {
    if (!map.getSource("simbox")) map.addSource("simbox", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    if (!map.getLayer("simbox")) map.addLayer({ id: "simbox", type: "line", source: "simbox", paint: { "line-color": "#f97316", "line-width": 2.4 } });
    showBox(area === "box" ? bbox : null);
  };
  const boxGeo = (b: number[] | null) => ({ type: "FeatureCollection" as const, features: b ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] } }] : [] });
  const showBox = (b: number[] | null) => (map.getSource("simbox") as GeoJSONSource | undefined)?.setData(boxGeo(b));
  whenLoaded(addBoxLayer);
  page.onOverlays(addBoxLayer);
  const kmOf = (b: number[]) => [((b[2] - b[0]) * 111.32 * Math.cos(((b[1] + b[3]) / 2) * Math.PI / 180)), (b[3] - b[1]) * 110.57];
  $("s-area").querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => {
    area = b.dataset.a as "region" | "box";
    $("s-area").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    box.querySelector<HTMLElement>('[data-tipfor="sim.area.region"]')!.textContent = t(area === "region" ? "sim.area.region.h" : "sim.area.box.h");
    $("s-draw-row").hidden = area !== "box";
    showBox(area === "box" ? bbox : null);
    refreshAuto();
  }));
  let drawing = false, start: [number, number] | null = null;
  const endDraw = () => { drawing = false; start = null; map.dragPan.enable(); map.getCanvas().style.cursor = ""; $("s-draw").textContent = t("sim.draw"); };
  $("s-draw").addEventListener("click", () => {
    if (drawing) { endDraw(); return; }
    drawing = true; map.dragPan.disable(); map.getCanvas().style.cursor = "crosshair"; $("s-draw").textContent = t("sim.drawing");
  });
  map.on("mousedown", (e: MapMouseEvent) => { if (drawing) { e.preventDefault(); start = [e.lngLat.lng, e.lngLat.lat]; } });
  map.on("mousemove", (e: MapMouseEvent) => { if (drawing && start) showBox([Math.min(start[0], e.lngLat.lng), Math.min(start[1], e.lngLat.lat), Math.max(start[0], e.lngLat.lng), Math.max(start[1], e.lngLat.lat)]); });
  map.on("mouseup", (e: MapMouseEvent) => {
    if (!drawing || !start) return;
    const R = o.regionBbox;
    const b = [Math.max(R[0], Math.min(start[0], e.lngLat.lng)), Math.max(R[1], Math.min(start[1], e.lngLat.lat)), Math.min(R[2], Math.max(start[0], e.lngLat.lng)), Math.min(R[3], Math.max(start[1], e.lngLat.lat))];
    endDraw();
    const [w, h] = kmOf(b);
    if (w < 0.5 || h < 0.5) return;
    bbox = b; showBox(b);
    $("s-box-txt").textContent = t("sim.box", { w: w.toFixed(1), h: h.toFixed(1) });
    refreshAuto();
  });

  // deep link: #/sim?box=W,S,E,N opens with that area selected
  const qb = new URLSearchParams(location.hash.split("?")[1] ?? "").get("box")?.split(",").map(Number);
  if (qb?.length === 4 && qb.every(Number.isFinite) && qb[0] < qb[2] && qb[1] < qb[3]) {
    const R = o.regionBbox;
    bbox = [Math.max(R[0], qb[0]), Math.max(R[1], qb[1]), Math.min(R[2], qb[2]), Math.min(R[3], qb[3])];
    (box.querySelector<HTMLButtonElement>('#s-area [data-a="box"]'))?.click();
    const [w, h] = kmOf(bbox);
    $("s-box-txt").textContent = t("sim.box", { w: w.toFixed(1), h: h.toFixed(1) });
    whenLoaded(() => { showBox(bbox); map.fitBounds([[bbox![0], bbox![1]], [bbox![2], bbox![3]]], { padding: { left: 420, right: 80, top: 120, bottom: 140 }, duration: 0 }); });
  }

  // ---------- what the engine derives from data ----------
  const ensurePack = async () => (pack ??= await loadPack(o.packUrl));
  // buildings, people and kecamatan per cell (separate file; older data releases do not have it)
  let expo: Promise<Exposure | null> | null = null;
  const ensureExposure = () => (expo ??= loadExposure(o.packUrl.replace("/engine_", "/exposure_")).catch(() => null));
  async function refreshAuto() {
    try {
      const p = await ensurePack();
      const r = buildRun(p, area === "box" ? bbox : null, 3);
      const zero = new Float64Array(2);
      const ent = inflowsFor(p.streams, r.isIn, zero, 1);
      let ch = 0, cn = 0, cnN = 0;
      for (let c = 0; c < p.flags.length; c++) if (p.flags[c] & CHANNEL) ch++;
      for (let c = 0; c < r.cn.length; c++) if (r.active[c] && !r.sea[c]) { cn += r.cn[c]; cnN++; }
      const soil = p.header.soil?.source?.startsWith("placeholder") ? "?" : "SoilGrids 2.0";
      $("s-auto").innerHTML = [
        t("sim.auto.terrain", { ch: fmt(ch) }), t("sim.auto.soil", { y: p.header.landcover_year, soil, cn: fmt(cn / Math.max(1, cnN), 1) }),
        t("sim.auto.rough", { y: p.header.landcover_year }), t("sim.auto.up", { n: ent.length, a: fmt(ent.reduce((a, e) => a + e.areaKm2, 0)) }), t("sim.auto.drain"),
      ].map((s) => `<li>${esc(s)}</li>`).join("");
      $("s-soilwarn").innerHTML = p.header.soil?.WARNING ? `<div class="note warn">${t("sim.soilwarn")}</div>` : "";
    } catch (e) { $("s-auto").innerHTML = `<li>${esc(t("sim.err", { m: String(e) }))}</li>`; }
  }
  page.onTab = (tab) => { if (tab === "sim") refreshAuto(); };

  // ---------- result display ----------
  // time since the start; for an observed event the clock time in Jakarta (WIB)
  const fmtT = (s: number) => res?.event
    ? new Date(Date.parse(res.event.start_utc) + s * 1000).toLocaleString(lang === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " WIB"
    : `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")} m`;
  const depthNow = (): Float32Array | null => {
    if (!res) return null;
    if (showMax && res.max) return res.max;
    const f = res.frames[frame];
    return f ? Float32Array.from(f, (v) => v / 100) : null;
  };
  const kpi = (k1: string, v: string, unit: string, sub: string) => `<div class="kpi card" title="${esc(sub)}"><div class="k">${esc(k1)}</div><div class="v">${v}<small>${unit}</small></div></div>`;
  const render = () => {
    if (!res || !layer) return;
    const d = depthNow();
    layer.setDepth(d);
    const g = res.run;
    let wet = 0, deep = 0;
    if (d) for (let c = 0; c < d.length; c++) if (res.count[c]) { if (d[c] > FLOOD_M) wet++; if (d[c] > deep) deep = d[c]; }
    const ex = d && expoNow && res.cells ? exposureSums(expoNow, res.cells, d, res.count, FLOOD_M) : null;
    page.kpis.innerHTML = kpi(t("kpi.area"), fmt((wet * g.dx * g.dx) / 1e6, 1), "km²", t("kpi.area.s")) + kpi(t("kpi.depth"), fmt(deep, 2), "m", t("kpi.depth.s"))
      + (ex ? kpi(t("kpi.bld"), fmt(ex.buildings), "", t("kpi.bld.s")) + kpi(t("kpi.pop"), fmt(ex.people), "", t("kpi.pop.s"))
        : kpi(t("kpi.rain"), fmt(totalMm(res.hy)), "mm", t("kpi.rain.s")) + kpi(t("kpi.inflow"), fmt(peakInflow()), "m³/s", t("kpi.inflow.s")));
    expoTable(ex);
    drawChart();
  };
  let expoNow: Exposure | null = null, expoLast: ExposureSums | null = null;
  const peakInflow = () => (res?.inflows.length ? Math.max(...Array.from({ length: res.inflows[0].q.length }, (_, s) => res!.inflows.reduce((a, f) => a + f.q[s], 0))) : 0);
  const unitName = (u: { name: string | null; kota: string | null }) => u.name ?? `${u.kota} (${t("sim.expo.other")})`;
  const expoTable = (ex: ExposureSums | null) => {
    expoLast = ex;
    const el = $("s-expo");
    if (!res) return;
    if (!ex) { el.innerHTML = res.cells === undefined && expoNow === null ? `<p class="help">${t("sim.expo.none")}</p>` : ""; return; }
    const top = ex.perUnit.slice(0, 10);
    el.innerHTML = `<table class="tbl"><thead><tr><th>${t("sim.expo.kec")}</th><th>${t("sim.expo.bld")}</th><th>${t("sim.expo.pop")}</th></tr></thead><tbody>${top.map((u) => `<tr><td>${esc(unitName(u.unit))}<small>${esc(u.unit.name ? u.unit.kota ?? "" : "")}</small></td><td>${fmt(u.buildings)}</td><td>${fmt(u.people)}</td></tr>`).join("")}</tbody></table>`
      + (ex.perUnit.length > top.length ? `<p class="help">${esc(t("sim.expo.more", { n: ex.perUnit.length - top.length }))}</p>` : "");
  };
  page.legend.innerHTML = `<b>${t("legend")}</b><ul class="legend">${CLASS_COLORS.slice(0, 5).map((c, i) => `<li><span class="swatch" style="background:${c}"></span>${CLASSES[i]}${i < 4 ? `–${CLASSES[i + 1]}` : "+"} m</li>`).join("")}</ul>`;
  page.timeline.innerHTML = `
    <div class="tl-row"><button class="btn small" id="t-play" type="button">▶</button><input type="range" id="t-frame" min="0" max="0" value="0" aria-label="${t("kpi.time")}"><output id="t-out"></output>
      <div class="seg" id="t-show"><button type="button" class="on" data-m="now">${t("sim.show.now")}</button><button type="button" data-m="max">${t("sim.show.max")}</button></div></div>
    <canvas id="t-chart" style="grid-column:1/3" width="800" height="54"></canvas>`;
  const tq = <T extends HTMLElement = HTMLElement>(id: string) => page.timeline.querySelector<T>(`#${id}`)!;
  const drawChart = () => {
    const cv = tq<HTMLCanvasElement>("t-chart"), w = (cv.width = cv.clientWidth * devicePixelRatio || 800), h = (cv.height = 54 * devicePixelRatio), c = cv.getContext("2d")!;
    c.clearRect(0, 0, w, h);
    if (!res || !res.times.length) return;
    const T = Math.max(...res.times, 1), A = Math.max(...res.area, 0.001), hy = res.hy, peak = Math.max(...hy.mm, 0.001);
    c.fillStyle = "rgba(29,99,216,.18)"; // rain bars
    hy.mm.forEach((v, i) => { const x0 = ((i * hy.blockSeconds) / T) * w, x1 = (((i + 1) * hy.blockSeconds) / T) * w; c.fillRect(x0, 0, Math.max(1, x1 - x0 - 1), (v / peak) * h * 0.45); });
    c.strokeStyle = "#1d63d8"; c.lineWidth = 2 * devicePixelRatio; c.beginPath();
    res.times.forEach((t0, i) => { const x = (t0 / T) * w, y = h - (res!.area[i] / A) * (h - 4) - 2; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
    const x = ((res.times[frame] ?? 0) / T) * w;
    c.strokeStyle = "#f97316"; c.lineWidth = 1.5 * devicePixelRatio; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
  };
  tq("t-frame").addEventListener("input", () => { frame = Number(tq<HTMLInputElement>("t-frame").value); tq("t-out").textContent = fmtT(res?.times[frame] ?? 0); render(); });
  tq("t-show").querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { showMax = b.dataset.m === "max"; tq("t-show").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
  const stopPlay = () => { clearInterval(playTimer); playTimer = 0; tq("t-play").textContent = "▶"; };
  tq("t-play").addEventListener("click", () => {
    if (playTimer || !res) { stopPlay(); return; }
    if (frame >= res.frames.length - 1) frame = 0;
    tq("t-play").textContent = "❚❚";
    playTimer = window.setInterval(() => {
      if (!res || frame >= res.frames.length - 1) { stopPlay(); return; }
      frame++; tq<HTMLInputElement>("t-frame").value = String(frame); tq("t-out").textContent = fmtT(res.times[frame]); render();
    }, 160);
  });

  // ---------- export menu ----------
  page.tools.innerHTML = `<div style="position:relative"><button class="btn" id="x-btn" type="button"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>${t("exp.btn")}</button>
    <div class="menu card" id="x-menu" hidden>${(["tif", "ctif", "html", "png", "csv", "json"] as const).map((x) => `<button type="button" data-x="${x}"><b>${t(`exp.${x}` as Key)}</b><small>${t(`exp.${x}.h` as Key)}</small></button>`).join("")}<p class="help" id="x-which" style="padding:4px 10px"></p></div></div>`;
  const menu = page.tools.querySelector<HTMLElement>("#x-menu")!;
  page.tools.querySelector("#x-btn")!.addEventListener("click", () => { menu.hidden = !menu.hidden; page.tools.querySelector("#x-which")!.textContent = res ? t("exp.which", { w: showMax ? t("sim.show.max") : `${t("sim.show.now")} (${fmtT(res.times[frame] ?? 0)})` }) : t("exp.none"); });
  const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const sourceLines = () => {
    const sc = res!.scenario;
    return [
      `${sc.event ? `${lang === "id" ? "Banjir nyata" : "Observed flood"} ${sc.event}, ${lang === "id" ? "hujan IMERG rata-rata" : "IMERG rain, mean"}` : lang === "id" ? "Skenario:" : "Scenario:"} ${sc.rainMm} mm / ${sc.rainHours} h, ${lang === "id" ? "laut" : "sea"} +${sc.seaLevel} m, ${sc.cellM} m, ${showMax ? t("sim.show.max") : fmtT(res!.times[frame] ?? 0)}`,
      `Data: FABDEM V1-2 + OSM (Oct 2026), Esri/IO land cover ${pack?.header.landcover_year}, SoilGrids 2.0, Copernicus GLO-90${sc.event ? ", NASA GPM IMERG Final V07" : ""}. Banjir3D engine v2 (local inertial). ${o.releaseTag ?? ""}`,
      `CRS WGS 84 / UTM 48S (EPSG:32748). ${t("exp.limit")} Licence CC BY-NC-SA 4.0 (FABDEM).`,
    ];
  };
  const expoCsv = () => {
    const q2 = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = (expoLast?.perUnit ?? []).map((u) => [q2(u.unit.name), q2(u.unit.kota), q2(u.unit.province), Math.round(u.buildings), Math.round(u.people)].join(","));
    return [`# ${sourceLines()[0]}`, `# ${lang === "id" ? "Bangunan: Overture Maps; penduduk: WorldPop 2025; kecamatan: OpenStreetMap via Overture (ODbL). Tergenang = kedalaman > 15 cm." : "Buildings: Overture Maps; people: WorldPop 2025; kecamatan: OpenStreetMap via Overture (ODbL). Flooded = depth > 15 cm."}`,
      "kecamatan,kota,province,buildings_flooded,people_affected", ...rows].join("\r\n");
  };
  const provenance = () => ({
    id: `B3D-${stamp()}`, created: new Date().toISOString(), app: "Banjir3D", data_release: o.releaseTag,
    engine: { name: "Banjir3D flood engine v2 (local inertial, Bates et al. 2010; NRCS CN; NRCS unit hydrograph inflows)", device: res!.gpu ? "WebGPU float32" : "CPU float64", wall_s: (res!.wall ?? 0) / 1000 },
    engine_pack: { created: pack?.header.created, inputs_sha256: pack?.header.inputs_sha256, landcover_year: pack?.header.landcover_year, soil: pack?.header.soil, channels: pack?.header.channels },
    scenario: res!.scenario, rain_mm_per_block: res!.hy, grid: { nx: res!.run.nx, ny: res!.run.ny, cell_m: res!.run.dx, utm: res!.run.utm, corners_lonlat: res!.run.corners },
    exposure: expoLast ? { flooded_m: FLOOD_M, buildings: Math.round(expoLast.buildings), people: Math.round(expoLast.people), pack: expoNow?.header.created, sources: expoNow?.header.sources } : null,
    inflows: res!.inflows.map((f) => ({ catchment_km2: +f.areaKm2.toFixed(2), cn: +f.cn.toFixed(1), lag_h: +f.lagH.toFixed(2), peak_m3s: +Math.max(...f.q).toFixed(1), x_m: f.x, y_m: f.y })),
    totals_m3: res!.totals, mass_error: res!.mass, flooded_km2_series: res!.times.map((tt, i) => [tt, +res!.area[i].toFixed(3)]),
    drain_mm_h: calibration.drain_mm_h,
    limitations: ["City drains: calibrated capacity " + calibration.drain_mm_h + " mm/h (1 Jan 2020 flood with IMERG rain, Validation page); no pumps or sea walls.", "Below-water channel shape not in the DEM; channels start at their mapped water level.", res!.event ? "Rain: GPM IMERG 0.1 degree hourly per point (nearest point per cell and per upstream catchment); satellites smooth local peaks (Halim gauge 377 mm/day vs 166 mm in its IMERG cell, 1 Jan 2020)." : "Upstream rain is spatially uniform and equal to the scenario rain when switched on.", "Checked on three observed floods at report points (about 80 % hit); modelled depths shallower than reported (Validation page)."],
    licence: "CC BY-NC-SA 4.0 (most restrictive input: FABDEM)",
  });
  menu.querySelectorAll<HTMLButtonElement>("[data-x]").forEach((b) => b.addEventListener("click", async () => {
    menu.hidden = true;
    const d = depthNow();
    if (!res || !d) { $("s-status").textContent = t("exp.none"); return; }
    const name = `banjir3d_${showMax ? "max" : `t${Math.round((res.times[frame] ?? 0) / 60)}min`}_${stamp()}`;
    const title = `${t("exp.title")}: ${t("region")}`;
    const x = b.dataset.x;
    if (x === "tif") save(`${name}_depth_m.tif`, depthTiff(res.grid, d), "image/tiff");
    else if (x === "ctif") save(`${name}_colour.tif`, colourTiff(res.grid, d), "image/tiff");
    else if (x === "html") save(`${name}.html`, htmlMap(title, await mercatorPng(res.grid, d), sourceLines(), t("legend")), "text/html");
    else if (x === "png") save(`${name}.png`, await mapPng(map, title, sourceLines()[0], sourceLines().slice(1), t("legend")), "image/png");
    else if (x === "csv") save(`${name}_kecamatan.csv`, expoCsv(), "text/csv");
    else save(`${name}_provenance.json`, JSON.stringify(provenance(), null, 1), "application/json");
  }));

  // ---------- research summary (after a run: maximum-depth map over the whole run) ----------
  const concl = document.createElement("aside");
  concl.className = "concl card"; concl.hidden = true; concl.setAttribute("aria-label", t("concl.title"));
  page.el.append(concl);
  const cBtn = document.createElement("button");
  cBtn.className = "btn"; cBtn.type = "button"; cBtn.hidden = true; cBtn.textContent = t("concl.btn");
  page.tools.prepend(cBtn);
  const showConcl = (on: boolean) => { concl.hidden = !on || concl.innerHTML === ""; cBtn.hidden = !concl.innerHTML; cBtn.classList.toggle("on", !concl.hidden); };
  cBtn.addEventListener("click", () => showConcl(concl.hidden !== false));
  let conclText = "";
  const conclude = () => {
    if (!res?.max || !pack) return;
    const r = res, g = r.run, mx = r.max!, a = g.dx * g.dx / 1e6;
    let land = 0, wet = 0, sum = 0, deep = -1, dMax = 0;
    const cls = [0, 0, 0, 0], bounds = [0.5, 1, 2];
    for (let c = 0; c < mx.length; c++) {
      if (!r.count[c]) continue;
      land++;
      const v = mx[c];
      if (v > dMax) { dMax = v; deep = c; }
      if (v <= FLOOD_M) continue;
      wet++; sum += v; cls[bounds.filter((b2) => v > b2).length]++;
    }
    let deepest: Facts["env"]["deepest"] = null;
    if (deep >= 0 && dMax > FLOOD_M) {
      const i = deep % g.nx, j = Math.floor(deep / g.nx), ll = fromUtm(g.utm.x0 + (i + 0.5) * g.dx, g.utm.y0 - (j + 0.5) * g.dx, g.utm.zone, true);
      let kec: string | null = null;
      if (expoNow) {
        const pi = g.i0 + i * g.k + (g.k >> 1), pj = g.j0 + j * g.k + (g.k >> 1), u = pi < expoNow.nx && pj < expoNow.ny ? expoNow.kec[pj * expoNow.nx + pi] : 0;
        const unit = u ? expoNow.units[u - 1] : null;
        if (unit) kec = unit.name ? `${lang === "id" ? "Kec." : "Kecamatan"} ${unit.name}${unit.kota ? `, ${unit.kota}` : ""}` : unitName(unit);
      }
      deepest = { lon: ll.lon, lat: ll.lat, kec };
    }
    let pk = 0;
    r.area.forEach((v, i) => { if (v > r.area[pk]) pk = i; });
    const ex = expoNow && r.cells ? exposureSums(expoNow, r.cells, mx, r.count, FLOOD_M) : null;
    const hy = r.hy, h = (hy.mm.length * hy.blockSeconds) / 3600, peakMmH = Math.max(0, ...hy.mm.map((v) => (v * 3600) / hy.blockSeconds));
    let rain: Facts["rain"];
    if (r.event && r.zone) {
      const used = new Set<number>();
      for (let c = 0; c < r.zone.length; c++) if (r.grid.mask[c]) used.add(r.zone[c]);
      const tot = [...used].map((z) => r.event!.mm[z].reduce((s2, v) => s2 + v, 0));
      rain = { kind: "event", id: r.event.id, wib: r.event.wib, meanMm: totalMm(hy), maxMm: Math.max(...tot), points: used.size, reportsN: r.event.reports.n, hitRate: r.event.reports.hit_rate, reportedKm2: r.event.reported_km2, reportedRw: r.event.reported_rw };
    } else rain = { kind: r.scenario.rainMode === "hourly" ? "hourly" : "design", mm: totalMm(hy), h, peakMmH, r24: r.scenario.r24 as number | undefined };
    const box2 = (r.scenario.area as { box?: number[] }).box ?? null, [wKm, hKm] = box2 ? kmOf(box2) : [0, 0];
    const facts: Facts = {
      area: { box: box2, wKm, hKm }, landKm2: land * a, cellM: g.dx, hours: r.scenario.hours as number, gpu: !!r.gpu, landcoverYear: pack.header.landcover_year,
      drainMmH: calibration.drain_mm_h, seaM: r.scenario.seaLevel as number, floodM: FLOOD_M, rain,
      upstream: r.inflows.length ? { n: r.inflows.length, peakM3s: peakInflow(), areaKm2: r.inflows.reduce((s2, f) => s2 + f.areaKm2, 0) } : null,
      env: { km2: wet * a, classesKm2: cls.map((v) => v * a), meanDepth: wet ? sum / wet : 0, maxDepth: dMax, deepest },
      peak: { km2: r.area[pk] ?? 0, tSec: r.times[pk] ?? 0 }, endKm2: r.area[r.area.length - 1] ?? 0, massError: r.mass ?? 0,
      expo: ex ? { buildings: ex.buildings, people: ex.people, units: ex.perUnit.length, top: ex.perUnit.slice(0, 3).map((u) => ({ name: unitName(u.unit), people: u.people, buildings: u.buildings })) } : null,
    };
    const c = buildConclusion(facts, lang === "id" ? "id" : "en", r.event?.start_utc ?? null);
    conclText = `${c.head[0]}\n\n${c.text}`;
    concl.innerHTML = `<div class="concl-head"><b>${t("concl.title")}</b><button type="button" class="btn small" data-c="copy">${t("concl.copy")}</button><button type="button" class="btn small" data-c="md">.md</button><button type="button" class="btn small" data-c="x" aria-label="${t("concl.close")}">×</button></div>
      <p class="help">${t("concl.note")}</p>
      <div class="concl-body">${c.paragraphs.map((x) => `<p>${esc(x)}</p>`).join("")}
      <h4>${esc(c.head[1])}</h4><ol class="refs">${c.refs.map((x) => `<li>${x}</li>`).join("")}</ol>
      <h4>${esc(c.head[2])}</h4><ul class="refs">${c.other.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    concl.querySelectorAll<HTMLButtonElement>("[data-c]").forEach((b2) => b2.addEventListener("click", async () => {
      if (b2.dataset.c === "x") showConcl(false);
      else if (b2.dataset.c === "md") save(`banjir3d_kesimpulan_${stamp()}.md`, `# ${conclText}\n`, "text/markdown");
      else { try { await navigator.clipboard.writeText(conclText); b2.textContent = t("concl.copied"); } catch { b2.textContent = "✗"; } setTimeout(() => (b2.textContent = t("concl.copy")), 1800); }
    }));
    showConcl(concl.hidden === false);
  };

  // ---------- run ----------
  const setRunning = (r: boolean) => { $<HTMLButtonElement>("s-run").disabled = r; $("s-cancel").hidden = !r; $("s-prog").hidden = !r; };
  const clear = () => {
    stopPlay(); worker?.terminate(); worker = null; setRunning(false); res = null;
    if (layer && map.getLayer("flood")) map.removeLayer("flood");
    layer = null; page.kpis.innerHTML = ""; page.timeline.hidden = true; page.legend.hidden = true; $("s-clear").hidden = true; $("s-stats").innerHTML = ""; $("s-expo-box").hidden = true; $("s-expo").innerHTML = ""; $("s-status").textContent = ""; concl.innerHTML = ""; showConcl(false);
  };
  $("s-clear").addEventListener("click", clear);
  $("s-cancel").addEventListener("click", () => { worker?.terminate(); worker = null; setRunning(false); $("s-status").textContent = ""; });
  const addLayer = () => { if (layer && !map.getLayer("flood")) map.addLayer(layer, map.getStyle().layers.find((l) => l.type === "symbol")?.id); };
  page.onOverlays(addLayer);
  $("s-run").addEventListener("click", async () => {
    const isEv = mode() === "event", hyIn = isEv ? null : hyeto();
    if (!isEv && !hyIn) { $("s-status").textContent = t("sim.hourly.bad"); return; }
    clear(); setRunning(true); $("s-status").textContent = t("sim.loading");
    let p: Pack, ev: EventRain | null;
    try { [p, ev] = await Promise.all([ensurePack(), isEv ? loadEvent($<HTMLSelectElement>("s-event").value) : null]); } catch (e) { setRunning(false); $("s-status").textContent = t("sim.err", { m: String(e) }); return; }
    const kk = !gpuAvailable && area === "region" ? Math.max(3, k) : k;
    $("s-cpuwarn").innerHTML = gpuAvailable ? "" : `<div class="note warn">${t("sim.cpuwarn")}</div>`;
    const run = buildRun(p, area === "box" ? bbox : null, kk);
    const N = run.nx * run.ny, count = new Uint8Array(N), mask = new Uint8Array(N);
    for (let c = 0; c < N; c++) { mask[c] = +(run.active[c] && !run.sea[c]); count[c] = +(mask[c] && !run.channel[c]); }
    const hours = num("s-hours"), steps = Math.ceil((hours * 3600) / DT_S), up = $<HTMLInputElement>("s-up").checked;
    // observed event: rain zone per cell, area-mean hyetograph for the chart and KPIs, each upstream catchment with the rain of its own points
    const zone = ev ? zoneGrid(ev, run) : undefined, hy = ev ? meanHyetograph(ev, zone!, mask) : hyIn!;
    let raw: Inflow[] = [];
    if (up && ev) {
      const cumZ = new Map<number, Float64Array>();
      const cumOf = (m: number) => { const g = fromUtm(p.ox + p.streams.x[m], p.oy - p.streams.y[m], p.zone, true), z = pointAt(ev!, g.lon, g.lat); if (!cumZ.has(z)) cumZ.set(z, cumAtSteps(ev!.mm[z], steps)); return cumZ.get(z)!; };
      raw = inflowsForSpatial(p.streams, run.isIn, cumOf, steps);
    } else if (up) {
      const cum = new Float64Array(steps + 1);
      for (let s = 1; s <= steps; s++) { const t1 = s * DT_S, kb = Math.min(hy.mm.length, Math.floor(t1 / hy.blockSeconds)); let v = 0; for (let b2 = 0; b2 < kb; b2++) v += hy.mm[b2]; if (kb < hy.mm.length) v += (hy.mm[kb] * (t1 - kb * hy.blockSeconds)) / hy.blockSeconds; cum[s] = v; }
      raw = inflowsFor(p.streams, run.isIn, cum, steps);
    }
    const inflows = raw.map((f) => ({ ...f, cell: run.cellAt(f.x, f.y) })).filter((f) => f.cell >= 0);
    const grid: Grid = { nx: run.nx, ny: run.ny, dx: run.dx, zone: run.utm.zone, x0: run.utm.x0, y0: run.utm.y0, z: Float32Array.from(run.z), mask };
    const scenario = {
      area: area === "box" ? { box: bbox } : "region", rainMode: mode(), ...(mode() === "design" ? { r24: num("s-r24") } : {}), rainMm: +totalMm(hy).toFixed(1), rainHours: (hy.mm.length * hy.blockSeconds) / 3600, upstreamRain: up, seaLevel: num("s-sea"), hours, cellM: run.dx,
      ...(ev ? { event: ev.id, eventStartUtc: ev.start_utc, rainSource: ev.source, rainPoints: ev.mm.length } : {}),
    };
    res = { run, grid, frames: [], times: [], area: [], max: null, inflows, hy, scenario, event: ev, zone, count };
    const mine = res;
    ensureExposure().then((x) => { expoNow = x; if (res !== mine) return; if (x) res.cells = exposureCells(x, run); $("s-expo-box").hidden = false; render(); conclude(); });
    layer = new FloodLayer(grid); addLayer();
    page.legend.hidden = false; page.timeline.hidden = false;
    // frames kept in memory as uint16 cm: about 150 MB at most, between 12 and 144 frames, at least 10 min apart
    const nFrames = Math.max(12, Math.min(144, Math.floor(150e6 / (N * 2))));
    const frameS = Math.max(600, Math.ceil((hours * 3600) / nFrames / 300) * 300);
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent<OutMsg>) => {
      const m = ev.data;
      if (!res) return;
      if (m.type === "engine") res.gpu = m.gpu;
      else if (m.type === "frame") {
        res.frames.push(Uint16Array.from(m.depth, (v) => Math.min(65535, Math.round(v * 100)))); res.times.push(m.t); res.area.push(m.floodedKm2);
        frame = res.frames.length - 1;
        const fr = tq<HTMLInputElement>("t-frame"); fr.max = String(frame); fr.value = String(frame); tq("t-out").textContent = fmtT(m.t);
        render();
      } else if (m.type === "progress") {
        const pc = Math.round((100 * m.t) / m.total);
        $("s-status").textContent = t("sim.running", { p: pc }); ($("s-prog").firstElementChild as HTMLElement).style.width = `${pc}%`;
      } else if (m.type === "done") {
        res.max = m.maxDepth; res.totals = m.totals; res.mass = m.massError; res.wall = m.wallMs; res.gpu = m.gpu;
        setRunning(false); $("s-clear").hidden = false; worker = null;
        $("s-status").textContent = t("sim.done", { s: (m.wallMs / 1000).toFixed(0), e: t(m.gpu ? "sim.gpu" : "sim.cpu") });
        const T = m.totals, mm = (v: number) => fmt(v / 1e6, 1);
        $("s-stats-box").hidden = false;
        $("s-stats").innerHTML = (lang === "id"
          ? [["Hujan rata-rata (mm)", fmt(totalMm(hy))], ["Air dari hulu, puncak (m³/s)", fmt(peakInflow())], ["Hujan jatuh (juta m³)", mm(T.rain)], ["Meresap ke tanah", mm(T.infiltration)], ["Masuk dari hulu", mm(T.inflow)], ["Keluar lewat tepi area", mm(T.outflow)], ["Ke laut", mm(T.sea)], ["Kesalahan neraca air", m.massError.toExponential(1)], ["Ukuran grid", `${run.nx} × ${run.ny} × ${run.dx} m`], ["Sungai masuk", String(inflows.length)]]
          : [["Mean rain (mm)", fmt(totalMm(hy))], ["Upstream inflow, peak (m³/s)", fmt(peakInflow())], ["Rain fallen (million m³)", mm(T.rain)], ["Infiltrated", mm(T.infiltration)], ["Inflow from upstream", mm(T.inflow)], ["Left through the area edge", mm(T.outflow)], ["To the sea", mm(T.sea)], ["Water balance error", m.massError.toExponential(1)], ["Grid", `${run.nx} × ${run.ny} × ${run.dx} m`], ["Entering rivers", String(inflows.length)]])
          .map(([a, b2]) => `<dt>${esc(a)}</dt><dd>${esc(b2)}</dd>`).join("");
        render(); conclude(); showConcl(true);
      } else if (m.type === "error") { setRunning(false); $("s-status").textContent = t("sim.err", { m: m.message }); }
    };
    worker.onerror = (e) => { setRunning(false); $("s-status").textContent = t("sim.err", { m: e.message }); };
    const msg: RunMsg = {
      type: "run", grid: { nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: run.cn, active: run.active, sea: run.sea, drain: drainOf(run), zone }, zoneMm: ev?.mm, seaLevel: num("s-sea"), hours, rain: hy, frameS,
      inflowCells: inflows.map((f) => f.cell), inflowQ: inflows.map((f) => f.q), inflowDt: DT_S, floodM: FLOOD_M, count, preferGpu: gpuAvailable,
    };
    worker.postMessage(msg);
  });
  return { destroy() { clear(); } };
}
