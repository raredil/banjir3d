// Run the Explore solver on the exact grid, DEM and rain written by make_inputs.py.
// Usage (from web/): npx vite-node ../verification/explore-vs-sfincs/run_explore.ts <dir> [--theta 1 --alpha 0.5 --hmin 0.05 --tag parity]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { LocalInertial } from "../../web/src/explore/local-inertial";

const args = process.argv.slice(2);
const dir = args[0];
const opt = (k: string, d: number) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d; };
const tag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : "run";
const meta = JSON.parse(readFileSync(`${dir}/meta.json`, "utf8"));
const buf = readFileSync(`${dir}/dem_north_first.f64`);
const z = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
let manningField: Float64Array | undefined;
if (meta.manning_field && existsSync(`${dir}/manning_north_first.f64`)) { const b = readFileSync(`${dir}/manning_north_first.f64`); manningField = new Float64Array(b.buffer, b.byteOffset, b.byteLength / 8); }
const s = new LocalInertial({ nx: meta.nx, ny: meta.ny, dx: meta.cell_m, dy: meta.cell_m, z }, {
  manning: meta.manning, manningField, theta: opt("theta", 1.0), alpha: opt("alpha", 0.5), hMin: opt("hmin", 0.05), dtMax: 15,
});
const total = meta.hours * 3600, rainEnd = meta.rain_h * 3600, every = 300;
const n = meta.nx * meta.ny;
const frames: Float32Array[] = [Float32Array.from(s.h)];
const hmax = new Float64Array(n);
let next = every, steps = 0;
const t0 = performance.now();
while (s.t < total) {
  s.rain = s.t < rainEnd ? meta.rain_mm_h / 3.6e6 : 0;
  s.step(); steps++;
  for (let c = 0; c < n; c++) if (s.h[c] > hmax[c]) hmax[c] = s.h[c];
  while (s.t >= next - 1e-9 && frames.length < total / every + 1) { frames.push(Float32Array.from(s.h)); next += every; }
}
const out = new Float32Array(frames.length * n);
frames.forEach((f, i) => out.set(f, i * n));
writeFileSync(`${dir}/explore_${tag}_frames.f32`, Buffer.from(out.buffer));
writeFileSync(`${dir}/explore_${tag}_hmax.f64`, Buffer.from(hmax.buffer));
writeFileSync(`${dir}/explore_${tag}.json`, JSON.stringify({ tag, steps, wall_s: (performance.now() - t0) / 1000, mass_error: s.massError(), frames: frames.length, theta: s.theta, alpha: s.alpha, hmin: s.hMin }));
console.log(tag, { steps, wall_s: ((performance.now() - t0) / 1000).toFixed(1), massError: s.massError().toExponential(2), frames: frames.length });
