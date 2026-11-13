// Time-step factor check: same box, same storm, Courant factor alpha 0.5 (old) vs 0.7 (Bates et al. 2010 recommend 0.7).
// From web/: npx vite-node ../verification/speed/alpha.ts <engine_pack.bin.gz> <out.json> [box] [hours]
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildRun, inflowSpread, parsePack } from "../../web/src/engine/pack";
import { FloodEngine } from "../../web/src/engine/solver";
import { DT_S, inflowsFor } from "../../web/src/engine/hydrology";
import { alternatingBlock, rainRate } from "../../web/src/explore/rain";

const [packF, outF, boxS, hS, kS] = process.argv.slice(2);
const raw = gunzipSync(readFileSync(packF));
const p = parsePack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const box = boxS && boxS !== "region" ? boxS.split(",").map(Number) : null;
const hours = Number(hS || 12), hy = alternatingBlock(150, 6), steps = Math.ceil((hours * 3600) / DT_S);
const cum = new Float64Array(steps + 1);
for (let s = 1; s <= steps; s++) cum[s] = cum[s - 1] + rainRate(hy, (s - 0.5) * DT_S) * 1000 * DT_S;
const run = buildRun(p, box, Number(kS || 1), 2026.8);
const ents = inflowsFor(p.streams, run.isIn, cum, steps).map((f) => ({ ...f, cell: run.cellAt(f.x, f.y) })).filter((f) => f.cell >= 0);
const inflows: { cell: number; q: Float64Array }[] = [];
for (const f of ents) { const sp = inflowSpread(run, f.cell); sp.cells.forEach((c, m) => inflows.push({ cell: c, q: f.q.map((v) => v * sp.w[m]) })); }
const res: Record<string, { wall: number; steps: number; km2: number; hmax: Float64Array; mass: number }> = {};
for (const alpha of [0.5, 0.7]) {
  const e = new FloodEngine({ nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: run.cn, active: run.active, sea: run.sea, ...(run.h0 ? { h0: run.h0 } : {}) }, { inflowCells: inflows.map((f) => f.cell), alpha });
  const t0 = Date.now(); let n = 0;
  while (e.t < hours * 3600) { e.rate = rainRate(hy, e.t) * 3.6e6; const s = Math.min(steps - 1, Math.floor(e.t / DT_S)); e.inflows = inflows.map((f) => f.q[s]); e.step(); n++; }
  let wet = 0;
  for (let c = 0; c < e.hMax.length; c++) if (run.active[c] && !run.sea[c] && !run.channel[c] && e.hMax[c] > 0.15) wet++;
  res[alpha] = { wall: (Date.now() - t0) / 1000, steps: n, km2: (wet * run.dx * run.dx) / 1e6, hmax: e.hMax, mass: e.massError() };
}
const a = res[0.5].hmax, b = res[0.7].hmax;
let se = 0, mx = 0, n = 0, both = 0, either = 0;
for (let c = 0; c < a.length; c++) if (run.active[c] && !run.sea[c]) { const d = b[c] - a[c]; se += d * d; mx = Math.max(mx, Math.abs(d)); n++; const wa = a[c] > 0.15 && !run.channel[c], wb = b[c] > 0.15 && !run.channel[c]; if (wa && wb) both++; if (wa || wb) either++; }
const out = { box, hours, grid: [run.nx, run.ny, run.dx], alpha05: { wall_s: res[0.5].wall, steps: res[0.5].steps, flooded_km2: +res[0.5].km2.toFixed(3), mass: res[0.5].mass }, alpha07: { wall_s: res[0.7].wall, steps: res[0.7].steps, flooded_km2: +res[0.7].km2.toFixed(3), mass: res[0.7].mass }, hmax_rmse_m: +Math.sqrt(se / n).toFixed(4), hmax_maxdiff_m: +mx.toFixed(3), csi: +(both / Math.max(1, either)).toFixed(4) };
console.log(JSON.stringify(out));
writeFileSync(outF, JSON.stringify(out, null, 1));
