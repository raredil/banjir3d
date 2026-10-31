// Research-style summary of a finished run: every number comes from the run, every method and dataset is cited
// from data/methods/references.json (Harvard, as on the Methods page). Pure function, unit-tested.
import data from "../../../data/methods/references.json";
import { citeAuthors, refEntry, sortRefs, type Ref } from "../methods/cite";

export type Rain =
  | { kind: "design" | "hourly"; mm: number; h: number; peakMmH: number; r24?: number }
  | { kind: "event"; id: string; wib: [string, string]; meanMm: number; maxMm: number; points: number; reportsN: number; hitRate: number; reportedKm2: number | null; reportedRw: number | null };

export type Facts = {
  area: { box: number[] | null; wKm: number; hKm: number };
  landKm2: number; cellM: number; hours: number; gpu: boolean; landcoverYear: number; drainMmH: number; seaM: number; floodM: number;
  rain: Rain;
  upstream: { n: number; peakM3s: number; areaKm2: number } | null;
  env: { km2: number; classesKm2: number[]; meanDepth: number; maxDepth: number; deepest: { lon: number; lat: number; kec: string | null } | null };
  peak: { km2: number; tSec: number }; endKm2: number; massError: number;
  expo: { buildings: number; people: number; units: number; top: { name: string; people: number; buildings: number }[] } | null;
};

const REFS = new Map((data.references as Ref[]).map((r) => [r.key, r]));

/** Three significant figures for counts that carry model uncertainty (about 744,000 instead of 744,035). */
export const round3 = (v: number) => (v < 1000 ? Math.round(v) : Number(v.toPrecision(3)));

export function buildConclusion(f: Facts, lang: "id" | "en", startUtc: string | null) {
  const id = lang === "id", loc = id ? "id-ID" : "en-GB";
  const used = new Set<string>();
  const cite = (...keys: string[]) => {
    keys.forEach((k) => used.add(k));
    return `(${keys.map((k) => { const r = REFS.get(k)!; return `${citeAuthors(r).replace(/ and /g, id ? " dan " : " and ")}, ${r.year}`; }).join("; ")})`;
  };
  const citeN = (k: string) => { used.add(k); const r = REFS.get(k)!; return `${citeAuthors(r).replace(/ and /g, id ? " dan " : " and ")} (${r.year})`; };
  const n = (v: number, d = 0) => v.toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = (a: number, b: number) => n(b > 0 ? (100 * a) / b : 0, 1);
  const deg = (v: number, pos: string, neg: string) => `${n(Math.abs(v), 4)}° ${v < 0 ? neg : pos}`;
  const when = (s: number) => startUtc
    ? new Date(Date.parse(startUtc) + s * 1000).toLocaleString(loc, { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB"
    : id ? `jam ke-${n(s / 3600, 1)} sejak awal simulasi` : `${n(s / 3600, 1)} h after the start of the run`;
  const wib = (s: string) => new Date(s).toLocaleString(loc, { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";
  const fm = n(f.floodM, 2);
  const p: string[] = [];

  // 1. study area and model
  const b = f.area.box;
  const where = b
    ? id ? `area terseleksi berukuran ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km (${deg(b[0], "BT", "BB")}–${deg(b[2], "BT", "BB")}; ${deg(b[1], "LU", "LS")}–${deg(b[3], "LU", "LS")})`
      : `a selected area of ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km (${deg(b[0], "E", "W")}–${deg(b[2], "E", "W")}; ${deg(b[1], "N", "S")}–${deg(b[3], "N", "S")})`
    : id ? "seluruh wilayah studi (DKI Jakarta dan zona penyangga 10 km)" : "the whole study region (DKI Jakarta and a 10 km buffer)";
  p.push(id
    ? `Simulasi genangan dilakukan pada ${where} dengan luas daratan termodelkan ${n(f.landKm2, 1)} km². Aliran permukaan dihitung dengan model hidrodinamika dua dimensi berbasis persamaan air dangkal bentuk inersia lokal ${cite("bates2010")} pada grid ${f.cellM} m selama ${n(f.hours)} jam simulasi, di atas model elevasi digital FABDEM yang telah dihilangkan bangunan dan vegetasinya ${cite("hawker2022")}, dengan saluran sungai OpenStreetMap ditoreh ke dalam DEM. Limpasan dihitung dengan metode SCS Curve Number ${cite("nrcs1986")} dari tutupan lahan Esri/Impact Observatory ${f.landcoverYear} dan kelompok hidrologi tanah dari SoilGrids 2.0 ${cite("poggio2021", "nrcs2009")}; koefisien kekasaran Manning memakai nilai klasifikasi lahan HEC-RAS ${cite("hecras2d")} yang mengacu pada ${citeN("chow1959")}. Kapasitas drainase kota dipakai ${n(f.drainMmH)} mm/jam sesuai hasil kalibrasi terhadap banjir 1 Januari 2020.`
    : `The flood simulation covers ${where}, with a modelled land area of ${n(f.landKm2, 1)} km². Surface flow was computed with a two-dimensional hydrodynamic model based on the local inertial form of the shallow water equations ${cite("bates2010")} on a ${f.cellM} m grid for ${n(f.hours)} simulated hours, over the FABDEM digital elevation model with buildings and forests removed ${cite("hawker2022")}, with OpenStreetMap river channels carved into the DEM. Runoff follows the SCS curve number method ${cite("nrcs1986")} from Esri/Impact Observatory ${f.landcoverYear} land cover and hydrologic soil groups from SoilGrids 2.0 ${cite("poggio2021", "nrcs2009")}; Manning roughness uses the HEC-RAS land-class values ${cite("hecras2d")} after ${citeN("chow1959")}. City drainage capacity was set to ${n(f.drainMmH)} mm/h, the value calibrated on the 1 January 2020 flood.`);

  // 2. forcing
  const r = f.rain;
  let rain: string;
  if (r.kind === "event") {
    rain = id
      ? `Masukan hujan adalah hujan teramati satelit GPM IMERG Final V07 per jam ${cite("huffman2023")} pada ${r.points} titik grid 0,1° untuk periode ${wib(r.wib[0])} sampai ${wib(r.wib[1])}; setiap sel model memakai hujan titik terdekat. Curah hujan rata-rata area sebesar ${n(r.meanMm)} mm${r.points > 1 ? ` dan titik grid terbasah ${n(r.maxMm)} mm` : ""}.`
      : `Rain input is hourly GPM IMERG Final V07 satellite precipitation ${cite("huffman2023")} at ${r.points} grid points of 0.1° for ${wib(r.wib[0])} to ${wib(r.wib[1])}; each model cell takes the rain of its nearest point. The area-mean rain was ${n(r.meanMm)} mm${r.points > 1 ? ` and the wettest grid point received ${n(r.maxMm)} mm` : ""}.`;
  } else if (r.kind === "design") {
    rain = id
      ? `Masukan hujan adalah hujan rencana${r.r24 != null ? ` dengan curah hujan harian (R24) ${n(r.r24)} mm` : ""}, ${n(r.mm)} mm selama ${n(r.h)} jam, yang didistribusikan dengan rumus intensitas Mononobe ${cite("maitsa2021")} dan metode blok bergantian ${cite("chow1988")}, dengan intensitas puncak ${n(r.peakMmH)} mm/jam, seragam di seluruh area.`
      : `Rain input is a design storm${r.r24 != null ? ` with a 24-hour rain (R24) of ${n(r.r24)} mm` : ""}, ${n(r.mm)} mm over ${n(r.h)} h, distributed with the Mononobe intensity relation ${cite("maitsa2021")} and the alternating block method ${cite("chow1988")}, with a peak intensity of ${n(r.peakMmH)} mm/h, uniform over the area.`;
  } else {
    rain = id
      ? `Masukan hujan adalah hietograf per jam yang ditentukan pengguna, total ${n(r.mm)} mm selama ${n(r.h)} jam dengan intensitas puncak ${n(r.peakMmH)} mm/jam, seragam di seluruh area.`
      : `Rain input is a user-defined hourly hyetograph of ${n(r.mm)} mm over ${n(r.h)} h with a peak intensity of ${n(r.peakMmH)} mm/h, uniform over the area.`;
  }
  const up = f.upstream;
  const upTxt = up
    ? id ? ` Debit dari ${up.n} sungai yang masuk dari hulu (daerah tangkapan ${n(up.areaKm2)} km²) dihitung dengan persamaan lag dan hidrograf satuan tak berdimensi NRCS ${cite("nrcs2010", "nrcs2007")}; debit puncak gabungannya ${n(up.peakM3s)} m³/s.`
      : ` Discharge from ${up.n} rivers entering from upstream (catchment ${n(up.areaKm2)} km²) was computed with the NRCS lag equation and dimensionless unit hydrograph ${cite("nrcs2010", "nrcs2007")}; their combined peak was ${n(up.peakM3s)} m³/s.`
    : id ? " Aliran dari hulu tidak dimasukkan." : " Inflow from upstream was not included.";
  p.push(rain + upTxt + (id ? ` Muka laut ditetapkan +${n(f.seaM, 1)} m.` : ` Sea level was held at +${n(f.seaM, 1)} m.`));

  // 3. flooded area and depth
  const [c1, c2, c3, c4] = f.env.classesKm2, d = f.env.deepest;
  const deepTxt = d
    ? id ? ` Kedalaman maksimum di luar alur sungai terpetakan mencapai ${n(f.env.maxDepth, 2)} m pada ${deg(d.lat, "LU", "LS")}, ${deg(d.lon, "BT", "BB")}${d.kec ? ` (${d.kec})` : ""}; titik ini dapat berupa badan air permanen yang tidak terpetakan sebagai saluran (situ, kolam).`
      : ` The maximum depth outside mapped river channels was ${n(f.env.maxDepth, 2)} m at ${deg(d.lat, "N", "S")}, ${deg(d.lon, "E", "W")}${d.kec ? ` (${d.kec})` : ""}; this point may be permanent water not mapped as a channel (lake, pond).`
    : "";
  p.push(id
    ? `Dengan ambang tergenang kedalaman lebih dari ${fm} m, total area yang pernah tergenang selama ${n(f.hours)} jam simulasi adalah ${n(f.env.km2, 1)} km² (${pct(f.env.km2, f.landKm2)} % dari luas daratan termodelkan). Luas genangan sesaat mencapai puncak ${n(f.peak.km2, 1)} km² pada ${when(f.peak.tSec)} dan tersisa ${n(f.endKm2, 1)} km² pada akhir simulasi. Berdasarkan kedalaman maksimum, area tergenang terbagi atas ${n(c1, 1)} km² (${fm}–0,5 m), ${n(c2, 1)} km² (0,5–1 m), ${n(c3, 1)} km² (1–2 m) dan ${n(c4, 1)} km² (> 2 m), dengan rata-rata kedalaman maksimum ${n(f.env.meanDepth, 2)} m.${deepTxt}`
    : `With a flood threshold of more than ${fm} m depth, the total area flooded at any time during the ${n(f.hours)} simulated hours was ${n(f.env.km2, 1)} km² (${pct(f.env.km2, f.landKm2)} % of the modelled land area). The instantaneous flooded area peaked at ${n(f.peak.km2, 1)} km² at ${when(f.peak.tSec)} and was ${n(f.endKm2, 1)} km² at the end of the run. By maximum depth, the flooded area splits into ${n(c1, 1)} km² (${fm}–0.5 m), ${n(c2, 1)} km² (0.5–1 m), ${n(c3, 1)} km² (1–2 m) and ${n(c4, 1)} km² (> 2 m), with a mean maximum depth of ${n(f.env.meanDepth, 2)} m.${deepTxt}`);

  // 4. exposure
  const x = f.expo;
  if (x) {
    const top = x.top.slice(0, 3).map((u) => `${u.name} (${id ? "sekitar " : "about "}${n(round3(u.people))}${id ? " jiwa" : " people"})`).join(", ");
    p.push(id
      ? `Berdasarkan data kependudukan WorldPop ${cite("worldpop2025")} dan jejak bangunan Overture Maps ${cite("overture2026")}, genangan maksimum lebih dari ${fm} m mengenai sekitar ${n(round3(x.buildings))} bangunan dan ${n(round3(x.people))} penduduk di ${x.units} kecamatan${top ? `; jumlah penduduk terdampak terbesar terdapat di ${top}` : ""}.`
      : `Based on WorldPop population data ${cite("worldpop2025")} and Overture Maps building footprints ${cite("overture2026")}, the maximum flood extent above ${fm} m reaches about ${n(round3(x.buildings))} buildings and ${n(round3(x.people))} residents in ${x.units} kecamatan${top ? `; the largest numbers of affected people are in ${top}` : ""}.`);
  }

  // 5. observed reference (observed-flood mode only)
  if (r.kind === "event") {
    const rep = r.reportedKm2 != null
      ? id ? `Sebagai pembanding, Pemerintah Provinsi DKI Jakarta melaporkan genangan seluas ${n(r.reportedKm2)} km² di ${r.reportedRw ?? "?"} RW untuk seluruh DKI Jakarta (Antara, mengutip data Pemprov DKI). ` : `For comparison, the DKI Jakarta provincial government reported ${n(r.reportedKm2)} km² flooded in ${r.reportedRw ?? "?"} RW for all of DKI Jakarta (Antara, quoting provincial data). `
      : "";
    p.push(rep + (id
      ? `Pada uji validasi model untuk seluruh wilayah (grid 90 m), ${n(r.hitRate * 100)} % dari ${n(r.reportsN)} laporan warga PetaBencana.id pada kejadian ini berada di sel yang tergenang.${b ? " Angka pembanding ini berlaku untuk seluruh wilayah, bukan hanya area terseleksi." : ""}`
      : `In the model validation for the whole region (90 m grid), ${n(r.hitRate * 100)} % of ${n(r.reportsN)} PetaBencana.id citizen reports for this event fell in flooded cells.${b ? " These reference figures apply to the whole region, not only the selected area." : ""}`));
  }

  // 6. limitations
  p.push(id
    ? `Hasil ini adalah keluaran model, bukan pengamatan. Model belum memuat pompa, pintu air dan tanggul laut, bentuk dasar saluran di bawah muka air tidak tercakup dalam DEM, dan jumlah penduduk adalah penduduk tinggal, bukan orang yang berada di lokasi saat banjir.${r.kind === "event" ? " Hujan satelit 0,1° meratakan puncak hujan lokal, sehingga kedalaman model di titik laporan cenderung lebih dangkal daripada laporan warga (lihat halaman Validasi)." : ""} Kesalahan neraca air simulasi ${Math.abs(f.massError).toExponential(1)}.`
    : `These are model results, not observations. The model does not yet include pumps, sluice gates or sea walls, the channel bed below the water surface is not in the DEM, and population counts are residents, not people present during the flood.${r.kind === "event" ? " The 0.1° satellite rain smooths local rain peaks, so modelled depths at report points tend to be shallower than reported (see the Validation page)." : ""} The water balance error of the run was ${Math.abs(f.massError).toExponential(1)}.`);

  const refs = sortRefs([...used].map((k) => REFS.get(k)!));
  const other = [
    `Esri / Impact Observatory 10 m Annual Land Use Land Cover ${f.landcoverYear}, CC BY 4.0. https://registry.opendata.aws/io-lulc/`,
    "OpenStreetMap contributors (ODbL). https://www.openstreetmap.org",
    "Copernicus DEM GLO-90 (ESA). https://registry.opendata.aws/copernicus-dem/",
    ...(r.kind === "event" ? ["PetaBencana.id flood report archive. https://docs.petabencana.id", "Antara (2020), Pemprov DKI figures from the 7 Jan 2020 coordination meeting. https://www.antaranews.com/berita/1921596/banjir-dan-kenangan ; https://sumut.antaranews.com/berita/270492/banjir-tahun-baru-2020-adalah-yang-terbaik-selama-siklus-banjir-besar-jakarta"] : []),
  ];
  const head = id ? ["Kesimpulan", "Daftar pustaka", "Sumber data lain"] : ["Conclusion", "References", "Other data sources"];
  const text = [p.join("\n\n"), `${head[1]}\n${refs.map((x) => refEntry(x).text).join("\n")}`, `${head[2]}\n${other.join("\n")}`].join("\n\n");
  return { paragraphs: p, refs: refs.map((x) => refEntry(x).html), other, text, head };
}
