import { describe, expect, it } from "vitest";
import { depthTiff } from "./export";
import { downscale } from "./flood-layer";

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
});
