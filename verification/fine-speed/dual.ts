// Fine-run speed/accuracy check (ADR 0016). From web/: npx vite-node ../verification/fine-speed/dual.ts <engine_pack.bin.gz> <buildings_overture.pmtiles> <r> <rc> <hours> [box]
// r = fine cells per 30 m side, rc = compute cells (rc = r: building blocks). Writes hmax_r<r>_rc<rc>.f32 and bld_r<r>.u8 here; compare.py compares.
import { readFileSync, openSync, readSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildDualRun, buildFineRun, fineGround, parsePack } from "../../web/src/engine/pack";
import { FloodEngine } from "../../web/src/engine/solver";
import { buildingMask } from "../../web/src/sim/buildings";
import { alternatingBlock, rainRate } from "../../web/src/explore/rain";
const [packF, pmF, rS, rcS, hS, boxS] = process.argv.slice(2);
const raw = gunzipSync(readFileSync(packF));
const p = parsePack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const box = (boxS ?? "106.8575,-6.2295,106.8665,-6.2205").split(",").map(Number);
const fd = openSync(pmF, "r");
const src = { getKey: () => pmF, getBytes: async (o: number, l: number) => { const b = Buffer.alloc(l); readSync(fd, b, 0, l, o); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + l) }; } };
const r = Number(rS), rc = Number(rcS), hours = Number(hS);
const g0 = buildFineRun(p, box, r, 2026);
const bm = await buildingMask(src as never, g0);
const t0 = Date.now();
const run = buildDualRun(p, box, r, rc, 2026, bm.mask);
const prep = Date.now() - t0;
const e = new FloodEngine({ nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: run.cn, active: run.active, sea: run.sea, h0: run.h0 ?? undefined, phi: run.phi, psiX: run.psiX, psiY: run.psiY, rainW: run.rainW }, {});
const hy = alternatingBlock(377, 24);
let n = 0; const t1 = Date.now();
while (e.t < hours * 3600) { e.rate = rainRate(hy, e.t) * 3.6e6; e.step(); n++; }
const s = (Date.now() - t1) / 1000;
// fine-grid max depth (water level of the compute cell minus fine ground; no downscaling interpolation here)
const nfx = g0.nx, nfy = g0.ny, f = r / rc, hf = new Float32Array(nfx * nfy);
let wet = 0, land = 0;
for (let J = 0; J < nfy; J++) for (let I = 0; I < nfx; I++) {
  const F = J * nfx + I;
  let d = 0;
  if (rc === r) { if (run.building?.[F] || !run.active[F] || run.sea[F]) continue; d = e.hMax[F]; }
  else { if (run.fine!.building[F]) continue; const C = Math.floor(J / f) * run.nx + Math.floor(I / f); if (!run.active[C] || run.sea[C]) continue; d = Math.max(0, run.z[C] + e.hMax[C] - fineGround(run.fine!.base, r, I, J)); }
  hf[F] = d; land++; if (d > 0.15) wet++;
}
writeFileSync(`./bld_r${r}.u8`, Buffer.from(g0.nx ? bm.mask.buffer : new ArrayBuffer(0)));
writeFileSync(`./hmax_r${r}_rc${rc}.f32`, Buffer.from(hf.buffer));
console.log(JSON.stringify({ r, rc, chan: Array.from(run.channel).reduce((a, b) => a + b, 0), compute: [run.nx, run.ny, run.dx], prepMs: prep, steps: n, wallS: s, mcs: +(n * run.nx * run.ny / s / 1e6).toFixed(1), mass: e.massError(), floodedShare: +(wet / land).toFixed(3), tot: Object.fromEntries(Object.entries(e.totals).map(([k, v]) => [k, Math.round(v)])), stored: Math.round(e.volume()), meanPhi: run.phi ? +(run.phi.reduce((a, b) => a + b, 0) / run.phi.length).toFixed(3) : 1 }));
