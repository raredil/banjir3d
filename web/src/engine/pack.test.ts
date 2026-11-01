import { describe, expect, it } from "vitest";
import { buildRun, sinkM, DOMAIN, type Pack } from "./pack";

// 2 x 1 pack: one cell sinking 50 mm/year, one stable; terrain measured in 2013
const pack = (sub: Int16Array | null): Pack => ({
  header: {} as Pack["header"], nx: 2, ny: 1, dx: 30, ox: 700000, oy: 9300000, zone: 48,
  z: Float32Array.from([2, 2]), n: Float32Array.from([0.03, 0.03]), cn: Uint8Array.from([80, 80]), flags: Uint8Array.from([DOMAIN, DOMAIN]),
  built: null, sub, subEpoch: 2013, h0: null,
  streams: { x: new Float32Array(), y: new Float32Array(), down: new Int32Array(), area: new Float32Array(), cn: new Float32Array(), slope: new Float32Array(), len: new Float32Array() },
});

describe("land subsidence shift", () => {
  it("lowers the terrain by rate x years since the terrain epoch", () => {
    const p = pack(Int16Array.from([50, 0]));
    expect(sinkM(p, 0, 2020)).toBeCloseTo(0.35, 6);
    const r = buildRun(p, null, 1, 2020);
    expect(r.z[0]).toBeCloseTo(1.65, 5);
    expect(r.z[1]).toBeCloseTo(2, 5);
  });
  it("carries the initial channel depth into the run grid", () => {
    const p = { ...pack(null), h0: Float32Array.from([0.5, 0]) };
    expect(Array.from(buildRun(p, null, 1).h0!)).toEqual([0.5, 0]);
    expect(buildRun(pack(null), null, 1).h0).toBeNull();
  });
  it("leaves the terrain unchanged without a rate map or a year", () => {
    expect(buildRun(pack(null), null, 1, 2025).z[0]).toBeCloseTo(2, 5);
    expect(buildRun(pack(Int16Array.from([50, 0])), null, 1).z[0]).toBeCloseTo(2, 5);
  });
});
