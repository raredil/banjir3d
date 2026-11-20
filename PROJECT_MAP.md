# PROJECT_MAP
> Shortcut for reading, never the truth: the code is the truth (CORE §4.1).
> The AUTO part is rebuilt by `python3 tools/make_map.py`. Write by hand only below it.

<!-- AUTO:START -->
Files: 220 | Lines: 50518 | Fingerprint: 91b82149fa6a9068 | Generated: 2026-11-20

### Files
- `pipeline/catalog_tools.py` (67 lines): load, bib_entries, check, write_bib
- `pipeline/demnas_ingest.py` (168 lines): gh, find_release, describe, qa_stats, main, covered
- `pipeline/demnas_public.py` (63 lines): main
- `pipeline/demnas_tiles.py` (103 lines): wc_tile, land_fraction, main
- `pipeline/design_rain.py` (197 lines): gumbel_k, moments, gumbel_fit, gumbel_cdf, lp3_fit, lp3_cdf, ks_distance, analyse (+6 more)
- `pipeline/design_rain_fetch.py` (128 lines): listing, files_of_year, read_window, main
- `pipeline/design_rain_imerg.py` (142 lines): granules, subset_url, parse, probe, read, main
- `pipeline/engine_pack.py` (601 lines): sha256, hsg_from_texture, soil_groups, class_tables, lc_to_n_cn, burn_channels, carve_drains, pump_rates (+11 more)
- `pipeline/exposure_pack.py` (179 lines): engine_grid, overture_divisions, build
- `pipeline/jakartasatu.py` (121 lines): fetch, num_range, channel_size, main
- `pipeline/make_domain.py` (99 lines): _round, r, build
- `pipeline/map_layers.py` (194 lines): describe, val, one, num, jakartasatu, petabencana, add_to_manifest, extra_records (+1 more)
- `pipeline/micro_drains.py` (256 lines): num, clean, convert, round_coords, r, manning_n, capacity, lines_utm (+5 more)
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
- `pipeline/tests/test_design_rain.py` (53 lines): test_gumbel_by_hand, test_lp3_zero_skew_is_log_normal, test_ks_distance, test_imerg_ascii_answer_of_ges_disc
- `pipeline/tests/test_domain.py` (19 lines): test_jakarta_domain
- `pipeline/tests/test_engine_drains.py` (61 lines): test_channel_size_fields, test_carve_drains_area_equivalent_depth, test_pump_rates
- `pipeline/tests/test_engine_subsidence.py` (19 lines): test_subsidence_onto_grid
- `pipeline/tests/test_grid.py` (26 lines): _crsless_tile, test_crsless_source
- `pipeline/tests/test_map_layers.py` (37 lines): test_map_layers
- `pipeline/tests/test_micro_drains.py` (50 lines): test_capacity_manning, _fc, test_sink_network_capacity_over_served_area
- `pipeline/tests/test_osm_water.py` (37 lines): test_osm_water
- `pipeline/tests/test_rbi.py` (29 lines): test_known_100k_sheets, test_known_25k_sheets, test_bbox_tiles, test_every_builder_has_catalog_id
- `pipeline/tests/test_soil_layer.py` (22 lines): test_soil_layer_groups_and_shares
- `pipeline/tests/test_subsidence.py` (21 lines): test_mean_sinking_vertical_and_capped, test_mean_sinking_no_data
- `pipeline/tests/test_tiles.py` (47 lines): _cog, _contrast, test_lanczos_top_zoom_is_sharper
- `verification/audit.cjs` (39 lines): lt, set
- `verification/data-checks/check_pack.py` (156 lines): checksums, tile_png, warp, stats, dem, landcover, imagery, summary (+1 more)
- `verification/explore-vs-sfincs/compare.py` (64 lines): csi, stats
- `verification/explore-vs-sfincs/make_inputs.py` (87 lines): lon_px, lat_py, load_dem
- `verification/explore-vs-sfincs/run_explore.ts` (36 lines): opt
- `verification/fine-consistency/run.ts` (113 lines): engineFor
- `verification/observed/box_cellsize.py` (104 lines): load, rule, main
- `verification/observed/compare.py` (474 lines): load_json, features, auc, grid_of, land_window_max, wilson, binom_p_greater, fair_baselines (+10 more)
- `verification/observed/event_rain.py` (57 lines): main
- `verification/observed/fetch.py` (361 lines): _NasaRedirect, nasa_host, redirect_request, get, grid_points, era5, imerg_granules, imerg (+8 more)
- `verification/observed/gauge_merge.py` (164 lines): load_imerg, bilinear, pos, km, hour_ends, gauge_totals, field, main
- `verification/observed/gauges_fetch.py` (86 lines): get, walk, main
- `verification/observed/gauges_westjava.py` (73 lines): days_for, main
- `verification/observed/make_sens.py` (52 lines): row, spread
- `verification/observed/make_skill.py` (56 lines): pick
- `verification/observed/mosaic_tiles.py` (125 lines): plan, cores, stitch
- `verification/observed/publish.py` (87 lines): features, structure, main
- `verification/observed/region_cellsize.py` (118 lines): load, cell_of, stats, main
- `verification/observed/rescore_distance.py` (48 lines): read, main
- `verification/observed/rescore_fair.py` (46 lines): read, main
- `verification/observed/run_event.ts` (104 lines): opt, cnOf, decYear, near, pointAt
- `verification/observed/rw_zenodo.py` (49 lines): main
- `verification/observed/test_compare.py` (50 lines): test_channel_water_is_not_a_hit, test_distance_to_water_and_classes
- `verification/observed/test_gauge_merge.py` (28 lines): test_field_near_and_far, test_gauge_day_window
- `verification/region-run/run.ts` (42 lines): opt
- Not listed one by one (160 files): data/ (7), data/demnas/ (1), data/engine/ (2), data/events/ (3), data/methods/ (1), data/rain/ (3), data/roughness/ (1), docs/penjelasan/ (2), verification/analytical-wave/ (2), verification/data-checks/ (2), verification/explore-vs-sfincs/ (3), verification/fine-consistency/ (3), verification/fine-speed/ (4), verification/gpu-parity/ (2), verification/observed/ (54), verification/speed/ (3), verification/terrain/ (1), web/ (5), web/public/data/jakarta/ (7), web/public/meta/ (2), web/scripts/ (2), web/src/ (15), web/src/engine/ (10), web/src/explore/ (9), web/src/methods/ (3), web/src/sim/ (13)

### Links (A -> B means A loads or uses B)
- `pipeline/catalog_tools.py` -> pipeline/engine_pack.py, web/src/engine/gpu.ts
- `pipeline/demnas_ingest.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py (+8 more)
- `pipeline/demnas_public.py` -> pipeline/b3d/__init__.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py (+5 more)
- `pipeline/demnas_tiles.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/rbi.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py (+5 more)
- `pipeline/design_rain.py` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py, verification/observed/compare.py (+5 more)
- `pipeline/design_rain_fetch.py` -> pipeline/b3d/grid.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, verification/observed/fetch.py, web/src/ai-context.ts (+3 more)
- `pipeline/design_rain_imerg.py` -> pipeline/b3d/grid.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/micro_drains.py, verification/observed/fetch.py (+5 more)
- `pipeline/engine_pack.py` -> pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/design_rain_imerg.py, pipeline/map_layers.py, pipeline/micro_drains.py, pipeline/region_pack.py (+18 more)
- `pipeline/exposure_pack.py` -> pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/design_rain_fetch.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, pipeline/micro_drains.py (+6 more)
- `pipeline/jakartasatu.py` -> pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, pipeline/map_layers.py, verification/data-checks/check_pack.py (+5 more)
- `pipeline/make_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py (+1 more)
- `pipeline/map_layers.py` -> pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/micro_drains.py, pipeline/verify_sources.py (+7 more)
- `pipeline/micro_drains.py` -> pipeline/b3d/grid.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, verification/observed/box_cellsize.py (+7 more)
- `pipeline/region_pack.py` -> pipeline/b3d/__init__.py, pipeline/b3d/layers.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/design_rain.py, pipeline/engine_pack.py (+5 more)
- `pipeline/subsidence.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py, pipeline/b3d/tiles.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py (+10 more)
- `pipeline/verify_sources.py` -> pipeline/b3d/layers.py, pipeline/b3d/util.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/design_rain_fetch.py, verification/terrain/probe.py (+2 more)
- `pipeline/b3d/__init__.py` -> pipeline/b3d/grid.py, verification/observed/compare.py, web/src/sim/conclusion.ts
- `pipeline/b3d/grid.py` -> pipeline/design_rain_imerg.py, pipeline/subsidence.py, verification/data-checks/check_pack.py, verification/observed/gauge_merge.py, web/src/engine/engine.test.ts
- `pipeline/b3d/layers.py` -> ., .grid, .tiles, .util, pipeline/b3d/__init__.py, pipeline/b3d/grid.py (+18 more)
- `pipeline/b3d/rbi.py` -> pipeline/b3d/grid.py, web/src/sim/export.ts
- `pipeline/b3d/tiles.py` -> pipeline/b3d/grid.py, pipeline/design_rain_imerg.py, verification/data-checks/check_pack.py, verification/observed/gauge_merge.py, web/src/sim/buildings.test.ts, web/src/sim/conclusion.ts (+1 more)
- `pipeline/b3d/util.py` -> pipeline/b3d/grid.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, verification/data-checks/check_pack.py, web/src/engine/event-rain.ts, web/src/sim/buildings.test.ts (+3 more)
- `pipeline/tests/test_catalog.py` -> pipeline/catalog_tools.py
- `pipeline/tests/test_design_rain.py` -> pipeline/b3d/grid.py, pipeline/design_rain.py, pipeline/design_rain_imerg.py, web/src/ai-context.ts
- `pipeline/tests/test_domain.py` -> pipeline/b3d/__init__.py, pipeline/b3d/grid.py
- `pipeline/tests/test_engine_drains.py` -> pipeline/engine_pack.py, pipeline/jakartasatu.py, pipeline/map_layers.py, pipeline/micro_drains.py, web/src/explore/local-inertial.test.ts
- `pipeline/tests/test_engine_subsidence.py` -> pipeline/engine_pack.py
- `pipeline/tests/test_grid.py` -> pipeline/b3d/grid.py, web/src/engine/engine.test.ts, web/src/sim/buildings.test.ts
- `pipeline/tests/test_map_layers.py` -> pipeline/demnas_ingest.py, pipeline/map_layers.py, verification/observed/compare.py
- `pipeline/tests/test_micro_drains.py` -> pipeline/micro_drains.py, verification/data-checks/check_pack.py, verification/observed/compare.py, web/src/engine/engine.test.ts, web/src/sim/buildings.test.ts
- `pipeline/tests/test_osm_water.py` -> pipeline/b3d/layers.py, web/src/engine/engine.test.ts
- `pipeline/tests/test_rbi.py` -> pipeline/b3d/rbi.py
- `pipeline/tests/test_soil_layer.py` -> pipeline/engine_pack.py, verification/observed/compare.py
- `pipeline/tests/test_subsidence.py` -> pipeline/engine_pack.py, pipeline/micro_drains.py, pipeline/subsidence.py, web/src/ai-context.ts, web/src/map.ts
- `pipeline/tests/test_tiles.py` -> pipeline/b3d/tiles.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py, verification/observed/run_event.ts, web/src/sim/buildings.test.ts, web/src/sim/export.ts
- `verification/audit.cjs` -> playwright, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/verify_sources.py, web/src/engine/pack.ts, web/src/map.ts
- `verification/data-checks/check_pack.py` -> pipeline/b3d/layers.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, pipeline/micro_drains.py (+9 more)
- `verification/explore-vs-sfincs/compare.py` -> pipeline/catalog_tools.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py, web/src/engine/engine.test.ts
- `verification/explore-vs-sfincs/make_inputs.py` -> pipeline/b3d/grid.py, pipeline/micro_drains.py, web/src/engine/engine.test.ts
- `verification/explore-vs-sfincs/run_explore.ts` -> node:fs, ../../web/src/explore/local-inertial, pipeline/design_rain_imerg.py, web/src/engine/engine.test.ts, web/src/engine/pack.ts, web/src/explore/local-inertial.ts
- `verification/fine-consistency/run.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/sim/buildings (+16 more)
- `verification/observed/box_cellsize.py` -> pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py, verification/observed/compare.py, verification/observed/make_sens.py (+3 more)
- `verification/observed/compare.py` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/map_layers.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py (+9 more)
- `verification/observed/event_rain.py` -> pipeline/demnas_ingest.py, verification/observed/fetch.py, web/src/engine/engine.test.ts, web/src/sim/buildings.test.ts, web/src/sim/panel.ts
- `verification/observed/fetch.py` -> pipeline/b3d/grid.py, pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, pipeline/jakartasatu.py (+12 more)
- `verification/observed/gauge_merge.py` -> pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/jakartasatu.py, verification/observed/fetch.py, verification/observed/make_sens.py, web/src/engine/engine.test.ts (+3 more)
- `verification/observed/gauges_fetch.py` -> pipeline/b3d/util.py, pipeline/demnas_ingest.py, pipeline/design_rain_fetch.py, pipeline/design_rain_imerg.py, pipeline/engine_pack.py, pipeline/verify_sources.py (+4 more)
- `verification/observed/gauges_westjava.py` -> pipeline/demnas_ingest.py, verification/observed/fetch.py
- `verification/observed/make_sens.py` -> verification/observed/compare.py, verification/observed/fetch.py, verification/observed/run_event.ts, web/src/engine/engine.test.ts, web/src/sim/conclusion.ts, web/src/sim/panel.ts
- `verification/observed/make_skill.py` -> pipeline/engine_pack.py, pipeline/micro_drains.py, verification/observed/box_cellsize.py, verification/observed/compare.py, verification/observed/fetch.py, verification/observed/make_sens.py (+5 more)
- `verification/observed/mosaic_tiles.py` -> pipeline/b3d/grid.py, pipeline/catalog_tools.py, pipeline/engine_pack.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py, verification/observed/box_cellsize.py (+4 more)
- `verification/observed/publish.py` -> pipeline/demnas_ingest.py, pipeline/jakartasatu.py, pipeline/map_layers.py, pipeline/verify_sources.py, verification/data-checks/check_pack.py, verification/observed/compare.py (+4 more)
- `verification/observed/region_cellsize.py` -> pipeline/b3d/rbi.py, pipeline/catalog_tools.py, pipeline/demnas_ingest.py, pipeline/micro_drains.py, verification/data-checks/check_pack.py, verification/observed/box_cellsize.py (+7 more)
- `verification/observed/rescore_distance.py` -> pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, verification/observed/compare.py, web/src/engine/engine.test.ts, web/src/engine/event-rain.ts
- `verification/observed/rescore_fair.py` -> pipeline/demnas_ingest.py, pipeline/design_rain_imerg.py, verification/observed/compare.py
- `verification/observed/run_event.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/util (+16 more)
- `verification/observed/rw_zenodo.py` -> pipeline/demnas_ingest.py, verification/observed/compare.py, verification/terrain/probe.py, web/src/engine/gpu.ts
- `verification/observed/test_compare.py` -> pipeline/micro_drains.py, verification/observed/box_cellsize.py, verification/observed/compare.py, web/src/engine/engine.test.ts
- `verification/observed/test_gauge_merge.py` -> verification/observed/gauge_merge.py, verification/observed/run_event.ts
- `verification/region-run/run.ts` -> node:fs, node:zlib, ../../web/src/engine/pack, ../../web/src/engine/solver, ../../web/src/engine/hydrology, ../../web/src/explore/rain (+7 more)

### Saved data keys (browser storage)
- b3d.lang, b3d.theme
<!-- AUTO:END -->

## Data (by hand: where saves, settings, content live; format; version)

## Fragile spots (by hand: changes here break other parts)

## Notes (by hand)
