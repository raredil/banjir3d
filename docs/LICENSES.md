# Licences of code, tools and assets
| Item | Version | Licence | Where |
|---|---|---|---|
| maplibre-gl | 6.15.0 | BSD-3-Clause | web bundle |
| pmtiles (JS) | 4.5.0 | BSD-3-Clause | web bundle |
| @fontsource/ibm-plex-sans, -mono | 5.3.0 | SIL OFL 1.1 (fonts), MIT (package) | web bundle |
| vite / typescript / vitest | 8.3.5 / 7.0.2 / 5.0.5 | MIT / Apache-2.0 / MIT | build only |
| rasterio, pyogrio, pyproj, shapely, geopandas | see requirements.txt | BSD/MIT | pipeline (Actions) |
| GDAL (in wheels) | 3.12 | MIT | pipeline |
| pyarrow | 26.0.0 | Apache-2.0 | pipeline |
| pmtiles (Python), mercantile, mgrs | 3.8.1, 1.2.1, 1.6.0 | BSD-3 / BSD-3 / MIT | pipeline |
| GitHub Actions (checkout, setup-python/node, upload/download-artifact, pages) | pinned SHAs in workflows | MIT | CI |
| OpenFreeMap basemap | live | OSM data ODbL; styles BSD/MIT | runtime, external |
Data licences: see `data/catalog.json` (shown on the Data catalog page). SFINCS (GPL-3.0) will run only inside Actions (Phase 2), never bundled into the website.
