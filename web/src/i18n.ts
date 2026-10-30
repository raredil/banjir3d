// UI strings (Indonesian first: the owner's language). Dataset metadata stays in English (research output language, BLUEPRINT A4).
const id = {
  "brand.sub": "Simulasi banjir Jakarta",
  "nav.map": "Peta", "nav.sim": "Simulasi", "nav.data": "Data", "nav.methods": "Metode", "nav.validation": "Validasi",
  "region": "DKI Jakarta + 10 km", "updated": "Data terbaru",
  "tab.layers": "Lapisan", "tab.sim": "Simulasi",
  "basemap": "Peta dasar", "basemap.light": "Peta jalan (OpenFreeMap)", "basemap.none": "Tanpa peta dasar",
  "g.imagery": "Citra satelit", "g.terrain": "Ketinggian", "g.landcover": "Tutupan lahan", "g.water": "Air", "g.exposure": "Bangunan & penduduk", "g.admin": "Batas wilayah",
  "opacity": "Transparansi", "source": "Sumber", "nopack": "Data wilayah belum tersedia.",
  "coords": "Koordinat",
  // simulation
  "sim.area": "Area", "sim.area.region": "Seluruh wilayah", "sim.area.box": "Pilih area",
  "sim.area.region.h": "DKI Jakarta + 10 km (±52 × 51 km). Sungai yang masuk dari Bogor, Depok, Tangerang dan Bekasi dihitung otomatis.",
  "sim.area.box.h": "Klik “Gambar area”, lalu tarik kotak di peta. Sungai yang masuk ke kotak membawa air dari seluruh daerah hulunya.",
  "sim.draw": "Gambar area", "sim.drawing": "Tarik kotak di peta…", "sim.box": "Kotak {w} × {h} km",
  "sim.rain": "Hujan", "sim.preset": "Pakai kejadian 1 Jan 2020", "sim.preset.h": "Hujan terukur satelit 31 Des 2019–2 Jan 2020, tiap kotak ±11 km dengan hujannya sendiri. Stasiun Halim mencatat 377 mm sehari (Lubis dkk. 2022); satelit meratakannya (166 mm di kotak itu).",
  "sim.mode": "Bentuk hujan", "sim.mode.design": "Total sehari (pola hujan rencana)", "sim.mode.hourly": "Saya ketik per jam", "sim.mode.event": "Banjir nyata (hujan terukur)",
  "sim.event": "Kejadian", "sim.event.h": "Hujan sungguhan per jam dari satelit NASA GPM IMERG (kotak 0,1° ≈ 11 km), tiap kotak dengan hujannya sendiri, juga di hulu. Satelit meratakan hujan lokal, jadi genangan model cenderung lebih dangkal dari laporan (lihat Validasi).",
  "sim.event.info": "Hujan rata-rata {mm} mm / {h} jam (kotak terbasah {mx} mm). {n} laporan warga (PetaBencana), {p}% kena genangan model.",
  "sim.event.rep": "Laporan Pemprov DKI: {km2} km², {rw} RW.", "sim.up.ev": "Hujan terukur di hulu ikut dihitung",
  "sim.r24": "Total hujan 24 jam", "sim.r24.h": "Jumlah hujan dalam sehari. Patokan: hujan lebat 50–100 mm, sangat lebat 100–150 mm, ekstrem > 150 mm (kategori BMKG). 1 Jan 2020: 377 mm.",
  "sim.dur": "Lama hujan", "sim.dur.h": "Berapa jam hujan itu turun. Hujan yang sama dalam waktu lebih singkat berarti lebih deras (pola Mononobe, puncak di tengah).",
  "sim.hourly": "Hujan per jam (mm)", "sim.hourly.h": "Ketik angka per jam dipisah koma, misalnya 5, 20, 60, 35, 10 (maksimal 72 jam).",
  "sim.hourly.bad": "Ketik angka 0–500 per jam, dipisah koma (maks. 72 jam).",
  "sim.up": "Hujan yang sama turun di hulu", "sim.up.h": "Hujan juga jatuh di daerah hulu (Bogor, Puncak, Depok). Air sungainya masuk lewat titik sungai di tepi area, dihitung dari luas tangkapan, tanah dan tutupan lahan hulu.",
  "sim.sea": "Tinggi muka laut", "sim.sea.h": "Di atas rata-rata (0 = rata-rata). Pasang tinggi Jakarta sekitar +0,6 m. Tanggul laut belum ada di data medan, jadi nilai di atas ±0,5 m melebih-lebihkan banjir pesisir.",
  "sim.hours": "Lama simulasi", "sim.hours.h": "Berapa jam sejak hujan mulai yang dihitung. Beri waktu setelah hujan berhenti, karena air dari hulu datang belakangan.",
  "sim.res": "Ukuran sel", "sim.res.h": "30 m paling detail. 60 m dan 90 m lebih cepat untuk mencoba-coba; sungai kecil jadi kurang tepat.",
  "sim.auto": "Data yang dipakai",
  "sim.auto.terrain": "Medan FABDEM 30 m + alur sungai OSM",
  "sim.auto.soil": "Resapan: tutupan lahan {y} dan tanah ({soil})",
  "sim.auto.rough": "Kekasaran: tutupan lahan {y}",
  "sim.auto.up": "{n} sungai masuk, hulu {a} km²",
  "sim.auto.drain": "Saluran kota: dikalibrasi pada banjir nyata (lihat Validasi). Pompa dan tanggul laut belum",
  "sim.soilwarn": "Kelompok tanah sementara (data SoilGrids sedang diproses). Hasil belum final.",
  "sim.run": "Jalankan simulasi", "sim.cancel": "Batalkan", "sim.clear": "Hapus hasil",
  "sim.loading": "Memuat data mesin…", "sim.running": "Menghitung… {p}%", "sim.done": "Selesai, {s} detik ({e})",
  "sim.gpu": "GPU", "sim.cpu": "CPU", "sim.err": "Simulasi gagal: {m}",
  "sim.cpuwarn": "Tanpa WebGPU: lebih lambat, seluruh wilayah memakai sel 90 m.",
  "sim.show": "Tampilkan", "sim.show.now": "Saat ini", "sim.show.max": "Maksimum",
  "kpi.area": "Luas banjir", "kpi.area.s": "kedalaman > 15 cm, di luar sungai", "kpi.depth": "Terdalam", "kpi.depth.s": "di luar alur sungai",
  "kpi.rain": "Total hujan", "kpi.rain.s": "total di area", "kpi.inflow": "Air dari hulu (puncak)", "kpi.inflow.s": "jumlah semua sungai masuk",
  "kpi.bld": "Bangunan tergenang", "kpi.bld.s": "bangunan di sel dengan genangan > 15 cm (Overture)", "kpi.pop": "Penduduk terdampak", "kpi.pop.s": "penduduk di sel dengan genangan > 15 cm (WorldPop 2025)",
  "sim.expo": "Terdampak per kecamatan", "sim.expo.h": "Bangunan (Overture Maps) dan penduduk (WorldPop 2025) di sel yang tergenang > 15 cm, dijumlah per kecamatan (batas dari OpenStreetMap). Mengikuti peta: saat ini atau maksimum. Kota Bekasi tidak punya batas kecamatan di sumber ini, jadi dihitung satu kota.",
  "sim.expo.kec": "Kecamatan", "sim.expo.bld": "Bangunan", "sim.expo.pop": "Penduduk", "sim.expo.other": "lainnya", "sim.expo.more": "+{n} kecamatan lain di tabel CSV",
  "sim.expo.none": "Data bangunan per kecamatan belum tersedia di rilis data ini.",
  "kpi.time": "Waktu", "legend": "Kedalaman banjir (m)",
  "exp.btn": "Ekspor", "exp.tif": "GeoTIFF kedalaman (m)", "exp.tif.h": "Angka kedalaman per sel 30 m, UTM 48S. Buka langsung di QGIS/ArcGIS.",
  "exp.ctif": "GeoTIFF berwarna", "exp.ctif.h": "Gambar berwarna sesuai legenda, langsung tampil di QGIS/ArcGIS.",
  "exp.html": "Peta HTML", "exp.html.h": "Satu file peta interaktif, bisa dibuka di browser atau dibagikan.",
  "exp.png": "Gambar peta (PNG)", "exp.png.h": "Tampilan saat ini dengan judul, legenda, skala, arah utara dan sumber.",
  "exp.csv": "Tabel per kecamatan (CSV)", "exp.csv.h": "Bangunan dan penduduk tergenang per kecamatan, bisa dibuka di Excel.",
  "exp.json": "Catatan proses (JSON)", "exp.json.h": "Semua masukan, versi data, parameter dan hasil cek massa, untuk lampiran tesis.",
  "exp.which": "Ekspor kedalaman: {w}", "exp.none": "Jalankan simulasi dulu.",
  "exp.title": "Simulasi banjir", "exp.limit": "Hasil model tanpa drainase kota dan pompa; bukan peta banjir resmi.",
  // data page
  "data.title": "Data", "data.lead": "Data yang dipakai, versinya, dan gunanya.",
  "data.use.engine": "Mesin simulasi", "data.use.map": "Lapisan peta", "data.use.validation": "Validasi", "data.use.planned": "Belum dipakai",
  "data.all": "Semua", "data.version": "Versi", "data.res": "Resolusi", "data.licence": "Lisensi", "data.provider": "Penyedia", "data.more": "Rincian dan sitasi",
  "data.copy": "Salin BibTeX", "data.copied": "Tersalin", "data.checks": "Pemeriksaan data otomatis", "data.pass": "lolos", "data.fail": "gagal",
  "data.pack": "Paket data wilayah", "data.engine": "Paket data mesin", "data.bib": "Unduh semua sitasi (.bib)",
  // methods / validation
  "me.md": "Unduh METHODS.md", "me.bib": "Unduh referensi (.bib)", "me.lang": "Teks metode ditulis dalam bahasa Inggris (bahasa publikasi).",
  "me.note": "Setiap sitasi tertaut ke daftar pustaka; setiap entri tertaut ke DOI atau sumber resmi.",
  "va.title": "Validasi", "va.lead": "Uji yang sudah dijalankan dan hasilnya.",
};
type Dict = Record<keyof typeof id, string>;
const en: Dict = {
  "brand.sub": "Jakarta flood simulation",
  "nav.map": "Map", "nav.sim": "Simulation", "nav.data": "Data", "nav.methods": "Methods", "nav.validation": "Validation",
  "region": "DKI Jakarta + 10 km", "updated": "Newest data",
  "tab.layers": "Layers", "tab.sim": "Simulation",
  "basemap": "Base map", "basemap.light": "Street map (OpenFreeMap)", "basemap.none": "No base map",
  "g.imagery": "Satellite image", "g.terrain": "Elevation", "g.landcover": "Land cover", "g.water": "Water", "g.exposure": "Buildings & people", "g.admin": "Boundaries",
  "opacity": "Opacity", "source": "Source", "nopack": "Region data not available yet.",
  "coords": "Coordinates",
  "sim.area": "Area", "sim.area.region": "Whole region", "sim.area.box": "Pick an area",
  "sim.area.region.h": "DKI Jakarta + 10 km (about 52 × 51 km). Rivers entering from Bogor, Depok, Tangerang and Bekasi are computed automatically.",
  "sim.area.box.h": "Click “Draw area”, then drag a box on the map. Rivers entering the box bring water from their whole upstream catchment.",
  "sim.draw": "Draw area", "sim.drawing": "Drag a box on the map…", "sim.box": "Box {w} × {h} km",
  "sim.rain": "Rain", "sim.preset": "Use the 1 Jan 2020 event", "sim.preset.h": "Satellite-measured rain 31 Dec 2019–2 Jan 2020, each ±11 km box with its own rain. The Halim gauge measured 377 mm in a day (Lubis et al. 2022); the satellite smooths it (166 mm in that box).",
  "sim.mode": "Rain shape", "sim.mode.design": "Daily total (design storm)", "sim.mode.hourly": "I type hourly values", "sim.mode.event": "Observed flood (measured rain)",
  "sim.event": "Event", "sim.event.h": "Real hourly rain from NASA GPM IMERG satellites (0.1° boxes ≈ 11 km), each box with its own rain, upstream too. Satellites smooth local downpours, so modelled water tends to be shallower than reported (see Validation).",
  "sim.event.info": "Mean rain {mm} mm / {h} h (wettest box {mx} mm). {n} citizen reports (PetaBencana), {p}% inside modelled water.",
  "sim.event.rep": "Jakarta government: {km2} km², {rw} RW.", "sim.up.ev": "Measured upstream rain included",
  "sim.r24": "24-hour rain total", "sim.r24.h": "Rain in one day. For scale: heavy 50–100 mm, very heavy 100–150 mm, extreme > 150 mm (BMKG classes). 1 Jan 2020: 377 mm.",
  "sim.dur": "Rain duration", "sim.dur.h": "How many hours the rain falls. The same total in fewer hours is more intense (Mononobe shape, peak in the middle).",
  "sim.hourly": "Rain per hour (mm)", "sim.hourly.h": "Type one number per hour separated by commas, e.g. 5, 20, 60, 35, 10 (up to 72 hours).",
  "sim.hourly.bad": "Type numbers 0–500 per hour, separated by commas (max 72 hours).",
  "sim.up": "Same rain falls upstream", "sim.up.h": "Rain also falls on the upstream land (Bogor, Puncak, Depok). Its river water enters at the river points on the area edge, computed from catchment size, soil and land cover.",
  "sim.sea": "Sea level", "sim.sea.h": "Above mean (0 = mean). Jakarta high tide is about +0.6 m. Sea walls are not in the terrain data, so values above about 0.5 m overstate coastal flooding.",
  "sim.hours": "Simulated time", "sim.hours.h": "Hours after the rain starts. Leave time after the rain stops: upstream water arrives later.",
  "sim.res": "Cell size", "sim.res.h": "30 m is the most detailed. 60 m and 90 m are faster for trying things; small rivers are less exact.",
  "sim.auto": "Data used",
  "sim.auto.terrain": "FABDEM 30 m terrain + OSM river paths",
  "sim.auto.soil": "Infiltration: land cover {y} and soil ({soil})",
  "sim.auto.rough": "Roughness: land cover {y}",
  "sim.auto.up": "{n} entering rivers, upstream {a} km²",
  "sim.auto.drain": "City drains: calibrated on observed floods (see Validation). Pumps and sea walls not yet",
  "sim.soilwarn": "Provisional soil groups (SoilGrids is being processed). Results are not final.",
  "sim.run": "Run simulation", "sim.cancel": "Cancel", "sim.clear": "Clear result",
  "sim.loading": "Loading engine data…", "sim.running": "Computing… {p}%", "sim.done": "Done, {s} s ({e})",
  "sim.gpu": "GPU", "sim.cpu": "CPU", "sim.err": "Simulation failed: {m}",
  "sim.cpuwarn": "No WebGPU: slower, the whole region uses 90 m cells.",
  "sim.show": "Show", "sim.show.now": "Now", "sim.show.max": "Maximum",
  "kpi.area": "Flooded area", "kpi.area.s": "depth > 15 cm, outside rivers", "kpi.depth": "Deepest", "kpi.depth.s": "outside river channels",
  "kpi.rain": "Rain", "kpi.rain.s": "total over the area", "kpi.inflow": "Upstream inflow (peak)", "kpi.inflow.s": "sum of all entering rivers",
  "kpi.bld": "Buildings flooded", "kpi.bld.s": "buildings in cells with water > 15 cm (Overture)", "kpi.pop": "People affected", "kpi.pop.s": "people in cells with water > 15 cm (WorldPop 2025)",
  "sim.expo": "Affected per kecamatan", "sim.expo.h": "Buildings (Overture Maps) and people (WorldPop 2025) in cells with water deeper than 15 cm, summed per kecamatan (sub-district; boundaries from OpenStreetMap). Follows the map: now or maximum. Kota Bekasi has no kecamatan boundaries in this source and is counted as one city.",
  "sim.expo.kec": "Kecamatan", "sim.expo.bld": "Buildings", "sim.expo.pop": "People", "sim.expo.other": "other", "sim.expo.more": "+{n} more kecamatan in the CSV table",
  "sim.expo.none": "Building counts per kecamatan are not in this data release yet.",
  "kpi.time": "Time", "legend": "Flood depth (m)",
  "exp.btn": "Export", "exp.tif": "Depth GeoTIFF (m)", "exp.tif.h": "Depth per 30 m cell, UTM 48S. Opens directly in QGIS/ArcGIS.",
  "exp.ctif": "Coloured GeoTIFF", "exp.ctif.h": "Colour image by the legend, shows directly in QGIS/ArcGIS.",
  "exp.html": "HTML map", "exp.html.h": "One interactive map file to open in a browser or share.",
  "exp.png": "Map image (PNG)", "exp.png.h": "Current view with title, legend, scale, north arrow and sources.",
  "exp.csv": "Table per kecamatan (CSV)", "exp.csv.h": "Buildings and people flooded per kecamatan, opens in Excel.",
  "exp.json": "Process record (JSON)", "exp.json.h": "All inputs, data versions, parameters and the mass check, for a thesis appendix.",
  "exp.which": "Exporting depth: {w}", "exp.none": "Run a simulation first.",
  "exp.title": "Flood simulation", "exp.limit": "Model result without city drains and pumps; not an official flood map.",
  "data.title": "Data", "data.lead": "Datasets used, their versions and what they are for.",
  "data.use.engine": "Simulation engine", "data.use.map": "Map layer", "data.use.validation": "Validation", "data.use.planned": "Not used yet",
  "data.all": "All", "data.version": "Version", "data.res": "Resolution", "data.licence": "Licence", "data.provider": "Provider", "data.more": "Details and citation",
  "data.copy": "Copy BibTeX", "data.copied": "Copied", "data.checks": "Automatic data checks", "data.pass": "pass", "data.fail": "fail",
  "data.pack": "Region data pack", "data.engine": "Engine data pack", "data.bib": "Download all citations (.bib)",
  "me.md": "Download METHODS.md", "me.bib": "Download references (.bib)", "me.lang": "",
  "me.note": "Every citation links to its reference; every reference links to its DOI or official source.",
  "va.title": "Validation", "va.lead": "Tests that have been run and their results.",
};
const STR = { id, en };

export type Lang = keyof typeof STR;
export type Key = keyof typeof id;

function initial(): Lang {
  try {
    const saved = localStorage.getItem("b3d.lang");
    if (saved === "en" || saved === "id") return saved;
  } catch {
    /* storage unavailable */
  }
  return "id";
}

export let lang: Lang = initial();

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem("b3d.lang", l);
  } catch {
    /* ignore */
  }
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = STR[lang][key] ?? STR.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  document.documentElement.lang = lang;
}
