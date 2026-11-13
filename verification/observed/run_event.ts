// Run engine v2 (CPU reference) on an observed event: hourly rain per 0.1 degree reanalysis cell (fetch.py), each catchment with
// its own rain, and the city-drain sink on built-up cells. Usage (from web/):
//   npx vite-node ../verification/observed/run_event.ts <engine.bin.gz> <rain_era5_land.json> <start UTC> <hours> <outdir>
//       [--k 3] [--drain 0] [--scale 1] [--box W,S,E,N] [--year auto|none|<decimal year>] [--pumps on|off] [--micro on|off] [--upstream on|off] [--amc 1|2|3] [--infil on|off]
// --amc: soil wetness before the storm (antecedent runoff condition, Chow et al. 1988), applied to the cells and the upstream catchments.
// --infil off: no infiltration at all (every drop runs off; what-if for paved green space).
// --drain: drainage capacity (mm/h) on a fully built cell, scaled by the built-area share; 0 on channels and sea.
// --upstream off: no river inflow from the catchments upstream of the run area (local rain only; source attribution runs).
// --pumps: polder pump sink from the engine pack (Jakarta Satu pump capacities per polder), on by default when the pack has it.
// --micro: South Jakarta micro-drain sink from the engine pack (pipeline/micro_drains.py), off by default.
// --year: terrain year for the land subsidence shift (auto = event start; none = terrain as measured). --scale: rain multiplier (1 = reanalysis as it is). Writes hmax.f32 (row-major, run grid), mask.u8 and summary.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildRun, parsePack } from "../../web/src/engine/pack";
import { FloodEngine } from "../../web/src/engine/solver";
import { DT_S, cnForAmc, inflowsForSpatial } from "../../web/src/engine/hydrology";
import { fromUtm } from "../../web/src/util";

const a = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const [packFile, rainFile, startUtc, hoursS, out] = a;
const hours = Number(hoursS), k = Number(opt("k", "3")), drainMmH = Number(opt("drain", "0")), scale = Number(opt("scale", "1")), pumpsOn = opt("pumps", "on") !== "off", microOn = opt("micro", "off") === "on", upOn = opt("upstream", "on") !== "off";
const amc = Number(opt("amc", "2")) as 1 | 2 | 3, infilOn = opt("infil", "on") !== "off";
if (![1, 2, 3].includes(amc)) throw new Error("--amc must be 1, 2 or 3");
const cnOf = (v: number) => cnForAmc(v, amc);
mkdirSync(out, { recursive: true });
const raw = gunzipSync(readFileSync(packFile));
const pack = parsePack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const box = opt("box", "") ? opt("box", "").split(",").map(Number) : null;
const yOpt = opt("year", "auto");
const decYear = (ms: number) => { const y = new Date(ms).getUTCFullYear(), a0 = Date.UTC(y, 0, 1); return y + (ms - a0) / (Date.UTC(y + 1, 0, 1) - a0); };
const terrainYear = yOpt === "none" || !pack.sub ? undefined : yOpt === "auto" ? decYear(Date.parse(startUtc)) : Number(yOpt);
const run0 = buildRun(pack, box, k, terrainYear);
const run = amc === 2 ? run0 : { ...run0, cn: run0.cn.map(cnOf) };

// hourly rain per point; value at time T is the rain of the hour ending at T
type Pt = { lon: number; lat: number; time: string[]; mm: (number | null)[] };
const pts = (JSON.parse(readFileSync(rainFile, "utf8")).points as Pt[]);
const t0 = Date.parse(startUtc), H = Math.ceil(hours);
const hourly = pts.map((p) => {
  const v = new Float64Array(H);
  p.time.forEach((t, m) => { const h = Math.round((Date.parse(t + "Z") - t0) / 3.6e6) - 1; if (h >= 0 && h < H) v[h] = (p.mm[m] ?? 0) * scale; });
  return v;
});
const lons = [...new Set(pts.map((p) => p.lon))].sort((x, y) => x - y), lats = [...new Set(pts.map((p) => p.lat))].sort((x, y) => x - y);
const idx = new Map(pts.map((p, m) => [`${p.lon},${p.lat}`, m]));
const near = (v: number, arr: number[]) => arr.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b), arr[0]);
const pointAt = (lon: number, lat: number) => idx.get(`${near(lon, lons)},${near(lat, lats)}`)!;

// rain zone per run cell (nearest reanalysis point)
const N = run.nx * run.ny, zone = new Uint16Array(N);
for (let J = 0; J < run.ny; J++) for (let I = 0; I < run.nx; I++) {
  const g = fromUtm(run.utm.x0 + (I + 0.5) * run.dx, run.utm.y0 - (J + 0.5) * run.dx, run.utm.zone, true);
  zone[J * run.nx + I] = pointAt(g.lon, g.lat);
}
// cumulative rain (mm) at the hydrograph steps, per point
const steps = Math.ceil((hours * 3600) / DT_S);
const cumOf = hourly.map((v) => { const c = new Float64Array(steps + 1); for (let s = 1; s <= steps; s++) c[s] = c[s - 1] + v[Math.min(H - 1, Math.floor(((s - 0.5) * DT_S) / 3600))] * (DT_S / 3600); return c; });
const stPoint = new Int32Array(pack.streams.x.length);
for (let m = 0; m < stPoint.length; m++) {
  const g = fromUtm(pack.ox + pack.streams.x[m], pack.oy - pack.streams.y[m], pack.zone, true);
  stPoint[m] = pointAt(g.lon, g.lat);
}
const inflows = !upOn ? [] : inflowsForSpatial(pack.streams, run.isIn, (m) => cumOf[stPoint[m]], steps, cnOf).map((f) => ({ ...f, cell: run.cellAt(f.x, f.y) })).filter((f) => f.cell >= 0);
const drain = new Float64Array(N);
for (let c = 0; c < N; c++) {
  if (!run.channel[c] && !run.sea[c]) drain[c] = (drainMmH / 3.6e6) * run.built[c];
  if (pumpsOn && run.pump && !run.sea[c]) drain[c] += run.pump[c]; // polder pumps (Jakarta Satu), see engine_pack.pump_rates
  if (microOn && run.mdr && !run.channel[c] && !run.sea[c]) drain[c] += run.mdr[c]; // micro drains (pipeline/micro_drains.py)
}

const e = new FloodEngine({ nx: run.nx, ny: run.ny, dx: run.dx, z: run.z, n: run.n, cn: infilOn ? run.cn : undefined, active: run.active, sea: run.sea, zone, drain, ...(run.h0 ? { h0: run.h0 } : {}) }, { inflowCells: inflows.map((f) => f.cell) });
const w0 = Date.now();
let nsteps = 0;
while (e.t < hours * 3600) {
  const h = Math.min(H - 1, Math.floor(e.t / 3600));
  e.rates = hourly.map((v) => v[h]);
  const s = Math.min(steps - 1, Math.floor(e.t / DT_S));
  e.inflows = inflows.map((f) => f.q[s]);
  e.step(); nsteps++;
  if (nsteps % 4000 === 0) console.log(`t=${(e.t / 3600).toFixed(2)} h  dt=${e.dtNow().toFixed(2)}  wall=${((Date.now() - w0) / 1000).toFixed(0)} s`);
}
writeFileSync(`${out}/hmax.f32`, Buffer.from(Float32Array.from(e.hMax).buffer));
writeFileSync(`${out}/mask.u8`, Uint8Array.from({ length: N }, (_, c) => run.active[c] | (run.sea[c] << 1) | (run.channel[c] << 2) | ((run.mdr?.[c] ?? 0) > 0 ? 8 : 0))); // bit0 active, bit1 sea, bit2 channel, bit3 served by a micro drain (whether on or off)
let wet = 0, cnt = 0, rainSum = 0;
for (let c = 0; c < N; c++) if (run.active[c] && !run.sea[c]) { cnt++; rainSum += cumOf[zone[c]][steps]; if (!run.channel[c] && e.hMax[c] > 0.15) wet++; }
const summary = {
  pack: pack.header.created, rain: rainFile.split("/").pop(), start_utc: startUtc, hours, k, dx: run.dx, nx: run.nx, ny: run.ny, drain_mm_h: drainMmH, upstream: upOn, amc, infiltration: infilOn, pumps: pumpsOn && !!run.pump, micro: microOn && !!run.mdr, micro_m3s: run.mdr && microOn ? Math.round(run.mdr.reduce((a, v, c) => a + (run.sea[c] || run.channel[c] ? 0 : v), 0) * run.dx * run.dx * 10) / 10 : 0, pump_m3s: run.pump ? Math.round(run.pump.reduce((a, v, c) => a + (run.sea[c] ? 0 : v), 0) * run.dx * run.dx * 10) / 10 : 0, rain_scale: scale, terrain_year: terrainYear ?? null, terrain_epoch: pack.sub ? pack.subEpoch : null,
  steps: nsteps, wall_s: (Date.now() - w0) / 1000, massError: e.massError(), totals: e.totals, built_share_known: !!pack.built,
  mean_rain_mm: rainSum / cnt, flooded_km2_gt015_outside_channels: (wet * run.dx * run.dx) / 1e6, utm: run.utm, corners: run.corners,
  inflows: inflows.slice(0, 12).map((f) => ({ areaKm2: +f.areaKm2.toFixed(1), rainMm: +f.rainMm.toFixed(1), peakQ: +Math.max(...f.q).toFixed(1), x: f.x, y: f.y })),
};
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, inflows: summary.inflows.slice(0, 5) }));
