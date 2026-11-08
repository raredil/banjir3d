import { describe, expect, it } from "vitest";
import { decodeMvt, fillPolygon } from "./buildings";

// minimal vector tile encoder for the test: one layer "buildings", one square polygon with a "height" value
const varint = (v: number, out: number[]) => { while (v > 127) { out.push((v & 127) | 128); v = Math.floor(v / 128); } out.push(v); };
const field = (f: number, w: number, out: number[]) => varint((f << 3) | w, out);
const bytes = (f: number, b: number[], out: number[]) => { field(f, 2, out); varint(b.length, out); out.push(...b); };
const zz = (v: number) => (v < 0 ? -2 * v - 1 : 2 * v);
function tile(): Uint8Array {
  const geom: number[] = [], g = [9, zz(10), zz(10), (3 << 3) | 2, zz(20), 0, 0, zz(20), zz(-20), 0, 15];
  g.forEach((v) => varint(v, geom));
  const feat: number[] = []; bytes(2, [0, 0], feat); field(3, 0, feat); varint(3, feat); bytes(4, geom, feat);
  const val: number[] = []; field(5, 0, val); varint(12, val);
  const layer: number[] = []; field(15, 0, layer); varint(2, layer);
  bytes(1, [...new TextEncoder().encode("buildings")], layer); bytes(2, feat, layer); bytes(3, [...new TextEncoder().encode("height")], layer); bytes(4, val, layer); field(5, 0, layer); varint(64, layer);
  const t: number[] = []; bytes(3, layer, t);
  return Uint8Array.from(t);
}

describe("vector tile reader", () => {
  it("decodes a polygon ring, its type, extent and properties", () => {
    const { extent, features } = decodeMvt(tile(), "buildings");
    expect(extent).toBe(64);
    expect(features).toHaveLength(1);
    expect(features[0].type).toBe(3);
    expect(features[0].rings[0]).toEqual([[10, 10], [30, 10], [30, 30], [10, 30]]);
    expect(features[0].props).toEqual({ height: 12 });
    expect(decodeMvt(tile(), "other").features).toHaveLength(0);
  });
});

describe("polygon fill", () => {
  it("marks cells whose centre is inside, holes excluded", () => {
    const m = new Uint8Array(36);
    fillPolygon(m, 6, 6, [[[0.6, 0.6], [5.4, 0.6], [5.4, 5.4], [0.6, 5.4]], [[2.2, 2.2], [3.8, 2.2], [3.8, 3.8], [2.2, 3.8]]]);
    const rows = Array.from({ length: 6 }, (_, j) => Array.from(m.slice(j * 6, j * 6 + 6)).join(""));
    expect(rows).toEqual(["000000", "011110", "010010", "010010", "011110", "000000"]);
  });
});
