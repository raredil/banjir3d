# PROJECT_MAP
> Shortcut for reading, never the truth: the code is the truth (CORE §4.1).
> The AUTO part is rebuilt by `python3 tools/make_map.py`. Write by hand only below it.

<!-- AUTO:START -->
Files: 72 | Lines: 6992 | Fingerprint: 4deaea9bb5d5b15a | Generated: 2026-10-30

### Files
- `pipeline/catalog_tools.py` (67 lines): load, bib_entries, check, write_bib
- `pipeline/demnas_ingest.py` (168 lines): gh, find_release, describe, qa_stats, main, covered
- `pipeline/demnas_tiles.py` (103 lines): wc_tile, land_fraction, main
- `pipeline/engine_pack.py` (384 lines): sha256, hsg_from_texture, soil_groups, class_tables, lc_to_n_cn, burn_channels, sea_mask, read_io_window (+4 more)
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
- `web/src/catalog.ts` (99 lines): badge, card, renderCatalog, dl, count
  - data objects: THEMES
- `web/src/i18n.ts` (285 lines): initial, setLang, t, applyStatic
  - data objects: STR
- `web/src/main.ts` (93 lines): route, applyTheme, state, syncLang
- `web/src/map.ts` (221 lines): attributionFor, displayFiles, emptyStyle, loadBasemap, mlLayers, legendHtml, renderMap, available (+2 more)
  - data objects: FONT
- `web/src/pmtiles-init.ts` (14 lines): ensurePmtiles
- `web/src/sample-look.ts` (66 lines): parseLook, depthColorExpr, sampleCenter, sampleOutline, zoomForWidth, boxKm, boxFromCorners, parseBox
  - data objects: DEFAULTS, LOOK_ONLY_LAYERS, SAMPLE_VIEW
- `web/src/sample3d.ts` (210 lines): renderSample, attr, url, dem, opt, apply, mount, setBox (+5 more)
  - data objects: NEEDED
- `web/src/util.ts` (73 lines): esc, safeUrl, fmtBytes, toUtm, rasterResampling
- `web/src/explore/analytical.ts` (32 lines): analyticalWave, waveDepth, bc
- `web/src/explore/dem-grid.ts` (123 lines): gridWindow, aggregationFor, blockMean, loadDem, loadLandCover, lonToPx, latToPy, pxToLon (+2 more)
- `web/src/explore/local-inertial.test.ts` (83 lines): flat, run
- `web/src/explore/local-inertial.ts` (234 lines): LocalInertial, cap
- `web/src/explore/palette.ts` (36 lines): depthRgba, paintDepth, overlayScale
- `web/src/explore/rain.ts` (41 lines): alternatingBlock, parseHourly, rainRate, mononobeDepth, totalMm, durationS
- `web/src/explore/roughness.ts` (56 lines): classify, nOfClass, nFieldFromCodes, classFractions, hex
- `web/src/explore/scenario.ts` (45 lines): hyetographOf, riverCells, clampScenario, frameSeconds, c
- `web/src/explore/sim.worker.ts` (45 lines): post, emit
- `web/src/explore/ui.ts` (241 lines): mountExplore, fmtTime, slider, num, summarize, set, draw, status (+5 more)
- `web/src/methods/cite.ts` (121 lines): citeAuthors, refEntry, citedKeys, cite, parseBlocks, renderHtml, renderMarkdown, toBibtex (+9 more)
- `web/src/methods/page.ts` (34 lines): renderMethods, download
- Not listed one by one (29 files): data/ (3), data/demnas/ (1), data/engine/ (1), data/methods/ (1), data/roughness/ (1), verification/analytical-wave/ (2), verification/data-checks/ (2), verification/explore-vs-sfincs/ (3), web/ (4), web/scripts/ (1), web/src/ (5), web/src/explore/ (4), web/src/methods/ (1)

### Links (A -> B means A loads or uses B)
- `pipeline/catalog_tools.py` -> pipeline/engine_pack.py, web/src/catalog.ts
- `pipeline/demnas_ingest.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py (+2 more)
- `pipeline/demnas_tiles.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/rbi.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py
- `pipeline/engine_pack.py` -> pipeline/b3d/grid.py, pipeline/region_pack.py, verification/data-checks/check_pack.py, web/src/catalog.ts, web/src/explore/local-inertial.test.ts, web/src/sample3d.ts
- `pipeline/make_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py
- `pipeline/region_pack.py` -> pipeline/b3d/__init__.py, pipeline/b3d/layers.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/engine_pack.py, pipeline/verify_sources.py (+1 more)
- `pipeline/verify_sources.py` -> pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py
- `pipeline/b3d/__init__.py` -> pipeline/b3d/grid.py
- `pipeline/b3d/grid.py` -> verification/data-checks/check_pack.py
- `pipeline/b3d/layers.py` -> ., .grid, .tiles, .util, pipeline/b3d/__init__.py, pipeline/b3d/grid.py (+5 more)
- `pipeline/b3d/rbi.py` -> pipeline/b3d/grid.py
- `pipeline/b3d/tiles.py` -> pipeline/b3d/grid.py, verification/data-checks/check_pack.py, web/src/catalog.ts
- `pipeline/b3d/util.py` -> pipeline/b3d/grid.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, web/src/catalog.ts, web/src/explore/sim.worker.ts
- `pipeline/tests/test_catalog.py` -> pipeline/catalog_tools.py
- `pipeline/tests/test_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py
- `pipeline/tests/test_grid.py` -> pipeline/b3d/grid.py, web/src/catalog.ts
- `pipeline/tests/test_osm_water.py` -> pipeline/b3d/layers.py
- `pipeline/tests/test_rbi.py` -> pipeline/b3d/rbi.py
- `pipeline/tests/test_tiles.py` -> pipeline/b3d/tiles.py, verification/data-checks/check_pack.py, web/src/catalog.ts
- `verification/data-checks/check_pack.py` -> pipeline/b3d/layers.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, web/src/explore/roughness.ts
- `verification/explore-vs-sfincs/compare.py` -> pipeline/catalog_tools.py, verification/data-checks/check_pack.py
- `verification/explore-vs-sfincs/make_inputs.py` -> pipeline/b3d/grid.py
- `verification/explore-vs-sfincs/run_explore.ts` -> node:fs, ../../web/src/explore/local-inertial, web/src/explore/local-inertial.ts
- `web/src/catalog.ts` -> ./i18n, ./types, ./util, pipeline/b3d/util.py, pipeline/engine_pack.py, pipeline/region_pack.py (+4 more)
- `web/src/i18n.ts` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/verify_sources.py, verification/data-checks/check_pack.py, web/src/explore/local-inertial.test.ts, web/src/explore/ui.ts (+1 more)
- `web/src/main.ts` -> ./catalog, ./i18n, ./types, ./util, ./methods/page, ./sample3d (+7 more)
- `web/src/map.ts` -> maplibre-gl, ./pmtiles-init, ./i18n, ./layers, ./types, ./util (+8 more)
- `web/src/pmtiles-init.ts` -> maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url, pmtiles
- `web/src/sample-look.ts` -> web/src/explore/local-inertial.test.ts, web/src/explore/ui.ts, web/src/methods/cite.ts
- `web/src/sample3d.ts` -> maplibre-gl, ./i18n, ./explore/ui, ./pmtiles-init, ./sample-look, ./types (+9 more)
- `web/src/util.ts` -> verification/data-checks/check_pack.py, web/src/explore/ui.ts
- `web/src/explore/analytical.ts` -> ./local-inertial, pipeline/catalog_tools.py, web/src/explore/local-inertial.ts
- `web/src/explore/dem-grid.ts` -> pmtiles, ./roughness, pipeline/b3d/tiles.py, web/src/explore/roughness.ts
- `web/src/explore/local-inertial.test.ts` -> vitest, ./local-inertial, ./analytical, pipeline/b3d/grid.py, pipeline/demnas_ingest.py, web/src/explore/analytical.ts (+3 more)
- `web/src/explore/local-inertial.ts` -> pipeline/b3d/grid.py, web/src/i18n.ts
- `web/src/explore/roughness.ts` -> ../../../data/roughness/worldcover-manning.json, pipeline/b3d/layers.py
- `web/src/explore/scenario.ts` -> ./local-inertial, ./rain, pipeline/b3d/grid.py, web/src/explore/rain.ts
- `web/src/explore/sim.worker.ts` -> ./local-inertial, ./scenario, ./rain, web/src/explore/local-inertial.ts, web/src/explore/rain.ts, web/src/explore/scenario.ts
- `web/src/explore/ui.ts` -> maplibre-gl, ../i18n, ./dem-grid, ./roughness, ./palette, ./rain (+10 more)
- `web/src/methods/cite.ts` -> ../util, pipeline/b3d/util.py
- `web/src/methods/page.ts` -> ../../../data/methods/methods.md?raw, ../../../data/methods/references.json, ../i18n, ./cite, pipeline/b3d/util.py, web/src/methods/cite.ts

### Saved data keys (browser storage)
- b3d.lang, b3d.theme
<!-- AUTO:END -->

## Data (by hand: where saves, settings, content live; format; version)

## Fragile spots (by hand: changes here break other parts)

## Notes (by hand)
