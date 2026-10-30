// Runs the flood engine off the main thread so the map stays smooth: WebGPU when the browser has it, else the CPU reference.
import { FloodEngine, type EngineGrid } from "../engine/solver";
import { GpuEngine } from "../engine/gpu";
import { rainRate, type Hyetograph } from "../explore/rain";

export type RunMsg = {
  type: "run"; grid: EngineGrid; seaLevel: number; hours: number; rain: Hyetograph; frameS: number;
  inflowCells: number[]; inflowQ: Float64Array[]; inflowDt: number; floodM: number; count: Uint8Array; preferGpu: boolean;
};
export type OutMsg =
  | { type: "engine"; gpu: boolean }
  | { type: "frame"; t: number; depth: Float32Array; floodedKm2: number }
  | { type: "progress"; t: number; total: number }
  | { type: "done"; maxDepth: Float32Array; massError: number; wallMs: number; totals: Record<string, number>; gpu: boolean }
  | { type: "error"; message: string };

const post = (m: OutMsg, tr: Transferable[] = []) => (self as unknown as Worker).postMessage(m, tr);

self.onmessage = async (ev: MessageEvent<RunMsg>) => {
  const m = ev.data;
  try {
    const total = m.hours * 3600, N = m.grid.nx * m.grid.ny, cellKm2 = (m.grid.dx * m.grid.dx) / 1e6;
    const flooded = (d: ArrayLike<number>, stride = 1, off = 0) => { let w = 0; for (let c = 0; c < N; c++) if (m.count[c] && d[c * stride + off] > m.floodM) w++; return w * cellKm2; };
    const t0 = performance.now();
    let next = 0;
    const gpu = m.preferGpu ? await GpuEngine.create({ grid: m.grid, seaLevel: m.seaLevel, hMin: 0.001, alpha: 0.5, dtMax: 15, tEnd: total, rain: m.rain, inflowCells: m.inflowCells, inflowQ: m.inflowQ, inflowDt: m.inflowDt }).catch(() => null) : null;
    post({ type: "engine", gpu: !!gpu });
    if (gpu) {
      let st = await gpu.state(), batch = 50;
      while (st.t < total - 1e-3) {
        const b0 = performance.now();
        gpu.steps(batch);
        st = await gpu.state();
        batch = Math.max(10, Math.min(2000, Math.round(batch * (250 / Math.max(1, performance.now() - b0))))); // about 4 updates per second
        if (st.t >= next || st.t >= total - 1e-3) {
          const hh = await gpu.depths(), d = new Float32Array(N);
          for (let c = 0; c < N; c++) d[c] = hh[2 * c];
          post({ type: "frame", t: st.t, depth: d, floodedKm2: flooded(d) }, [d.buffer]);
          while (next <= st.t) next += m.frameS;
        }
        post({ type: "progress", t: st.t, total });
      }
      const hh = await gpu.depths(), mx = new Float32Array(N);
      for (let c = 0; c < N; c++) mx[c] = hh[2 * c + 1];
      const me = await gpu.massError(m.grid.active);
      const s = await gpu.state();
      gpu.destroy();
      post({ type: "done", maxDepth: mx, massError: me, wallMs: performance.now() - t0, totals: s.totals, gpu: true }, [mx.buffer]);
      return;
    }
    const e = new FloodEngine(m.grid, { seaLevel: m.seaLevel, inflowCells: m.inflowCells });
    let yieldAt = performance.now() + 200;
    while (e.t < total) {
      e.rate = rainRate(m.rain, e.t) * 3.6e6;
      const k = Math.min((m.inflowQ[0]?.length ?? 1) - 1, Math.floor(e.t / m.inflowDt));
      e.inflows = m.inflowQ.map((q) => q[k]);
      e.step();
      if (e.t >= next || e.t >= total) {
        const d = Float32Array.from(e.h);
        post({ type: "frame", t: e.t, depth: d, floodedKm2: flooded(d) }, [d.buffer]);
        while (next <= e.t) next += m.frameS;
      }
      if (performance.now() > yieldAt) { post({ type: "progress", t: e.t, total }); await new Promise((r) => setTimeout(r, 0)); yieldAt = performance.now() + 200; }
    }
    const mx = Float32Array.from(e.hMax);
    post({ type: "done", maxDepth: mx, massError: e.massError(), wallMs: performance.now() - t0, totals: { ...e.totals }, gpu: false }, [mx.buffer]);
  } catch (err) {
    post({ type: "error", message: String((err as Error)?.message ?? err) });
  }
};
