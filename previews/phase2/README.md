# Phase 2 previews: Explore engine v0 (2026-10-29)

Run on the 10 x 10 km sample with the "Heavy rain" preset (100 mm/h for 3 h, drainage 20 mm/h, no river inflow, 8 h simulated). Result: peak depth 5.02 m (a DEM pit), flooded area over 0.1 m at maximum 42.6 km2 of about 100 km2, mass balance error 1.6e-14.

- `explore-v0-grey-max-depth.jpg`: grey look, maximum depth over the whole run.
- `explore-v0-satellite-max-depth.jpg`: satellite look, same result.

EXPLORATORY RESULT, not for quantitative conclusions. The engine is not yet verified against the EA benchmarks or SFINCS. Rain falls evenly, no infiltration, canals are not cut into the terrain, so water ponds in every DEM depression and drains only through the open north edge.

# Explore engine v1 previews (2026-10-29, Claude Code, software-rendered, not final quality)
- `explore-v1-methods.jpg`, `explore-v1-methods-refs.jpg`, `explore-v1-methods-mobile.jpg`: new Methods page (`#/methods`): full methods text with Harvard in-text citations, reference list with DOI links, downloads (METHODS.md, .bib). Mobile shows the Indonesian note (text stays English for papers).
- `explore-v1-draw-dragging.jpg`: drawing your own simulation area (orange box) on the flat, north-up map.
- `explore-v1-draw-run.jpg`: result in that 2.4 × 1.9 km box with the default 1 Jan 2020 event (377 mm over 24 h, Mononobe alternating block, open edges, no drainage, WorldCover roughness, 30 h): peak 1.27 m, 1.71 km² over 0.15 m, mass error 1.5e-14, maximum depth shown. Water follows the Ciliwung valley in the bare-earth terrain.
- `explore-v1-sample-mobile.jpg`: 3D page at 390 px.
EXPLORATORY RESULT, not for quantitative conclusions (not validated against observed floods).

# Sharp display and data checks (2026-10-30, Claude Code, software-rendered, retina 2x)
- `sharp-flood-before-after.png`: same run, zoomed in. Left: old overlay (depths smeared between 38 m cells). Right: every model cell a sharp square with its computed depth.
- `sharp-imagery-z14-before-after.jpg`: map page at zoom 14. Left: old tiles (82.5 % of the 10 m source detail). Right: re-tiled (99.7 %); 15 % more on-screen detail.
- `sharp-imagery-z16-pixels.png`: zoom 16: the real 10 m Sentinel-2 pixels shown as sharp squares instead of a blur.
- `sharp-draw-run.jpg`: the 2.4 × 1.9 km run (default 1 Jan 2020 event) with the new overlay.
- `data-checks-catalog.png`: data-check results on the Data catalog page.
EXPLORATORY RESULT, not for quantitative conclusions (not validated against observed floods).
