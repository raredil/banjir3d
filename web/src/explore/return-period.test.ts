import { describe, expect, it } from "vitest";
import { RP, RP_OPTIONS, returnPeriodOf } from "./return-period";

// data/rain/design_rain_jakarta.json from release design-rain-jakarta-20261120-r5 (GPM IMERG 2001-2024, log-Pearson III)
describe("return-period design rain", () => {
  it("offers 2-100 years, rising, rounded to the 5 mm slider step", () => {
    expect(RP_OPTIONS.map((o) => o.years)).toEqual([2, 5, 10, 25, 50, 100]);
    expect(RP_OPTIONS.map((o) => o.mm)).toEqual([90, 110, 125, 145, 160, 175]);
    for (const o of RP_OPTIONS) expect(o.min).toBeLessThanOrEqual(o.max);
  });
  it("records its source", () => {
    expect(RP.product).toBe("GPM IMERG V07");
    expect(RP.years).toEqual([2001, 2024]);
    expect(RP.dist).toBe("lp3");
    expect(RP.gaugeRatio).toBeCloseTo(1.371, 3);
  });
  it("names the return period only for a 24 h storm of exactly that total", () => {
    expect(returnPeriodOf(175, 24)).toBe(100);
    expect(returnPeriodOf(175, 6)).toBeNull();
    expect(returnPeriodOf(170, 24)).toBeNull();
  });
});
