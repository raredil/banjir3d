import { describe, expect, it } from "vitest";
import { buildConclusion, round3, type Facts } from "./conclusion";

const base: Facts = {
  area: { box: [106.8, -6.25, 106.9, -6.15], wKm: 11.1, hKm: 11.1 }, landKm2: 120, cellM: 30, hours: 48, gpu: false, landcoverYear: 2024, drainMmH: 0, seaM: 0, floodM: 0.15,
  rain: { kind: "event", id: "2020-01-01", wib: ["2019-12-31T12:00:00+0700", "2020-01-03T12:00:00+0700"], meanMm: 250, maxMm: 320, points: 4, reportsN: 259, hitRate: 0.795, reportedKm2: 156, reportedRw: 390 },
  upstream: { n: 3, peakM3s: 420, areaKm2: 300 },
  env: { km2: 40, classesKm2: [20, 10, 8, 2], meanDepth: 0.62, maxDepth: 3.1, deepest: { lon: 106.86, lat: -6.22, kec: "Kec. Jatinegara, Jakarta Timur" } },
  peak: { km2: 35, tSec: 30 * 3600 }, endKm2: 20, massError: 1e-15,
  expo: { buildings: 111663, people: 744035, units: 12, top: [{ name: "Jatinegara", people: 90123, buildings: 9000 }] },
};

describe("buildConclusion", () => {
  it("states the run numbers and cites every method it names", () => {
    const c = buildConclusion(base, "id", "2019-12-31T05:00:00Z");
    const all = c.paragraphs.join(" ");
    expect(all).toContain("40,0 km²");
    expect(all).toContain("33,3 %"); // 40 of 120 km²
    expect(all).toContain("(Bates, Horritt dan Fewtrell, 2010)");
    expect(all).toContain("(Huffman et al., 2023)");
    expect(all).toContain("744.000 penduduk");
    expect(all).toContain("6,2200° LS");
    expect(all).toContain("1 Januari 2020"); // peak 30 h after 31 Dec 05:00 UTC = 1 Jan 18:00 WIB
    expect(c.refs.length).toBe(c.text.split("Daftar pustaka\n")[1].split("\n\n")[0].split("\n").length);
    for (const k of ["Bates", "Hawker", "Huffman", "WorldPop", "Overture"]) expect(c.text).toContain(k);
  });
  it("uses the design-storm method and leaves out event-only parts", () => {
    const c = buildConclusion({ ...base, area: { box: null, wKm: 0, hKm: 0 }, rain: { kind: "design", mm: 150, h: 6, peakMmH: 60 }, upstream: null, expo: null }, "en", null);
    const all = c.paragraphs.join(" ");
    expect(all).toContain("alternating block method (Chow, Maidment and Mays, 1988)");
    expect(all).toContain("whole study region");
    expect(all).not.toContain("PetaBencana");
    expect(all).not.toContain("Huffman");
    expect(all).toContain("30.0 h after the start");
  });
  it("rounds counts to three significant figures", () => {
    expect(round3(744035)).toBe(744000);
    expect(round3(111663)).toBe(112000);
    expect(round3(412.6)).toBe(413);
  });
});
