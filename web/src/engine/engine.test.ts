import { describe, expect, it } from "vitest";
import { FloodEngine, retention, scsRunoff, type EngineGrid } from "./solver";
import { DT_S, arealReduction, catchmentHydrograph, entryMembers, findEntries, inflowsFor, inflowsForSpatial, nrcsLagHours, uhRatio, type Streams } from "./hydrology";
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
  it("starts with the initial depth and counts it in the water balance", () => {
    const g = grid(10, 10, 10, () => 0, { h0: new Float64Array(100).fill(0.2) });
    const e = new FloodEngine(g);
    expect(e.h[55]).toBeCloseTo(0.2, 9);
    run(e, 300);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
  });
  it("lets rain on an edge cell leave (free outflow, review 2026-11-20 M-03)", () => {
    // tilted plane under steady rain, outflow east: kinematic depth h = (i x n / sqrt S)^0.6 also at the last cell
    const nx = 50, dx = 30, S = 0.01, nM = 0.03, iMmH = 50;
    const z = Float64Array.from({ length: nx }, (_, i) => (i === 0 ? 100 : (nx - i) * dx * S));
    const e = new FloodEngine({ nx, ny: 1, dx, z, n: new Float64Array(nx).fill(nM), active: new Uint8Array(nx).fill(1) });
    e.rate = iMmH;
    run(e, 4 * 3600);
    const kin = (c: number) => ((iMmH / 3.6e6) * c * dx * nM / Math.sqrt(S)) ** 0.6;
    expect(e.h[49]).toBeLessThan(1.3 * kin(50)); // was 0.209 m (all rain kept) against 0.047 m
    expect(e.h[40] / kin(40)).toBeGreaterThan(0.7);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
  });
  it("keeps a lake at rest", () => {
    // west column is a wall: an open edge where the ground falls outward drains freely (M-03), which is not what this test checks
    const g = grid(20, 20, 10, (i) => (i === 0 ? 5 : 0.1 * i));
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
  it("areal reduction factor (TP-29 fit) matches hand values and its range limits", () => {
    // by hand: D = 6 h, A = 350 km2: e = 1.1 * 6^0.25 = 1.72158; 1 - exp(-e) + exp(-e - 1.365) = 1 - 0.17882 + 0.04566 = 0.8668
    expect(arealReduction(350, 6)).toBeCloseTo(0.8668, 3);
    // D = 24 h, A = 1000 km2: e = 2.43443; 1 - 0.08764 + 0.00178 = 0.9141
    expect(arealReduction(1000, 24)).toBeCloseTo(0.9141, 3);
    expect(arealReduction(0, 6)).toBe(1);
    expect(arealReduction(5000, 24)).toBeCloseTo(arealReduction(1000, 24), 12); // beyond TP-29: held at 1,000 km2
    expect(arealReduction(350, 72)).toBeCloseTo(arealReduction(350, 24), 12);
  });

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
    // design rain: each entry's runoff volume equals the reduced depth over its area (ARF from the full catchment area)
    const steps = 300, cum = Float64Array.from({ length: steps + 1 }, (_, s) => Math.min(150, (s * DT_S) / 3600 * 25));
    const f = inflowsFor(st, (x) => x === 1 || x === 3, cum, steps, (c) => c, 6);
    const g = f.find((v) => v.stream === 2)!;
    expect(g.arf).toBeCloseTo(arealReduction(30, 6), 12);
    const vol = g.q.reduce((a, v) => a + v * DT_S, 0);
    expect(vol / ((scsRunoff(150 * g.arf, retention(80)) / 1000) * 20e6)).toBeCloseTo(1, 3);
    expect(inflowsFor(st, (x) => x === 1 || x === 3, cum, steps).every((v) => v.arf === 1)).toBe(true);
  });
  it("gives each entry the rain of its own catchment", () => {
    // two tributaries 0 -> 1 and 2 -> 3 enter at 1 and 3 (cells 4 and 5 are inside)
    const st: Streams = {
      x: Float32Array.from([0, 1, 10, 11, 2, 12]), y: new Float32Array(6), down: Int32Array.from([1, 4, 3, 5, -1, -1]),
      area: Float32Array.from([5, 6, 5, 6, 7, 7]), cn: new Float32Array(6).fill(90), slope: new Float32Array(6).fill(5), len: new Float32Array(6).fill(2000),
    };
    const isIn = (x: number) => x === 2 || x === 12;
    expect(Array.from(entryMembers(st, isIn, [1, 3]))).toEqual([0, 0, 1, 1, -1, -1]);
    const steps = 24, wet = Float64Array.from({ length: steps + 1 }, (_, s) => 4 * s), dry = new Float64Array(steps + 1);
    const f = inflowsForSpatial(st, isIn, (k) => (st.x[k] < 5 ? wet : dry), steps);
    expect(f.find((v) => v.stream === 1)!.rainMm).toBe(96);
    expect(f.find((v) => v.stream === 3)!.rainMm).toBe(0);
    expect(Math.max(...f.find((v) => v.stream === 3)!.q)).toBe(0);
  });
  it("inverts UTM", () => {
    const u = toUtm(106.8456, -6.2088, 48);
    const g = fromUtm(u.easting, u.northing, 48, true);
    expect(g.lon).toBeCloseTo(106.8456, 7);
    expect(g.lat).toBeCloseTo(-6.2088, 7);
  });
});

describe("building porosity (dual-grid fine runs)", () => {
  const mk = (por: boolean) => {
    const nx = 16, ny = 12, N = nx * ny, g = grid(nx, ny, 10, (i, j) => 0.02 * i + 0.01 * j, { cn: new Float64Array(N).fill(90) });
    if (por) {
      const phi = new Float64Array(N), psiX = new Float64Array(N), psiY = new Float64Array(N), rainW = new Float64Array(N);
      for (let c = 0; c < N; c++) { phi[c] = 0.3 + 0.7 * ((c * 7919) % 13) / 12; psiX[c] = 0.2 + 0.8 * ((c * 104729) % 11) / 10; psiY[c] = 0.5; rainW[c] = c % 2 ? 1.2 : 0.8; }
      Object.assign(g, { phi, psiX, psiY, rainW });
    }
    return g;
  };
  it("equals the plain engine when every share is one", () => {
    const g = mk(false), N = g.nx * g.ny;
    const a = new FloodEngine(g, { inflowCells: [40] });
    const b = new FloodEngine({ ...g, phi: new Float64Array(N).fill(1), psiX: new Float64Array(N).fill(1), psiY: new Float64Array(N).fill(1), rainW: new Float64Array(N).fill(1) }, { inflowCells: [40] });
    for (const e of [a, b]) { e.rate = 80; e.inflows = [2]; run(e, 1800); }
    let d = 0;
    for (let c = 0; c < N; c++) d = Math.max(d, Math.abs(a.h[c] - b.h[c]));
    expect(d).toBe(0);
  });
  it("conserves mass with storage and face shares, roof rain routing, inflow and open edges", () => {
    const e = new FloodEngine(mk(true), { inflowCells: [40] });
    e.rate = 80; e.inflows = [2];
    run(e, 1800); e.rate = 0; e.inflows = [0]; run(e, 3600);
    expect(Math.abs(e.massError())).toBeLessThan(1e-9);
    expect(e.totals.outflow).toBeGreaterThan(0);
    for (let c = 0; c < e.h.length; c++) expect(e.h[c]).toBeGreaterThanOrEqual(0);
  });
  it("blocks flow across a closed face", () => {
    const nx = 10, ny = 1, N = nx, g = grid(nx, ny, 10, () => 0);
    const psiX = new Float64Array(N).fill(1); psiX[4] = 0; g.psiX = psiX; g.phi = new Float64Array(N).fill(1);
    const e = new FloodEngine(g);
    for (let c = 0; c < 5; c++) e.h[c] = 1;
    run(e, 600);
    for (let c = 5; c < N; c++) expect(e.h[c]).toBe(0);
  });
});

describe("soil wetness (antecedent runoff condition)", () => {
  it("classes and curve numbers follow Chow et al. 1988", async () => {
    const { amcClass, cnForAmc } = await import("./hydrology");
    expect([amcClass(10), amcClass(40), amcClass(60)]).toEqual([1, 2, 3]);
    expect(cnForAmc(75, 2)).toBe(75);
    expect(cnForAmc(75, 1)).toBeCloseTo(55.75, 1); // 4.2*75/(10-4.35)
    expect(cnForAmc(75, 3)).toBeCloseTo(87.3, 1); // 23*75/(10+9.75)
    expect(cnForAmc(100, 1)).toBe(100);
  });
});
