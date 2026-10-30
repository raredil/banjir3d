import { describe, expect, it } from "vitest";
import { FloodEngine, retention, scsRunoff, type EngineGrid } from "./solver";
import { DT_S, catchmentHydrograph, findEntries, nrcsLagHours, uhRatio, type Streams } from "./hydrology";
import { fromUtm, toUtm } from "../util";

function grid(nx: number, ny: number, dx: number, zf: (i: number, j: number) => number, extra: Partial<EngineGrid> = {}): EngineGrid {
  const N = nx * ny, z = new Float64Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = zf(i, j);
  return { nx, ny, dx, z, n: new Float64Array(N).fill(0.03), active: new Uint8Array(N).fill(1), ...extra };
}
const run = (e: FloodEngine, s: number) => { while (e.t < s) e.step(); };

describe("NRCS curve number", () => {
  it("matches TR-55 worked values", () => {
    expect(retention(100)).toBe(0);
    expect(scsRunoff(100, retention(80))).toBeCloseTo(50.5, 1); // TR-55 eq. 2-3: P = 3.94 in, S = 2.5 in -> Q = 1.99 in
    expect(scsRunoff(10, retention(70))).toBe(0); // below the initial abstraction 0.2 S = 21.8 mm
  });
});

describe("flood engine v2 (CPU reference)", () => {
  it("keeps a lake at rest", () => {
    const g = grid(20, 20, 10, (i) => 0.1 * i);
    const e = new FloodEngine(g);
    for (let c = 0; c < 400; c++) e.h[c] = Math.max(0, 1.5 - g.z[c]);
    const h0 = Float64Array.from(e.h);
    run(e, 900);
    let d = 0;
    for (let c = 0; c < 400; c++) d = Math.max(d, Math.abs(e.h[c] - h0[c]));
    expect(d).toBeLessThan(1e-6);
  });
  it("conserves mass with curve-number runoff and open edges", () => {
    const N = 900, cn = new Float64Array(N).fill(85);
    const e = new FloodEngine(grid(30, 30, 30, (i, j) => 0.01 * i + 0.005 * j, { cn }));
    e.rate = 60;
    run(e, 3600); e.rate = 0; run(e, 7200);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
    expect(e.totals.infiltration).toBeGreaterThan(0);
    expect(e.totals.outflow).toBeGreaterThan(0);
    // 60 mm on CN 85: runoff 60 -> scsRunoff(60, S(85)) = 22.2 mm, the rest infiltrates
    expect(e.totals.infiltration / e.totals.rain).toBeCloseTo(1 - scsRunoff(60, retention(85)) / 60, 3);
  });
  it("rains per zone and drains through city drains, mass kept", () => {
    const nx = 20, ny = 20, N = nx * ny, zone = new Uint16Array(N), drain = new Float64Array(N);
    for (let c = 0; c < N; c++) { zone[c] = c % nx < 10 ? 0 : 1; drain[c] = c % nx >= 10 ? 5 / 3.6e6 : 0; } // 5 mm/h on the east half
    const e = new FloodEngine(grid(nx, ny, 30, () => 0, { zone, drain, active: new Uint8Array(N).fill(1) }));
    e.rates = [0, 20];
    run(e, 1800);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
    expect(e.h[5 * nx + 2]).toBe(0); // west half: no rain, far from the wet half
    expect(e.totals.rain).toBeCloseTo(0.5 * N * 900 * 0.01, 6); // 10 mm on half the cells
    expect(e.totals.drain / e.totals.rain).toBeGreaterThan(0.2);
    expect(e.totals.drain / e.totals.rain).toBeLessThan(0.26); // capacity 5 of 20 mm/h, a little spreads west
  });
  it("holds the sea level and drains a river into the sea", () => {
    const nx = 40, ny = 5, N = nx * ny, sea = new Uint8Array(N);
    for (let j = 0; j < ny; j++) for (let i = 30; i < nx; i++) sea[j * nx + i] = 1;
    const e = new FloodEngine(grid(nx, ny, 20, (i) => (i < 30 ? 0.02 * (30 - i) : -2), { sea }), { inflowCells: [2 * nx], seaLevel: 0 });
    e.inflows = [5];
    run(e, 6 * 3600);
    expect(e.h[2 * nx + 35]).toBeCloseTo(2, 6);
    expect(e.totals.sea).toBeGreaterThan(0); // grid edges are open too, so the rest leaves there
    expect((e.totals.sea + e.totals.outflow) / e.totals.inflow).toBeGreaterThan(0.9);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
  });
  it("treats the edge of the run area as open, cells outside as dry", () => {
    const nx = 20, ny = 20, N = nx * ny, active = new Uint8Array(N).fill(1);
    for (let j = 0; j < ny; j++) for (let i = 15; i < nx; i++) active[j * nx + i] = 0;
    const e = new FloodEngine(grid(nx, ny, 10, (i) => -0.05 * i, { active }));
    for (let c = 0; c < N; c++) if (active[c]) e.h[c] = 0.5;
    run(e, 1800);
    expect(e.totals.outflow).toBeGreaterThan(0);
    for (let c = 0; c < N; c++) if (!active[c]) expect(e.h[c]).toBe(0);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
  });
});

describe("upstream hydrology", () => {
  it("unit hydrograph table peaks at t = Tp", () => {
    expect(uhRatio(1)).toBe(1);
    expect(uhRatio(0.55)).toBeCloseTo(0.565, 3);
    expect(uhRatio(6)).toBe(0);
  });
  it("keeps the runoff volume of the catchment", () => {
    const steps = 400, cum = new Float64Array(steps + 1);
    for (let k = 1; k <= steps; k++) cum[k] = Math.min(100, (k * DT_S) / 3600 * 25); // 25 mm/h for 4 h
    const q = catchmentHydrograph(50, 80, nrcsLagHours(15000, 80, 5), cum, steps);
    const vol = q.reduce((a, v) => a + v * DT_S, 0);
    expect(vol / (scsRunoff(100, retention(80)) / 1000 * 50e6)).toBeCloseTo(1, 3);
  });
  it("NRCS lag grows with length and falls with slope", () => {
    expect(nrcsLagHours(20000, 85, 5)).toBeGreaterThan(nrcsLagHours(10000, 85, 5));
    expect(nrcsLagHours(20000, 85, 15)).toBeLessThan(nrcsLagHours(20000, 85, 5));
  });
  it("counts a river once when it leaves the area and comes back", () => {
    // stream 0 -> 1 -> 2 -> 3 -> 4; inside = cells 1 and 3; tributary area joins at 2 (outside)
    const st: Streams = {
      x: Float32Array.from([0, 1, 2, 3, 4]), y: new Float32Array(5), down: Int32Array.from([1, 2, 3, 4, -1]),
      area: Float32Array.from([10, 11, 30, 31, 32]), cn: new Float32Array(5).fill(80), slope: new Float32Array(5).fill(5), len: new Float32Array(5).fill(1000),
    };
    const e = findEntries(st, (x) => x === 1 || x === 3);
    expect(e.map((v) => [v.stream, v.effKm2])).toEqual([[2, 20], [0, 10]]);
  });
  it("inverts UTM", () => {
    const u = toUtm(106.8456, -6.2088, 48);
    const g = fromUtm(u.easting, u.northing, 48, true);
    expect(g.lon).toBeCloseTo(106.8456, 7);
    expect(g.lat).toBeCloseTo(-6.2088, 7);
  });
});
