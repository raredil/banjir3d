# Phase 2 previews: Explore engine v0 (2026-10-29)

Run on the 10 x 10 km sample with the "Heavy rain" preset (100 mm/h for 3 h, drainage 20 mm/h, no river inflow, 8 h simulated). Result: peak depth 5.02 m (a DEM pit), flooded area over 0.1 m at maximum 42.6 km2 of about 100 km2, mass balance error 1.6e-14.

- `explore-v0-grey-max-depth.jpg`: grey look, maximum depth over the whole run.
- `explore-v0-satellite-max-depth.jpg`: satellite look, same result.

EXPLORATORY RESULT, not for quantitative conclusions. The engine is not yet verified against the EA benchmarks or SFINCS. Rain falls evenly, no infiltration, canals are not cut into the terrain, so water ponds in every DEM depression and drains only through the open north edge.
