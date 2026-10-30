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
  kind: "raster" | "hillshade" | "relief" | "water" | "buildings" | "admin" | "demnas-grid" | "region";
  visible: boolean;
  opacity: number;
  note?: string;
  legend?: LegendItem[];
  ramp?: { label: string; stops: [number, string][]; unit: string };
};

// Lowland-weighted hypsometric ramp: most flood-relevant terrain around Jakarta lies below 60 m.
export const ELEVATION_RAMP: [number, string][] = [
  [-5, "#3b6e9e"], [0, "#e9f2e1"], [5, "#b9dcae"], [15, "#86c08a"], [30, "#5aa37a"], [60, "#d8c879"],
  [150, "#c9944f"], [400, "#9c6b43"], [1000, "#7d5b4f"], [2000, "#b8aaa3"], [3000, "#ffffff"],
];

export const LAYERS: LayerDef[] = [
  { id: "s2", group: "g.imagery", name: { id: "Citra satelit Sentinel-2", en: "Sentinel-2 satellite image" }, title: "Sentinel-2 L2A cloud-free composite (10 m)", catalogId: "sentinel-2-l2a", file: "imagery_s2.pmtiles", kind: "raster", visible: true, opacity: 1 },
  { id: "relief-glo30", group: "g.terrain", name: { id: "Ketinggian permukaan (GLO-30)", en: "Surface elevation (GLO-30)" }, title: "Elevation, Copernicus GLO-30 DSM (m, EGM2008)", catalogId: "copernicus-glo30", file: "dem_glo30.pmtiles", kind: "relief", visible: false, opacity: 0.75,
    ramp: { label: "Elevation", unit: "m", stops: ELEVATION_RAMP } },
  { id: "hs-glo30", group: "g.terrain", name: { id: "Bayangan relief permukaan (GLO-30)", en: "Surface hillshade (GLO-30)" }, title: "Hillshade, Copernicus GLO-30 (surface model)", catalogId: "copernicus-glo30", file: "dem_glo30.pmtiles", kind: "hillshade", visible: false, opacity: 0.55 },
  { id: "relief-fabdem", group: "g.terrain", name: { id: "Ketinggian tanah (FABDEM)", en: "Ground elevation (FABDEM)" }, title: "Elevation, FABDEM V1-2 bare earth (m, EGM2008)", catalogId: "fabdem", file: "dem_fabdem.pmtiles", kind: "relief", visible: false, opacity: 0.75,
    ramp: { label: "Elevation", unit: "m", stops: ELEVATION_RAMP } },
  { id: "hs-fabdem", group: "g.terrain", name: { id: "Bayangan relief tanah (FABDEM)", en: "Ground hillshade (FABDEM)" }, title: "Hillshade, FABDEM V1-2 (buildings & trees removed)", catalogId: "fabdem", file: "dem_fabdem.pmtiles", kind: "hillshade", visible: false, opacity: 0.55 },
  { id: "lulc-io", group: "g.landcover", name: { id: "Tutupan lahan 2024 (Esri/IO)", en: "Land cover 2024 (Esri/IO)" }, title: "Land use/land cover, Impact Observatory / Esri (10 m, newest year)", catalogId: "io-lulc-annual", file: "lulc_io_latest.pmtiles", kind: "raster", visible: false, opacity: 0.7 },
  { id: "lulc-wc", group: "g.landcover", name: { id: "Tutupan lahan 2021 (ESA WorldCover)", en: "Land cover 2021 (ESA WorldCover)" }, title: "Land cover, ESA WorldCover 2021 v200 (10 m)", catalogId: "esa-worldcover-2021", file: "lulc_worldcover_2021.pmtiles", kind: "raster", visible: false, opacity: 0.7 },
  { id: "gsw", group: "g.water", name: { id: "Frekuensi genangan air 1984–2021", en: "Surface-water frequency 1984–2021" }, title: "Surface-water occurrence 1984–2021, JRC GSW v1.4 (%)", catalogId: "jrc-gsw", file: "water_gsw_occurrence.pmtiles", kind: "raster", visible: false, opacity: 0.85,
    ramp: { label: "Water occurrence", unit: "%", stops: [[1, "#bdd7ee"], [50, "#4292c6"], [100, "#08306b"]] } },
  { id: "osm-water", group: "g.water", name: { id: "Sungai, kanal, situ (OSM)", en: "Rivers, canals, lakes (OSM)" }, title: "Water bodies & waterways, OpenStreetMap (situ, ponds, canals, drains)", catalogId: "osm-water", file: "water_osm.pmtiles", kind: "water", visible: true, opacity: 1,
    legend: [{ label: "Lake / situ / pond / reservoir", color: "#2f7fd1" }, { label: "River / canal", color: "#1f5fa8" }, { label: "Stream / drain / ditch", color: "#5aa4e6" }, { label: "Wetland", color: "#5fb3a6" }] },
  { id: "buildings", group: "g.exposure", name: { id: "Bangunan (Overture, zoom dekat)", en: "Buildings (Overture, zoom in)" }, title: "Buildings, Overture Maps (zoom ≥ 14)", catalogId: "overture-buildings", file: "buildings_overture.pmtiles", kind: "buildings", visible: false, opacity: 0.85,
    legend: [{ label: "Building footprint", color: "#6b6f7a" }] },
  { id: "pop", group: "g.exposure", name: { id: "Penduduk per sel 100 m (2025)", en: "People per 100 m cell (2025)" }, title: "Population, WorldPop Global2 R2025A (people per ~100 m cell)", catalogId: "worldpop-global2", file: "population_worldpop.pmtiles", kind: "raster", visible: false, opacity: 0.85,
    ramp: { label: "People per cell", unit: "", stops: [[10, "#fdd0a2"], [100, "#f16913"], [500, "#7f2704"]] } },
  { id: "admin", group: "g.admin", name: { id: "Batas kabupaten/kota", en: "District boundaries" }, title: "Administrative boundaries, geoBoundaries (kabupaten/kota)", catalogId: "geoboundaries-idn", file: "admin_geoboundaries.pmtiles", kind: "admin", visible: true, opacity: 1,
    legend: [{ label: "Kabupaten / kota (ADM2)", color: "#3a3f4b" }] },
  { id: "demnas-grid", group: "g.admin", name: { id: "Lembar unduhan DEMNAS", en: "DEMNAS download sheets" }, title: "DEMNAS tile grid (RBI 1:50,000 sheets) — download guide", catalogId: "demnas", kind: "demnas-grid", visible: false, opacity: 1,
    legend: [{ label: "Tile to download", color: "#d9480f" }] },
  { id: "region-domain", group: "g.admin", name: { id: "Batas wilayah simulasi", en: "Simulation region outline" }, title: "Simulation region outline: DKI Jakarta (mainland) + 10 km buffer", catalogId: "geoboundaries-idn", kind: "region", role: "domain", visible: true, opacity: 1,
    legend: [{ label: "Simulation region (10 km buffer)", color: "#e8590c" }] },
  { id: "region-dki", group: "g.admin", name: { id: "Batas DKI Jakarta", en: "DKI Jakarta boundary" }, title: "DKI Jakarta boundary (Kepulauan Seribu excluded)", catalogId: "geoboundaries-idn", kind: "region", role: "admin", visible: true, opacity: 1,
    legend: [{ label: "DKI Jakarta boundary", color: "#7a2e0b" }] },
];
