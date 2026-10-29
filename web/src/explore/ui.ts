import type { CanvasSource, Map as MlMap } from "maplibre-gl";
import { t, type Key } from "../i18n";
import { loadDem, loadLandCover, gridWindow, type GridWindow } from "./dem-grid";
import { nFieldFromCodes, type RoughMode } from "./roughness";
import { paintDepth } from "./palette";
import { DEFAULT_SCENARIO, clampScenario, type Scenario } from "./scenario";
import type { OutMsg, RunMsg } from "./sim.worker";

type Opts = { demUrl: string; landUrl: string; bbox: number[]; cap: HTMLElement; onActive: (active: boolean) => void };
const PRESETS: Record<string, Partial<Scenario>> = {
  moderate: { rainMmH: 50, rainHours: 2, drainMmH: 20, inflowM3s: 0, totalHours: 6 },
  heavy: { rainMmH: 100, rainHours: 3, drainMmH: 20, inflowM3s: 0, totalHours: 8 },
  extreme: { rainMmH: 150, rainHours: 3, drainMmH: 20, inflowM3s: 300, totalHours: 8 },
};
const RAMP = "linear-gradient(90deg,#d7e6f4,#9ecae1,#4292c6,#2171b5,#08306b)";

const fmtTime = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")} min`;

export function mountExplore(map: MlMap, box: HTMLElement, o: Opts) {
  const d = DEFAULT_SCENARIO;
  const slider = (id: string, key: Key, min: number, max: number, step: number, v: number, unit: string) =>
    `<label class="opacity s3-ctl"><span>${t(key)}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output id="${id}-v" data-unit="${unit}">${v} ${unit}</output></label>`;
  box.innerHTML = `
    <div class="group"><h3>${t("ex.title")}</h3>
      <div class="ex-presets">${Object.keys(PRESETS).map((k) => `<button class="chip" type="button" data-preset="${k}">${t(`ex.p.${k}` as Key)}</button>`).join("")}</div>
      ${slider("ex-rain", "ex.rain", 0, 200, 5, d.rainMmH, "mm/h")}
      ${slider("ex-rainh", "ex.rainh", 0.5, 12, 0.5, d.rainHours, "h")}
      ${slider("ex-drain", "ex.drain", 0, 100, 5, d.drainMmH, "mm/h")}
      ${slider("ex-inflow", "ex.inflow", 0, 600, 25, d.inflowM3s, "m³/s")}
      ${slider("ex-total", "ex.total", 1, 12, 1, d.totalHours, "h")}
      <label class="opacity s3-ctl"><span>${t("ex.rough")}</span><select id="ex-rough">${(["n", "low", "high", "uniform"] as const).map((m) => `<option value="${m}">${t(`ex.rough.${m}` as Key)}</option>`).join("")}</select></label>
      <div class="ex-actions"><button class="chip primary" id="ex-run" type="button">${t("ex.run")}</button><button class="chip" id="ex-cancel" type="button" hidden>${t("ex.cancel")}</button><button class="chip" id="ex-clear" type="button" hidden>${t("ex.clear")}</button></div>
      <div class="ex-status" id="ex-status" role="status"></div>
      <div id="ex-result" hidden>
        <div class="ex-timeline"><button class="chip" id="ex-play" type="button">${t("ex.play")}</button><input type="range" id="ex-frame" min="0" max="0" step="1" value="0" aria-label="${t("ex.time")}"><output id="ex-time"></output></div>
        <label class="layer-row"><input type="checkbox" id="ex-max"><span>${t("ex.max")}</span></label>
        <div class="ramp"><div class="ramp-bar" style="background:${RAMP}"></div><div class="ramp-labels"><span>0</span><span>${t("ex.depth")}</span><span>2+</span></div></div>
        <div class="ex-stats" id="ex-stats"></div>
      </div>
      <div class="notice">${t("ex.warn")}</div>
      <p class="crs-note">${t("ex.note")}</p>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => box.querySelector<T>(`#${id}`)!;
  const num = (id: string) => Number($<HTMLInputElement>(id).value);
  for (const el of box.querySelectorAll<HTMLInputElement>('input[type="range"][id^="ex-"]')) {
    const out = box.querySelector<HTMLElement>(`#${el.id}-v`);
    if (out) el.addEventListener("input", () => (out.textContent = `${el.value} ${out.dataset.unit}`));
  }
  box.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PRESETS[b.dataset.preset!];
      const set = (id: string, v: number | undefined) => { if (v === undefined) return; const el = $<HTMLInputElement>(id); el.value = String(v); el.dispatchEvent(new Event("input")); };
      set("ex-rain", p.rainMmH); set("ex-rainh", p.rainHours); set("ex-drain", p.drainMmH); set("ex-inflow", p.inflowM3s); set("ex-total", p.totalHours);
    }));

  // overlay: the simulation grid drawn as an image draped on the terrain
  const win: GridWindow = gridWindow(o.bbox);
  const canvas = document.createElement("canvas");
  canvas.width = win.nx; canvas.height = win.ny;
  const ctx2 = canvas.getContext("2d")!;
  const img = ctx2.createImageData(win.nx, win.ny);
  // A canvas source needs no network request, so it works under the app's strict CSP (no data: or blob: fetches).
  canvas.id = "flood-canvas";
  map.addSource("flood", { type: "canvas", canvas, coordinates: win.corners as [[number, number], [number, number], [number, number], [number, number]], animate: false });
  map.addLayer({ id: "flood", type: "raster", source: "flood", paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "linear" } }, "wfill");
  let flip = false;
  const draw = (depth: Float32Array | null) => {
    if (!depth) ctx2.clearRect(0, 0, win.nx, win.ny);
    else { paintDepth(depth, img.data); ctx2.putImageData(img, 0, 0); }
    // upload the new pixels on the next render, then stop animating again
    const src = map.getSource("flood") as CanvasSource;
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
    $("ex-time").textContent = showMax ? t("ex.maxlabel") : fmtTime(times[i]);
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
    stopPlay(); frames = []; times = []; maxDepth = null;
    $("ex-result").hidden = true; $("ex-stats").textContent = "";
    setRunning(true); status(t("ex.loading"));
    try {
      dem ??= await loadDem(o.demUrl, o.bbox);
    } catch {
      setRunning(false); status(t("ex.err")); return;
    }
    let mode = $<HTMLSelectElement>("ex-rough").value as RoughMode;
    let field: Float64Array | undefined;
    if (mode !== "uniform") {
      try {
        land ??= await loadLandCover(o.landUrl, o.bbox);
        field = nFieldFromCodes(land.codes, land.nx, land.ny, land.f, mode);
      } catch {
        mode = "uniform"; status(t("ex.roughfail"));
      }
    }
    roughLabel = t(`ex.rough.${mode}` as Key);
    roughMean = field ? field.reduce((a, v) => a + v, 0) / field.length : d.manning;
    const scenario = clampScenario({ rainMmH: num("ex-rain"), rainHours: num("ex-rainh"), drainMmH: num("ex-drain"), inflowM3s: num("ex-inflow"), totalHours: num("ex-total"), manning: d.manning });
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
        for (const v of maxDepth) { if (v > peak) peak = v; if (v > 0.1) wet++; }
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
  return { destroy() { stopPlay(); worker?.terminate(); } };
}
