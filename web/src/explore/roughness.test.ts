import { describe, expect, it } from "vitest";
import { classify, nFieldFromCodes, nOfClass } from "./roughness";

describe("WorldCover roughness", () => {
  it("classifies the official palette colours", () => {
    expect(classify(0xfa, 0x00, 0x00)).toBe(50); // built-up
    expect(classify(0x00, 0x64, 0x00)).toBe(10); // tree cover
    expect(classify(0x00, 0x64, 0xc8)).toBe(80); // water
    expect(classify(0xf8, 0x05, 0x03)).toBe(50); // tolerant to small colour shifts
  });
  it("uses built-up n 0.15 (effective value for a bare-earth DEM), not the smooth-channel 0.018", () => {
    expect(nOfClass(50, "n")).toBe(0.15);
    expect(nOfClass(50, "low")).toBeLessThan(nOfClass(50, "n"));
    expect(nOfClass(50, "high")).toBeGreaterThan(nOfClass(50, "n"));
  });
  it("averages class n over each model cell and supports a uniform field", () => {
    const f = 2, nx = 1, ny = 1;
    const codes = new Uint8Array([50, 50, 30, 30]); // half built-up (0.15), half grass (0.033)
    expect(nFieldFromCodes(codes, nx, ny, f, "n")[0]).toBeCloseTo((0.15 + 0.033) / 2, 9);
    expect(nFieldFromCodes(codes, nx, ny, f, "uniform")[0]).toBe(0.05);
    expect(nFieldFromCodes(new Uint8Array(4), nx, ny, f, "n")[0]).toBe(0.15); // no data falls back to the default
  });
});
