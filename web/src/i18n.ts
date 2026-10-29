// UI strings. Dataset metadata stays in English (research output language, BLUEPRINT A4).
const STR = {
  en: {
    phase: "Phase 2 · Explore",
    "nav.map": "Map",
    "nav.catalog": "Data catalog",
    "nav.sample": "3D sample",
    "s3.title": "3D sample",
    "s3.name": "Ciliwung, Kampung Melayu–Manggarai (10 × 10 km)",
    "s3.looks": "Look",
    "s3.sat": "Satellite drape",
    "s3.sat.d": "Sentinel-2 10 m image on the terrain, soft hillshade, rivers and canals.",
    "s3.lc": "Land-cover drape",
    "s3.lc.d": "Impact Observatory / Esri 10 m land cover on the terrain. Central Jakarta is almost all built-up, so this look carries little information here.",
    "s3.grey": "Grey relief + depth ramp (print-friendly)",
    "s3.grey.d": "Grey elevation tint and hillshade with a blue depth ramp. Reads best in print.",
    "s3.view": "View",
    "s3.exag": "Vertical exaggeration",
    "s3.tilt": "Tilt",
    "s3.level": "Illustrative water level",
    "s3.reset": "Reset view",
    "s3.warn": "ILLUSTRATIVE ONLY: a flat water level poured over the terrain (bathtub fill). This is not a flood model result.",
    "s3.cap": "ILLUSTRATIVE ONLY: flat water level of {n} m above sea level (bathtub fill). Not a flood model result.",
    "s3.depth": "Depth below the level (m)",
    "s3.note": "Preview renderer (MapLibre terrain). Exaggeration changes the view only. Terrain: FABDEM V1-2, 30 m bare earth. The final 3D renderer is chosen later.",
    "ex.title": "Flood scenario (Explore engine v0)",
    "ex.p.moderate": "Moderate rain",
    "ex.p.heavy": "Heavy rain",
    "ex.p.extreme": "Extreme rain + river",
    "ex.rain": "Rainfall intensity",
    "ex.rainh": "Rain duration",
    "ex.drain": "Drainage capacity",
    "ex.inflow": "River inflow (south edge)",
    "ex.total": "Simulated time",
    "ex.run": "Run simulation",
    "ex.cancel": "Cancel",
    "ex.clear": "Clear result",
    "ex.loading": "Loading terrain...",
    "ex.running": "Running",
    "ex.done": "Done",
    "ex.cancelled": "Cancelled",
    "ex.time": "Time",
    "ex.max": "Show maximum depth over the whole run",
    "ex.maxlabel": "maximum depth over the whole run",
    "ex.play": "Play",
    "ex.pause": "Pause",
    "ex.depth": "Water depth (m)",
    "ex.warn": "EXPLORATORY RESULT, not for quantitative conclusions. On the sample, rain on a closed domain agrees with SFINCS (depth RMSE about 0.04 to 0.06 m), but nothing is validated against observed floods and the EA benchmarks are pending. Roughness here is uniform (0.05), rain is even and constant, there is no infiltration, and canals are not cut into the terrain.",
    "ex.cap": "EXPLORATORY RESULT, not for quantitative conclusions. Showing: {t}.",
    "ex.stats": "Peak depth {peak} m. Flooded area (maximum, over 0.1 m) {area} km². Mass balance error {err}. Computed in {s} s.",
    "ex.err": "Could not load the terrain or run the simulation.",
    "ex.note": "2D local-inertial scheme (Bates et al. 2010) on the FABDEM grid, cells of about 38 m, computed in your browser. The river enters at the lowest cell of the southern edge, the north edge is open, the other edges are closed.",
    "s3.nodata": "The 3D sample needs the region pack (terrain, satellite, land cover, water). It is not available yet.",
    layers: "Layers",
    basemap: "Basemap",
    "basemap.light": "OpenFreeMap (light)",
    "basemap.none": "None",
    opacity: "Opacity",
    source: "Source",
    "g.imagery": "Satellite image",
    "g.terrain": "Terrain",
    "g.landcover": "Land cover",
    "g.water": "Water bodies",
    "g.exposure": "Buildings & people",
    "g.admin": "Boundaries & grids",
    "nopack": "The data for this region has not been built yet. It is created by the “Region pack” GitHub Action; until then only the DEMNAS tile grid and the region outline are shown.",
    "pack.built": "Region pack",
    "coords": "Cursor",
    "crs.note": "Display: Web Mercator (interactive only). Research exports use WGS 84 / UTM 48S (EPSG:32748).",
    "cat.title": "Data catalog",
    "cat.lead": "Every dataset the app uses, with version, licence, DOI and how it is accessed. Statuses: verified = two sources or a direct check; single-source = one source; unverified = still to be checked.",
    "cat.bib": "Download REFERENCES.bib",
    "cat.copy": "Copy BibTeX",
    "cat.copied": "Copied",
    "cat.files": "Files in the region pack",
    "cat.auto": "Automatic check",
    "cat.outlicence": "Output licence (most restrictive input)",
    "cat.datasets": "datasets",
    "cat.nopack": "No region pack yet.",
    "legend": "Legend",
    "status.ok": "built",
    "status.failed": "failed",
  },
  id: {
    phase: "Fase 2 · Explore",
    "nav.map": "Peta",
    "nav.catalog": "Katalog data",
    "nav.sample": "Sampel 3D",
    "s3.title": "Sampel 3D",
    "s3.name": "Ciliwung, Kampung Melayu–Manggarai (10 × 10 km)",
    "s3.looks": "Gaya tampilan",
    "s3.sat": "Citra satelit",
    "s3.sat.d": "Citra Sentinel-2 10 m di atas medan, bayangan lembut, sungai dan kanal.",
    "s3.lc": "Tutupan lahan",
    "s3.lc.d": "Tutupan lahan Impact Observatory / Esri 10 m di atas medan. Jakarta bagian tengah hampir semuanya area terbangun, jadi gaya ini kurang informatif di sini.",
    "s3.grey": "Relief abu-abu + rampa kedalaman (ramah cetak)",
    "s3.grey.d": "Warna ketinggian abu-abu dan bayangan relief dengan rampa kedalaman biru. Paling jelas saat dicetak.",
    "s3.view": "Kamera",
    "s3.exag": "Pembesaran vertikal",
    "s3.tilt": "Kemiringan",
    "s3.level": "Tinggi air ilustrasi",
    "s3.reset": "Atur ulang tampilan",
    "s3.warn": "HANYA ILUSTRASI: air datar setinggi tertentu yang dituangkan ke medan (bathtub fill). Ini bukan hasil model banjir.",
    "s3.cap": "HANYA ILUSTRASI: air datar setinggi {n} m di atas muka laut (bathtub fill). Bukan hasil model banjir.",
    "s3.depth": "Kedalaman di bawah tinggi air (m)",
    "s3.note": "Renderer pratinjau (medan MapLibre). Pembesaran hanya mengubah tampilan. Medan: FABDEM V1-2, 30 m tanah gundul. Renderer 3D final dipilih nanti.",
    "ex.title": "Skenario banjir (mesin Explore v0)",
    "ex.p.moderate": "Hujan sedang",
    "ex.p.heavy": "Hujan lebat",
    "ex.p.extreme": "Hujan ekstrem + sungai",
    "ex.rain": "Intensitas hujan",
    "ex.rainh": "Lama hujan",
    "ex.drain": "Kapasitas drainase",
    "ex.inflow": "Aliran sungai (tepi selatan)",
    "ex.total": "Waktu simulasi",
    "ex.run": "Jalankan simulasi",
    "ex.cancel": "Batal",
    "ex.clear": "Hapus hasil",
    "ex.loading": "Memuat medan...",
    "ex.running": "Berjalan",
    "ex.done": "Selesai",
    "ex.cancelled": "Dibatalkan",
    "ex.time": "Waktu",
    "ex.max": "Tampilkan kedalaman maksimum selama simulasi",
    "ex.maxlabel": "kedalaman maksimum selama simulasi",
    "ex.play": "Putar",
    "ex.pause": "Jeda",
    "ex.depth": "Kedalaman air (m)",
    "ex.warn": "HASIL EKSPLORASI, bukan untuk kesimpulan kuantitatif. Di area sampel, hujan di domain tertutup cocok dengan SFINCS (RMSE kedalaman sekitar 0,04 sampai 0,06 m), tapi belum divalidasi dengan banjir yang teramati dan benchmark EA belum dikerjakan. Kekasaran di sini seragam (0,05), hujan merata dan konstan, tanpa infiltrasi, dan kanal belum digali di medan.",
    "ex.cap": "HASIL EKSPLORASI, bukan untuk kesimpulan kuantitatif. Ditampilkan: {t}.",
    "ex.stats": "Kedalaman puncak {peak} m. Luas genangan (maksimum, di atas 0,1 m) {area} km². Galat neraca massa {err}. Dihitung dalam {s} detik.",
    "ex.err": "Medan tidak bisa dimuat atau simulasi gagal dijalankan.",
    "ex.note": "Skema local-inertial 2D (Bates dkk. 2010) di grid FABDEM, sel sekitar 38 m, dihitung di browser kamu. Sungai masuk di sel terendah tepi selatan, tepi utara terbuka, tepi lain tertutup.",
    "s3.nodata": "Sampel 3D butuh region pack (medan, satelit, tutupan lahan, air). Datanya belum tersedia.",
    layers: "Lapisan",
    basemap: "Peta dasar",
    "basemap.light": "OpenFreeMap (terang)",
    "basemap.none": "Tanpa",
    opacity: "Transparansi",
    source: "Sumber",
    "g.imagery": "Citra satelit",
    "g.terrain": "Topografi",
    "g.landcover": "Tutupan lahan",
    "g.water": "Badan air",
    "g.exposure": "Bangunan & penduduk",
    "g.admin": "Batas & grid",
    "nopack": "Data untuk wilayah ini belum dibuat. Data dibuat oleh GitHub Action “Region pack”; sementara itu hanya grid tile DEMNAS dan batas wilayah yang tampil.",
    "pack.built": "Paket wilayah",
    "coords": "Kursor",
    "crs.note": "Tampilan: Web Mercator (hanya interaktif). Ekspor riset memakai WGS 84 / UTM 48S (EPSG:32748).",
    "cat.title": "Katalog data",
    "cat.lead": "Semua dataset yang dipakai, lengkap dengan versi, lisensi, DOI, dan cara aksesnya. Status: verified = dua sumber atau dicek langsung; single-source = satu sumber; unverified = masih harus dicek.",
    "cat.bib": "Unduh REFERENCES.bib",
    "cat.copy": "Salin BibTeX",
    "cat.copied": "Tersalin",
    "cat.files": "File di paket wilayah",
    "cat.auto": "Cek otomatis",
    "cat.outlicence": "Lisensi output (input paling ketat)",
    "cat.datasets": "dataset",
    "cat.nopack": "Belum ada paket wilayah.",
    "legend": "Legenda",
    "status.ok": "jadi",
    "status.failed": "gagal",
  },
} as const;

export type Lang = keyof typeof STR;
export type Key = keyof (typeof STR)["en"];

function initial(): Lang {
  try {
    const saved = localStorage.getItem("b3d.lang");
    if (saved === "en" || saved === "id") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith("id") ? "id" : "en";
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

export function t(key: Key): string {
  return STR[lang][key] ?? STR.en[key];
}

export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  document.documentElement.lang = lang;
}
