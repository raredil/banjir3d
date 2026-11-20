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
  it("names the subsidence shift with its year and sources", () => {
    const c = buildConclusion({ ...base, terrainYear: 2020.0, subEpoch: 2013 }, "id", "2019-12-31T05:00:00Z");
    expect(c.text).toContain("dari keadaan 2013 sampai Januari 2020");
    expect(c.text).toContain("Shabrina");
    expect(c.text).toContain("Morishita");
  });
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

describe("why here", () => {
  it("explains a place only from computed facts", () => {
    const places = [{ name: "Kec. Jatinegara, Jakarta Timur", lon: 106.87, lat: -6.23, areaKm2: 2.4, depthP90: 1.2, reliefM: -1.4, riverShare: 0.7, nearShare: 0.9, loweredM: 0.12 },
      { name: null, lon: 106.8, lat: -6.4, areaKm2: 0.9, depthP90: 0.6, reliefM: -0.5, riverShare: 0.05, nearShare: 0.1, loweredM: null }];
    const c = buildConclusion({ ...base, places, subEpoch: 2013 }, "id", null);
    expect(c.why[1]).toContain("Kec. Jatinegara");
    expect(c.why[1]).toContain("70 % genangannya ada di tepi sungai");
    expect(c.why[1]).toContain("1,4 m lebih rendah");
    expect(c.why[1]).toContain("turun rata-rata 12 cm");
    expect(c.why[2]).toContain("air hujan yang mengalir dan berkumpul");
    expect(c.why[2]).toContain("belum pasti"); // 0.5 m relief is within the terrain error
    expect(c.text).toContain("Mengapa di sini tergenang?");
  });
});

describe("plain summary", () => {
  it("says what ran, how big, how deep, where the water came from and how far to trust it", () => {
    const skill = { events: [{ id: "2020-01-01", hit: 0.43, random: 0.37, randomNear: 0.43, verdict: "not_better" as const, obsMedianM: 0.7, modelMedianM: 0.09, dkiKm2: 62, reportedKm2: 156 },
      { id: "2021-02-20", hit: 0.33, random: 0.19, randomNear: 0.24, verdict: "better" as const, obsMedianM: 0.65, modelMedianM: 0.05, dkiKm2: 20, reportedKm2: null },
      { id: "2025-03-04", hit: 0.35, random: 0.36, randomNear: 0.34, verdict: "too_few" as const, obsMedianM: 0.55, modelMedianM: 0.06, dkiKm2: 55, reportedKm2: null }] };
    const c = buildConclusion({ ...base, water: { rainM3: 3e7, inflowM3: 1e7, infilM3: 3e6, outM3: 0, seaM3: 2e7 }, skill }, "id", "2019-12-31T05:00:00Z");
    const s = c.summary.join(" ");
    expect(s).toContain("banjir 1 Januari 2020");
    expect(s).toContain("sekitar 40,0 km²");
    expect(s).toContain("mata kaki");
    expect(s).toContain("75 % dari hujan"); // 3e7 of 4e7
    expect(s).toContain("25 % dari sungai yang membawa air dari luar kotak");
    expect(s).toContain("8 % meresap"); // 3e6 of 4e7
    expect(s).toContain("50 % mengalir ke laut");
    expect(s).not.toContain("keluar lewat tepi"); // 0: left out
    expect(s).toContain("lebih baik dari tebakan acak hanya pada banjir 2021");
    expect(s).toContain("pada 2020 tidak lebih baik dari acak");
    expect(s).toContain("pada 2025 laporannya terlalu sedikit");
    expect(s).toContain("model 9 cm, sedangkan warga melaporkan 70 cm");
    expect(s).toContain("62 km², sedangkan Pemprov DKI melaporkan 156 km²");
    for (const x of c.summary) expect(x.split(/\s+/).length).toBeLessThanOrEqual(60); // short items
    expect(c.text.startsWith("Ringkasan")).toBe(true);
  });
  it("says where the model is weakest from the distance-to-river scores (review MT-06)", () => {
    const bd = { water: { n: 57, hit: 0.53, random: 0.43, shareReports: 0.22, shareCells: 0.14 }, le100: { n: 54, hit: 0.46, random: 0.43, shareReports: 0.21, shareCells: 0.15 },
      "100_500": { n: 101, hit: 0.42, random: 0.41, shareReports: 0.39, shareCells: 0.49 }, gt500: { n: 47, hit: 0.66, random: 0.47, shareReports: 0.18, shareCells: 0.23 } };
    const skill = { events: [{ id: "2020-01-01", hit: 0.49, random: 0.38, verdict: "not_better" as const, obsMedianM: 0.7, modelMedianM: 0.1, dkiKm2: 73, reportedKm2: 156, byDistance: bd }] };
    const s = buildConclusion({ ...base, skill }, "id", null).summary.join(" ");
    expect(s).toContain("43 % laporan warga ada di sungai atau kurang dari 100 m darinya, padahal zona itu hanya 29 % dari peta");
    expect(s).toContain("model kena 50 % laporan, titik acak yang sama dekatnya ke sungai 43 %"); // (57 x 0.53 + 54 x 0.46) / 111
    expect(s).toContain("Lebih dari 500 m dari sungai: 66 % lawan 47 %. Jadi genangan hujan");
    expect(s).toContain("Dugaan penyebab (belum diuji satu per satu)");
    const few = { ...bd, gt500: { ...bd.gt500, n: 4 } }; // too few far reports: no sentence
    const s2 = buildConclusion({ ...base, skill: { events: [{ ...skill.events[0], byDistance: few }] } }, "en", null).summary.join(" ");
    expect(s2).not.toContain("Where the model is weakest");
  });
  it("mentions changed components in the detail text", () => {
    const c = buildConclusion({ ...base, comp: { infiltration: false, amc: 3, subsidence: true } }, "id", null);
    expect(c.paragraphs.join(" ")).toContain("resapan tanah dimatikan");
    expect(c.paragraphs.join(" ")).toContain("basah (AMC III)");
  });
});
