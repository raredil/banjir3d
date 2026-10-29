import { LocalInertial } from "./local-inertial";
import { frameSeconds, MM_PER_H, clampScenario, edgesOf, hyetographOf, riverCells, type Scenario } from "./scenario";
import { durationS, rainRate } from "./rain";

export type RunMsg = { type: "run"; z: Float64Array; nx: number; ny: number; dx: number; dy: number; scenario: Scenario; manningField?: Float64Array };
export type OutMsg =
  | { type: "frame"; index: number; t: number; depth: Float32Array }
  | { type: "progress"; t: number; total: number }
  | { type: "done"; maxDepth: Float32Array; steps: number; massError: number; wallMs: number; totals: { rain: number; drain: number; inflow: number; outflow: number } };

let cancelled = false;
const post = (m: OutMsg, tr: Transferable[] = []) => (self as unknown as Worker).postMessage(m, tr);

self.onmessage = async (ev: MessageEvent<RunMsg | { type: "cancel" }>) => {
  const m = ev.data;
  if (m.type === "cancel") { cancelled = true; return; }
  cancelled = false;
  const sc = clampScenario(m.scenario);
  const hy = hyetographOf(sc);
  const s = new LocalInertial({ nx: m.nx, ny: m.ny, dx: m.dx, dy: m.dy, z: m.z }, {
    manning: sc.manning, manningField: m.manningField, openEdges: edgesOf(sc), inflowCells: sc.inflowM3s > 0 ? riverCells(m.z, m.nx, m.ny) : [],
  });
  s.drain = sc.drainMmH * MM_PER_H;
  const total = sc.totalHours * 3600, rainEnd = durationS(hy), every = frameSeconds(sc.totalHours);
  const maxDepth = new Float32Array(m.nx * m.ny);
  const t0 = performance.now();
  let steps = 0, nextFrame = 0, index = 0, yieldAt = performance.now() + 40;
  const emit = () => { post({ type: "frame", index: index++, t: s.t, depth: Float32Array.from(s.h) }); nextFrame += every; };
  emit();
  while (s.t < total && !cancelled) {
    s.rain = rainRate(hy, s.t);
    s.inflow = s.t < rainEnd ? sc.inflowM3s : 0;
    s.step(); steps++;
    for (let c = 0; c < maxDepth.length; c++) if (s.h[c] > maxDepth[c]) maxDepth[c] = s.h[c];
    if (s.t >= nextFrame) emit();
    if (performance.now() > yieldAt) {
      post({ type: "progress", t: s.t, total });
      await new Promise((r) => setTimeout(r, 0));
      yieldAt = performance.now() + 40;
    }
  }
  if (cancelled) return;
  post({ type: "done", maxDepth, steps, massError: s.massError(), wallMs: performance.now() - t0, totals: { ...s.totals } }, [maxDepth.buffer]);
};
