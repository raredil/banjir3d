import { describe, expect, it } from "vitest";
import { depthTiff } from "./export";
import { downscale, fineResult } from "./flood-layer";

const g = { nx: 4, ny: 3, dx: 30, zone: 48, x0: 676380, y0: 9336780, z: new Float32Array(12), mask: new Uint8Array(12).fill(1) };

describe("exports", () => {
  it("writes a little-endian GeoTIFF with EPSG:32748 keys", () => {
    const d = Float32Array.from({ length: 12 }, (_, i) => i / 10);
    const b = depthTiff(g, d);
    expect(String.fromCharCode(b[0], b[1])).toBe("II");
    expect(b[2]).toBe(42);
    const dv = new DataView(b.buffer);
    expect(dv.getFloat32(b.length - 4, true)).toBeCloseTo(1.1, 6); // last cell
  });
  it("downscaling never invents water between dry cells and keeps wet cells' depth at their centres", () => {
    const d = new Float32Array(12); d[5] = 1;
    const f = downscale(g, g.z, d, g.mask, 3);
    expect(f[(1 * 3 + 1) * 12 + 1 * 3 + 1]).toBeCloseTo(1, 6); // centre of cell (1,1)
    expect(Math.max(...f.slice(0, 12))).toBe(0); // the first fine row only sees the dry cells of row 0
  });
  it("draws a river that stays in its channel as no flood, and water above its banks as a smooth sheet (ADR 0018)", () => {
    const h = { nx: 3, ny: 1, channel: Uint8Array.from([0, 1, 0]) }, z = Float32Array.from([5, 1, 5]);
    const inBank = downscale(h, z, Float32Array.from([0, 3.5, 0]), new Uint8Array(3).fill(1), 3);
    expect(Math.max(...inBank)).toBe(0); // water surface 4.5 m is below the banks (5 m): the river itself, not a flood
    const over = downscale(h, z, Float32Array.from([0, 5, 0]), new Uint8Array(3).fill(1), 3);
    expect(over[4]).toBeCloseTo(1, 6); // channel centre: 6 m surface over the 5 m bank level
    expect(over[3]).toBeCloseTo(1, 6); // no square edge at the channel cell border: the same surface over the same ground
    const old = downscale({ nx: 3, ny: 1 }, z, Float32Array.from([0, 3.5, 0]), new Uint8Array(3).fill(1), 3); // without channel flags the bed is blended in
    expect(old[2]).toBeGreaterThan(0.5);
  });
  it("exports a drawing-grid fine result on its fine cells with buildings dry and the 30 m water surface (ADR 0018)", () => {
    const z = Float32Array.from([2, 2]), building = new Uint8Array(6 * 3); building[0] = 1;
    const geom = { nx: 2, ny: 1, dx: 30, zone: 48, x0: 0, y0: 0, z, mask: Uint8Array.from([1, 1]), channel: new Uint8Array(2),
      fine: { r: 3, s: 3, nx: 6, ny: 3, dx: 10, building, drawOnly: true, base: { nx: 2, ny: 1, z, channel: new Uint8Array(2) } } };
    const { grid, depth } = fineResult(geom, Float32Array.from([0.5, 0.5]));
    expect([grid.nx, grid.ny, grid.dx]).toEqual([6, 3, 10]);
    expect(depth[0]).toBe(0); // building
    expect(depth[4]).toBeCloseTo(0.5, 6);
  });
});
