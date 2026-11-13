// Research-style summary of a finished run: every number comes from the run, every method and dataset is cited
// from data/methods/references.json (Harvard, as on the Methods page). Pure function, unit-tested.
import data from "../../../data/methods/references.json";
import { citeAuthors, refEntry, sortRefs, type Ref } from "../methods/cite";

export type Rain =
  | { kind: "design" | "hourly"; mm: number; h: number; peakMmH: number }
  | { kind: "event"; id: string; wib: [string, string]; meanMm: number; maxMm: number; points: number; reportsN: number; hitRate: number; reportedKm2: number | null; reportedRw: number | null };

export type Facts = {
  area: { box: number[] | null; wKm: number; hKm: number };
  landKm2: number; cellM: number; fine?: { buildingShare: number | null; computeM?: number; drawOnly?: boolean }; hours: number; gpu: boolean; landcoverYear: number; drainMmH: number; dsdaDrains?: number; pumpsM3s?: number; pumpPolders?: number; pumpsOff?: boolean; terrainYear?: number; subEpoch?: number; seaM: number; floodM: number;
  rain: Rain;
  upstream: { n: number; peakM3s: number; areaKm2: number } | null;
  env: { km2: number; classesKm2: number[]; meanDepth: number; maxDepth: number; deepest: { lon: number; lat: number; kec: string | null } | null };
  peak: { km2: number; tSec: number }; endKm2: number; massError: number;
  expo: { buildings: number; people: number; units: number; top: { name: string; people: number; buildings: number }[] } | null;
  comp?: { infiltration: boolean; amc: 1 | 2 | 3; subsidence: boolean };
  water?: { rainM3: number; inflowM3: number; infilM3: number; outM3: number; seaM3: number };
  skill?: Skill;
};
/** How well the tested set-up matched three recorded floods (data/engine/skill.json, from verification/observed/scores-*.json). */
export type Skill = { events: { id: string; hit: number; random: number; obsMedianM: number; modelMedianM: number; dkiKm2: number; reportedKm2: number | null }[] };

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
  const yr = (v: number, d = 0) => v.toLocaleString(loc, { useGrouping: false, maximumFractionDigits: d, minimumFractionDigits: d });
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
    ? `Simulasi genangan dilakukan pada ${where} dengan luas daratan termodelkan ${n(f.landKm2, 1)} km². Aliran permukaan dihitung dengan model hidrodinamika dua dimensi berbasis persamaan air dangkal bentuk inersia lokal ${cite("bates2010")} pada grid ${f.fine?.computeM ?? f.cellM} m${f.fine?.computeM ? ` (hasil digambar per sel ${f.cellM} m)` : ""} selama ${n(f.hours)} jam simulasi, di atas model elevasi digital FABDEM yang telah dihilangkan bangunan dan vegetasinya ${cite("hawker2022")}, dengan saluran sungai OpenStreetMap ditoreh ke dalam DEM. Limpasan dihitung dengan metode SCS Curve Number ${cite("nrcs1986")} dari tutupan lahan Esri/Impact Observatory ${f.landcoverYear} dan kelompok hidrologi tanah dari SoilGrids 2.0 ${cite("poggio2021", "nrcs2009")}; koefisien kekasaran Manning memakai nilai klasifikasi lahan HEC-RAS ${cite("hecras2d")} yang mengacu pada ${citeN("chow1959")}. ${f.terrainYear ? ` Medan diturunkan sesuai laju penurunan tanah InSAR Sentinel-1 2016–2024 ${cite("shabrina2026", "morishita2020")} dari tahun ${yr(f.subEpoch ?? 2013)} ke tahun ${yr(f.terrainYear, 1)}.` : ""}`
    : `The flood simulation covers ${where}, with a modelled land area of ${n(f.landKm2, 1)} km². Surface flow was computed with a two-dimensional hydrodynamic model based on the local inertial form of the shallow water equations ${cite("bates2010")} on a ${f.fine?.computeM ?? f.cellM} m grid${f.fine?.computeM ? ` (result drawn on ${f.cellM} m cells)` : ""} for ${n(f.hours)} simulated hours, over the FABDEM digital elevation model with buildings and forests removed ${cite("hawker2022")}, with OpenStreetMap river channels carved into the DEM. Runoff follows the SCS curve number method ${cite("nrcs1986")} from Esri/Impact Observatory ${f.landcoverYear} land cover and hydrologic soil groups from SoilGrids 2.0 ${cite("poggio2021", "nrcs2009")}; Manning roughness uses the HEC-RAS land-class values ${cite("hecras2d")} after ${citeN("chow1959")}. ${f.terrainYear ? ` The terrain was lowered by Sentinel-1 InSAR subsidence rates for 2016–2024 ${cite("shabrina2026", "morishita2020")} from ${yr(f.subEpoch ?? 2013)} to ${yr(f.terrainYear, 1)}.` : ""}`);

  // 1a. fine cells (10 m and finer): what is real detail and what is interpolated
  if (f.fine?.drawOnly) {
    const bs = f.fine.buildingShare;
    p.push(id
      ? `Data medan tidak lebih rinci dari 30 m, sehingga aliran dihitung pada grid 30 m yang sama dengan simulasi 30 m (grid yang diuji terhadap banjir tercatat). Sel ${f.cellM} m hanya dipakai untuk menggambar: muka air dari grid 30 m dikurangi ketinggian tanah yang diinterpolasi bilinear${bs !== null ? `, dan jejak bangunan Overture Maps ${cite("overture2026")} (${n(bs * 100, 1)} % sel) dibiarkan kering` : ""}. Karena itu luas, kedalaman, bangunan dan penduduk terdampak sama dengan simulasi 30 m; yang berubah hanya ketajaman peta dan berkas ekspor.`
      : `The terrain data are no finer than 30 m, so the flow was solved on the same 30 m grid as a 30 m run (the grid checked against recorded floods). The ${f.cellM} m cells only draw the result: the 30 m water surface minus the bilinearly interpolated ground${bs !== null ? `, with the Overture Maps building footprints ${cite("overture2026")} (${n(bs * 100, 1)} % of the cells) left dry` : ""}. Area, depth, buildings and people affected are therefore the same as in a 30 m run; only the sharpness of the map and the export files change.`);
  } else if (f.fine) {
    const bs = f.fine.buildingShare;
    p.push(id
      ? `Grid ${f.cellM} m lebih halus dari data medan (30 m), sehingga ketinggian tanah di dalam setiap sel 30 m diinterpolasi bilinear dan tidak menambah informasi medan baru. ${bs !== null ? `Detail yang nyata pada ukuran ini adalah jejak bangunan Overture Maps ${cite("overture2026")}, yang menutupi ${n(bs * 100, 1)} % sel${f.fine.computeM ? "" : " dan dimodelkan sebagai blok padat setinggi 10 m"} sehingga air mengalir di jalan dan gang di antara bangunan ${cite("schubert2012")}; tanah terbuka di antaranya memakai kekasaran jalan aspal (n = 0,016) ${cite("chow1959")}, bukan nilai kawasan terbangun yang pada grid 30 m mewakili bangunan itu sendiri.` : "Jejak bangunan tidak berhasil dimuat, sehingga hasil grid halus ini setara dengan grid 30 m yang diperhalus."} ${f.fine.computeM ? ` Aliran dihitung pada grid ${f.fine.computeM} m yang membawa bangunan sebagai porositas (bagian sel terbuka menyimpan air, bagian sisi sel terbuka mengalirkannya) ${cite("sanders2008")}, lalu muka air digambar pada sel ${f.cellM} m tanpa air di atas bangunan (grid ganda ${cite("sanders2019")}).` : ""} Hasil grid halus belum dikalibrasi terhadap banjir tercatat; kalibrasi berlaku untuk grid 30–90 m.`
      : `The ${f.cellM} m grid is finer than the terrain data (30 m), so the ground inside each 30 m cell is interpolated bilinearly and adds no new terrain information. ${bs !== null ? `The detail that is real at this size is the Overture Maps building footprints ${cite("overture2026")}, which cover ${n(bs * 100, 1)} % of the cells${f.fine.computeM ? "" : " and are modelled as 10 m solid blocks"}, so water flows in the streets and alleys between buildings ${cite("schubert2012")}; the open ground between them takes asphalt street roughness (n = 0.016) ${cite("chow1959")}, not the built-area value that stands for those buildings on 30 m grids.` : "The building footprints could not be loaded, so this fine run equals a refined 30 m run."} ${f.fine.computeM ? ` The flow was solved on a ${f.fine.computeM} m grid that carries the buildings as porosity (the open share of a cell stores water, the open share of its sides conveys it) ${cite("sanders2008")}, and the water surface was drawn on the ${f.cellM} m cells with no water on buildings (dual grid, ${cite("sanders2019")}).` : ""} Fine-grid results are not calibrated against recorded floods; the calibration holds for 30–90 m grids.`);
  }

  // 1b. city drainage: what of it is in the model, and how
  const dr: string[] = [];
  if (id) {
    if (f.dsdaDrains) dr.push(`Sistem drainase kota masuk ke model melalui ${n(f.dsdaDrains)} ruas saluran primer dan sekunder dari data Jakarta Satu ${cite("dsda2026")}, yang ditoreh ke medan sesuai lebar dan kedalaman tercatat; bagian saluran di bawah muka air awal sudah berisi air saat simulasi dimulai.`);
    if (f.pumpsM3s) dr.push(`Pompa polder berkapasitas total ${n(f.pumpsM3s)} m³/detik${f.pumpPolders ? ` di ${n(f.pumpPolders)} polder` : ""} menguras air dari daratan polder masing-masing; kapasitasnya dibagi rata ke seluruh daratan polder, sehingga bila hanya sebagian polder tergenang, air yang dipompa lebih sedikit dari kapasitasnya.`);
    else if (f.pumpsOff) dr.push("Pompa polder tidak dinyalakan dalam simulasi ini, sesuai hasil uji tiga banjir: menyalakannya membuat model makin kering dibanding laporan warga.");
    dr.push(`Saluran tersier dan mikro tidak memiliki data ukuran, sehingga tidak dimodelkan satu per satu. Uji kalibrasi pada banjir 1 Januari 2020 menunjukkan bahwa penyerapan tambahan oleh saluran kota di lahan terbangun (1–40 mm/jam) justru menjauhkan hasil dari laporan warga, sehingga penyerapan tambahan ini ditetapkan ${n(f.drainMmH)} mm/jam.`);
  } else {
    if (f.dsdaDrains) dr.push(`City drainage enters the model through ${n(f.dsdaDrains)} primary and secondary drain sections from the Jakarta Satu records ${cite("dsda2026")}, carved into the terrain with their recorded width and depth; the part of each drain below the initial water surface is full when the run starts.`);
    if (f.pumpsM3s) dr.push(`Polder pumps with a total capacity of ${n(f.pumpsM3s)} m³/s${f.pumpPolders ? ` in ${n(f.pumpPolders)} polders` : ""} drain the land of their polder; the capacity is spread evenly over the polder, so a partly flooded polder pumps less than its capacity.`);
    else if (f.pumpsOff) dr.push("The polder pumps are not switched on in this run, following the three-flood test: switching them on made the model even drier than the citizen reports.");
    dr.push(`Tertiary and micro drains have no recorded size and are not modelled one by one. Calibration on the 1 January 2020 flood showed that an extra drain sink on built-up land (1–40 mm/h) moved the results away from the citizen reports, so this extra sink is set to ${n(f.drainMmH)} mm/h.`);
  }
  p.push(dr.join(" "));
  const cp = f.comp;
  if (cp && (!cp.infiltration || cp.amc !== 2 || !cp.subsidence)) {
    const off: string[] = [];
    if (!cp.infiltration) off.push(id ? "resapan tanah dimatikan (seluruh hujan menjadi limpasan)" : "infiltration switched off (all rain runs off)");
    if (cp.amc !== 2) off.push(id ? `kondisi tanah sebelum hujan ${cp.amc === 1 ? "kering (AMC I)" : "basah (AMC III)"}, Curve Number dikonversi dengan persamaan ${citeN("chow1988")}` : `antecedent condition ${cp.amc === 1 ? "dry (AMC I)" : "wet (AMC III)"}, curve numbers converted with the equations of ${citeN("chow1988")}`);
    if (!cp.subsidence) off.push(id ? "penurunan tanah tidak diterapkan (medan seperti saat diukur)" : "no subsidence shift (terrain as surveyed)");
    p.push(id ? `Pengaturan berbeda dari pengaturan yang diuji: ${off.join("; ")}.` : `Set-up differs from the tested one: ${off.join("; ")}.`);
  }

  // 2. forcing
  const r = f.rain;
  let rain: string;
  if (r.kind === "event") {
    rain = id
      ? `Masukan hujan adalah hujan teramati satelit GPM IMERG Final V07 per jam ${cite("huffman2023")} pada ${r.points} titik grid 0,1° untuk periode ${wib(r.wib[0])} sampai ${wib(r.wib[1])}; setiap sel model memakai hujan titik terdekat. Curah hujan rata-rata area sebesar ${n(r.meanMm)} mm${r.points > 1 ? ` dan titik grid terbasah ${n(r.maxMm)} mm` : ""}.`
      : `Rain input is hourly GPM IMERG Final V07 satellite precipitation ${cite("huffman2023")} at ${r.points} grid points of 0.1° for ${wib(r.wib[0])} to ${wib(r.wib[1])}; each model cell takes the rain of its nearest point. The area-mean rain was ${n(r.meanMm)} mm${r.points > 1 ? ` and the wettest grid point received ${n(r.maxMm)} mm` : ""}.`;
  } else if (r.kind === "design") {
    rain = id
      ? `Masukan hujan adalah hujan rencana ${n(r.mm)} mm selama ${n(r.h)} jam, dibentuk dengan rumus intensitas Mononobe ${cite("maitsa2021")} yang diskalakan ke lama hujan${r.h > 24 ? " (diperpanjang melewati 24 jam tempat rumus itu diturunkan: sebuah anggapan)" : ""} dan diurutkan dengan metode blok bergantian ${cite("chow1988")}, dengan intensitas puncak ${n(r.peakMmH)} mm/jam, seragam di seluruh area.`
      : `Rain input is a design storm of ${n(r.mm)} mm over ${n(r.h)} h, shaped with the Mononobe intensity relation ${cite("maitsa2021")} scaled to the storm duration${r.h > 24 ? " (extended beyond the 24 h it was derived for: an assumption)" : ""} and ordered with the alternating block method ${cite("chow1988")}, with a peak intensity of ${n(r.peakMmH)} mm/h, uniform over the area.`;
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
    ? `Hasil ini adalah keluaran model, bukan pengamatan. Model belum memuat pintu air dan tanggul laut${f.pumpsM3s ? ", pompa dihitung sebagai batas bawah (kapasitas dibagi rata ke polder)" : ""}, bentuk dasar saluran di bawah muka air tidak tercakup dalam DEM, dan jumlah penduduk adalah penduduk tinggal, bukan orang yang berada di lokasi saat banjir.${r.kind === "event" ? " Hujan satelit 0,1° meratakan puncak hujan lokal, sehingga kedalaman model di titik laporan cenderung lebih dangkal daripada laporan warga (lihat halaman Validasi)." : ""} Kesalahan neraca air simulasi ${Math.abs(f.massError).toExponential(1)}.`
    : `These are model results, not observations. The model does not yet include sluice gates or sea walls${f.pumpsM3s ? ", pumps are a lower bound (capacity spread over the polder)" : ""}, the channel bed below the water surface is not in the DEM, and population counts are residents, not people present during the flood.${r.kind === "event" ? " The 0.1° satellite rain smooths local rain peaks, so modelled depths at report points tend to be shallower than reported (see the Validation page)." : ""} The water balance error of the run was ${Math.abs(f.massError).toExponential(1)}.`);

  const refs = sortRefs([...used].map((k) => REFS.get(k)!));
  const summary = plainSummary(f, id, n, when);
  const other = [
    `Esri / Impact Observatory 10 m Annual Land Use Land Cover ${f.landcoverYear}, CC BY 4.0. https://registry.opendata.aws/io-lulc/`,
    "OpenStreetMap contributors (ODbL). https://www.openstreetmap.org",
    "Copernicus DEM GLO-90 (ESA). https://registry.opendata.aws/copernicus-dem/",
    ...(r.kind === "event" ? ["PetaBencana.id flood report archive. https://docs.petabencana.id", "Antara (2020), Pemprov DKI figures from the 7 Jan 2020 coordination meeting. https://www.antaranews.com/berita/1921596/banjir-dan-kenangan ; https://sumut.antaranews.com/berita/270492/banjir-tahun-baru-2020-adalah-yang-terbaik-selama-siklus-banjir-besar-jakarta"] : []),
  ];
  const head = id ? ["Kesimpulan", "Daftar pustaka", "Sumber data lain"] : ["Conclusion", "References", "Other data sources"];
  const text = [p.join("\n\n"), `${head[1]}\n${refs.map((x) => refEntry(x).text).join("\n")}`, `${head[2]}\n${other.join("\n")}`].join("\n\n");
  const sHead = id ? "Ringkasan" : "Summary";
  const text2 = `${sHead}\n${summary.map((x) => `- ${x}`).join("\n")}\n\n${id ? "Penjelasan ilmiah" : "Scientific detail"}\n${text}`;
  return { summary, paragraphs: p, refs: refs.map((x) => refEntry(x).html), other, text: text2, head };
}

/** Plain-language summary (owner 2026-11-13: the research text alone was hard to follow): what was run, how big and how deep, who
 *  is affected, where the water came from, and how far the numbers can be trusted. Every number comes from the run or skill.json. */
function plainSummary(f: Facts, id: boolean, n: (v: number, d?: number) => string, when: (s: number) => string): string[] {
  const out: string[] = [], r = f.rain, fm = n(f.floodM * 100);
  const area = f.area.box ? (id ? `kotak ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km` : `a ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km box`) : id ? "seluruh Jakarta dan sekitarnya" : "all of Jakarta and its surroundings";
  const rainTxt = r.kind === "event"
    ? id ? `banjir nyata ${r.id} dengan hujan satelit rata-rata ${n(r.meanMm)} mm` : `the observed flood of ${r.id} with satellite rain of ${n(r.meanMm)} mm on average`
    : id ? `hujan ${n(r.mm)} mm selama ${n(r.h)} jam (paling deras ${n(r.peakMmH)} mm per jam)` : `${n(r.mm)} mm of rain over ${n(r.h)} h (wettest hour ${n(r.peakMmH)} mm)`;
  out.push(id ? `Yang dihitung: ${rainTxt} di ${area}, ${f.upstream ? "ditambah air sungai kiriman dari hulu" : "tanpa air kiriman dari hulu"}, selama ${n(f.hours)} jam.`
    : `What was run: ${rainTxt} over ${area}, ${f.upstream ? "plus river water arriving from upstream" : "without river water from upstream"}, for ${n(f.hours)} h.`);
  const e = f.env, [c1, c2, c3, c4] = e.classesKm2;
  out.push(id ? `Luas: sekitar ${n(e.km2, 1)} km² pernah tergenang lebih dari ${fm} cm (${n(f.landKm2 > 0 ? (100 * e.km2) / f.landKm2 : 0, 1)} % daratan). Paling luas sekaligus ${n(f.peak.km2, 1)} km² pada ${when(f.peak.tSec)}; di akhir hitungan tersisa ${n(f.endKm2, 1)} km².`
    : `Extent: about ${n(e.km2, 1)} km² flooded deeper than ${fm} cm at some time (${n(f.landKm2 > 0 ? (100 * e.km2) / f.landKm2 : 0, 1)} % of the land). Largest at one moment: ${n(f.peak.km2, 1)} km² at ${when(f.peak.tSec)}; ${n(f.endKm2, 1)} km² left at the end.`);
  out.push(id ? `Kedalaman: ${n(c1, 1)} km² setinggi mata kaki sampai lutut (${fm}–50 cm), ${n(c2, 1)} km² setinggi lutut sampai pinggang (0,5–1 m), ${n(c3 + c4, 1)} km² lebih dari 1 m.${e.deepest ? ` Titik terdalam di luar sungai ${n(e.maxDepth, 1)} m${e.deepest.kec ? ` di ${e.deepest.kec}` : ""} (bisa juga kolam atau situ yang tidak tercatat sebagai sungai).` : ""}`
    : `Depth: ${n(c1, 1)} km² ankle to knee deep (${fm}–50 cm), ${n(c2, 1)} km² knee to waist (0.5–1 m), ${n(c3 + c4, 1)} km² deeper than 1 m.${e.deepest ? ` Deepest point off the rivers ${n(e.maxDepth, 1)} m${e.deepest.kec ? ` in ${e.deepest.kec}` : ""} (may also be a pond or lake not mapped as a river).` : ""}`);
  if (f.expo) {
    const top = f.expo.top.slice(0, 3).map((u) => u.name).join(", ");
    out.push(id ? `Dampak: sekitar ${n(round3(f.expo.buildings))} bangunan dan ${n(round3(f.expo.people))} penduduk tinggal di area yang tergenang lebih dari ${fm} cm${top ? `; terbanyak di ${top}` : ""}.`
      : `Impact: about ${n(round3(f.expo.buildings))} buildings and ${n(round3(f.expo.people))} residents are in areas flooded deeper than ${fm} cm${top ? `; most in ${top}` : ""}.`);
  }
  const w = f.water;
  if (w && w.rainM3 + w.inflowM3 > 0) {
    const tot = w.rainM3 + w.inflowM3, up = (100 * w.inflowM3) / tot, soak = w.rainM3 > 0 ? (100 * w.infilM3) / w.rainM3 : 0;
    out.push(id ? `Asal air: ${n(100 - up)} % dari hujan yang jatuh di area ini, ${n(up)} % kiriman sungai dari hulu. Dari hujan itu ${n(soak)} % meresap ke tanah; sisanya mengalir mengikuti kemiringan tanah ke tempat yang lebih rendah dan ke sungai. Sungai meluap hanya di tempat airnya melebihi tinggi tebing alurnya, karena itu tidak semua sungai meluap.`
      : `Where the water came from: ${n(100 - up)} % rain on this area, ${n(up)} % river water from upstream. Of the rain, ${n(soak)} % soaked into the ground; the rest flowed downhill to lower ground and to the rivers. A river spills only where its water rises above its banks, which is why not every river overflows.`);
  }
  if (f.fine?.drawOnly) out.push(id ? `Peta digambar per ${n(f.cellM)} m agar tepinya halus; semua angka di atas tetap dari hitungan 30 m (data medan tidak lebih rinci dari 30 m).`
    : `The map is drawn on ${n(f.cellM)} m cells for smooth edges; all numbers above come from the 30 m run (the terrain data are no finer than 30 m).`);
  const sk = f.skill?.events;
  if (sk?.length) {
    const hit = sk.map((x) => n(x.hit * 100)).join("/"), rnd = sk.map((x) => n(x.random * 100)).join("/");
    const ob = sk.map((x) => n(x.obsMedianM * 100)).join("/"), mo = sk.map((x) => n(x.modelMedianM * 100)).join("/");
    const e20 = sk.find((x) => x.reportedKm2);
    out.push(id ? `Seberapa bisa dipercaya: pada uji tiga banjir nyata (2020, 2021, 2025) ${hit} % laporan warga jatuh di dekat genangan model, dibanding ${rnd} % bila titiknya diacak. Kedalaman model di titik laporan lebih dangkal (tengah-tengahnya ${mo} cm, laporan ${ob} cm)${e20 ? ` dan luas banjir DKI 2020 ${n(e20.dkiKm2)} km² dibanding ${n(e20.reportedKm2!)} km² yang dilaporkan` : ""}. Jadi letak genangan cukup tepat, tetapi luas dan kedalaman lebih mungkin terlalu kecil daripada terlalu besar, terutama karena hujan satelit lebih rendah dari hujan sebenarnya. ${r.kind === "event" ? "" : "Hasil hujan rencana tidak bisa diuji langsung: ia menjawab \"bagaimana jika\"."}`.trim()
      : `How far to trust it: on three recorded floods (2020, 2021, 2025) ${hit} % of citizen reports fell near modelled flooding, against ${rnd} % for random points. Modelled depths at the reports are shallower (median ${mo} cm vs ${ob} cm reported)${e20 ? ` and the 2020 DKI flooded area is ${n(e20.dkiKm2)} km² vs ${n(e20.reportedKm2!)} km² reported` : ""}. So the places are fairly right, but extent and depth are more likely too small than too large, mainly because satellite rain is lower than the real rain. ${r.kind === "event" ? "" : "A design-storm result cannot be checked directly: it answers 'what if'."}`.trim());
  }
  return out;
}
