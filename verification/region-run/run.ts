// Run the v2 engine (CPU reference) on the real engine pack. Usage (from web/):
//   npx vite-node ../verification/region-run/run.ts <engine_pack.bin.gz> <outdir> [--k 3] [--r24 377] [--hours 30] [--box W,S,E,N]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildRun, parsePack } from "../../web/src/engine/pack";
import { FloodEngine } from "../../web/src/engine/solver";
import { DT_S, inflowsFor } from "../../web/src/engine/hydrology";
import { alternatingBlock, rainRate } from "../../web/src/explore/rain";

const a = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const [packFile, out] = a;
mkdirSync(out, { recursive: true });
const raw = gunzipSync(readFileSync(packFile));
const pack = parsePack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const k = Number(opt("k", "3")), hours = Number(opt("hours", "30")), r24 = Number(opt("r24", "377"));
const box = opt("box", "") ? opt("box", "").split(",").map(Number) : null;
const run = buildRun(pack, box, k);
const hy = alternatingBlock(r24, 24);
const steps = Math.ceil((hours * 3600) / DT_S);
const cum = new Float64Array(steps + 1);
for (let s = 1; s <= steps; s++) { let p = cum[s - 1]; for (let t = (s - 1) * DT_S; t < s * DT_S; t += 60) p += (rainRate(hy, t) * 60) * 1000; cum[s] = p; }
const inflows = inflowsFor(pack.streams, run.isIn, cum, steps).map((f) => ({ ...f, cell: run.cellAt(f.x, f.y) })).filter((f) => f.cell >= 0);
const e = new FloodEngine({ nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: run.cn, active: run.active, sea: run.sea }, { inflowCells: inflows.map((f) => f.cell) });
const t0 = Date.now();
let nsteps = 0;
while (e.t < hours * 3600) {
  e.rate = rainRate(hy, e.t) * 3.6e6;
  const s = Math.min(steps - 1, Math.floor(e.t / DT_S));
  e.inflows = inflows.map((f) => f.q[s]);
  e.step(); nsteps++;
  if (nsteps % 2000 === 0) console.log(`t=${(e.t / 3600).toFixed(2)} h  dt=${e.dtNow().toFixed(2)}  wall=${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
writeFileSync(`${out}/hmax.f32`, Buffer.from(Float32Array.from(e.hMax).buffer));
let wet = 0, peak = 0;
for (let c = 0; c < e.hMax.length; c++) if (run.active[c] && !run.sea[c] && !run.channel[c]) { if (e.hMax[c] > 0.15) wet++; peak = Math.max(peak, e.hMax[c]); }
const summary = { nx: run.nx, ny: run.ny, dx: run.dx, k, r24, hours, steps: nsteps, wall_s: (Date.now() - t0) / 1000, massError: e.massError(), totals: e.totals,
  flooded_km2_gt015_outside_channels: (wet * run.dx * run.dx) / 1e6, peak_m: peak, utm: run.utm, corners: run.corners,
  inflows: inflows.map((f) => ({ areaKm2: +f.areaKm2.toFixed(1), cn: +f.cn.toFixed(1), lagH: +f.lagH.toFixed(2), peakQ: +Math.max(...f.q).toFixed(1), x: f.x, y: f.y })) };
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, inflows: summary.inflows.slice(0, 8) }));
