import type { CanvasSource, Map as MlMap } from "maplibre-gl";
import { t, type Key } from "../i18n";
import { aggregationFor, gridWindow, loadDem, loadLandCover, type GridWindow } from "./dem-grid";
import { nFieldFromCodes, type RoughMode } from "./roughness";
import { overlayScale, paintDepth } from "./palette";
import { parseHourly, totalMm } from "./rain";
import { DEFAULT_SCENARIO, clampScenario, hyetographOf, type RainMode, type Scenario } from "./scenario";
import type { OutMsg, RunMsg } from "./sim.worker";

type Opts = { demUrl: string; landUrl: string; bbox: number[]; cap: HTMLElement; onActive: (active: boolean) => void };
// Documented cases only: the 1 Jan 2020 event (Lubis et al. 2022) and the case used for the SFINCS comparison.
const PRESETS: Record<string, Partial<Scenario>> = {
  jan2020: { rainMode: "design", r24: 377, stormHours: 24, totalHours: 30, drainMmH: 0, inflowM3s: 0, open: true },
  sfincs: { rainMode: "constant", rainMmH: 100, rainHours: 3, totalHours: 8, drainMmH: 0, inflowM3s: 0, open: false },
};
const RAMP = "linear-gradient(90deg,#d7e6f4,#9ecae1,#4292c6,#2171b5,#08306b)";
const FLOOD_M = 0.15; // flooded-area threshold: lower bound of the second depth class (BLUEPRINT 8), above the 0.05 m wet/dry limit

const fmtTime = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")} min`;

export function mountExplore(map: MlMap, box: HTMLElement, o: Opts) {
  const d = DEFAULT_SCENARIO;
  const slider = (id: string, key: Key, min: number, max: number, step: number, v: number, unit: string) =>
    `<label class="opacity s3-ctl"><span>${t(key)}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output id="${id}-v" data-unit="${unit}">${v} ${unit}</output></label>`;
  const k = aggregationFor(o.bbox);
  const win: GridWindow = gridWindow(o.bbox, k);
  box.innerHTML = `
    <div class="group"><h3>${t("ex.title")}</h3>
      <p class="crs-note">${t("ex.grid").replace("{nx}", String(win.nx)).replace("{ny}", String(win.ny)).replace("{d}", win.dx.toFixed(0))}${k > 1 ? " " + t("ex.coarse") : ""}</p>
      <div class="ex-presets">${Object.keys(PRESETS).map((p) => `<button class="chip" type="button" data-preset="${p}" title="${t(`ex.p.${p}.d` as Key)}">${t(`ex.p.${p}` as Key)}</button>`).join("")}</div>
      <label class="opacity s3-ctl"><span>${t("ex.rainmode")}</span><select id="ex-mode">${(["design", "hourly", "constant"] as const).map((m) => `<option value="${m}">${t(`ex.mode.${m}` as Key)}</option>`).join("")}</select></label>
      <div data-mode="design">
        ${slider("ex-r24", "ex.r24", 0, 500, 1, d.r24, "mm")}
        ${slider("ex-storm", "ex.storm", 1, 24, 1, d.stormHours, "h")}
      </div>
      <div data-mode="hourly" hidden>
        <label class="s3-ctl ex-text"><span>${t("ex.hourly")}</span><textarea id="ex-hourly" rows="2" spellcheck="false" placeholder="5, 20, 60, 35, 10"></textarea></label>
      </div>
      <div data-mode="constant" hidden>
        ${slider("ex-rain", "ex.rain", 0, 200, 5, d.rainMmH, "mm/h")}
        ${slider("ex-rainh", "ex.rainh", 0.5, 12, 0.5, d.rainHours, "h")}
      </div>
      <p class="crs-note" id="ex-rainsum"></p>
      ${slider("ex-drain", "ex.drain", 0, 100, 5, d.drainMmH, "mm/h")}
      ${slider("ex-inflow", "ex.inflow", 0, 600, 25, d.inflowM3s, "m³/s")}
      ${slider("ex-total", "ex.total", 1, 48, 1, d.totalHours, "h")}
      <label class="opacity s3-ctl"><span>${t("ex.rough")}</span><select id="ex-rough">${(["n", "low", "high", "uniform"] as const).map((m) => `<option value="${m}">${t(`ex.rough.${m}` as Key)}</option>`).join("")}</select></label>
      <label class="opacity s3-ctl"><span>${t("ex.edges")}</span><select id="ex-edges"><option value="open">${t("ex.edges.open")}</option><option value="closed">${t("ex.edges.closed")}</option></select></label>
      <div class="ex-actions"><button class="chip primary" id="ex-run" type="button">${t("ex.run")}</button><button class="chip" id="ex-cancel" type="button" hidden>${t("ex.cancel")}</button><button class="chip" id="ex-clear" type="button" hidden>${t("ex.clear")}</button></div>
      <div class="ex-status" id="ex-status" role="status"></div>
      <div id="ex-result" hidden>
        <div class="ex-timeline"><button class="chip" id="ex-play" type="button">${t("ex.play")}</button><input type="range" id="ex-frame" min="0" max="0" step="1" value="0" aria-label="${t("ex.time")}"><output id="ex-time"></output></div>
        <label class="layer-row"><input type="checkbox" id="ex-max"><span>${t("ex.max")}</span></label>
        <div class="ramp"><div class="ramp-bar" style="background:${RAMP}"></div><div class="ramp-labels"><span>0</span><span>${t("ex.depth")}</span><span>2+</span></div></div>
        <div class="ex-stats" id="ex-stats"></div>
      </div>
      <div class="notice">${t("ex.warn")}</div>
      <p class="crs-note">${t("ex.note")} <a href="#/methods">${t("ex.methods")}</a></p>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => box.querySelector<T>(`#${id}`)!;
  const num = (id: string) => Number($<HTMLInputElement>(id).value);

  const read = (): Scenario | null => {
    const mode = $<HTMLSelectElement>("ex-mode").value as RainMode;
    const hourly = mode === "hourly" ? parseHourly($<HTMLTextAreaElement>("ex-hourly").value) : null;
    if (mode === "hourly" && !hourly) return null;
    return clampScenario({
      rainMode: mode, r24: num("ex-r24"), stormHours: num("ex-storm"), hourly: hourly?.mm ?? [], rainMmH: num("ex-rain"), rainHours: num("ex-rainh"),
      drainMmH: num("ex-drain"), inflowM3s: num("ex-inflow"), totalHours: num("ex-total"), manning: d.manning, open: $<HTMLSelectElement>("ex-edges").value === "open",
    });
  };
  const summarize = () => {
    const mode = $<HTMLSelectElement>("ex-mode").value;
    box.querySelectorAll<HTMLElement>("[data-mode]").forEach((el) => (el.hidden = el.dataset.mode !== mode));
    const sc = read();
    if (!sc) { $("ex-rainsum").textContent = t("ex.hourlybad"); return; }
    const hy = hyetographOf(sc);
    const peak = Math.max(0, ...hy.mm.map((v) => (v * 3600) / hy.blockSeconds));
    $("ex-rainsum").textContent = t(`ex.sum.${sc.rainMode}` as Key).replace("{mm}", totalMm(hy).toFixed(0)).replace("{h}", String((hy.mm.length * hy.blockSeconds) / 3600)).replace("{p}", peak.toFixed(0));
  };
  for (const el of box.querySelectorAll<HTMLInputElement>('input[type="range"][id^="ex-"]')) {
    const out = box.querySelector<HTMLElement>(`#${el.id}-v`);
    el.addEventListener("input", () => { if (out) out.textContent = `${el.value} ${out.dataset.unit}`; summarize(); });
  }
  $("ex-mode").addEventListener("change", summarize);
  $("ex-hourly").addEventListener("input", summarize);
  box.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PRESETS[b.dataset.preset!];
      const set = (id: string, v: number | undefined) => { if (v === undefined) return; const el = $<HTMLInputElement>(id); el.value = String(v); el.dispatchEvent(new Event("input")); };
      if (p.rainMode) $<HTMLSelectElement>("ex-mode").value = p.rainMode;
      if (p.open !== undefined) $<HTMLSelectElement>("ex-edges").value = p.open ? "open" : "closed";
      set("ex-r24", p.r24); set("ex-storm", p.stormHours); set("ex-rain", p.rainMmH); set("ex-rainh", p.rainHours);
      set("ex-drain", p.drainMmH); set("ex-inflow", p.inflowM3s); set("ex-total", p.totalHours);
      summarize();
    }));
  summarize();

  // overlay: the simulation grid drawn as an image draped on the terrain. Every model cell is drawn as a sharp square of
  // px x px canvas pixels (no smoothing), so the map shows exactly the computed depths, never values blurred between cells.
  const cells = document.createElement("canvas");
  cells.width = win.nx; cells.height = win.ny;
  const cctx = cells.getContext("2d")!;
  const img = cctx.createImageData(win.nx, win.ny);
  const px = overlayScale(win.nx, win.ny);
  const canvas = document.createElement("canvas");
  canvas.width = win.nx * px; canvas.height = win.ny * px;
  const ctx2 = canvas.getContext("2d")!;
  // A canvas source needs no network request, so it works under the app's strict CSP (no data: or blob: fetches).
  canvas.id = "flood-canvas";
  map.addSource("flood", { type: "canvas", canvas, coordinates: win.corners as [[number, number], [number, number], [number, number], [number, number]], animate: false });
  map.addLayer({ id: "flood", type: "raster", source: "flood", paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "nearest" } }, "wfill");
  let flip = false;
  const draw = (depth: Float32Array | null) => {
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    if (depth) {
      paintDepth(depth, img.data); cctx.putImageData(img, 0, 0);
      ctx2.imageSmoothingEnabled = false;
      ctx2.drawImage(cells, 0, 0, canvas.width, canvas.height);
    }
    // upload the new pixels on the next render, then stop animating again
    const src = map.getSource("flood") as CanvasSource | undefined;
    if (!src) return;
    src.play();
    map.once("render", () => src.pause());
    // A layer draped on 3D terrain is cached per terrain tile; a tiny paint change makes MapLibre redraw those tiles.
    flip = !flip;
    map.setPaintProperty("flood", "raster-opacity", flip ? 1 : 0.999);
    map.triggerRepaint();
  };

  let dem: (GridWindow & { z: Float64Array }) | null = null;
  let land: { codes: Uint8Array; nx: number; ny: number; f: number } | null = null;
  let roughLabel = "";
  let roughMean = 0;
  let worker: Worker | null = null;
  let frames: Float32Array[] = [];
  let times: number[] = [];
  let maxDepth: Float32Array | null = null;
  let running = false;
  let playTimer: number | undefined;

  const status = (s: string) => ($("ex-status").textContent = s);
  const setCap = (s: string) => (o.cap.textContent = s);
  const show = () => {
    if (!frames.length) return;
    const showMax = $<HTMLInputElement>("ex-max").checked && maxDepth;
    const i = Math.min(Number($<HTMLInputElement>("ex-frame").value), frames.length - 1);
    draw(showMax ? maxDepth : frames[i]);
    $("ex-time").textContent = showMax ? t("ex.maxshort") : fmtTime(times[i]);
    setCap(t("ex.cap").replace("{t}", showMax ? t("ex.maxlabel") : fmtTime(times[i])));
  };
  const stopPlay = () => { if (playTimer) clearInterval(playTimer); playTimer = undefined; $("ex-play").textContent = t("ex.play"); };
  const setRunning = (r: boolean) => {
    running = r;
    $<HTMLButtonElement>("ex-run").disabled = r;
    $("ex-cancel").hidden = !r;
  };
  const clear = () => {
    stopPlay(); worker?.terminate(); worker = null; setRunning(false);
    frames = []; times = []; maxDepth = null;
    draw(null); setCap(""); status("");
    $("ex-result").hidden = true; $("ex-clear").hidden = true; o.onActive(false);
  };

  $("ex-run").addEventListener("click", async () => {
    if (running) return;
    const scenario = read();
    if (!scenario) { status(t("ex.hourlybad")); return; }
    stopPlay(); frames = []; times = []; maxDepth = null;
    $("ex-result").hidden = true; $("ex-stats").textContent = "";
    setRunning(true); status(t("ex.loading"));
    try {
      dem ??= await loadDem(o.demUrl, o.bbox, k);
    } catch {
      setRunning(false); status(t("ex.err")); return;
    }
    let mode = $<HTMLSelectElement>("ex-rough").value as RoughMode;
    let field: Float64Array | undefined;
    if (mode !== "uniform") {
      try {
        land ??= await loadLandCover(o.landUrl, o.bbox, k);
        field = nFieldFromCodes(land.codes, land.nx, land.ny, land.f, mode);
      } catch {
        mode = "uniform"; status(t("ex.roughfail"));
      }
    }
    roughLabel = t(`ex.rough.${mode}` as Key);
    roughMean = field ? field.reduce((a, v) => a + v, 0) / field.length : d.manning;
    worker?.terminate();
    worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onerror = () => { setRunning(false); status(t("ex.err")); };
    o.onActive(true); $("ex-clear").hidden = false; $("ex-result").hidden = false;
    $<HTMLInputElement>("ex-max").checked = false;
    worker.onmessage = (ev: MessageEvent<OutMsg>) => {
      const m = ev.data;
      if (m.type === "frame") {
        frames.push(m.depth); times.push(m.t);
        const fr = $<HTMLInputElement>("ex-frame");
        fr.max = String(frames.length - 1); fr.value = String(frames.length - 1);
        show();
      } else if (m.type === "progress") {
        status(`${t("ex.running")} ${Math.round((100 * m.t) / m.total)}%`);
      } else {
        maxDepth = m.maxDepth; setRunning(false);
        let peak = 0, wet = 0;
        for (const v of maxDepth) { if (v > peak) peak = v; if (v > FLOOD_M) wet++; }
        const area = (wet * dem!.dx * dem!.dy) / 1e6;
        status(t("ex.done"));
        $("ex-stats").textContent = t("ex.stats").replace("{peak}", peak.toFixed(2)).replace("{area}", area.toFixed(2)).replace("{err}", m.massError.toExponential(1)).replace("{s}", (m.wallMs / 1000).toFixed(1)) + " " + t("ex.roughstat").replace("{m}", roughLabel).replace("{n}", roughMean.toFixed(3));
        show();
      }
    };
    const msg: RunMsg = { type: "run", z: dem.z, nx: dem.nx, ny: dem.ny, dx: dem.dx, dy: dem.dy, scenario, manningField: field };
    worker.postMessage(msg);
  });
  $("ex-cancel").addEventListener("click", () => { worker?.terminate(); worker = null; setRunning(false); status(t("ex.cancelled")); });
  $("ex-clear").addEventListener("click", clear);
  $("ex-frame").addEventListener("input", () => { stopPlay(); show(); });
  $("ex-max").addEventListener("change", show);
  $("ex-play").addEventListener("click", () => {
    if (playTimer) { stopPlay(); return; }
    const fr = $<HTMLInputElement>("ex-frame");
    $<HTMLInputElement>("ex-max").checked = false;
    if (Number(fr.value) >= frames.length - 1) fr.value = "0";
    $("ex-play").textContent = t("ex.pause");
    playTimer = window.setInterval(() => {
      const next = Number(fr.value) + 1;
      if (next >= frames.length) { stopPlay(); return; }
      fr.value = String(next); show();
    }, 140);
  });
  return {
    destroy() {
      stopPlay(); worker?.terminate(); o.onActive(false); setCap("");
      if (map.getLayer("flood")) map.removeLayer("flood");
      if (map.getSource("flood")) map.removeSource("flood");
    },
  };
}
