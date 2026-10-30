// Developer page (not in the production build): GPU solver vs CPU reference on real terrain. Open /verify-gpu.html?box=W,S,E,N&hours=H
// &zones=1: west and east half get different rain (east half 50 %); &drain=D: drains of D mm/h on built cells (all cells without a share).
import { buildRun, loadPack } from "./engine/pack";
import { FloodEngine } from "./engine/solver";
import { GpuEngine } from "./engine/gpu";
import { DT_S, inflowsFor } from "./engine/hydrology";
import { alternatingBlock, rainRate } from "./explore/rain";

const q = new URLSearchParams(location.search);
const out = document.querySelector("#out")!;
(async () => {
  const pack = await loadPack("data/jakarta/engine_jakarta.bin.gz");
  const box = (q.get("box") ?? "106.83,-6.25,106.87,-6.21").split(",").map(Number);
  const hours = Number(q.get("hours") ?? 3), k = Number(q.get("k") ?? 1);
  const run = buildRun(pack, box, k);
  const hy = alternatingBlock(377, 24);
  const steps = Math.ceil((hours * 3600) / DT_S), cum = new Float64Array(steps + 1);
  for (let s = 1; s <= steps; s++) { let p = cum[s - 1]; for (let t = (s - 1) * DT_S; t < s * DT_S; t += 60) p += rainRate(hy, t) * 60 * 1000; cum[s] = p; }
  const inflows = inflowsFor(pack.streams, run.isIn, cum, steps).map((f) => ({ ...f, cell: run.cellAt(f.x, f.y) })).filter((f) => f.cell >= 0);
  const zones = q.get("zones") === "1", drainMmH = Number(q.get("drain") ?? 0), N = run.nx * run.ny;
  const zone = zones ? Uint16Array.from({ length: N }, (_, c) => +(c % run.nx >= run.nx / 2)) : undefined;
  const drain = drainMmH > 0 ? Float64Array.from({ length: N }, (_, c) => (run.channel[c] || run.sea[c] ? 0 : (drainMmH / 3.6e6) * (pack.built ? run.built[c] : 1))) : undefined;
  const zoneMm = zones ? [hy.mm, hy.mm.map((v) => v * 0.5)] : undefined;
  const grid = { nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: run.cn, active: run.active, sea: run.sea, zone, drain };
  // CPU: rain rate per block is constant, inflow per DT_S step (same discretisation as the GPU)
  const cpu = new FloodEngine(grid, { inflowCells: inflows.map((f) => f.cell) });
  let t0 = performance.now();
  while (cpu.t < hours * 3600) {
    cpu.rate = rainRate(hy, cpu.t) * 3.6e6;
    if (zoneMm) cpu.rates = zoneMm.map((mm) => rainRate({ blockSeconds: hy.blockSeconds, mm }, cpu.t) * 3.6e6);
    const s = Math.min(steps - 1, Math.floor(cpu.t / DT_S));
    cpu.inflows = inflows.map((f) => f.q[s]);
    cpu.step();
  }
  const cpuMs = performance.now() - t0;
  const gpu = await GpuEngine.create({ grid, seaLevel: 0, hMin: 0.001, alpha: 0.5, dtMax: 15, tEnd: hours * 3600, rain: hy, inflowCells: inflows.map((f) => f.cell), inflowQ: inflows.map((f) => f.q), inflowDt: DT_S, zoneMm });
  if (!gpu) { out.textContent = "no WebGPU"; (window as any).__result = { error: "no webgpu" }; return; }
  t0 = performance.now();
  let st = await gpu.state();
  while (st.t < hours * 3600 - 1e-3) { gpu.steps(200); st = await gpu.state(); }
  const gpuMs = performance.now() - t0;
  const hh = await gpu.depths();
  let se = 0, n = 0, mx = 0, wetC = 0, wetG = 0, both = 0;
  for (let c = 0; c < cpu.h.length; c++) {
    if (!run.active[c]) continue;
    const a = cpu.hMax[c], b = hh[2 * c + 1];
    const d = Math.abs(a - b); se += d * d; n++; mx = Math.max(mx, d);
    const wa = a > 0.15, wb = b > 0.15; if (wa) wetC++; if (wb) wetG++; if (wa && wb) both++;
  }
  const r = { cells: n, nx: run.nx, ny: run.ny, dx: run.dx, hours, inflows: inflows.length, cpuMs, gpuMs, rmseMax: Math.sqrt(se / n), maxAbsMax: mx,
    csi: both / (wetC + wetG - both), cpuMass: cpu.massError(), gpuMass: await gpu.massError(run.active), cpuT: cpu.t, gpuT: st.t, zones, drainMmH, cpuDrain: cpu.totals.drain, gpuDrain: st.totals.drain };
  out.textContent = JSON.stringify(r, null, 1);
  (window as any).__result = r;
})().catch((e) => { out.textContent = String(e?.stack ?? e); (window as any).__result = { error: String(e) }; });
