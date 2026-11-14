import type { Key } from "./i18n";

/** Display-layer definitions (data-driven). `file` must match a PMTiles name in the region pack manifest. */
export type LegendItem = { label: string; color: string };
export type LayerDef = {
  id: string;
  group: Key;
  name: { id: string; en: string };
  title: string; // full source title (tooltip)
  catalogId: string;
  file?: string;
  role?: "domain" | "admin";
  kind: "raster" | "hillshade" | "relief" | "water" | "buildings" | "admin" | "demnas-grid" | "region" | "js-drains" | "js-pumps" | "mikro" | "soil" | "js-polders" | "js-walls" | "genangan" | "reports" | "tersier" | "rain";
  visible: boolean;
  opacity: number;
  note?: string;
  legend?: LegendItem[];
  ramp?: { label: string; stops: [number, string][]; unit: string };
  event?: string; // kind "rain": observed event id (data/events/<id>_imerg.json)
  url?: string; // GeoJSON shipped with the app (meta/), for layers without a tile file
  dl?: { geojson?: string[]; file?: string }; // export: GeoJSON next to the tiles (filterable) or the full file in the data release
};

// Lowland-weighted hypsometric ramp: most flood-relevant terrain around Jakarta lies below 60 m.
export const ELEVATION_RAMP: [number, string][] = [
  [-5, "#3b6e9e"], [0, "#e9f2e1"], [5, "#b9dcae"], [15, "#86c08a"], [30, "#5aa37a"], [60, "#d8c879"],
  [150, "#c9944f"], [400, "#9c6b43"], [1000, "#7d5b4f"], [2000, "#b8aaa3"], [3000, "#ffffff"],
];

// observed depth classes (cm) for the official flood polygons and citizen reports: warm colours, so they never read as model water
export const OBS_CLASSES: [number, string][] = [[0, "#fdd49e"], [30, "#fc8d59"], [70, "#d7301f"], [150, "#7f0000"]];
const OBS_LEGEND = (lbl: (a: number, b?: number) => string) => OBS_CLASSES.map(([v, c], i) => ({ label: lbl(v, OBS_CLASSES[i + 1]?.[0]), color: c }));
const cm = (a: number, b?: number) => (b === undefined ? `> ${a} cm` : a === 0 ? `≤ ${b} cm / ?` : `${a}–${b} cm`);
const JS_TITLE = "Jakarta Satu, Dinas Sumber Daya Air Provinsi DKI Jakarta";
// event rain totals (mm per IMERG 0.1 degree cell): green to purple, so rain never reads as model water depth (blue)
export const RAIN_CLASSES: [number, string][] = [[0, "#ffffcc"], [50, "#d9f0a3"], [100, "#addd8e"], [125, "#78c679"], [150, "#31a354"], [175, "#006837"], [200, "#8c6bb1"], [250, "#6e016b"]];
const RAIN_LEGEND = RAIN_CLASSES.map(([v, c], i) => ({ label: RAIN_CLASSES[i + 1] ? `${v}–${RAIN_CLASSES[i + 1][0]} mm` : `> ${v} mm`, color: c }));
const evName = (e: string, l: "id" | "en") => new Date(`${e}T12:00:00+07:00`).toLocaleDateString(l === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

export const LAYERS: LayerDef[] = [
  { id: "s2", dl: { file: "imagery_s2_rgb.tif" },  group: "g.imagery", name: { id: "Citra satelit Sentinel-2", en: "Sentinel-2 satellite image" }, title: "Sentinel-2 L2A cloud-free composite (10 m)", catalogId: "sentinel-2-l2a", file: "imagery_s2.pmtiles", kind: "raster", visible: false, opacity: 1 },
  { id: "relief-glo30", dl: { file: "dem_glo30.tif" },  group: "g.terrain", name: { id: "Ketinggian permukaan (GLO-30)", en: "Surface elevation (GLO-30)" }, title: "Elevation, Copernicus GLO-30 DSM (m, EGM2008)", catalogId: "copernicus-glo30", file: "dem_glo30.pmtiles", kind: "relief", visible: false, opacity: 0.75,
    ramp: { label: "Elevation", unit: "m", stops: ELEVATION_RAMP } },
  { id: "hs-glo30", group: "g.terrain", name: { id: "Bayangan relief permukaan (GLO-30)", en: "Surface hillshade (GLO-30)" }, title: "Hillshade, Copernicus GLO-30 (surface model)", catalogId: "copernicus-glo30", file: "dem_glo30.pmtiles", kind: "hillshade", visible: false, opacity: 0.55 },
  { id: "relief-fabdem", dl: { file: "dem_fabdem.tif" },  group: "g.terrain", name: { id: "Ketinggian tanah (FABDEM)", en: "Ground elevation (FABDEM)" }, title: "Elevation, FABDEM V1-2 bare earth (m, EGM2008)", catalogId: "fabdem", file: "dem_fabdem.pmtiles", kind: "relief", visible: false, opacity: 0.75,
    ramp: { label: "Elevation", unit: "m", stops: ELEVATION_RAMP } },
  { id: "hs-fabdem", group: "g.terrain", name: { id: "Bayangan relief tanah (FABDEM)", en: "Ground hillshade (FABDEM)" }, title: "Hillshade, FABDEM V1-2 (buildings & trees removed)", catalogId: "fabdem", file: "dem_fabdem.pmtiles", kind: "hillshade", visible: false, opacity: 0.55 },
  { id: "relief-demnas", dl: { file: "dem_demnas.tif" },  group: "g.terrain", name: { id: "Ketinggian DEMNAS 8 m (BIG)", en: "DEMNAS 8 m elevation (BIG)" }, title: "Elevation, DEMNAS 8 m, Badan Informasi Geospasial (m, EGM2008; partly a surface model in built-up areas)", catalogId: "demnas", file: "dem_demnas.pmtiles", kind: "relief", visible: false, opacity: 0.75,
    ramp: { label: "Elevation", unit: "m", stops: ELEVATION_RAMP } },
  { id: "hs-demnas", group: "g.terrain", name: { id: "Bayangan relief DEMNAS 8 m", en: "DEMNAS 8 m hillshade" }, title: "Hillshade, DEMNAS 8 m (Badan Informasi Geospasial)", catalogId: "demnas", file: "dem_demnas.pmtiles", kind: "hillshade", visible: false, opacity: 0.55 },
  { id: "subsidence", dl: { file: "subsidence_insar.tif" },  group: "g.terrain", name: { id: "Laju penurunan tanah 2016–2024", en: "Land subsidence rate 2016–2024" }, title: "Land subsidence, Sentinel-1 InSAR mean 2016–2024, vertical (mm/year; Shabrina et al. 2026, CC BY 4.0)", catalogId: "jakarta-subsidence-sinking-city", file: "subsidence_insar.pmtiles", kind: "raster", visible: false, opacity: 0.85,
    ramp: { label: "Sinking", unit: "mm/yr", stops: [[5, "#fed976"], [15, "#fd8d3c"], [30, "#e31a1c"], [50, "#800026"]] } },
  { id: "lulc-io", dl: { file: "lulc_io_2024.tif" },  group: "g.landcover", name: { id: "Tutupan lahan 2024 (Esri/IO)", en: "Land cover 2024 (Esri/IO)" }, title: "Land use/land cover, Impact Observatory / Esri (10 m, newest year)", catalogId: "io-lulc-annual", file: "lulc_io_latest.pmtiles", kind: "raster", visible: false, opacity: 0.7 },
  { id: "soil-hsg", url: "data/jakarta/soil_hsg.geojson", dl: { geojson: ["data/jakarta/soil_hsg.geojson"] }, group: "g.landcover", name: { id: "Kelompok tanah (daya serap, SoilGrids)", en: "Soil group (infiltration, SoilGrids)" }, title: "Hydrologic soil group A-D used by the engine, from SoilGrids 2.0 sand and clay 0-100 cm (Poggio et al. 2021; NRCS 2009 criteria), 30 m model grid", catalogId: "soilgrids-2", kind: "soil", visible: false, opacity: 0.6,
    note: "The soil group sets how much rain soaks in on open land (curve number, Methods §4); built-up land counts as sealed whatever the soil.", legend: [{ label: "A pasir / sand", color: "#2f9e44" }, { label: "B", color: "#94d82d" }, { label: "C lempung / loam", color: "#fab005" }, { label: "D liat / clay", color: "#e8590c" }] },
  { id: "lulc-wc", dl: { file: "lulc_worldcover_2021.tif" },  group: "g.landcover", name: { id: "Tutupan lahan 2021 (ESA WorldCover)", en: "Land cover 2021 (ESA WorldCover)" }, title: "Land cover, ESA WorldCover 2021 v200 (10 m)", catalogId: "esa-worldcover-2021", file: "lulc_worldcover_2021.pmtiles", kind: "raster", visible: false, opacity: 0.7 },
  { id: "gsw", dl: { file: "water_gsw_occurrence.tif" },  group: "g.water", name: { id: "Frekuensi genangan air 1984–2021", en: "Surface-water frequency 1984–2021" }, title: "Surface-water occurrence 1984–2021, JRC GSW v1.4 (%)", catalogId: "jrc-gsw", file: "water_gsw_occurrence.pmtiles", kind: "raster", visible: false, opacity: 0.85,
    ramp: { label: "Water occurrence", unit: "%", stops: [[1, "#bdd7ee"], [50, "#4292c6"], [100, "#08306b"]] } },
  { id: "osm-water", dl: { geojson: ["water_osm.geojson"] },  group: "g.water", name: { id: "Sungai, kanal, situ (OSM)", en: "Rivers, canals, lakes (OSM)" }, title: "Water bodies & waterways, OpenStreetMap (situ, ponds, canals, drains)", catalogId: "osm-water", file: "water_osm.pmtiles", kind: "water", visible: true, opacity: 1,
    legend: [{ label: "Lake / situ / pond / reservoir", color: "#2f7fd1" }, { label: "River / canal", color: "#1f5fa8" }, { label: "Stream / drain / ditch", color: "#5aa4e6" }, { label: "Wetland", color: "#5fb3a6" }] },
  { id: "js-drains", dl: { geojson: ["jakartasatu_drain1.geojson", "jakartasatu_drain2.geojson"] },  group: "g.infra", name: { id: "Saluran primer & sekunder (DSDA)", en: "Primary & secondary drains (DSDA)" }, title: `Drainage channels with width and depth, ${JS_TITLE}`, catalogId: "jakartasatu-dsda", file: "jakartasatu.pmtiles", kind: "js-drains", visible: false, opacity: 1,
    legend: [{ label: "Primer / primary", color: "#0b7285" }, { label: "Sekunder / secondary", color: "#3bc9db" }] },
  { id: "tersier", url: "meta/drainase_tersier_dki.geojson", dl: { geojson: ["meta/drainase_tersier_dki.geojson"] }, group: "g.infra", name: { id: "Saluran tersier / penghubung (DKI, 1:5.000)", en: "Tertiary / link drains (DKI, 1:5,000)" }, title: "Tertiary drainage lines DRAINASE_LN_5K, Pemprov DKI Jakarta (1:5,000; line, name and kelurahan only, no size)", catalogId: "dki-drainase-tersier", kind: "tersier", visible: false, opacity: 1,
    note: "Map only: the source has no width or depth, so these lines are not carved into the model terrain.", legend: [{ label: "Tersier / tertiary", color: "#e8590c" }] },
  { id: "mikro", url: "meta/saluran_mikro_jaksel.geojson", dl: { geojson: ["meta/saluran_mikro_jaksel.geojson"] }, group: "g.infra", name: { id: "Saluran mikro Jakarta Selatan (lebar, dalam)", en: "South Jakarta micro drains (width, depth)" }, title: "Micro drains Jakarta Selatan, Dinas SDA DKI (Jakarta Satu update 2024, cut 3 Nov 2026; width and depth per section)", catalogId: "dsda-saluran-mikro-jaksel", kind: "mikro", visible: false, opacity: 1,
    note: "Sections with a width and depth enter the model as the switch 'Saluran mikro Jakarta Selatan' (capacity by Manning, spread over the land each drain network serves).", legend: [{ label: "≥ 1 m", color: "#1864ab" }, { label: "0,5–1 m", color: "#4dabf7" }, { label: "< 0,5 m", color: "#a5d8ff" }, { label: "tanpa ukuran / no size", color: "#adb5bd" }] },
  { id: "js-pumps", dl: { geojson: ["jakartasatu_pump.geojson"] },  group: "g.infra", name: { id: "Rumah pompa (DSDA)", en: "Pump stations (DSDA)" }, title: `Pump stations, capacity m³/s, ${JS_TITLE}`, catalogId: "jakartasatu-dsda", file: "jakartasatu.pmtiles", kind: "js-pumps", visible: false, opacity: 1,
    legend: [{ label: "Pompa (besar = kapasitas besar) / pump (size = capacity)", color: "#c2255c" }] },
  { id: "js-polders", dl: { geojson: ["jakartasatu_polder.geojson"] },  group: "g.infra", name: { id: "Sistem polder (DSDA)", en: "Polder systems (DSDA)" }, title: `Polder systems, ${JS_TITLE}`, catalogId: "jakartasatu-dsda", file: "jakartasatu.pmtiles", kind: "js-polders", visible: false, opacity: 0.8,
    legend: [{ label: "Polder", color: "#845ef7" }] },
  { id: "js-walls", dl: { geojson: ["jakartasatu_wall.geojson"] },  group: "g.infra", name: { id: "Tanggul laut NCICD (DSDA)", en: "NCICD sea walls (DSDA)" }, title: `NCICD sea and river walls, ${JS_TITLE}`, catalogId: "jakartasatu-dsda", file: "jakartasatu.pmtiles", kind: "js-walls", visible: false, opacity: 1,
    legend: [{ label: "Tanggul / wall", color: "#5c3d2e" }] },
  { id: "genangan", dl: { geojson: ["jakartasatu_genangan.geojson"] },  group: "g.observed", name: { id: "Genangan resmi per RT (DSDA)", en: "Official flood records per RT (DSDA)" }, title: `Flood polygons per RT with date and depth 2016–2025 ("Genangan"), ${JS_TITLE}`, catalogId: "jakartasatu-dsda", file: "jakartasatu.pmtiles", kind: "genangan", visible: false, opacity: 0.7,
    legend: OBS_LEGEND(cm) },
  { id: "reports", dl: { geojson: ["reports_petabencana.geojson"] },  group: "g.observed", name: { id: "Laporan warga (PetaBencana)", en: "Citizen reports (PetaBencana)" }, title: "Citizen flood reports for the three validation floods, PetaBencana.id", catalogId: "petabencana", file: "reports_petabencana.pmtiles", kind: "reports", visible: false, opacity: 1,
    legend: OBS_LEGEND(cm) },
  { id: "rain-2020-01-01", event: "2020-01-01", group: "g.rain", name: { id: `Curah hujan ${evName("2020-01-01", "id")}`, en: `Rainfall ${evName("2020-01-01", "en")}` }, title: "Event rain total per 0.1° cell, NASA GPM IMERG Final V07 (the rain the model uses for this flood)", catalogId: "gpm-imerg-v07", kind: "rain", visible: false, opacity: 0.6, legend: RAIN_LEGEND },
  { id: "rain-2021-02-20", event: "2021-02-20", group: "g.rain", name: { id: `Curah hujan ${evName("2021-02-20", "id")}`, en: `Rainfall ${evName("2021-02-20", "en")}` }, title: "Event rain total per 0.1° cell, NASA GPM IMERG Final V07 (the rain the model uses for this flood)", catalogId: "gpm-imerg-v07", kind: "rain", visible: false, opacity: 0.6, legend: RAIN_LEGEND },
  { id: "rain-2025-03-04", event: "2025-03-04", group: "g.rain", name: { id: `Curah hujan ${evName("2025-03-04", "id")}`, en: `Rainfall ${evName("2025-03-04", "en")}` }, title: "Event rain total per 0.1° cell, NASA GPM IMERG Final V07 (the rain the model uses for this flood)", catalogId: "gpm-imerg-v07", kind: "rain", visible: false, opacity: 0.6, legend: RAIN_LEGEND },
  { id: "buildings", dl: { file: "buildings_overture.parquet" },  group: "g.exposure", name: { id: "Bangunan (Overture, zoom dekat)", en: "Buildings (Overture, zoom in)" }, title: "Buildings, Overture Maps (zoom ≥ 14)", catalogId: "overture-buildings", file: "buildings_overture.pmtiles", kind: "buildings", visible: false, opacity: 0.85,
    legend: [{ label: "Building footprint", color: "#6b6f7a" }] },
  { id: "pop", dl: { file: "population_worldpop_2025.tif" },  group: "g.exposure", name: { id: "Penduduk per sel 100 m (2025)", en: "People per 100 m cell (2025)" }, title: "Population, WorldPop Global2 R2025A (people per ~100 m cell)", catalogId: "worldpop-global2", file: "population_worldpop.pmtiles", kind: "raster", visible: false, opacity: 0.85,
    ramp: { label: "People per cell", unit: "", stops: [[10, "#fdd0a2"], [100, "#f16913"], [500, "#7f2704"]] } },
  { id: "admin", dl: { geojson: ["admin_geoboundaries.geojson"] },  group: "g.admin", name: { id: "Batas kabupaten/kota", en: "District boundaries" }, title: "Administrative boundaries, geoBoundaries (kabupaten/kota)", catalogId: "geoboundaries-idn", file: "admin_geoboundaries.pmtiles", kind: "admin", visible: true, opacity: 1,
    legend: [{ label: "Kabupaten / kota (ADM2)", color: "#3a3f4b" }] },
  { id: "demnas-grid", group: "g.admin", name: { id: "Lembar unduhan DEMNAS", en: "DEMNAS download sheets" }, title: "DEMNAS tile grid (RBI 1:50,000 sheets) — download guide", catalogId: "demnas", kind: "demnas-grid", visible: false, opacity: 1,
    legend: [{ label: "Tile to download", color: "#d9480f" }] },
  { id: "region-domain", group: "g.admin", name: { id: "Batas wilayah simulasi", en: "Simulation region outline" }, title: "Simulation region outline: DKI Jakarta (mainland) + 10 km buffer", catalogId: "geoboundaries-idn", kind: "region", role: "domain", visible: true, opacity: 1,
    legend: [{ label: "Simulation region (10 km buffer)", color: "#e8590c" }] },
  { id: "region-dki", group: "g.admin", name: { id: "Batas DKI Jakarta", en: "DKI Jakarta boundary" }, title: "DKI Jakarta boundary (Kepulauan Seribu excluded)", catalogId: "geoboundaries-idn", kind: "region", role: "admin", visible: true, opacity: 1,
    legend: [{ label: "DKI Jakarta boundary", color: "#7a2e0b" }] },
];
