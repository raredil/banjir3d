import { describe, expect, it } from "vitest";
import { depthRgba, overlayScale, paintDepth } from "./palette";

describe("flood depth palette", () => {
  it("is transparent when dry and opaque-ish when deep", () => {
    expect(depthRgba(0)[3]).toBe(0);
    expect(depthRgba(0.01)[3]).toBe(0);
    expect(depthRgba(3)[3]).toBeGreaterThan(0.9);
  });
  it("gets darker and more opaque with depth", () => {
    let prevA = 0, prevB = 999;
    for (const d of [0.05, 0.2, 0.4, 0.8, 1.5, 2.5]) {
      const [, , b, a] = depthRgba(d);
      expect(a).toBeGreaterThanOrEqual(prevA);
      expect(b).toBeLessThanOrEqual(prevB);
      prevA = a; prevB = b;
    }
  });
  it("paints one RGBA pixel per cell", () => {
    const out = new Uint8ClampedArray(8);
    paintDepth(new Float32Array([0, 1]), out);
    expect(out[3]).toBe(0);
    expect(out[7]).toBeGreaterThan(200);
  });
  it("draws every model cell as a block of whole canvas pixels within the texture limit", () => {
    expect(overlayScale(263, 264)).toBe(3);
    expect(overlayScale(45, 38)).toBe(16);
    expect(overlayScale(2000, 80)).toBe(1);
    expect(overlayScale(400, 400) * 400).toBeLessThanOrEqual(1024);
  });
});
