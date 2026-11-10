// Fine cells vs 30 m consistency check. From web/: npx vite-node ../verification/fine-consistency/run.ts <engine_pack.bin.gz> <buildings.pmtiles> <out.json> [box] [r24 dur hours]
// Runs one box at 30 m (no buildings), and at fine cells (building blocks and dual grid), the same rain and upstream inflows as
// the app's design storm, and compares the maximum water level and depth per 30 m cell.
import { readFileSync, openSync, readSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildDualRun, buildFineRun, buildRun, inflowSpread, parsePack, CHANNEL, type RunGrid } from "../../web/src/engine/pack";
import { FloodEngine } from "../../web/src/engine/solver";
import { DT_S, inflowsFor } from "../../web/src/engine/hydrology";
import { buildingMask } from "../../web/src/sim/buildings";
import { alternatingBlock, rainRate } from "../../web/src/explore/rain";
import { fineResult } from "../../web/src/sim/flood-layer";

const [packF, pmF, outF, boxS, r24S, durS, hS, casesS] = process.argv.slice(2);
const raw = gunzipSync(readFileSync(packF));
const p = parsePack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
if (process.env.OLD === "1") { const nOld = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength); const hl = new DataView(nOld.buffer, nOld.byteOffset).getUint32(0, true); const h = JSON.parse(new TextDecoder().decode(nOld.subarray(4, 4 + hl))); const d = h.arrays.find((a: { name: string }) => a.name === "n"); for (let c = 0; c < p.n.length; c++) if (p.flags[c] & CHANNEL) p.n[c] = nOld[4 + hl + d.offset + c] / 1000; }
const box = (boxS || "106.8575,-6.2295,106.8665,-6.2205").split(",").map(Number);
const r24 = Number(r24S || 150), dur = Number(durS || 6), hours = Number(hS || 12);
const hy = alternatingBlock(r24, dur);
const fd = openSync(pmF, "r");
const src = { getKey: () => pmF, getBytes: async (o: number, l: number) => { const b = Buffer.alloc(l); readSync(fd, b, 0, l, o); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + l) }; } };
const steps = Math.ceil((hours * 3600) / DT_S);
const cum = new Float64Array(steps + 1);
for (let s = 1; s <= steps; s++) cum[s] = cum[s - 1] + rainRate(hy, (s - 0.5) * DT_S) * 1000 * DT_S;
const year = 2026.8;

type Case = { name: string; r: number; rc: number; blocks: boolean };
const cases: Case[] = (casesS || "30:1:1:0,10b:3:3:1,10p:3:1:1,5p:6:3:1,2p:15:5:1").split(",").map((s) => { const [name, r, rc, b] = s.split(":"); return { name, r: +r, rc: +rc, blocks: b === "1" }; });

function engineFor(run: RunGrid) {
  // OLD=1 reproduces the app before 2026-11-10: channel roughness of the land cover, inflow into one run cell
  const old = process.env.OLD === "1";
  const ents = inflowsFor(p.streams, run.isIn, cum, steps).map((f) => ({ ...f, cell: run.cellAt(f.x, f.y) })).filter((f) => f.cell >= 0);
  const inflows: { cell: number; q: Float64Array }[] = [];
  for (const f of ents) { const sp = old ? { cells: [f.cell], w: [1] } : inflowSpread(run, f.cell); sp.cells.forEach((c, m) => inflows.push({ cell: c, q: f.q.map((v) => v * sp.w[m]) })); }
  const e = new FloodEngine({ nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: run.cn, active: run.active, sea: run.sea, ...(run.h0 ? { h0: run.h0 } : {}), ...(run.phi ? { phi: run.phi, psiX: run.psiX, psiY: run.psiY, rainW: run.rainW } : {}) }, { inflowCells: inflows.map((f) => f.cell) });
  return { e, inflows, entries: ents.length };
}

const base = buildRun(p, box, 1, year);
const PN = base.nx * base.ny;
const out: Record<string, unknown> = { box, r24, dur, hours, grid30: [base.nx, base.ny] };
const per30: Record<string, { wse: Float64Array; dep: Float64Array; wet: Float64Array }> = {};
for (const cs of cases) {
  let run: RunGrid;
  let bld: Uint8Array | null = null;
  if (cs.r === 1) run = base;
  else {
    const g0 = buildFineRun(p, box, cs.r, year);
    bld = cs.blocks ? (await buildingMask(src as never, g0)).mask : new Uint8Array(g0.nx * g0.ny);
    run = cs.rc === cs.r ? buildFineRun(p, box, cs.r, year, bld) : buildDualRun(p, box, cs.r, cs.rc, year, bld);
  }
  const { e, inflows, entries } = engineFor(run);
  const t0 = Date.now();
  let n = 0;
  while (e.t < hours * 3600) {
    e.rate = rainRate(hy, e.t) * 3.6e6;
    const s = Math.min(steps - 1, Math.floor(e.t / DT_S));
    e.inflows = inflows.map((f) => f.q[s]);
    e.step(); n++;
  }
  const wall = (Date.now() - t0) / 1000;
  // max depth on the cells the map draws (fine cells for every fine run), then per 30 m cell: mean depth over open (non-building)
  // land cells and the share of them deeper than 0.15 m
  let fx: number, fy: number, fdep: Float32Array, fmask: Uint8Array, fz: Float32Array;
  const dmax = Float32Array.from(e.hMax);
  if (run.fine) {
    const N = run.nx * run.ny, mask = new Uint8Array(N);
    for (let c = 0; c < N; c++) mask[c] = +(run.active[c] && !run.sea[c] && (!run.phi || run.phi[c] > 0) && !run.building?.[c]);
    const fr = fineResult({ nx: run.nx, ny: run.ny, dx: run.dx, zone: 48, x0: 0, y0: 0, z: Float32Array.from(run.z), mask, fine: run.fine }, dmax);
    fx = fr.grid.nx; fy = fr.grid.ny; fdep = fr.depth; fmask = fr.grid.mask; fz = fr.grid.z;
  } else {
    fx = run.nx; fy = run.ny; fdep = dmax; fz = Float32Array.from(run.z); fmask = new Uint8Array(fx * fy);
    for (let c = 0; c < fx * fy; c++) fmask[c] = +(run.active[c] && !run.sea[c] && !run.building?.[c]);
  }
  const rr = cs.r;
  const wse = new Float64Array(PN), dep = new Float64Array(PN), wet = new Float64Array(PN), cnt = new Float64Array(PN);
  for (let J = 0; J < fy; J++) for (let I = 0; I < fx; I++) {
    const F = J * fx + I; if (!fmask[F]) continue;
    const P = Math.floor(J / rr) * base.nx + Math.floor(I / rr);
    cnt[P]++; dep[P] += fdep[F]; wse[P] += fdep[F] > 0.01 ? fz[F] + fdep[F] : NaN; wet[P] += +(fdep[F] > 0.15);
  }
  for (let P = 0; P < PN; P++) if (cnt[P]) { dep[P] /= cnt[P]; wet[P] /= cnt[P]; wse[P] /= cnt[P]; }
  per30[cs.name] = { wse, dep, wet };
  let land = 0, wetS = 0, depS = 0;
  for (let P = 0; P < PN; P++) if (base.active[P] && !base.sea[P] && !base.channel[P] && cnt[P]) { land++; wetS += wet[P]; depS += dep[P]; }
  const T = e.totals;
  out[cs.name] = { r: cs.r, rc: cs.rc, blocks: cs.blocks, compute: [run.nx, run.ny, +run.dx.toFixed(2)], steps: n, wall_s: wall, mass: e.massError(),
    flooded_share: +(wetS / land).toFixed(3), mean_depth_m: +(depS / land).toFixed(3), inflow_m3: Math.round(T.inflow), rain_m3: Math.round(T.rain), outflow_m3: Math.round(T.outflow), infil_m3: Math.round(T.infiltration), stored_m3: Math.round(e.volume()), n_inflows: entries, inflow_cells: inflows.length };
  console.log(cs.name, JSON.stringify(out[cs.name]));
  writeFileSync(`${outF}.${cs.name}.f32`, Buffer.from(fdep.buffer));
  writeFileSync(`${outF}.${cs.name}.json`, JSON.stringify({ nx: fx, ny: fy }));
}
// agreement with the 30 m run per 30 m land cell
const ref = per30["30"];
if (ref) for (const k of Object.keys(per30)) {
  if (k === "30") continue;
  const a = per30[k];
  let n = 0, se = 0, bias = 0, hit = 0, fa = 0, miss = 0;
  for (let P = 0; P < PN; P++) {
    if (!base.active[P] || base.sea[P] || base.channel[P]) continue;
    const d = a.dep[P] - ref.dep[P]; n++; se += d * d; bias += d;
    const w1 = ref.wet[P] > 0.5, w2 = a.wet[P] > 0.5;
    if (w1 && w2) hit++; else if (w2) fa++; else if (w1) miss++;
  }
  (out[k] as Record<string, unknown>).vs30 = { mean_depth_diff_m: +(bias / n).toFixed(3), rmse_m: +Math.sqrt(se / n).toFixed(3), csi: +(hit / Math.max(1, hit + fa + miss)).toFixed(3), hit, false_alarm: fa, miss };
  console.log(k, "vs 30 m", JSON.stringify((out[k] as Record<string, unknown>).vs30));
}
writeFileSync(outF, JSON.stringify(out, null, 1));
