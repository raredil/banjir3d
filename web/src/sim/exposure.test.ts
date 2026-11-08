import { describe, expect, it } from "vitest";
import { exposureCells, exposureSums, type Exposure } from "./exposure";

// 4 x 2 pack cells, two kecamatan (west, east); run grid k = 2 over the whole pack: 2 x 1 run cells
const x: Exposure = {
  units: [{ name: "Barat", kota: "A", province: "ID-JK", buildings: 0, people: 0 }, { name: null, kota: "B", province: "ID-JB", buildings: 0, people: 0 }],
  nx: 4, ny: 2, header: {},
  kec: Uint8Array.from([1, 1, 2, 2, 1, 1, 2, 2]), bld: Uint16Array.from([1, 0, 3, 0, 2, 0, 0, 5]), pop: Uint16Array.from([10, 25, 0, 0, 0, 0, 40, 0]),
};

describe("exposure", () => {
  const cells = exposureCells(x, { nx: 2, ny: 1, k: 2, i0: 0, j0: 0 });
  it("keeps only cells with buildings or people, with their run cell", () => {
    expect(Array.from(cells.cell)).toEqual([0, 0, 1, 0, 1, 1]);
    expect(cells.pop.reduce((a, v) => a + v, 0)).toBeCloseTo(7.5);
  });
  it("sums flooded cells per unit, largest first", () => {
    const s = exposureSums(x, cells, [0.5, 0.1], [1, 1], 0.15);
    expect(s.buildings).toBe(3);
    expect(s.people).toBeCloseTo(3.5);
    expect(s.perUnit.map((u) => u.unit.name)).toEqual(["Barat"]);
    const all = exposureSums(x, cells, [0.5, 0.5], [1, 1], 0.15);
    expect(all.perUnit.map((u) => u.unit.kota)).toEqual(["B", "A"]);
  });
  it("skips cells not counted (channels, sea)", () => {
    expect(exposureSums(x, cells, [0.5, 0.5], [0, 1], 0.15).buildings).toBe(8);
  });
});

describe("exposure on fine runs", () => {
  // r = 2 over the west 2 x 1 pack cells: run grid 4 x 2; pack cell 0 holds 1 building and 1 person
  const run = { nx: 4, ny: 2, k: 1, i0: 0, j0: 0, r: 2 };
  it("spreads a 30 m cell's buildings and people over its counted fine cells (no double counting)", () => {
    const count = Uint8Array.from([1, 0, 1, 1, 1, 1, 1, 1]); // run cell 1 is a building footprint
    const c = exposureCells(x, run, count);
    const wet = new Float32Array(8).fill(0.5);
    expect(exposureSums(x, c, wet, count, 0.15).buildings).toBeCloseTo(1, 6); // whole pack cell 0 flooded: 1 building, not 3
    const half = Float32Array.from([0.5, 0, 0, 0, 0, 0, 0, 0]); // one of its three counted cells
    expect(exposureSums(x, c, half, count, 0.15).buildings).toBeCloseTo(1 / 3, 6);
  });
});
