// Runs the flood engine off the main thread so the map stays smooth: WebGPU when the browser has it, else the CPU reference.
import { ALPHA, FloodEngine, type EngineGrid } from "../engine/solver";
import { GpuEngine } from "../engine/gpu";
import { rainRate, type Hyetograph } from "../explore/rain";

export type RunMsg = {
  type: "run"; grid: EngineGrid; seaLevel: number; hours: number; rain: Hyetograph; frameS: number;
  inflowCells: number[]; inflowQ: Float64Array[]; inflowDt: number; floodM: number; count: Float32Array; preferGpu: boolean; // count: area share per cell that counts (0 = none)
  zoneMm?: number[][]; // observed event: rain blocks per zone (grid.zone), same blockSeconds as rain
};
export type OutMsg =
  | { type: "engine"; gpu: boolean; reason?: string } // reason: why WebGPU was asked for but not used (the run continues on the CPU)
  | { type: "frame"; t: number; depthCm: Uint16Array; floodedKm2: number } // depth in cm (as the panel stores frames)
  | { type: "progress"; t: number; total: number }
  | { type: "done"; maxDepth: Float32Array; massError: number; wallMs: number; totals: Record<string, number>; gpu: boolean; steps: number }
  | { type: "error"; message: string };

const post = (m: OutMsg, tr: Transferable[] = []) => (self as unknown as Worker).postMessage(m, tr);

self.onmessage = async (ev: MessageEvent<RunMsg>) => {
  const m = ev.data;
  try {
    const total = m.hours * 3600, N = m.grid.nx * m.grid.ny, cellKm2 = (m.grid.dx * m.grid.dx) / 1e6;
    // one pass per frame: flooded area and the depth in cm (no conversion work left for the page)
    const frame = (t: number, d: ArrayLike<number>, stride: number) => {
      const cm = new Uint16Array(N);
      let w = 0;
      for (let c = 0; c < N; c++) { const v = d[c * stride]; cm[c] = v >= 655.35 ? 65535 : Math.round(v * 100); if (v > m.floodM) w += m.count[c]; }
      post({ type: "frame", t, depthCm: cm, floodedKm2: w * cellKm2 }, [cm.buffer]);
    };
    // WebGPU first when asked; any GPU problem (no adapter, too little memory, validation error, device lost, non-finite
    // state) ends the GPU attempt and the same run starts again on the CPU reference engine
    if (m.preferGpu) {
      const why = await runGpu(m, total, N, frame, performance.now()).catch((e) => String((e as Error)?.message ?? e));
      if (why === null) return;
      post({ type: "engine", gpu: false, reason: why });
    } else post({ type: "engine", gpu: false });
    const e = new FloodEngine(m.grid, { seaLevel: m.seaLevel, inflowCells: m.inflowCells });
    const t0 = performance.now();
    let yieldAt = t0 + 200, nSteps = 0, next = 0;
    while (e.t < total) {
      e.rate = rainRate(m.rain, e.t) * 3.6e6;
      if (m.zoneMm) e.rates = m.zoneMm.map((mm) => rainRate({ blockSeconds: m.rain.blockSeconds, mm }, e.t) * 3.6e6);
      const k = Math.min((m.inflowQ[0]?.length ?? 1) - 1, Math.floor(e.t / m.inflowDt));
      e.inflows = m.inflowQ.map((q) => q[k]);
      e.step(); nSteps++;
      if (e.t >= next || e.t >= total) {
        frame(e.t, e.h, 1);
        while (next <= e.t) next += m.frameS;
      }
      if (performance.now() > yieldAt) { post({ type: "progress", t: e.t, total }); await new Promise((r) => setTimeout(r, 0)); yieldAt = performance.now() + 200; }
    }
    const mx = Float32Array.from(e.hMax);
    post({ type: "done", maxDepth: mx, massError: e.massError(), wallMs: performance.now() - t0, totals: { ...e.totals }, gpu: false, steps: nSteps }, [mx.buffer]);
  } catch (err) {
    post({ type: "error", message: String((err as Error)?.message ?? err) });
  }
};

/** The run on WebGPU. Returns null when it finished, else the reason it gave up (frames sent so far are replaced by the CPU run). */
async function runGpu(m: RunMsg, total: number, N: number, frame: (t: number, d: ArrayLike<number>, stride: number) => void, t0: number): Promise<string | null> {
  const gpu = await GpuEngine.create({ grid: m.grid, seaLevel: m.seaLevel, hMin: 0.001, alpha: ALPHA, dtMax: 15, tEnd: total, rain: m.rain, inflowCells: m.inflowCells, inflowQ: m.inflowQ, inflowDt: m.inflowDt, zoneMm: m.zoneMm });
  try {
    let st = await gpu.state(), batch = 20, nSteps = 0, next = 0, started = false;
    while (st.t < total - 1e-3) {
      const b0 = performance.now();
      gpu.steps(batch); nSteps += batch;
      st = await gpu.state();
      if (gpu.error) return gpu.error;
      if (!Number.isFinite(st.t) || !Number.isFinite(st.dt) || (st.dt <= 0 && st.t < total - 1e-3)) return `GPU state not finite (t ${st.t}, dt ${st.dt})`;
      // about 4 updates per second, and short submissions (long ones trip the operating system's GPU watchdog)
      batch = Math.max(5, Math.min(1000, Math.round(batch * (250 / Math.max(1, performance.now() - b0)))));
      if (!started) { post({ type: "engine", gpu: true }); started = true; }
      if (st.t >= next || st.t >= total - 1e-3) {
        frame(st.t, await gpu.depths(), 2);
        while (next <= st.t) next += m.frameS;
      }
      post({ type: "progress", t: st.t, total });
    }
    const hh = await gpu.depths(), mx = new Float32Array(N);
    for (let c = 0; c < N; c++) mx[c] = hh[2 * c + 1];
    const me = await gpu.massError(m.grid.active);
    const s = await gpu.state();
    if (gpu.error) return gpu.error;
    if (!Number.isFinite(me)) return "GPU water balance not finite";
    post({ type: "done", maxDepth: mx, massError: me, wallMs: performance.now() - t0, totals: s.totals, gpu: true, steps: nSteps }, [mx.buffer]);
    return null;
  } finally { gpu.destroy(); }
}
