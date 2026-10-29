import { describe, expect, it } from "vitest";
import { gridWindow, latToPy, lonToPx, pxToLat, pxToLon, terrarium } from "./dem-grid";
import { clampScenario, DEFAULT_SCENARIO, riverCells } from "./scenario";

describe("DEM window geometry", () => {
  it("round-trips lon/lat and pixel coordinates", () => {
    expect(pxToLon(lonToPx(106.857))).toBeCloseTo(106.857, 9);
    expect(pxToLat(latToPy(-6.215))).toBeCloseTo(-6.215, 9);
  });
  it("covers the 10 x 10 km sample with about 38 m square cells", () => {
    const w = gridWindow([106.812, -6.26, 106.902, -6.17]);
    expect(w.nx).toBeGreaterThan(255);
    expect(w.nx).toBeLessThan(275);
    expect(w.ny).toBeGreaterThan(255);
    expect(w.ny).toBeLessThan(275);
    expect(w.dx).toBeGreaterThan(37.5);
    expect(w.dx).toBeLessThan(38.5);
    expect(w.corners[0][0]).toBeLessThanOrEqual(106.812);
    expect(w.corners[1][0]).toBeGreaterThanOrEqual(106.902);
    expect(w.corners[0][1]).toBeGreaterThanOrEqual(-6.17);
    expect(w.corners[2][1]).toBeLessThanOrEqual(-6.26);
  });
  it("decodes Terrarium heights", () => {
    expect(terrarium(128, 0, 0)).toBe(0);
    expect(terrarium(128, 10, 128)).toBeCloseTo(10.5, 6);
  });
});

describe("scenario helpers", () => {
  it("puts the inflow on the lowest south-edge cell and its neighbours", () => {
    const nx = 6, ny = 3, z = new Float64Array(nx * ny).fill(5);
    z[(ny - 1) * nx + 3] = 1;
    expect(riverCells(z, nx, ny)).toEqual([2, 3, 4].map((i) => (ny - 1) * nx + i));
  });
  it("clamps scenario values to safe ranges", () => {
    const c = clampScenario({ ...DEFAULT_SCENARIO, rainMmH: 9999, totalHours: -3, manning: NaN });
    expect(c.rainMmH).toBe(300);
    expect(c.totalHours).toBe(1);
    expect(c.manning).toBe(0.01);
  });
});
