import { describe, expect, it } from "vitest";
import { applySensitivity, smoothNoise, SENS_RE } from "./sensitivity";
import type { RunGrid } from "./pack";

const grid = (nx: number, ny: number): RunGrid => {
  const N = nx * ny;
  return {
    nx, ny, dx: 90, k: 3, i0: 0, j0: 0, r: 1, building: null, z: new Float64Array(N).fill(5), n: new Float64Array(N).fill(0.1), cn: new Float64Array(N).fill(98),
    active: new Uint8Array(N).fill(1), sea: new Uint8Array(N), channel: new Uint8Array(N), built: new Float64Array(N).fill(0.5), h0: null, pump: null, mdr: null,
    corners: [[0, 0], [0, 0], [0, 0], [0, 0]], utm: { zone: 48, x0: 0, y0: 0 }, isIn: () => true, cellAt: () => 0,
  };
};

describe("sensitivity variants (review R-08)", () => {
  it("accepts only the listed variants", () => {
    for (const s of ["none", "n0.7", "n1.3", "cnb92", "dem1", "dem10"]) expect(SENS_RE.test(s)).toBe(true);
    for (const s of ["n2", "dem0", "dem11", "dem1;rm", ""]) expect(SENS_RE.test(s)).toBe(false);
    expect(() => applySensitivity(grid(4, 4), "n9")).toThrow();
  });
  it("scales roughness and lowers the built curve number by its share", () => {
    const g = grid(4, 4);
    expect(applySensitivity(g, "n1.3").n[0]).toBeCloseTo(0.13, 12);
    expect(applySensitivity(g, "cnb92").cn[0]).toBeCloseTo(95, 12); // half built: 98 - 6 x 0.5
    expect(g.n[0]).toBe(0.1); // input untouched
  });
  it("adds a smooth terrain error of 0.5 m standard deviation that repeats with the seed", () => {
    const g = grid(120, 100), a = applySensitivity(g, "dem3"), b = applySensitivity(g, "dem3"), c = applySensitivity(g, "dem4");
    const dz = Array.from(a.z, (v) => v - 5), m = dz.reduce((s, v) => s + v, 0) / dz.length;
    const sd = Math.sqrt(dz.reduce((s, v) => s + (v - m) ** 2, 0) / dz.length);
    expect(Math.abs(m)).toBeLessThan(1e-9);
    expect(sd).toBeCloseTo(0.5, 6);
    expect(a.z[777]).toBe(b.z[777]);
    expect(a.z[777]).not.toBe(c.z[777]);
    // smooth: neighbours alike (lag-1 correlation high), far cells not
    let s1 = 0, s9 = 0, n = 0;
    for (let j = 0; j < 100; j++) for (let i = 0; i < 100; i++) { const k = j * 120 + i; s1 += dz[k] * dz[k + 1]; s9 += dz[k] * dz[k + 20]; n++; }
    expect(s1 / n / 0.25).toBeGreaterThan(0.9);
    expect(Math.abs(s9 / n / 0.25)).toBeLessThan(0.3);
  });
  it("leaves sea cells alone", () => {
    const g = grid(10, 10); g.sea[5] = 1;
    expect(applySensitivity(g, "dem1").z[5]).toBe(5);
    expect(smoothNoise(3, 1, 0, 1, 1, [1, 1, 1]).length).toBe(3);
  });
});
