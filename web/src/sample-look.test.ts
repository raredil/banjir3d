import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, SAMPLE_VIEW, boxFromCorners, boxKm, parseBox, depthColorExpr, parseLook, sampleCenter, sampleOutline, zoomForWidth } from "./sample-look";

describe("sample look helpers", () => {
  it("falls back to the default look for unknown values", () => {
    expect(parseLook("grey")).toBe("grey");
    expect(parseLook("nope")).toBe(DEFAULT_LOOK);
    expect(parseLook(null)).toBe(DEFAULT_LOOK);
  });
  it("keeps the depth ramp stops strictly ascending for every slider level", () => {
    for (let level = 1; level <= 15; level += 0.5) {
      const e = depthColorExpr(level);
      const stops = e.slice(3).filter((_, i) => i % 2 === 0) as number[];
      for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
    }
  });
  it("closes the sample outline and finds its centre", () => {
    const b = [106.812, -6.26, 106.902, -6.17];
    const ring = sampleOutline(b).geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(sampleCenter(b)[0]).toBeCloseTo(106.857, 3);
  });
  it("keeps the desktop zoom on wide maps and zooms out on phones", () => {
    expect(zoomForWidth(1100)).toBe(SAMPLE_VIEW.zoom);
    expect(zoomForWidth(390)).toBeLessThan(SAMPLE_VIEW.zoom - 1);
  });
});

describe("user-drawn area", () => {
  const region = [106.595, -6.462, 107.064, -5.998];
  it("orders the corners and clips the box to the region", () => {
    expect(boxFromCorners([106.9, -6.1], [106.5, -6.3], region)).toEqual([106.595, -6.3, 106.9, -6.1]);
  });
  it("rejects boxes that are too small or outside the region", () => {
    expect(boxFromCorners([106.8, -6.2], [106.801, -6.201], region)).toBeNull();
    expect(boxFromCorners([100, 0], [101, 1], region)).toBeNull();
  });
  it("parses deep links and rejects bad input", () => {
    expect(parseBox("106.812,-6.26,106.902,-6.17", region)).toEqual([106.812, -6.26, 106.902, -6.17]);
    expect(parseBox("1,2,3", region)).toBeNull();
    expect(parseBox("<x>", region)).toBeNull();
  });
  it("measures a 10 km sample as about 10 km", () => {
    const [w, h] = boxKm([106.812, -6.26, 106.902, -6.17]);
    expect(w).toBeGreaterThan(9.5); expect(w).toBeLessThan(10.5);
    expect(h).toBeGreaterThan(9.5); expect(h).toBeLessThan(10.5);
  });
});
