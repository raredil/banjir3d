import { describe, expect, it } from "vitest";
import { floodPlaces } from "./places";

describe("floodPlaces", () => {
  it("separates river overflow from rain ponding and measures how low the flooded ground lies", () => {
    // 30 x 10 cells of 30 m: a river in column 2 whose water rises 1 m above the banks (west patch), and a closed hollow far east
    const nx = 30, ny = 10, N = nx * ny, z = new Float64Array(N).fill(5), channel = new Uint8Array(N), land = new Float32Array(N).fill(1), max = new Float32Array(N);
    for (let j = 0; j < ny; j++) {
      const c = j * nx + 2; channel[c] = 1; land[c] = 0; max[c] = 1.0; // surface 6 m over 5 m banks
      for (const i of [1, 3, 4]) max[j * nx + i] = 0.8;
      for (const i of [24, 25, 26]) { z[j * nx + i] = 3; max[j * nx + i] = 0.6; } // hollow 2 m below its surroundings, no river near
    }
    const ps = floodPlaces({ nx, ny, dx: 30, z, channel, land, max }, { floodM: 0.15, lonLat: () => ({ lon: 0, lat: 0 }) });
    expect(ps.length).toBe(3); // the channel splits the river banks into two patches
    const river = ps.filter((p) => p.riverShare > 0.5), hollow = ps.find((p) => p.riverShare < 0.2)!;
    expect(river.length).toBe(2);
    expect(Math.max(...river.map((p) => p.areaKm2))).toBeCloseTo((2 * 10 * 900) / 1e6, 6);
    expect(hollow.reliefM!).toBeCloseTo(-2, 6);
    expect(hollow.nearShare).toBe(0);
  });
});
