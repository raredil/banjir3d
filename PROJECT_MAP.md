# PROJECT_MAP
> Shortcut for reading, never the truth: the code is the truth (CORE §4.1).
> The AUTO part is rebuilt by `python3 tools/make_map.py`. Write by hand only below it.

<!-- AUTO:START -->
Files: 142 | Lines: 19420 | Fingerprint: 8a6fcfe2e630442b | Generated: 2026-11-10

### Files
- `pipeline/catalog_tools.py` (67 lines): load, bib_entries, check, write_bib
- `pipeline/demnas_ingest.py` (168 lines): gh, find_release, describe, qa_stats, main, covered
- `pipeline/demnas_public.py` (63 lines): main
- `pipeline/demnas_tiles.py` (103 lines): wc_tile, land_fraction, main
- `pipeline/engine_pack.py` (557 lines): sha256, hsg_from_texture, soil_groups, class_tables, lc_to_n_cn, burn_channels, carve_drains, pump_rates (+10 more)
- `pipeline/exposure_pack.py` (179 lines): engine_grid, overture_divisions, build
- `pipeline/jakartasatu.py` (121 lines): fetch, num_range, channel_size, main
- `pipeline/make_domain.py` (99 lines): _round, r, build
- `pipeline/map_layers.py` (194 lines): describe, val, one, num, jakartasatu, petabencana, add_to_manifest, extra_records (+1 more)
- `pipeline/region_pack.py` (121 lines): build, output_licence, merge, retile
- `pipeline/subsidence.py` (132 lines): mean_sinking, main, onto
- `pipeline/verify_sources.py` (97 lines): get, status, zenodo_licence, extra_checks, main
- `pipeline/b3d/__init__.py` (21 lines): load_regions, load_domain
- `pipeline/b3d/grid.py` (65 lines): Grid, shape, bounds, region_grid, warp_to_grid
- `pipeline/b3d/layers.py` (635 lines): _HTTPRangeFile, _cells, _rec, _dem_display, copernicus_dem, __init__, seekable, readable (+22 more)
- `pipeline/b3d/rbi.py` (63 lines): _sub, sheet_code, sheets_in_bbox
- `pipeline/b3d/tiles.py` (123 lines): terrarium, _encode, render_pmtiles, palette_render, render, ramp_render, rgb_render
- `pipeline/b3d/util.py` (144 lines): now_utc, sha256, http_get, download, write_cog, raster_info, output_record, software_versions (+1 more)
- `pipeline/tests/test_catalog.py` (6 lines): test_catalog_valid
- `pipeline/tests/test_domain.py` (19 lines): test_jakarta_domain
- `pipeline/tests/test_engine_drains.py` (49 lines): test_channel_size_fields, test_carve_drains_area_equivalent_depth, test_pump_rates
- `pipeline/tests/test_engine_subsidence.py` (19 lines): test_subsidence_onto_grid
- `pipeline/tests/test_grid.py` (26 lines): _crsless_tile, test_crsless_source
- `pipeline/tests/test_map_layers.py` (37 lines): test_map_layers
- `pipeline/tests/test_osm_water.py` (37 lines): test_osm_water
- `pipeline/tests/test_rbi.py` (29 lines): test_known_100k_sheets, test_known_25k_sheets, test_bbox_tiles, test_every_builder_has_catalog_id
- `pipeline/tests/test_subsidence.py` (21 lines): test_mean_sinking_vertical_and_capped, test_mean_sinking_no_data
- `pipeline/tests/test_tiles.py` (47 lines): _cog, _contrast, test_lanczos_top_zoom_is_sharper
- `verification/data-checks/check_pack.py` (156 lines): checksums, tile_png, warp, stats, dem, landcover, imagery, summary (+1 more)
- `verification/explore-vs-sfincs/compare.py` (64 lines): csi, stats
- `verification/explore-vs-sfincs/make_inputs.py` (87 lines): lon_px, lat_py, load_dem
- `verification/explore-vs-sfincs/run_explore.ts` (36 lines): opt
- `verification/fine-consistency/run.ts` (113 lines): engineFor
- `verification/observed/compare.py` (260 lines): load_json, features, auc, grid_of, report_scores, rw_scores, rw_place_scores, dki_flooded_km2 (+2 more)
- `verification/observed/event_rain.py` (57 lines): main
- `verification/observed/fetch.py` (361 lines): _NasaRedirect, nasa_host, redirect_request, get, grid_points, era5, imerg_granules, imerg (+8 more)
- `verification/observed/publish.py` (87 lines): features, structure, main
- `verification/observed/run_event.ts` (87 lines): opt, decYear, near, pointAt
- `verification/observed/rw_zenodo.py` (49 lines): main
- `verification/region-run/run.ts` (42 lines): opt
- `verification/terrain/probe.py` (431 lines): get, out, walk_arcgis, jakarta_satu, js_quick, js_targets, zenodo, raster_facts (+4 more)
- `web/src/catalog.ts` (72 lines): card, renderCatalog, renderValidation
  - data objects: ORDER
- `web/src/i18n.ts` (188 lines): initial, setLang, t, applyStatic
  - data objects: STR
- `web/src/layer-export.ts` (41 lines): bboxOf, exportLayer, touches
- `web/src/layers.ts` (89 lines): OBS_LEGEND, cm, evName
- `web/src/main.ts` (127 lines): showError, ensureMap, route, applyTheme, state
- `web/src/map.ts` (340 lines): rainGeo, loadBasemap, mlLayers, legendHtml, createMapPage, refresh, isT, h (+11 more)
  - data objects: FONT
- `web/src/pmtiles-init.ts` (14 lines): ensurePmtiles
- `web/src/util.ts` (93 lines): esc, safeUrl, fmtBytes, toUtm, rasterResampling, fromUtm
- `web/src/engine/engine.test.ts` (169 lines): grid, run, isIn, mk
- `web/src/engine/event-rain.ts` (46 lines): zoneGrid, cumAtSteps, meanHyetograph, nearest, pointAt
- `web/src/engine/gpu.ts` (321 lines): GpuEngine, buf, off, group
- `web/src/engine/hydrology.ts` (110 lines): nrcsLagHours, uhRatio, catchmentHydrograph, findEntries, inflowsFor, entryMembers, inflowsForSpatial, vol
  - data objects: UH_Q, UH_T
- `web/src/engine/pack.test.ts` (201 lines): box
- `web/src/engine/pack.ts` (500 lines): parsePack, fetchPackBytes, buildRun, groundAt, landGround, bilinearAt, buildFineRun, buildDualRun (+11 more)
- `web/src/engine/solver.ts` (259 lines): porosityArrays, FloodEngine, scsRunoff, retention, isOpen
- `web/src/explore/analytical.ts` (32 lines): analyticalWave, waveDepth, bc
- `web/src/explore/local-inertial.test.ts` (83 lines): flat, run
- `web/src/explore/local-inertial.ts` (234 lines): LocalInertial, cap
- `web/src/explore/rain.ts` (41 lines): alternatingBlock, parseHourly, rainRate, mononobeDepth, totalMm, durationS
- Not listed one by one (82 files): data/ (5), data/demnas/ (1), data/engine/ (2), data/events/ (3), data/methods/ (1), data/roughness/ (1), verification/analytical-wave/ (2), verification/data-checks/ (2), verification/explore-vs-sfincs/ (3), verification/fine-consistency/ (3), verification/fine-speed/ (4), verification/gpu-parity/ (2), verification/observed/ (16), web/ (5), web/public/data/jakarta/ (7), web/public/meta/ (2), web/scripts/ (1), web/src/ (4), web/src/engine/ (1), web/src/explore/ (3), web/src/methods/ (3), web/src/sim/ (11)

### Links (A -> B means A loads or uses B)
- `pipeline/catalog_tools.py` -> pipeline/engine_pack.py, web/src/engine/gpu.ts
- `pipeline/demnas_ingest.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py (+6 more)
- `pipeline/demnas_public.py` -> pipeline/b3d/__init__.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py (+3 more)
- `pipeline/demnas_tiles.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/rbi.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py (+4 more)
- `pipeline/engine_pack.py` -> pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/map_layers.py, pipeline/region_pack.py, pipeline/subsidence.py, verification/data-checks/check_pack.py (+13 more)
- `pipeline/exposure_pack.py` -> pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/engine_pack.py, verification/observed/compare.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts (+2 more)
- `pipeline/jakartasatu.py` -> pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/map_layers.py, verification/data-checks/check_pack.py, verification/observed/compare.py (+3 more)
- `pipeline/make_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py (+1 more)
- `pipeline/map_layers.py` -> pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/verify_sources.py, verification/observed/compare.py (+4 more)
- `pipeline/region_pack.py` -> pipeline/b3d/__init__.py, pipeline/b3d/layers.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/engine_pack.py, pipeline/verify_sources.py (+4 more)
- `pipeline/subsidence.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py (+6 more)
- `pipeline/verify_sources.py` -> pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, verification/terrain/probe.py, web/src/sim/buildings.test.ts
- `pipeline/b3d/__init__.py` -> pipeline/b3d/grid.py, verification/observed/compare.py, web/src/sim/conclusion.ts
- `pipeline/b3d/grid.py` -> pipeline/subsidence.py, verification/data-checks/check_pack.py, web/src/engine/engine.test.ts
- `pipeline/b3d/layers.py` -> ., .grid, .tiles, .util, pipeline/b3d/__init__.py, pipeline/b3d/grid.py (+13 more)
- `pipeline/b3d/rbi.py` -> pipeline/b3d/grid.py, web/src/sim/export.ts
- `pipeline/b3d/tiles.py` -> pipeline/b3d/grid.py, verification/data-checks/check_pack.py, web/src/sim/buildings.test.ts, web/src/sim/conclusion.ts, web/src/sim/export.ts
- `pipeline/b3d/util.py` -> pipeline/b3d/grid.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, web/src/engine/event-rain.ts, web/src/sim/buildings.test.ts, web/src/sim/conclusion.ts (+2 more)
- `pipeline/tests/test_catalog.py` -> pipeline/catalog_tools.py
- `pipeline/tests/test_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py
- `pipeline/tests/test_engine_drains.py` -> pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/map_layers.py, web/src/engine/pack.ts, web/src/explore/local-inertial.test.ts
- `pipeline/tests/test_engine_subsidence.py` -> pipeline/engine_pack.py
- `pipeline/tests/test_grid.py` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts, web/src/sim/buildings.test.ts
- `pipeline/tests/test_map_layers.py` -> pipeline/demnas_ingest.py, pipeline/map_layers.py, verification/observed/compare.py
- `pipeline/tests/test_osm_water.py` -> pipeline/b3d/layers.py
- `pipeline/tests/test_rbi.py` -> pipeline/b3d/rbi.py
- `pipeline/tests/test_subsidence.py` -> pipeline/engine_pack.py, pipeline/subsidence.py, web/src/engine/pack.ts, web/src/map.ts
- `pipeline/tests/test_tiles.py` -> pipeline/b3d/tiles.py, verification/data-checks/check_pack.py, verification/observed/run_event.ts, web/src/sim/buildings.test.ts, web/src/sim/export.ts
- `verification/data-checks/check_pack.py` -> pipeline/b3d/layers.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/event-rain.ts (+4 more)
- `verification/explore-vs-sfincs/compare.py` -> pipeline/catalog_tools.py, verification/data-checks/check_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts
- `verification/explore-vs-sfincs/make_inputs.py` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts
- `verification/explore-vs-sfincs/run_explore.ts` -> node:fs, ../../web/src/explore/local-inertial, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/explore/local-inertial.ts
- `verification/fine-consistency/run.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/sim/buildings (+11 more)
- `verification/observed/compare.py` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/map_layers.py, verification/data-checks/check_pack.py, verification/observed/fetch.py (+4 more)
- `verification/observed/event_rain.py` -> pipeline/demnas_ingest.py, verification/observed/fetch.py, web/src/engine/engine.test.ts, web/src/sim/buildings.test.ts, web/src/sim/panel.ts
- `verification/observed/fetch.py` -> pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/map_layers.py (+9 more)
- `verification/observed/publish.py` -> pipeline/demnas_ingest.py, pipeline/jakartasatu.py, pipeline/map_layers.py, pipeline/verify_sources.py, verification/data-checks/check_pack.py, verification/observed/compare.py (+3 more)
- `verification/observed/run_event.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/util (+11 more)
- `verification/observed/rw_zenodo.py` -> pipeline/demnas_ingest.py, verification/observed/compare.py, verification/terrain/probe.py, web/src/engine/gpu.ts
- `verification/region-run/run.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/explore/rain (+6 more)
- `verification/terrain/probe.py` -> pipeline/b3d/grid.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/map_layers.py, pipeline/subsidence.py, pipeline/verify_sources.py (+9 more)
- `web/src/catalog.ts` -> ../../data/catalog-use.json, ./i18n, ./types, ./util, pipeline/b3d/util.py, pipeline/demnas_ingest.py (+7 more)
- `web/src/i18n.ts` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, verification/observed/compare.py, verification/observed/fetch.py (+6 more)
- `web/src/layer-export.ts` -> ./layers, pipeline/b3d/util.py, pipeline/jakartasatu.py, pipeline/verify_sources.py, verification/observed/compare.py, web/src/engine/pack.ts
- `web/src/layers.ts` -> ./i18n, pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/engine_pack.py, pipeline/map_layers.py, verification/data-checks/check_pack.py (+8 more)
- `web/src/main.ts` -> ../../data/validation.json, ./catalog, ./i18n, ./map, ./types, ./util (+11 more)
- `web/src/map.ts` -> maplibre-gl, ./pmtiles-init, ./i18n, ./layers, ./engine/event-rain, ./types (+18 more)
- `web/src/pmtiles-init.ts` -> maplibre-gl, maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url, pmtiles, web/src/sim/buildings.test.ts
- `web/src/util.ts` -> pipeline/engine_pack.py, pipeline/jakartasatu.py, verification/data-checks/check_pack.py, web/src/engine/event-rain.ts, web/src/map.ts
- `web/src/engine/engine.test.ts` -> vitest, ./solver, ./hydrology, ../util, pipeline/demnas_ingest.py, pipeline/engine_pack.py (+5 more)
- `web/src/engine/event-rain.ts` -> ../util, ./hydrology, ../explore/rain, pipeline/engine_pack.py, verification/data-checks/check_pack.py, verification/observed/run_event.ts (+3 more)
- `web/src/engine/gpu.ts` -> ./solver, pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/engine/solver.ts, web/src/main.ts (+3 more)
- `web/src/engine/hydrology.ts` -> ./solver, pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/engine/solver.ts, web/src/sim/conclusion.ts
- `web/src/engine/pack.test.ts` -> vitest, ./pack, ../util, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/subsidence.py (+7 more)
- `web/src/engine/pack.ts` -> ../util, ./hydrology, pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/subsidence.py, pipeline/verify_sources.py (+10 more)
- `web/src/engine/solver.ts` -> pipeline/demnas_ingest.py, pipeline/engine_pack.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/i18n.ts, web/src/sim/conclusion.ts
- `web/src/explore/analytical.ts` -> ./local-inertial, pipeline/catalog_tools.py, verification/observed/run_event.ts, web/src/explore/local-inertial.ts
- `web/src/explore/local-inertial.test.ts` -> vitest, ./local-inertial, ./analytical, pipeline/b3d/grid.py, pipeline/demnas_ingest.py, web/src/explore/analytical.ts (+2 more)
- `web/src/explore/local-inertial.ts` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/i18n.ts, web/src/sim/buildings.test.ts, web/src/sim/conclusion.ts

### Saved data keys (browser storage)
- b3d.lang, b3d.theme
<!-- AUTO:END -->

## Data (by hand: where saves, settings, content live; format; version)

## Fragile spots (by hand: changes here break other parts)

## Notes (by hand)
