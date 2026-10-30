# PROJECT_MAP
> Shortcut for reading, never the truth: the code is the truth (CORE §4.1).
> The AUTO part is rebuilt by `python3 tools/make_map.py`. Write by hand only below it.

<!-- AUTO:START -->
Files: 97 | Lines: 12082 | Fingerprint: 817ea776265ab4eb | Generated: 2026-10-30

### Files
- `pipeline/catalog_tools.py` (67 lines): load, bib_entries, check, write_bib
- `pipeline/demnas_ingest.py` (168 lines): gh, find_release, describe, qa_stats, main, covered
- `pipeline/demnas_tiles.py` (103 lines): wc_tile, land_fraction, main
- `pipeline/engine_pack.py` (389 lines): sha256, hsg_from_texture, soil_groups, class_tables, lc_to_n_cn, burn_channels, sea_mask, read_io_window (+4 more)
- `pipeline/make_domain.py` (99 lines): _round, r, build
- `pipeline/region_pack.py` (121 lines): build, output_licence, merge, retile
- `pipeline/verify_sources.py` (97 lines): get, status, zenodo_licence, extra_checks, main
- `pipeline/b3d/__init__.py` (21 lines): load_regions, load_domain
- `pipeline/b3d/grid.py` (65 lines): Grid, shape, bounds, region_grid, warp_to_grid
- `pipeline/b3d/layers.py` (635 lines): _HTTPRangeFile, _cells, _rec, _dem_display, copernicus_dem, __init__, seekable, readable (+22 more)
- `pipeline/b3d/rbi.py` (63 lines): _sub, sheet_code, sheets_in_bbox
- `pipeline/b3d/tiles.py` (123 lines): terrarium, _encode, render_pmtiles, palette_render, render, ramp_render, rgb_render
- `pipeline/b3d/util.py` (144 lines): now_utc, sha256, http_get, download, write_cog, raster_info, output_record, software_versions (+1 more)
- `pipeline/tests/test_catalog.py` (6 lines): test_catalog_valid
- `pipeline/tests/test_domain.py` (19 lines): test_jakarta_domain
- `pipeline/tests/test_grid.py` (26 lines): _crsless_tile, test_crsless_source
- `pipeline/tests/test_osm_water.py` (37 lines): test_osm_water
- `pipeline/tests/test_rbi.py` (29 lines): test_known_100k_sheets, test_known_25k_sheets, test_bbox_tiles, test_every_builder_has_catalog_id
- `pipeline/tests/test_tiles.py` (47 lines): _cog, _contrast, test_lanczos_top_zoom_is_sharper
- `verification/data-checks/check_pack.py` (156 lines): checksums, tile_png, warp, stats, dem, landcover, imagery, summary (+1 more)
- `verification/explore-vs-sfincs/compare.py` (64 lines): csi, stats
- `verification/explore-vs-sfincs/make_inputs.py` (87 lines): lon_px, lat_py, load_dem
- `verification/explore-vs-sfincs/run_explore.ts` (36 lines): opt
- `verification/observed/compare.py` (163 lines): load_json, features, auc, grid_of, report_scores, rw_scores, dki_flooded_km2, main
- `verification/observed/fetch.py` (361 lines): _NasaRedirect, nasa_host, redirect_request, get, grid_points, era5, imerg_granules, imerg (+8 more)
- `verification/observed/publish.py` (87 lines): features, structure, main
- `verification/observed/run_event.ts` (79 lines): opt, near, pointAt
- `verification/region-run/run.ts` (42 lines): opt
- `web/src/catalog.ts` (73 lines): card, renderCatalog, renderValidation
  - data objects: ORDER
- `web/src/i18n.ts` (152 lines): initial, setLang, t, applyStatic
  - data objects: STR
- `web/src/main.ts` (88 lines): ensureMap, route, applyTheme, state
- `web/src/map.ts` (178 lines): loadBasemap, mlLayers, legendHtml, createMapPage, displayFiles, available, attr, addOverlays (+1 more)
  - data objects: FONT
- `web/src/pmtiles-init.ts` (14 lines): ensurePmtiles
- `web/src/util.ts` (93 lines): esc, safeUrl, fmtBytes, toUtm, rasterResampling, fromUtm
- `web/src/engine/engine.test.ts` (125 lines): grid, run, isIn
- `web/src/engine/gpu.ts` (300 lines): GpuEngine, buf, off, group
- `web/src/engine/hydrology.ts` (110 lines): nrcsLagHours, uhRatio, catchmentHydrograph, findEntries, inflowsFor, entryMembers, inflowsForSpatial, vol
  - data objects: UH_Q, UH_T
- `web/src/engine/pack.ts` (116 lines): parsePack, loadPack, buildRun, ll, cell
- `web/src/engine/solver.ts` (198 lines): FloodEngine, scsRunoff, retention, isOpen, face
- `web/src/explore/analytical.ts` (32 lines): analyticalWave, waveDepth, bc
- `web/src/explore/local-inertial.test.ts` (83 lines): flat, run
- `web/src/explore/local-inertial.ts` (234 lines): LocalInertial, cap
- `web/src/explore/rain.ts` (41 lines): alternatingBlock, parseHourly, rainRate, mononobeDepth, totalMm, durationS
- `web/src/explore/roughness.ts` (56 lines): classify, nOfClass, nFieldFromCodes, classFractions, hex
- `web/src/methods/cite.ts` (121 lines): citeAuthors, refEntry, citedKeys, cite, parseBlocks, renderHtml, renderMarkdown, toBibtex (+9 more)
- `web/src/methods/page.ts` (34 lines): renderMethods, download
- `web/src/sim/export.ts` (173 lines): save, geotiff, classColor, depthTiff, colourTiff, mercatorPng, htmlMap, mapPng (+6 more)
- `web/src/sim/flood-layer.ts` (146 lines): downscale, FloodLayer, hex, sh, mk
  - data objects: CLASSES, CLASS_COLORS
- `web/src/sim/panel.ts` (316 lines): mountSim, refreshAuto, q, tip, sl, num, summarize, setVal (+19 more)
- `web/src/sim/worker.ts` (71 lines): post, flooded
- Not listed one by one (47 files): data/ (5), data/demnas/ (1), data/engine/ (2), data/methods/ (1), data/roughness/ (1), verification/analytical-wave/ (2), verification/data-checks/ (2), verification/explore-vs-sfincs/ (3), verification/gpu-parity/ (2), verification/observed/ (6), web/ (5), web/public/data/jakarta/ (5), web/public/meta/ (2), web/scripts/ (1), web/src/ (5), web/src/explore/ (2), web/src/methods/ (1), web/src/sim/ (1)

### Links (A -> B means A loads or uses B)
- `pipeline/catalog_tools.py` -> pipeline/engine_pack.py, web/src/engine/gpu.ts
- `pipeline/demnas_ingest.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py (+4 more)
- `pipeline/demnas_tiles.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/rbi.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py (+2 more)
- `pipeline/engine_pack.py` -> pipeline/b3d/grid.py, pipeline/region_pack.py, verification/data-checks/check_pack.py, verification/observed/compare.py, web/src/engine/engine.test.ts, web/src/engine/gpu.ts (+4 more)
- `pipeline/make_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py (+1 more)
- `pipeline/region_pack.py` -> pipeline/b3d/__init__.py, pipeline/b3d/layers.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/engine_pack.py, pipeline/verify_sources.py (+3 more)
- `pipeline/verify_sources.py` -> pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py
- `pipeline/b3d/__init__.py` -> pipeline/b3d/grid.py, verification/observed/compare.py
- `pipeline/b3d/grid.py` -> verification/data-checks/check_pack.py, web/src/engine/engine.test.ts
- `pipeline/b3d/layers.py` -> ., .grid, .tiles, .util, pipeline/b3d/__init__.py, pipeline/b3d/grid.py (+10 more)
- `pipeline/b3d/rbi.py` -> pipeline/b3d/grid.py, web/src/sim/export.ts
- `pipeline/b3d/tiles.py` -> pipeline/b3d/grid.py, verification/data-checks/check_pack.py, web/src/sim/export.ts
- `pipeline/b3d/util.py` -> pipeline/b3d/grid.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, web/src/sim/panel.ts, web/src/sim/worker.ts
- `pipeline/tests/test_catalog.py` -> pipeline/catalog_tools.py
- `pipeline/tests/test_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py
- `pipeline/tests/test_grid.py` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts
- `pipeline/tests/test_osm_water.py` -> pipeline/b3d/layers.py
- `pipeline/tests/test_rbi.py` -> pipeline/b3d/rbi.py
- `pipeline/tests/test_tiles.py` -> pipeline/b3d/tiles.py, verification/data-checks/check_pack.py, verification/observed/run_event.ts, web/src/sim/export.ts
- `verification/data-checks/check_pack.py` -> pipeline/b3d/layers.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts (+2 more)
- `verification/explore-vs-sfincs/compare.py` -> pipeline/catalog_tools.py, verification/data-checks/check_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts
- `verification/explore-vs-sfincs/make_inputs.py` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts
- `verification/explore-vs-sfincs/run_explore.ts` -> node:fs, ../../web/src/explore/local-inertial, web/src/engine/engine.test.ts, web/src/explore/local-inertial.ts
- `verification/observed/compare.py` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, verification/data-checks/check_pack.py, verification/observed/fetch.py, web/src/engine/engine.test.ts (+2 more)
- `verification/observed/fetch.py` -> pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/verify_sources.py, verification/data-checks/check_pack.py (+6 more)
- `verification/observed/publish.py` -> pipeline/demnas_ingest.py, pipeline/verify_sources.py, verification/data-checks/check_pack.py, verification/observed/compare.py, verification/observed/fetch.py, web/src/main.ts
- `verification/observed/run_event.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/util (+6 more)
- `verification/region-run/run.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/explore/rain (+6 more)
- `web/src/catalog.ts` -> ../../data/catalog-use.json, ./i18n, ./types, ./util, pipeline/b3d/util.py, pipeline/demnas_ingest.py (+6 more)
- `web/src/i18n.ts` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, web/src/engine/pack.ts, web/src/map.ts (+2 more)
- `web/src/main.ts` -> ../../data/validation.json, ./catalog, ./i18n, ./map, ./types, ./util (+9 more)
- `web/src/map.ts` -> maplibre-gl, ./pmtiles-init, ./i18n, ./layers, ./types, ./util (+12 more)
- `web/src/pmtiles-init.ts` -> maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url, pmtiles
- `web/src/util.ts` -> verification/data-checks/check_pack.py
- `web/src/engine/engine.test.ts` -> vitest, ./solver, ./hydrology, ../util, pipeline/demnas_ingest.py, pipeline/engine_pack.py (+4 more)
- `web/src/engine/gpu.ts` -> ./solver, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/engine/solver.ts, web/src/main.ts, web/src/sim/export.ts
- `web/src/engine/hydrology.ts` -> ./solver, pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/engine/solver.ts
- `web/src/engine/pack.ts` -> ../util, ./hydrology, pipeline/catalog_tools.py, pipeline/engine_pack.py, pipeline/verify_sources.py, web/src/engine/engine.test.ts (+1 more)
- `web/src/engine/solver.ts` -> pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/i18n.ts
- `web/src/explore/analytical.ts` -> ./local-inertial, pipeline/catalog_tools.py, verification/observed/run_event.ts, web/src/explore/local-inertial.ts
- `web/src/explore/local-inertial.test.ts` -> vitest, ./local-inertial, ./analytical, pipeline/b3d/grid.py, pipeline/demnas_ingest.py, web/src/explore/analytical.ts (+2 more)
- `web/src/explore/local-inertial.ts` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/engine/solver.ts, web/src/i18n.ts
- `web/src/explore/roughness.ts` -> ../../../data/roughness/worldcover-manning.json, pipeline/b3d/layers.py, web/src/engine/pack.ts
- `web/src/methods/cite.ts` -> ../util, pipeline/b3d/util.py, web/src/engine/gpu.ts
- `web/src/methods/page.ts` -> ../../../data/methods/methods.md?raw, ../../../data/methods/references.json, ../i18n, ./cite, pipeline/b3d/util.py, web/src/catalog.ts (+1 more)
- `web/src/sim/export.ts` -> maplibre-gl, ./flood-layer, ../util, https://unpkg.com/leaflet@1.9.4/dist/leaflet.js, https://unpkg.com/leaflet@1.9.4/dist/leaflet.css, pipeline/b3d/grid.py (+8 more)
- `web/src/sim/flood-layer.ts` -> maplibre-gl, ../util, pipeline/b3d/grid.py, pipeline/b3d/tiles.py, pipeline/demnas_ingest.py, web/src/engine/engine.test.ts (+2 more)
- `web/src/sim/panel.ts` -> maplibre-gl, ../i18n, ../map, ../engine/pack, ../engine/hydrology, ../explore/rain (+22 more)
- `web/src/sim/worker.ts` -> ../engine/solver, ../engine/gpu, ../explore/rain, pipeline/demnas_ingest.py, web/src/engine/engine.test.ts, web/src/engine/gpu.ts (+3 more)

### Saved data keys (browser storage)
- b3d.lang, b3d.theme
<!-- AUTO:END -->

## Data (by hand: where saves, settings, content live; format; version)

## Fragile spots (by hand: changes here break other parts)

## Notes (by hand)
