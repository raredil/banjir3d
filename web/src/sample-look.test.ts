import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, SAMPLE_VIEW, depthColorExpr, parseLook, sampleCenter, sampleOutline, zoomForWidth } from "./sample-look";

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
