// UI strings. Dataset metadata stays in English (research output language, BLUEPRINT A4).
const STR = {
  en: {
    phase: "Phase 0 · Data",
    "nav.map": "Map",
    "nav.catalog": "Data catalog",
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
    phase: "Fase 0 · Data",
    "nav.map": "Peta",
    "nav.catalog": "Katalog data",
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
