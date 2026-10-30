# Data checks: map and simulation = source data (2026-10-30)

Question: does what the app shows and simulates equal the region-pack source rasters, or does the tiling for the web blur or change it?

`check_pack.py <pack dir> <out.json> [--tag TAG]` checks a downloaded region pack and exits 1 if a check fails. It runs automatically in `region-pack.yml` and `retile.yml`; the result `data-check.json` is published with the release and listed on the Data catalog page.

| Check | Limit | region-jakarta-20261024-r2 | same pack, re-tiled (Lanczos z14, WebP 92) |
|---|---|---|---|
| Release files match SHA256SUMS | all | 11 ok | 11 ok |
| Terrain the engine reads (FABDEM z12 Terrarium tiles) vs FABDEM COG, bilinear at pixel centre, whole region | max ≤ 0.01 m | max 0.0039 m, RMSE 0.002 m (1.87 M pixels) | same |
| Land-cover class the engine decodes (WorldCover z14 tiles, `roughness.ts classify`) vs COG | ≥ 99.9 % | 100.00 % (1.64 M pixels, sample) | same |
| Sentinel-2 z14 tiles vs COG (Lanczos), sample | ≥ 95 % local contrast, ≥ 38 dB | **82.5 %, 33.3 dB (fail)** | 99.7 %, 43.0 dB |

Files: `results-region-jakarta-20261024-r2.json`, `results-retiled-local.json` (local run in a cloud session, same code as the Action).

Reading:
- Terrain: 0.0039 m is the Terrarium rounding step (1/256 m). The engine uses the FABDEM values themselves. The 38 m cell mean differs from the bilinear centre value by RMSE 0.03 m (sample) to 0.05 m (region); the 30 m pixels inside one 38 m cell spread by a median 0.08 m (p95 0.9 m): detail a 38 m grid cannot hold.
- Imagery: the old tiles were made with an averaging kernel at z14, where tile pixels (9.5 m) are finer than the 10 m source, plus WebP quality 82; that removed 17.5 % of the local contrast (visible blur). Lanczos at z14 and WebP 92 keep 99.7 %. Lower zooms are downsampled and keep the averaging kernel. Tile file grows from 8.8 to 15.3 MB.
- Not checked here: whether the sources themselves are right (FABDEM, WorldCover and Sentinel-2 have their own published accuracy assessments, see the catalog), and whether the flood results match observed floods (Phase 4).

Display rules that go with this (web): flood depths are drawn cell by cell without interpolation (`explore/ui.ts`, `palette.ts overlayScale`); data grids are drawn with nearest-neighbour; the Sentinel-2 image is smoothed only below zoom 15 and shows its real 10 m pixels as sharp squares above (`util.ts rasterResampling`); maximum zoom 18.
