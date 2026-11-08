import { describe, expect, it } from "vitest";
import { BUILDING_RAISE_M, buildDualRun, buildFineRun, buildRun, fineGround, packCellOf, sinkM, CHANNEL, DOMAIN, type Pack } from "./pack";
import { fromUtm } from "../util";

// 2 x 1 pack: one cell sinking 50 mm/year, one stable; terrain measured in 2013
const pack = (sub: Int16Array | null): Pack => ({
  header: {} as Pack["header"], nx: 2, ny: 1, dx: 30, ox: 700000, oy: 9300000, zone: 48,
  z: Float32Array.from([2, 2]), n: Float32Array.from([0.03, 0.03]), cn: Uint8Array.from([80, 80]), flags: Uint8Array.from([DOMAIN, DOMAIN]),
  built: null, sub, subEpoch: 2013, h0: null, pump: null,
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
  it("averages the pump sink over a merged block (same m3/s on a full block)", () => {
    const p = { ...pack(null), pump: Float32Array.from([2e-6, 0]) };
    expect(buildRun(p, null, 2).pump![0]).toBeCloseTo(1e-6, 12);
    expect(buildRun(pack(null), null, 1).pump).toBeNull();
  });
  it("leaves the terrain unchanged without a rate map or a year", () => {
    expect(buildRun(pack(null), null, 1, 2025).z[0]).toBeCloseTo(2, 5);
    expect(buildRun(pack(Int16Array.from([50, 0])), null, 1).z[0]).toBeCloseTo(2, 5);
  });
});

describe("fine run grid (cells below 30 m)", () => {
  // 2 x 1 pack: ground 2 m and 4 m; r = 3 gives 6 x 3 cells of 10 m
  const p = pack(null); p.z = Float32Array.from([2, 4]);
  const box = (() => { const a = fromUtm(700000, 9300000, 48, true), b = fromUtm(700060, 9299970, 48, true); return [a.lon + 1e-7, b.lat + 1e-7, b.lon - 1e-7, a.lat - 1e-7]; })();
  it("interpolates the ground bilinearly between pack centres and keeps the pack values at the centres", () => {
    const g = buildFineRun(p, box, 3);
    expect([g.nx, g.ny, g.dx, g.r]).toEqual([6, 3, 10, 3]);
    expect(g.z[1]).toBeCloseTo(2, 6); // centre of pack cell 0 (fine column 1)
    expect(g.z[4]).toBeCloseTo(4, 6); // centre of pack cell 1 (fine column 4)
    expect(g.z[2]).toBeCloseTo(2 + 2 / 3, 6); // a third of the way between the centres
    expect(g.z[0]).toBeCloseTo(2, 6); // outside the outer centre: no extrapolation
    expect(g.z[6 + 2]).toBeCloseTo(g.z[2], 9); // same in every row of a one-row pack
  });
  it("raises building cells as solid blocks and maps run cells back to their pack cell", () => {
    const bld = new Uint8Array(18); bld[0] = 1;
    const g = buildFineRun(p, box, 3, undefined, bld);
    expect(g.building![0]).toBe(1);
    expect(g.z[0]).toBeCloseTo(2 + BUILDING_RAISE_M, 6);
    expect(packCellOf(g, 5)).toEqual([1, 0]);
    expect(packCellOf(buildRun(p, null, 2), 0)).toEqual([1, 1]); // centre of the 2 x 2 block
  });
  it("keeps a channel cell's bed level in all its fine cells", () => {
    const q = pack(null); q.z = Float32Array.from([2, -1]); q.flags = Uint8Array.from([DOMAIN, DOMAIN | CHANNEL]);
    const g = buildFineRun(q, box, 3);
    for (const c of [3, 4, 5, 9, 10, 11, 15, 16, 17]) expect(g.z[c]).toBeCloseTo(-1, 6);
    expect(g.z[2]).toBeCloseTo(2, 6); // land next to the channel is not pulled down by it
  });
});

describe("dual-grid run (porosity compute cells, fine result cells)", () => {
  // 2 x 1 pack, fine r = 6 (5 m, 12 x 6 cells), compute rc = 2 (15 m, 4 x 2 cells): one fine column of buildings across
  // the whole height at fine column 4 (inside compute column 1), and fine column 7 half blocked
  const p = pack(null); p.z = Float32Array.from([2, 4]);
  const box = (() => { const a = fromUtm(700000, 9300000, 48, true), b = fromUtm(700060, 9299970, 48, true); return [a.lon + 1e-7, b.lat + 1e-7, b.lon - 1e-7, a.lat - 1e-7]; })();
  const bld = new Uint8Array(12 * 6);
  for (let J = 0; J < 6; J++) bld[J * 12 + 4] = 1;
  for (let J = 0; J < 3; J++) bld[J * 12 + 7] = 1;
  const g = buildDualRun(p, box, 6, 2, undefined, bld);
  it("keeps the fine grid and the coarser compute grid", () => {
    expect([g.nx, g.ny, g.dx, g.r]).toEqual([4, 2, 15, 2]);
    expect([g.fine!.nx, g.fine!.ny, g.fine!.dx, g.fine!.s]).toEqual([12, 6, 5, 3]);
    expect(Array.from(g.fine!.building)).toEqual(Array.from(bld));
  });
  it("stores water on the open share and blocks a closed row of buildings", () => {
    expect(g.phi![1]).toBeCloseTo(6 / 9, 6); // compute cell (1, 0): fine columns 3-5, one of them all building
    expect(g.phi![0]).toBe(1);
    expect(g.psiX![0]).toBe(0); // centre of cell 0 to centre of cell 1 crosses the closed column 4
    expect(g.psiX![1]).toBe(0); // cell 1 centre (column 4) is itself all building
    expect(g.psiX![2]).toBe(0); // band 0 (rows 0-2): column 7 between the centres is closed
    expect(g.psiX![6]).toBe(1); // band 1 (rows 3-5): columns 7-10 all open
    expect(g.psiX![5]).toBe(0); // band 1, centre column 4 closed
  });
  it("grounds fine cells like the building-block grid", () => {
    const f = buildFineRun(p, box, 6);
    for (let J = 0; J < 6; J++) for (let I = 0; I < 12; I++) expect(fineGround(g.fine!.base, 6, I, J)).toBeCloseTo(f.z[J * 12 + I], 9);
  });
  it("hands roof rain of a closed cell to open neighbours, total rain area kept", () => {
    const all = new Uint8Array(12 * 6); for (let J = 0; J < 3; J++) for (let I = 0; I < 3; I++) all[J * 12 + I] = 1; // compute cell 0 all roof
    const h = buildDualRun(p, box, 6, 2, undefined, all);
    expect(h.phi![0]).toBe(0);
    expect(h.rainW![0]).toBe(0);
    expect(Array.from(h.rainW!).reduce((a, b) => a + b, 0)).toBeCloseTo(8, 5);
    expect(h.cellAt(15, 15)).not.toBe(0); // inflow never lands on a closed cell
  });
});
