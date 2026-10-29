import { describe, expect, it } from "vitest";
import { alternatingBlock, constantRain, mononobeDepth, parseHourly, rainRate, totalMm } from "./rain";

describe("rain input", () => {
  it("Mononobe depth reaches R24 at 24 h and follows the 1/3 power", () => {
    expect(mononobeDepth(377, 24)).toBeCloseTo(377, 9);
    expect(mononobeDepth(100, 3)).toBeCloseTo(50, 9); // (3/24)^(1/3) = 0.5
  });
  it("alternating block keeps the Mononobe total and puts the peak in the middle", () => {
    const h = alternatingBlock(377, 24);
    expect(h.mm).toHaveLength(24);
    expect(totalMm(h)).toBeCloseTo(377, 6);
    const peak = Math.max(...h.mm);
    expect(h.mm.indexOf(peak)).toBe(11);
    expect(peak).toBeCloseTo(377 * Math.cbrt(1 / 24), 6);
    expect(h.mm[12]).toBeGreaterThan(h.mm[10]); // second block right of the peak, third left
    expect(totalMm(alternatingBlock(377, 6))).toBeCloseTo(mononobeDepth(377, 6), 6);
  });
  it("parses typed hourly depths and rejects bad input", () => {
    expect(parseHourly("10, 20.5 0;5")?.mm).toEqual([10, 20.5, 0, 5]);
    expect(parseHourly("")).toBeNull();
    expect(parseHourly("10, -2")).toBeNull();
    expect(parseHourly("1e3")).toBeNull();
    expect(parseHourly("<script>")).toBeNull();
    expect(parseHourly("600")).toBeNull();
  });
  it("converts blocks to a rate and stops after the last block", () => {
    const c = constantRain(100, 3);
    expect(rainRate(c, 0)).toBeCloseTo(100 / 3.6e6, 15);
    expect(rainRate(c, 3 * 3600 + 1)).toBe(0);
  });
});
