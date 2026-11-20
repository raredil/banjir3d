// Research-style summary of a finished run: every number comes from the run, every method and dataset is cited
// from data/methods/references.json (Harvard, as on the Methods page). Pure function, unit-tested.
import data from "../../../data/methods/references.json";
import { citeAuthors, refEntry, sortRefs, type Ref } from "../methods/cite";
import type { Place } from "./places";

export type Rain =
  | { kind: "design" | "hourly"; mm: number; h: number; peakMmH: number }
  | { kind: "event"; id: string; wib: [string, string]; meanMm: number; maxMm: number; points: number; reportsN: number; hitRate: number; randomRate?: number; reportedKm2: number | null; reportedRw: number | null };

export type Facts = {
  area: { box: number[] | null; wKm: number; hKm: number };
  landKm2: number; cellM: number; fine?: { buildingShare: number | null; computeM?: number; drawOnly?: boolean }; hours: number; gpu: boolean; landcoverYear: number; drainMmH: number; dsdaDrains?: number; pumpsM3s?: number; pumpPolders?: number; pumpsOff?: boolean; micro?: { m3s: number; drains?: number; mmH?: number }; microOff?: boolean; terrainYear?: number; subEpoch?: number; seaM: number; floodM: number;
  rain: Rain;
  upstream: { n: number; peakM3s: number; areaKm2: number } | null;
  env: { km2: number; classesKm2: number[]; meanDepth: number; maxDepth: number; deepest: { lon: number; lat: number; kec: string | null } | null };
  peak: { km2: number; tSec: number }; endKm2: number; massError: number;
  expo: { buildings: number; people: number; units: number; top: { name: string; people: number; buildings: number }[] } | null;
  comp?: { infiltration: boolean; amc: 1 | 2 | 3; subsidence: boolean };
  water?: { rainM3: number; inflowM3: number; infilM3: number; outM3: number; seaM3: number; drainM3?: number; storedM3?: number };
  skill?: Skill;
  places?: Place[]; // largest flooded places with computed reasons (places.ts)
};
/** How well the tested set-up matched three recorded floods (data/skill.json, from verification/observed/scores-*.json). */
export type Skill = { events: { id: string; n?: number; hit: number; random: number; randomNear?: number; ci95?: number[]; verdict?: "better" | "not_better" | "too_few"; obsMedianM: number; modelMedianM: number; dkiKm2: number; reportedKm2: number | null; byDistance?: Record<string, DistClass> }[] };
/** Report hits per distance to the nearest river/water block (skill.json byDistance, review MT-06). */
export type DistClass = { n: number; hit: number | null; random: number | null; p?: number | null; shareReports: number | null; shareCells: number | null };

/** Reports in a river block or within 100 m of one, pooled, against those more than 500 m away (null when a side has fewer than 20 reports). */
export function nearFar(bd?: Record<string, DistClass>) {
  if (!bd) return null;
  const pool = (ks: string[]) => {
    const cs = ks.map((k) => bd[k]).filter((c): c is DistClass => !!c && c.n > 0 && c.hit != null && c.random != null);
    const n = cs.reduce((a, c) => a + c.n, 0);
    return n ? { n, hit: cs.reduce((a, c) => a + c.n * c.hit!, 0) / n, random: cs.reduce((a, c) => a + c.n * c.random!, 0) / n, share: cs.reduce((a, c) => a + (c.shareReports ?? 0), 0), cells: cs.reduce((a, c) => a + (c.shareCells ?? 0), 0) } : null;
  };
  const near = pool(["water", "le100"]), far = pool(["gt500"]);
  return near && far && near.n >= 20 && far.n >= 20 ? { near, far } : null;
}

const REFS = new Map((data.references as Ref[]).map((r) => [r.key, r]));

/** "Januari 2020" from a decimal year (2020.0 -> January 2020). */
export const monthYear = (t: number, loc: string) => { const y = Math.floor(t), m = Math.min(11, Math.floor((t - y) * 12)); return new Date(Date.UTC(y, m, 15)).toLocaleDateString(loc, { timeZone: "UTC", month: "long", year: "numeric" }); };

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
    ? id ? `kotak pilihan ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km (${deg(b[0], "BT", "BB")}–${deg(b[2], "BT", "BB")}; ${deg(b[1], "LU", "LS")}–${deg(b[3], "LU", "LS")})`
      : `a selected area of ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km (${deg(b[0], "E", "W")}–${deg(b[2], "E", "W")}; ${deg(b[1], "N", "S")}–${deg(b[3], "N", "S")})`
    : id ? "seluruh wilayah studi (DKI Jakarta dan 10 km di sekelilingnya)" : "the whole study region (DKI Jakarta and a 10 km buffer)";
  p.push(id
    ? [`Simulasi mencakup ${where}, dengan daratan seluas ${n(f.landKm2, 1)} km².`,
      `Aliran air di permukaan dihitung dengan model dua dimensi yang memakai persamaan air dangkal bentuk inersia lokal ${cite("bates2010")}, pada sel ${f.fine?.computeM ?? f.cellM} m${f.fine?.computeM ? ` (hasil digambar per sel ${f.cellM} m)` : ""} selama ${n(f.hours)} jam.`,
      `Tinggi tanah diambil dari FABDEM, peta tinggi tanah (DEM) yang sudah dibersihkan dari bangunan dan pohon ${cite("hawker2022")}. Alur sungai dari OpenStreetMap dibuat lebih rendah di peta itu agar air bisa mengalir di dalamnya.`,
      `Bagian hujan yang menjadi aliran permukaan (limpasan) dihitung dengan metode SCS Curve Number ${cite("nrcs1986")}, dari tutupan lahan Esri/Impact Observatory ${f.landcoverYear} dan kelompok tanah SoilGrids 2.0 ${cite("poggio2021", "nrcs2009")}.`,
      `Kekasaran permukaan (koefisien Manning) mengikuti nilai per jenis lahan dari HEC-RAS ${cite("hecras2d")}, yang bersumber dari ${citeN("chow1959")}.`,
      f.terrainYear ? `Tinggi tanah juga disesuaikan dengan penurunan tanah yang diukur satelit radar Sentinel-1 (2016–2024) ${cite("shabrina2026", "morishita2020")}, dari keadaan ${yr(f.subEpoch ?? 2013)} sampai ${monthYear(f.terrainYear, loc)}.` : ""].filter(Boolean).join(" ")
    : `The flood simulation covers ${where}, with a modelled land area of ${n(f.landKm2, 1)} km². Surface flow was computed with a two-dimensional hydrodynamic model based on the local inertial form of the shallow water equations ${cite("bates2010")} on a ${f.fine?.computeM ?? f.cellM} m grid${f.fine?.computeM ? ` (result drawn on ${f.cellM} m cells)` : ""} for ${n(f.hours)} simulated hours, over the FABDEM digital elevation model with buildings and forests removed ${cite("hawker2022")}, with OpenStreetMap river channels carved into the DEM. Runoff follows the SCS curve number method ${cite("nrcs1986")} from Esri/Impact Observatory ${f.landcoverYear} land cover and hydrologic soil groups from SoilGrids 2.0 ${cite("poggio2021", "nrcs2009")}; Manning roughness uses the HEC-RAS land-class values ${cite("hecras2d")} after ${citeN("chow1959")}. ${f.terrainYear ? ` The terrain was lowered by Sentinel-1 InSAR subsidence rates for 2016–2024 ${cite("shabrina2026", "morishita2020")} from ${yr(f.subEpoch ?? 2013)} to ${monthYear(f.terrainYear, loc)}.` : ""}`);

  // 1a. fine cells (10 m and finer): what is real detail and what is interpolated
  if (f.fine?.drawOnly) {
    const bs = f.fine.buildingShare;
    p.push(id
      ? `Data medan tidak lebih rinci dari 30 m, sehingga aliran dihitung pada grid 30 m yang sama dengan simulasi 30 m. Sel ${f.cellM} m hanya dipakai untuk menggambar: muka air dari grid 30 m dikurangi ketinggian tanah yang diinterpolasi bilinear${bs !== null ? `, dan jejak bangunan Overture Maps ${cite("overture2026")} (${n(bs * 100, 1)} % sel) dibiarkan kering` : ""}. Karena itu luas, kedalaman, bangunan dan penduduk terdampak sama dengan simulasi 30 m; yang berubah hanya ketajaman peta dan berkas ekspor.`
      : `The terrain data are no finer than 30 m, so the flow was solved on the same 30 m grid as a 30 m run. The ${f.cellM} m cells only draw the result: the 30 m water surface minus the bilinearly interpolated ground${bs !== null ? `, with the Overture Maps building footprints ${cite("overture2026")} (${n(bs * 100, 1)} % of the cells) left dry` : ""}. Area, depth, buildings and people affected are therefore the same as in a 30 m run; only the sharpness of the map and the export files change.`);
  } else if (f.fine) {
    const bs = f.fine.buildingShare;
    p.push(id
      ? `Grid ${f.cellM} m lebih halus dari data medan (30 m), sehingga ketinggian tanah di dalam setiap sel 30 m diinterpolasi bilinear dan tidak menambah informasi medan baru. ${bs !== null ? `Detail yang nyata pada ukuran ini adalah jejak bangunan Overture Maps ${cite("overture2026")}, yang menutupi ${n(bs * 100, 1)} % sel${f.fine.computeM ? "" : " dan dimodelkan sebagai blok padat setinggi 10 m"} sehingga air mengalir di jalan dan gang di antara bangunan ${cite("schubert2012")}; tanah terbuka di antaranya memakai kekasaran jalan aspal (n = 0,016) ${cite("chow1959")}, bukan nilai kawasan terbangun yang pada grid 30 m mewakili bangunan itu sendiri.` : "Jejak bangunan tidak berhasil dimuat, sehingga hasil grid halus ini setara dengan grid 30 m yang diperhalus."} ${f.fine.computeM ? ` Aliran dihitung pada grid ${f.fine.computeM} m yang membawa bangunan sebagai porositas (bagian sel terbuka menyimpan air, bagian sisi sel terbuka mengalirkannya) ${cite("sanders2008")}, lalu muka air digambar pada sel ${f.cellM} m tanpa air di atas bangunan (grid ganda ${cite("sanders2019")}).` : ""} Hasil grid halus belum diuji terhadap banjir tercatat; uji itu hanya dibuat pada sel 90 m.`
      : `The ${f.cellM} m grid is finer than the terrain data (30 m), so the ground inside each 30 m cell is interpolated bilinearly and adds no new terrain information. ${bs !== null ? `The detail that is real at this size is the Overture Maps building footprints ${cite("overture2026")}, which cover ${n(bs * 100, 1)} % of the cells${f.fine.computeM ? "" : " and are modelled as 10 m solid blocks"}, so water flows in the streets and alleys between buildings ${cite("schubert2012")}; the open ground between them takes asphalt street roughness (n = 0.016) ${cite("chow1959")}, not the built-area value that stands for those buildings on 30 m grids.` : "The building footprints could not be loaded, so this fine run equals a refined 30 m run."} ${f.fine.computeM ? ` The flow was solved on a ${f.fine.computeM} m grid that carries the buildings as porosity (the open share of a cell stores water, the open share of its sides conveys it) ${cite("sanders2008")}, and the water surface was drawn on the ${f.cellM} m cells with no water on buildings (dual grid, ${cite("sanders2019")}).` : ""} Fine-grid results are not checked against recorded floods; that check was made on 90 m cells only.`);
  }

  // 1b. city drainage: what of it is in the model, and how
  const dr: string[] = [];
  if (id) {
    if (f.dsdaDrains) dr.push(`Sistem drainase kota masuk ke model melalui ${n(f.dsdaDrains)} ruas saluran primer dan sekunder dari data Jakarta Satu ${cite("dsda2026")}, yang ditoreh ke medan sesuai lebar dan kedalaman tercatat; bagian saluran di bawah 0 m (muka laut) sudah berisi air saat simulasi dimulai, di tempat lain saluran mulai kosong.`);
    if (f.pumpsM3s) dr.push(`Pompa polder berkapasitas total ${n(f.pumpsM3s)} m³/detik${f.pumpPolders ? ` di ${n(f.pumpPolders)} polder` : ""} menguras air dari daratan polder masing-masing; kapasitasnya dibagi rata ke seluruh daratan polder, sehingga bila hanya sebagian polder tergenang, air yang dipompa lebih sedikit dari kapasitasnya.`);
    else if (f.pumpsOff) dr.push("Pompa polder tidak dinyalakan. Ini penyesuaian, bukan keadaan nyata: model sudah lebih kering dari kenyataan karena hujan satelit terlalu kecil, dan pompa menambah kekeringan itu. Mematikan pompa menutupi sebagian kekurangan hujan, jadi hasil skenario pompa tidak boleh dibaca sebagai angka mutlak.");
    if (f.micro) dr.push(`Saluran mikro Jakarta Selatan dengan lebar dan kedalaman tercatat${f.micro.drains ? ` (${n(f.micro.drains)} ruas)` : ""} ${cite("dsda2026mikro")} ikut membuang air: kapasitas penuh tiap saluran dihitung dengan rumus Manning ${citeN("chow1959")}, saluran yang tersambung menjadi satu jaringan, dan kapasitas jaringan (saluran yang bermuara ke sungai atau saluran besar) dibagi rata ke daratan yang dilayaninya${f.micro.mmH ? ` (rata-rata ${n(f.micro.mmH)} mm/jam)` : ""}; di area ini kapasitasnya ${n(f.micro.m3s)} m³/detik. Air yang masuk saluran mikro dianggap keluar dari model, tidak ditambahkan ke sungai.`);
    else if (f.microOff) dr.push("Saluran mikro Jakarta Selatan (data ukuran DSDA) tidak dinyalakan dalam simulasi ini, sesuai hasil uji tiga banjir: dengan kapasitas penuh, model di Jakarta Selatan menjadi jauh lebih kering daripada laporan warga.");
    dr.push(`Saluran tersier, dan saluran mikro di luar Jakarta Selatan, tidak punya data ukuran sehingga tidak dihitung satu per satu. Serapan tambahan saluran kecil di lahan terbangun ditetapkan ${n(f.drainMmH)} mm/jam: pada uji lama (paket data sebelum November 2026) setiap nilai 1–40 mm/jam membuat hasil makin jauh dari laporan warga. Nilai 0 ini ada di batas bawah rentang uji, tanda bahwa model kekurangan air dari sumber lain (hujan satelit), bukan bukti bahwa saluran kecil tidak bekerja.`);
  } else {
    if (f.dsdaDrains) dr.push(`City drainage enters the model through ${n(f.dsdaDrains)} primary and secondary drain sections from the Jakarta Satu records ${cite("dsda2026")}, carved into the terrain with their recorded width and depth; the part of each drain below 0 m (sea level) is full when the run starts; elsewhere drains start empty.`);
    if (f.pumpsM3s) dr.push(`Polder pumps with a total capacity of ${n(f.pumpsM3s)} m³/s${f.pumpPolders ? ` in ${n(f.pumpPolders)} polders` : ""} drain the land of their polder; the capacity is spread evenly over the polder, so a partly flooded polder pumps less than its capacity.`);
    else if (f.pumpsOff) dr.push("The polder pumps are off. This is an adjustment, not reality: the model is already drier than reality because the satellite rain is too low, and pumps make it drier still. Switching them off offsets part of the missing rain, so pump scenarios must not be read as absolute numbers.");
    if (f.micro) dr.push(`Micro drains in South Jakarta with a recorded width and depth${f.micro.drains ? ` (${n(f.micro.drains)} sections)` : ""} ${cite("dsda2026mikro")} remove water: each drain's full-flow capacity follows Manning's equation ${citeN("chow1959")}, connected drains form one network, and the network capacity (drains that empty into a river or a large drain) is spread evenly over the land it serves${f.micro.mmH ? ` (mean ${n(f.micro.mmH)} mm/h)` : ""}; in this area the capacity is ${n(f.micro.m3s)} m³/s. Water taken by a micro drain leaves the model; it is not added to the river.`);
    else if (f.microOff) dr.push("The South Jakarta micro drains (DSDA size records) are not switched on in this run, following the three-flood test: at full capacity they made South Jakarta much drier than the citizen reports.");
    dr.push(`Tertiary drains, and micro drains outside South Jakarta, have no recorded size and are not modelled one by one. The extra small-drain sink on built-up land is ${n(f.drainMmH)} mm/h: in an older test (data pack before November 2026) every value of 1–40 mm/h moved results away from the citizen reports. This 0 sits at the lower end of the tested range, a sign that the model lacks water from another source (satellite rain), not proof that small drains do not work.`);
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
      ? `Hujan yang dipakai adalah hujan per jam dari satelit GPM IMERG Final V07 ${cite("huffman2023")}, dalam ${r.points} kotak berukuran sekitar 11 km, dari ${wib(r.wib[0])} sampai ${wib(r.wib[1])}. Setiap sel model memakai hujan kotak terdekat. Rata-rata curah hujan di area ini ${n(r.meanMm)} mm${r.points > 1 ? `; kotak dengan hujan terbanyak menerima ${n(r.maxMm)} mm` : ""}.`
      : `Rain input is hourly GPM IMERG Final V07 satellite precipitation ${cite("huffman2023")} at ${r.points} grid points of 0.1° for ${wib(r.wib[0])} to ${wib(r.wib[1])}; each model cell takes the rain of its nearest point. The area-mean rain was ${n(r.meanMm)} mm${r.points > 1 ? ` and the wettest grid point received ${n(r.maxMm)} mm` : ""}.`;
  } else if (r.kind === "design") {
    rain = id
      ? `Hujan yang dipakai adalah hujan rencana ${n(r.mm)} mm selama ${n(r.h)} jam, dibentuk dengan rumus intensitas Mononobe (sebagaimana dipakai ${citeN("maitsa2021")}) yang diskalakan ke lama hujan${r.h > 24 ? " (diperpanjang melewati 24 jam tempat rumus itu diturunkan: sebuah anggapan)" : ""} dan diurutkan dengan metode blok bergantian ${cite("chow1988")}, dengan intensitas puncak ${n(r.peakMmH)} mm/jam, seragam di seluruh area.${f.upstream ? ` Untuk daerah tangkapan hulu, hujan titik ini dikalikan faktor reduksi luas ${cite("allen2005")}.` : ""}`
      : `Rain input is a design storm of ${n(r.mm)} mm over ${n(r.h)} h, shaped with the Mononobe intensity relation ${cite("maitsa2021")} scaled to the storm duration${r.h > 24 ? " (extended beyond the 24 h it was derived for: an assumption)" : ""} and ordered with the alternating block method ${cite("chow1988")}, with a peak intensity of ${n(r.peakMmH)} mm/h, uniform over the area.${f.upstream ? ` Over the upstream catchments this point depth is multiplied by the areal reduction factor ${cite("allen2005")}.` : ""}`;
  } else {
    rain = id
      ? `Hujan yang dipakai adalah hujan per jam yang diisi pengguna, total ${n(r.mm)} mm selama ${n(r.h)} jam dengan intensitas puncak ${n(r.peakMmH)} mm/jam, seragam di seluruh area.`
      : `Rain input is a user-defined hourly hyetograph of ${n(r.mm)} mm over ${n(r.h)} h with a peak intensity of ${n(r.peakMmH)} mm/h, uniform over the area.`;
  }
  const up = f.upstream;
  const upTxt = up
    ? id ? ` Debit ${up.n} sungai yang masuk dari hulu (daerah tangkapan ${n(up.areaKm2)} km²) dihitung dengan rumus waktu tunda (lag) dan hidrograf satuan sintetis NRCS ${cite("nrcs2010", "nrcs2007")}. Jumlah debit puncaknya ${n(up.peakM3s)} m³/detik.`
      : ` Discharge from ${up.n} rivers entering from upstream (catchment ${n(up.areaKm2)} km²) was computed with the NRCS lag equation and dimensionless unit hydrograph ${cite("nrcs2010", "nrcs2007")}; their combined peak was ${n(up.peakM3s)} m³/s.`
    : id ? " Aliran dari hulu tidak dimasukkan." : " Inflow from upstream was not included.";
  p.push(rain + upTxt + (id ? ` Muka laut dibuat tetap ${n(f.seaM, 1)} m di atas rata-rata muka laut.` : ` Sea level was held at ${n(f.seaM, 1)} m above mean sea level.`));

  // 3. flooded area and depth
  const [c1, c2, c3, c4] = f.env.classesKm2, d = f.env.deepest;
  const deepTxt = d
    ? id ? ` Kedalaman maksimum di daratan ${n(f.env.maxDepth, 2)} m, di ${deg(d.lat, "LU", "LS")}, ${deg(d.lon, "BT", "BB")}${d.kec ? ` (${d.kec})` : ""}; titik seperti ini bisa berupa kolam, galian atau situ yang tidak tercatat sebagai badan air.`
      : ` The maximum depth outside mapped river channels was ${n(f.env.maxDepth, 2)} m at ${deg(d.lat, "N", "S")}, ${deg(d.lon, "E", "W")}${d.kec ? ` (${d.kec})` : ""}; this point may be permanent water not mapped as a channel (lake, pond).`
    : "";
  p.push(id
    ? `Daratan dihitung tergenang bila air di atasnya lebih dari ${fm} m. Selama ${n(f.hours)} jam simulasi, ${n(f.env.km2, 1)} km² (${pct(f.env.km2, f.landKm2)} % daratan) pernah tergenang. Di blok sel yang memuat sungai, yang dihitung hanya bagian daratnya, dengan air di atas tinggi daratnya. Genangan paling luas pada satu waktu ${n(f.peak.km2, 1)} km² (${when(f.peak.tSec)}); di akhir simulasi tersisa ${n(f.endKm2, 1)} km². Menurut kedalaman maksimum, genangan terbagi atas ${n(c1, 1)} km² (${fm}–0,5 m), ${n(c2, 1)} km² (0,5–1 m), ${n(c3, 1)} km² (1–2 m) dan ${n(c4, 1)} km² (> 2 m), dengan rata-rata kedalaman maksimum ${n(f.env.meanDepth, 2)} m.${deepTxt}`
    : `With a flood threshold of more than ${fm} m depth, the total area flooded at any time during the ${n(f.hours)} simulated hours was ${n(f.env.km2, 1)} km² (${pct(f.env.km2, f.landKm2)} % of the modelled land area). The instantaneous flooded area peaked at ${n(f.peak.km2, 1)} km² at ${when(f.peak.tSec)} and was ${n(f.endKm2, 1)} km² at the end of the run. By maximum depth, the flooded area splits into ${n(c1, 1)} km² (${fm}–0.5 m), ${n(c2, 1)} km² (0.5–1 m), ${n(c3, 1)} km² (1–2 m) and ${n(c4, 1)} km² (> 2 m), with a mean maximum depth of ${n(f.env.meanDepth, 2)} m.${deepTxt}`);

  // 4. exposure
  const x = f.expo;
  if (x) {
    const top = x.top.slice(0, 3).map((u) => `${u.name} (${id ? "sekitar " : "about "}${n(round3(u.people))}${id ? " jiwa" : " people"})`).join(", ");
    p.push(id
      ? `Sekitar ${n(round3(x.buildings))} bangunan dan ${n(round3(x.people))} penduduk berada di sel yang pernah tergenang lebih dari ${fm} m, tersebar di ${x.units} kecamatan${top ? `; terbanyak di ${top}` : ""}. Data: penduduk WorldPop ${cite("worldpop2025")} dan jejak bangunan Overture Maps ${cite("overture2026")}.`
      : `Based on WorldPop population data ${cite("worldpop2025")} and Overture Maps building footprints ${cite("overture2026")}, the maximum flood extent above ${fm} m reaches about ${n(round3(x.buildings))} buildings and ${n(round3(x.people))} residents in ${x.units} kecamatan${top ? `; the largest numbers of affected people are in ${top}` : ""}.`);
  }

  // 5. observed reference (observed-flood mode only)
  if (r.kind === "event") {
    const rep = r.reportedKm2 != null
      ? id ? `Sebagai pembanding, Pemerintah Provinsi DKI Jakarta melaporkan genangan seluas ${n(r.reportedKm2)} km² di ${r.reportedRw ?? "?"} RW untuk seluruh DKI Jakarta (Antara, mengutip data Pemprov DKI). ` : `For comparison, the DKI Jakarta provincial government reported ${n(r.reportedKm2)} km² flooded in ${r.reportedRw ?? "?"} RW for all of DKI Jakarta (Antara, quoting provincial data). `
      : "";
    p.push(rep + (id
      ? `Pada uji seluruh wilayah (sel 90 m), ${n(r.hitRate * 100)} % dari ${n(r.reportsN)} laporan warga PetaBencana.id pada kejadian ini berada dalam ±270 m dari daratan yang tergenang model${r.randomRate != null ? `. Titik acak di sekitar tempat warga biasa melapor (dalam 1 km dari laporan) mendapat ${n(r.randomRate * 100)} %` : ""}.${b ? " Angka ini berlaku untuk seluruh wilayah, bukan hanya kotak pilihan." : ""}`
      : `In the whole-region check (90 m cells), ${n(r.hitRate * 100)} % of ${n(r.reportsN)} PetaBencana.id citizen reports for this event lay within about 270 m of land the model flooded${r.randomRate != null ? `, against ${n(r.randomRate * 100)} % for random points where people report (within 1 km of a report)` : ""}.${b ? " These reference figures apply to the whole region, not only the selected area." : ""}`));
  }

  // 6. limitations
  p.push(id
    ? `Hasil ini keluaran model, bukan pengamatan. Model belum memuat pintu air dan tanggul laut${f.pumpsM3s ? ", dan pompa dihitung sebagai batas bawah (kapasitas dibagi rata ke polder)" : ""}. Dasar sungai di bawah muka air tidak terekam di DEM, sehingga banyak sungai kecil terlalu dangkal di model. Jumlah penduduk adalah penduduk yang tinggal di sana, bukan orang yang berada di lokasi saat banjir.${r.kind === "event" ? " Hujan satelit dengan kotak sekitar 11 km meratakan puncak hujan setempat, sehingga kedalaman model di lokasi laporan cenderung lebih dangkal dari laporan warga (lihat halaman Validasi)." : ""} Neraca air seimbang: selisih air masuk dan keluar ${sci(Math.abs(f.massError))} dari total air, praktis nol.`
    : `These are model results, not observations. The model does not yet include sluice gates or sea walls${f.pumpsM3s ? ", pumps are a lower bound (capacity spread over the polder)" : ""}, the channel bed below the water surface is not in the DEM, so many small rivers are too shallow in the model, and population counts are residents, not people present during the flood.${r.kind === "event" ? " The 0.1° satellite rain smooths local rain peaks, so modelled depths at report points tend to be shallower than reported (see the Validation page)." : ""} The water balance closes: the gap between water in and out is ${sci(Math.abs(f.massError))} of the total, practically zero.`);

  const refs = sortRefs([...used].map((k) => REFS.get(k)!));
  const summary = plainSummary(f, id, n, when, loc), why = whyHere(f, id, n, deg);
  const other = [
    `Esri / Impact Observatory 10 m Annual Land Use Land Cover ${f.landcoverYear}, CC BY 4.0. https://registry.opendata.aws/io-lulc/`,
    "OpenStreetMap contributors (ODbL). https://www.openstreetmap.org",
    "Copernicus DEM GLO-90 (ESA). https://registry.opendata.aws/copernicus-dem/",
    ...(r.kind === "event" ? ["PetaBencana.id flood report archive. https://docs.petabencana.id", "Antara (2020), Pemprov DKI figures from the 7 Jan 2020 coordination meeting. https://www.antaranews.com/berita/1921596/banjir-dan-kenangan ; https://sumut.antaranews.com/berita/270492/banjir-tahun-baru-2020-adalah-yang-terbaik-selama-siklus-banjir-besar-jakarta"] : []),
  ];
  const head = id ? ["Kesimpulan", "Daftar pustaka", "Sumber data lain"] : ["Conclusion", "References", "Other data sources"];
  const text = [p.join("\n\n"), `${head[1]}\n${refs.map((x) => refEntry(x).text).join("\n")}`, `${head[2]}\n${other.join("\n")}`].join("\n\n");
  const sHead = id ? "Ringkasan" : "Summary";
  const wHead = id ? "Mengapa di sini tergenang?" : "Why does it flood here?";
  const text2 = `${sHead}\n${summary.map((x) => `- ${x}`).join("\n")}\n\n${why.length ? `${wHead}\n${why.map((x) => `- ${x}`).join("\n")}\n\n` : ""}${id ? "Penjelasan ilmiah" : "Scientific detail"}\n${text}`;
  return { summary, why, whyHead: wHead, paragraphs: p, refs: refs.map((x) => refEntry(x).html), other, text: text2, head };
}

/** "1 Januari 2020" / "1 January 2020" from an event id. */
export const eventDate = (id: string, loc: string) => new Date(`${id}T00:00:00Z`).toLocaleDateString(loc, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
/** "1 × 10⁻¹⁴" for the water-balance error. */
export const sci = (v: number) => {
  if (!v) return "0";
  const e = Math.floor(Math.log10(Math.abs(v))), m = Math.round(Math.abs(v) / 10 ** e), sup = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return `${m} × 10${e < 0 ? "⁻" : ""}${String(Math.abs(e)).split("").map((d) => sup[+d]).join("")}`;
};

/** Plain summary (owner 2026-11-18, review 04 §2.C): short sentences, one idea each, every number from the run or skill.json, the
 *  trust verdict from the fair baselines (review 03), and a closing sentence that says what the map may and may not be used for. */
function plainSummary(f: Facts, id: boolean, n: (v: number, d?: number) => string, when: (s: number) => string, loc: string): string[] {
  const out: string[] = [], r = f.rain, fm = n(f.floodM * 100);
  const area = f.area.box ? (id ? `kotak pilihan ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km` : `a chosen ${n(f.area.wKm, 1)} × ${n(f.area.hKm, 1)} km box`)
    : id ? "seluruh DKI Jakarta dan 10 km di sekelilingnya" : "all of DKI Jakarta and 10 km around it";
  const rainTxt = r.kind === "event"
    ? id ? `banjir ${eventDate(r.id, loc)} (hujan satelit rata-rata ${n(r.meanMm)} mm)` : `the flood of ${eventDate(r.id, loc)} (satellite rain ${n(r.meanMm)} mm on average)`
    : id ? `hujan ${n(r.mm)} mm selama ${n(r.h)} jam (jam terderas ${n(r.peakMmH)} mm)` : `${n(r.mm)} mm of rain over ${n(r.h)} hours (wettest hour ${n(r.peakMmH)} mm)`;
  out.push(id ? `Yang dihitung: ${rainTxt} di ${area}, selama ${n(f.hours)} jam.` : `What was run: ${rainTxt} over ${area}, for ${n(f.hours)} hours.`);
  const w = f.water;
  if (w && w.rainM3 + w.inflowM3 > 0) {
    const up = Math.round((100 * w.inflowM3) / (w.rainM3 + w.inflowM3));
    out.push(f.upstream && up > 0
      ? id ? `Asal air: ${n(100 - up)} % dari hujan yang turun di area ini dan ${n(up)} % dari sungai yang membawa air ${f.area.box ? "dari luar kotak" : "dari hulu"}.`
        : `Where the water came from: ${n(100 - up)} % rain on this area and ${n(up)} % river water from ${f.area.box ? "outside the box" : "upstream"}.`
      : id ? "Asal air: seluruhnya dari hujan yang turun di area ini (air sungai dari hulu tidak dimasukkan)." : "Where the water came from: all of it is rain on this area (river water from upstream not included).");
  }
  const e = f.env, [c1, c2, c3, c4] = e.classesKm2;
  out.push(id ? `Luas: sekitar ${n(e.km2, 1)} km² (${n(f.landKm2 > 0 ? (100 * e.km2) / f.landKm2 : 0, 1)} % daratan) pernah tergenang lebih dari ${fm} cm.`
    : `Extent: about ${n(e.km2, 1)} km² (${n(f.landKm2 > 0 ? (100 * e.km2) / f.landKm2 : 0, 1)} % of the land) was flooded deeper than ${fm} cm at some time.`);
  out.push(id ? `Genangan paling luas terjadi pada ${when(f.peak.tSec)}, yaitu ${n(f.peak.km2, 1)} km². Di akhir hitungan tersisa ${n(f.endKm2, 1)} km².`
    : `The flooded area was largest at ${when(f.peak.tSec)}: ${n(f.peak.km2, 1)} km². At the end of the run ${n(f.endKm2, 1)} km² remained.`);
  if (e.km2 > 0) out.push(id ? `Kedalaman: ${n((100 * c1) / e.km2)} % genangan setinggi mata kaki sampai lutut (${fm}–50 cm), ${n(c2, 1)} km² setinggi lutut sampai pinggang (0,5–1 m), dan ${n(c3 + c4, 1)} km² lebih dalam dari 1 m.`
    : `Depth: ${n((100 * c1) / e.km2)} % of the flooded area is ankle to knee deep (${fm}–50 cm), ${n(c2, 1)} km² knee to waist (0.5–1 m) and ${n(c3 + c4, 1)} km² deeper than 1 m.`);
  if (f.expo) {
    const top = f.expo.top.slice(0, 3).map((u) => u.name).join(", ");
    out.push(id ? `Dampak: sekitar ${n(round3(f.expo.buildings))} bangunan dan ${n(round3(f.expo.people))} penduduk berada di area yang tergenang lebih dari ${fm} cm${top ? `; terbanyak di ${top}` : ""}.`
      : `Impact: about ${n(round3(f.expo.buildings))} buildings and ${n(round3(f.expo.people))} residents are in areas flooded deeper than ${fm} cm${top ? `; most in ${top}` : ""}.`);
  }
  if (w && w.rainM3 + w.inflowM3 > 0) {
    const tot = w.rainM3 + w.inflowM3, pc = (v: number) => n(Math.max(0, (100 * v) / tot)), big = (v?: number) => v != null && (100 * v) / tot >= 0.5;
    const parts = id
      ? [`${pc(w.infilM3)} % meresap ke tanah`, ...(big(w.seaM3) ? [`${pc(w.seaM3)} % mengalir ke laut`] : []), ...(big(w.outM3) ? [`${pc(w.outM3)} % keluar lewat tepi area`] : []), ...(big(w.drainM3) ? [`${pc(w.drainM3!)} % dibuang pompa atau saluran`] : []), ...(big(w.storedM3) ? [`${pc(w.storedM3!)} % masih ada di permukaan pada akhir hitungan (termasuk air di sungai)`] : [])]
      : [`${pc(w.infilM3)} % soaked in`, ...(big(w.seaM3) ? [`${pc(w.seaM3)} % flowed to the sea`] : []), ...(big(w.outM3) ? [`${pc(w.outM3)} % left over the edge of the area`] : []), ...(big(w.drainM3) ? [`${pc(w.drainM3!)} % was removed by pumps or drains`] : []), ...(big(w.storedM3) ? [`${pc(w.storedM3!)} % was still on the surface at the end (river water included)`] : [])];
    out.push(id ? `Ke mana airnya: dari seluruh air yang masuk, ${parts.join(", ")}.` : `Where the water went: of all water that came in, ${parts.join(", ")}.`);
  }
  const sk = f.skill?.events;
  if (sk?.length) {
    const yr = (xs: typeof sk) => xs.map((x) => x.id.slice(0, 4)).join(id ? " dan " : " and ");
    const better = sk.filter((x) => x.verdict === "better"), notB = sk.filter((x) => x.verdict === "not_better"), few = sk.filter((x) => x.verdict === "too_few");
    const s1 = id ? [better.length ? `terbukti lebih baik dari tebakan acak hanya pada banjir ${yr(better)}` : "belum terbukti lebih baik dari tebakan acak pada banjir mana pun", notB.length ? `pada ${yr(notB)} tidak lebih baik dari acak` : "", few.length ? `pada ${yr(few)} laporannya terlalu sedikit untuk dinilai` : ""]
      : [better.length ? `proved better than a random guess only for the ${yr(better)} flood` : "not yet proved better than a random guess for any flood", notB.length ? `no better than random in ${yr(notB)}` : "", few.length ? `too few reports to judge in ${yr(few)}` : ""];
    if (sk.some((x) => x.verdict)) out.push(id ? `Seberapa bisa dipercaya: model ini diuji pada tiga banjir nyata dengan laporan warga PetaBencana. Letak genangannya ${s1.filter(Boolean).join("; ")}.`
      : `How far to trust it: the model was checked on three recorded floods with PetaBencana citizen reports. Its flood locations were ${s1.filter(Boolean).join("; ")}.`);
    const ev = sk.find((x) => r.kind === "event" && x.id === r.id) ?? sk[0];
    out.push(id ? `Model juga terlalu dangkal: di lokasi laporan warga banjir ${eventDate(ev.id, loc)}, nilai tengah kedalaman model ${n(ev.modelMedianM * 100)} cm, sedangkan warga melaporkan ${n(ev.obsMedianM * 100)} cm.`
      : `The model is also too shallow: at the citizen reports of the ${eventDate(ev.id, loc)} flood, the median model depth is ${n(ev.modelMedianM * 100)} cm, against ${n(ev.obsMedianM * 100)} cm reported.`);
    const nf = nearFar(ev.byDistance);
    if (nf) {
      const P = (v: number) => n(100 * v), gN = nf.near.hit - nf.near.random, gF = nf.far.hit - nf.far.random;
      out.push(id ? `Di mana model paling lemah (banjir ${eventDate(ev.id, loc)}): ${P(nf.near.share)} % laporan warga ada di sungai atau kurang dari 100 m darinya, padahal zona itu hanya ${P(nf.near.cells)} % dari peta. Di zona itu model kena ${P(nf.near.hit)} % laporan, titik acak yang sama dekatnya ke sungai ${P(nf.near.random)} %. Lebih dari 500 m dari sungai: ${P(nf.far.hit)} % lawan ${P(nf.far.random)} %.${gF - gN >= 0.1 ? " Jadi genangan hujan di tanah rendah lebih tertangkap daripada luapan sungai ke permukiman di tepinya." : ""}`
        : `Where the model is weakest (the ${eventDate(ev.id, loc)} flood): ${P(nf.near.share)} % of citizen reports lie in a river or within 100 m of one, a zone that is only ${P(nf.near.cells)} % of the map. There the model hit ${P(nf.near.hit)} % of reports, random points equally close to a river ${P(nf.near.random)} %. More than 500 m from a river: ${P(nf.far.hit)} % against ${P(nf.far.random)} %.${gF - gN >= 0.1 ? " So rain ponding on low ground is caught better than rivers spilling into the neighbourhoods along their banks." : ""}`);
    }
    const e20 = sk.find((x) => x.reportedKm2);
    if (e20) out.push(id ? `Luas genangan model di DKI pada banjir ${eventDate(e20.id, loc)} adalah ${n(e20.dkiKm2)} km², sedangkan Pemprov DKI melaporkan ${n(e20.reportedKm2!)} km² (cara Pemprov menghitung luas itu tidak diketahui).`
      : `The modelled flooded area in DKI for the ${eventDate(e20.id, loc)} flood is ${n(e20.dkiKm2)} km², against ${n(e20.reportedKm2!)} km² reported by the provincial government (how that figure was measured is not known).`);
    out.push(id ? "Dugaan penyebab (belum diuji satu per satu): hujan satelit lebih kecil dari hujan terukur (Halim, 1 Januari 2020: alat ukur 377 mm dalam sehari, satelit 166 mm), banyak sungai kecil terlalu dangkal di peta tinggi tanah, dan galat peta tinggi tanah (sekitar 1 m di kawasan terbangun) lebih besar dari kedalaman banjir biasa."
      : "Likely causes (not yet tested one by one): satellite rain is lower than gauged rain (Halim, 1 January 2020: gauge 377 mm in one day, satellite 166 mm), many small rivers are too shallow in the terrain data, and the terrain error (about 1 m in built-up areas) is larger than typical flood depths.");
  }
  out.push(id ? `Jadi: peta ini cocok untuk membandingkan skenario (misalnya hujan lebih besar, atau pompa menyala) dan melihat pola umum. Peta ini belum bisa memastikan apakah satu kawasan atau rumah tertentu kebanjiran, dan luas serta kedalamannya kemungkinan terlalu kecil.${r.kind === "event" ? "" : " Hasil hujan rencana tidak bisa dicek dengan kejadian nyata; ia menjawab pertanyaan \"bagaimana jika\"."}`
    : `In short: this map is suited to comparing scenarios (for example more rain, or pumps running) and to seeing the general pattern. It cannot yet tell whether a given neighbourhood or house floods, and its extent and depth are probably too small.${r.kind === "event" ? "" : " A design-storm result cannot be checked against a real event; it answers a \"what if\" question."}`);
  return out;
}

/** "Why does it flood here?" for the largest flooded places (places.ts): computed reasons only, closed by the terrain caveat. */
function whyHere(f: Facts, id: boolean, n: (v: number, d?: number) => string, deg: (v: number, pos: string, neg: string) => string): string[] {
  const ps = f.places ?? [];
  if (!ps.length) return [];
  const out = [id ? "Alasan di bawah dihitung dari peta tinggi tanah, alur sungai dan muka air model, bukan dari pengamatan lapangan."
    : "The reasons below are computed from the terrain, the river channels and the modelled water levels, not from field observation."];
  for (const p of ps) {
    const where = p.name ?? (id ? `Kawasan di sekitar ${deg(p.lat, "LU", "LS")}, ${deg(p.lon, "BT", "BB")}` : `The area around ${deg(p.lat, "N", "S")}, ${deg(p.lon, "E", "W")}`);
    const s: string[] = [id ? `${where}: ${n(p.areaKm2, 1)} km² tergenang, umumnya sampai ${n(p.depthP90, 1)} m.` : `${where}: ${n(p.areaKm2, 1)} km² flooded, mostly up to ${n(p.depthP90, 1)} m.`];
    const rs = Math.round(100 * p.riverShare);
    s.push(p.riverShare >= 0.5
      ? id ? `${rs} % genangannya ada di tepi sungai atau saluran yang muka airnya naik lebih tinggi dari tanah di sampingnya, jadi sebagian besar airnya kemungkinan luapan sungai.` : `${rs} % of it lies beside a river or drain whose water rose above the land next to it, so most of the water probably came over the bank.`
      : p.riverShare < 0.2
        ? id ? `Hanya ${rs} % genangannya ada di tepi sungai yang meluap; sebagian besar adalah air hujan yang mengalir dan berkumpul di tanah yang lebih rendah.` : `Only ${rs} % of it lies beside an overflowing river; most of it is rain water that ran off and gathered in lower ground.`
        : id ? `${rs} % genangannya ada di tepi sungai yang meluap; sisanya air hujan yang berkumpul di tanah yang lebih rendah.` : `${rs} % of it lies beside an overflowing river; the rest is rain water gathered in lower ground.`);
    if (p.reliefM != null) s.push(p.reliefM <= -0.3
      ? id ? `Tanah yang tergenang rata-rata ${n(-p.reliefM, 1)} m lebih rendah dari daratan kering di sekitarnya (dalam radius 450 m).` : `The flooded ground lies on average ${n(-p.reliefM, 1)} m below the dry land around it (within 450 m).`
      : id ? `Tanah yang tergenang hampir sama tinggi dengan daratan di sekitarnya (selisih ${n(p.reliefM, 1)} m), jadi letak yang rendah bukan penyebab utamanya.` : `The flooded ground is about as high as the land around it (difference ${n(p.reliefM, 1)} m), so low position is not the main cause.`);
    if (p.loweredM != null && p.loweredM >= 0.1) s.push(id ? `Sejak ${f.subEpoch ?? 2013}, tanah di sini turun rata-rata ${n(p.loweredM * 100)} cm (pengukuran satelit radar).` : `Since ${f.subEpoch ?? 2013} the ground here has sunk by ${n(p.loweredM * 100)} cm on average (satellite radar).`);
    if (p.reliefM != null && Math.abs(p.reliefM) < 1) s.push(id ? "Catatan: selisih tinggi ini lebih kecil dari galat peta tinggi tanah (sekitar 1 m di kawasan terbangun), jadi alasan ini belum pasti." : "Note: this height difference is smaller than the terrain error (about 1 m in built-up areas), so this reason is uncertain.");
    out.push(s.join(" "));
  }
  return out;
}
