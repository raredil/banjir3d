import { describe, expect, it } from "vitest";
import { cumAtSteps, meanHyetograph, pointAt, zoneGrid, type EventRain } from "./event-rain";
import { DT_S } from "./hydrology";
import { toUtm } from "../util";

const ev = { lon: [106.7, 106.8], lat: [-6.3, -6.2], mm: [[10, 0], [20, 0], [30, 0], [40, 10]] };

describe("observed-event rain", () => {
  it("picks the nearest point, rows south to north", () => {
    expect(pointAt(ev, 106.71, -6.29)).toBe(0);
    expect(pointAt(ev, 106.79, -6.29)).toBe(1);
    expect(pointAt(ev, 106.71, -6.21)).toBe(2);
    expect(pointAt(ev, 107.5, -5.0)).toBe(3); // outside: edge point
  });
  it("zones a UTM grid by the nearest point", () => {
    const sw = toUtm(106.66, -6.34, 48), dx = 300;
    const g = { nx: 60, ny: 60, dx, utm: { zone: 48, x0: sw.easting, y0: sw.northing + 60 * dx } };
    const z = zoneGrid(ev, g);
    expect(z[59 * 60]).toBe(0); // SW corner cell
    expect(z[59]).toBe(3); // NE corner cell
  });
  it("accumulates hourly rain at the hydrograph steps", () => {
    const c = cumAtSteps([12, 6], (2 * 3600) / DT_S);
    expect(c[0]).toBe(0);
    expect(c[3600 / DT_S]).toBeCloseTo(12);
    expect(c[(2 * 3600) / DT_S]).toBeCloseTo(18);
  });
  it("averages the rain over the counted cells", () => {
    const hy = meanHyetograph(ev, Uint16Array.from([0, 0, 3, 1]), [1, 1, 1, 0]);
    expect(hy.mm[0]).toBeCloseTo((10 + 10 + 40) / 3);
    expect(hy.mm[1]).toBeCloseTo(10 / 3);
  });
  it("ships complete event files (full grid, run window, report counts)", () => {
    const files = Object.values(import.meta.glob<EventRain>("../../../data/events/*_imerg.json", { import: "default", eager: true }));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const e of files) {
      expect(e.mm.length).toBe(e.lon.length * e.lat.length);
      expect(e.mm.every((v) => v.length === e.hours && v.every((x) => x >= 0 && x < 300))).toBe(true);
      expect(e.reports.n).toBeGreaterThan(0);
    }
  });
});
