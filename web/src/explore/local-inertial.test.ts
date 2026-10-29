import { describe, expect, it } from "vitest";
import { LocalInertial, type Grid } from "./local-inertial";
import { analyticalWave } from "./analytical";

function flat(nx: number, ny: number, d = 10, zf: (i: number, j: number) => number = () => 0): Grid {
  const z = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = zf(i, j);
  return { nx, ny, dx: d, dy: d, z };
}
const run = (s: LocalInertial, seconds: number) => { while (s.t < seconds) s.step(); };

describe("local-inertial solver (exploratory, sanity tests only)", () => {
  it("keeps a lake at rest on a flat bed at rest", () => {
    const s = new LocalInertial(flat(20, 20), {}, new Float64Array(400).fill(1));
    run(s, 600);
    expect(Math.max(...Array.from(s.h)) - 1).toBeLessThan(1e-9);
    expect(Math.min(...Array.from(s.h)) - 1).toBeGreaterThan(-1e-9);
  });
  it("is well balanced: a lake at rest on a sloping bed stays still", () => {
    const g = flat(30, 10, 10, (i) => i * 0.2); // bed 0..5.8 m
    const h0 = new Float64Array(300);
    for (let c = 0; c < 300; c++) h0[c] = Math.max(0, 4 - g.z[c]);
    const s = new LocalInertial(g, {}, h0);
    run(s, 900);
    let drift = 0;
    for (let c = 0; c < 300; c++) drift = Math.max(drift, Math.abs(s.h[c] - h0[c]));
    expect(drift).toBeLessThan(1e-6);
  });
  it("conserves mass with rain and a drainage sink on a closed domain", () => {
    const s = new LocalInertial(flat(30, 30, 20, (i, j) => 0.002 * i + 0.001 * j), { manning: 0.04 });
    s.rain = 50 / 3600 / 1000; s.drain = 10 / 3600 / 1000;
    run(s, 3600);
    expect(Math.abs(s.massError())).toBeLessThan(1e-9);
    expect(s.totals.rain).toBeGreaterThan(0);
    expect(Math.min(...Array.from(s.h))).toBeGreaterThanOrEqual(0);
  });
  it("conserves mass and stays non-negative in a 1D dam break", () => {
    const nx = 80, h0 = new Float64Array(nx * 5);
    for (let j = 0; j < 5; j++) for (let i = 0; i < nx; i++) h0[j * nx + i] = i < 40 ? 2 : 0.5;
    const s = new LocalInertial(flat(nx, 5, 5), { manning: 0.02 }, h0);
    run(s, 20); // the rarefaction wave (about 4.4 m/s) has travelled well under 100 m of the 200 m to the left wall
    expect(Math.abs(s.massError())).toBeLessThan(1e-9);
    expect(Math.min(...Array.from(s.h))).toBeGreaterThanOrEqual(0);
    const mid = 2 * nx;
    expect(s.h[mid + 40]).toBeLessThan(2); // left drops
    expect(s.h[mid + 41]).toBeGreaterThan(0.5); // right rises
    expect(s.h[mid + 5]).toBeGreaterThan(1.99); // far left still untouched
  });
  it("passes an inflow through an open north edge at steady state (outflow = inflow within 5%)", () => {
    const nx = 10, ny = 30, d = 10, slope = 0.01;
    const g = flat(nx, ny, d, (_i, j) => slope * d * j);
    const row = Array.from({ length: nx }, (_, i) => (ny - 1) * nx + i);
    const s = new LocalInertial(g, { manning: 0.03, openEdges: ["n"], inflowCells: row });
    s.inflow = 10; // m3/s over 100 m of width = 0.1 m2/s
    run(s, 2400);
    const t0 = s.totals.outflow, tt = s.t;
    run(s, tt + 600);
    const rate = (s.totals.outflow - t0) / (s.t - tt);
    expect(Math.abs(rate - 10) / 10).toBeLessThan(0.05);
    expect(Math.abs(s.massError())).toBeLessThan(1e-9);
  });
  it("follows the Hunter et al. (2005) analytical wave over a dry horizontal plane", () => {
    const a = analyticalWave({ n: 0.03, u: 1, dx: 50, theta: 1, length: 5000, seconds: 3600 });
    expect(a.rmse / a.h0).toBeLessThan(0.02);
    expect(Math.abs(a.frontModel - a.frontTrue)).toBeLessThanOrEqual(100);
    const b = analyticalWave({ n: 0.15, u: 0.5, dx: 38, theta: 1, length: 3000, seconds: 3600 });
    expect(b.rmse / b.h0).toBeLessThan(0.05);
  });
  it("lets water leave through every open edge and none through walls", () => {
    // bed falls by 1 % towards the open edge; a transmissive edge passes the flow that arrives, a flat lake at rest stays
    const down = { n: (_i: number, j: number) => 0.1 * j, s: (_i: number, j: number) => 0.1 * (19 - j), w: (i: number) => 0.1 * i, e: (i: number) => 0.1 * (19 - i) };
    for (const e of ["n", "s", "w", "e"] as const) {
      const s = new LocalInertial(flat(20, 20, 10, down[e]), { manning: 0.03, openEdges: [e] }, new Float64Array(400).fill(0.5));
      run(s, 1800);
      expect(s.totals.outflow).toBeGreaterThan(0);
      expect(Math.abs(s.massError())).toBeLessThan(1e-9);
    }
    const closed = new LocalInertial(flat(20, 20, 10, down.n), { manning: 0.03 }, new Float64Array(400).fill(0.5));
    run(closed, 1800);
    expect(closed.totals.outflow).toBe(0);
  });
});
