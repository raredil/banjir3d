# ADR 0004 — Pipeline libraries
Date: 2026-10-23 · Status: accepted

Python 3.13; rasterio 1.5 (GDAL 3.12 wheels) for COGs and warping; pyogrio 0.13 (GDAL with the PMTiles/MVT and OSM drivers) for vector tiles and OSM parsing; pyarrow 26 reads Overture GeoParquet on S3 with bbox predicate push-down; pmtiles 3.8 writes raster tile archives; mgrs for Sentinel-2 tile ids. Not used: DuckDB (extensions download at run time), tippecanoe (not packaged; GDAL's PMTiles driver is enough at this scale). All versions pinned in `pipeline/requirements.txt`; `pip-audit` runs in CI.
Raster display tiles are rendered by our own small tiler (`b3d/tiles.py`) so DEM tiles are Terrarium-encoded after resampling (encoding before resampling would corrupt heights).
