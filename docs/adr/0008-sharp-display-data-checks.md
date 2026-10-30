# ADR 0008: Sharp display and automatic data checks
Date: 2026-10-30 · Status: accepted (owner request "nothing blurry, map or flood; data must be validated")

## Context
The flood overlay was a canvas of one pixel per 38 m model cell drawn with linear resampling, so depths were smeared between cells. The Sentinel-2 z14 tiles were made with an averaging kernel and WebP 82 and kept only 82.5 % of the source detail; zooming past z14 showed a blur. Nothing checked automatically that the tiles the engine reads equal the source rasters.

## Decision
1. Flood overlay: every model cell is drawn as a sharp square (nearest-neighbour, whole canvas pixels per cell). No interpolation of results.
2. Imagery tiles: Lanczos at the top zoom (z14), averaging below, WebP 92 (`pipeline/b3d/layers.py imagery_display`). New `retile.yml` re-renders the display tiles of an existing pack from its own COG without touching the source data.
3. Map: data grids nearest-neighbour; Sentinel-2 linear below z15, nearest from z15 (real 10 m pixels, not blur); max zoom 18.
4. `verification/data-checks/check_pack.py` runs in every pack build and re-tile; limits in the script; result `data-check.json` in the release and on the Data catalog page. A failing check fails the workflow before publishing.

## Consequences
Imagery PMTiles 8.8 → 15.3 MB. Zoomed in close, imagery looks pixelated rather than blurred: 10 m is the limit of free satellite data. Sharper imagery (sub-metre) would need a licensed source (cost/licence: owner decision).
