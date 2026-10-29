# Explore engine versus SFINCS (2026-10-29)

Question: does the browser Explore solver (2D local-inertial, `web/src/explore/local-inertial.ts`) give the same flood as SFINCS, the peer-reviewed reference named in BLUEPRINT 4.2 (Leijnse et al. 2021, doi:10.1016/j.coastaleng.2020.103796; van Ormondt et al. 2025, doi:10.5194/gmd-18-843-2025)?

## Setup (identical for both)
10 x 10 km sample (docs/ASSUMPTIONS.md A7), FABDEM V1-2 z12 grid, 263 x 264 cells of 37.99 m, rain 100 mm/h for 3 h then dry, 8 h simulated, closed boundaries, no infiltration or drainage, SFINCS 2.4.0 (Galibier) compiled from source with `advection = 0` (pure local-inertial), `theta = 1.0`, `alpha = 0.5`, `huthresh = 0.05`, `dtmax = 15`. Explore set to the same values. SFINCS mass check: stored volume / rain volume = 0.99991.

## Results
| Case | Explore settings | hmax RMSE | hmax r | CSI hmax > 0.3 m | CSI hmax > 1 m | peak hmax SFINCS / Explore | volume difference over the run |
|---|---|---|---|---|---|---|---|
| A. uniform n = 0.05 | theta 1.0, alpha 0.5, hMin 0.05 (SFINCS-matched) | 0.039 m | 0.998 | 0.955 | 0.957 | 4.43 / 4.55 m | max 0.14 % |
| B. uniform n = 0.05 | theta 0.7, alpha 0.7, hMin 0.001 (old Explore defaults) | 0.094 m | 0.995 | not recorded | not recorded | 4.43 / 8.11 m | max 1.5 % |
| C. WorldCover n field (mean 0.142) | SFINCS-matched | 0.056 m | 0.995 | 0.951 | 0.920 | 3.77 / 3.83 m | max 0.36 % |

Cases A and B: console output of the first run, copied here because the SFINCS output file was then overwritten by case C. Case C: `comparison-spatial-n.json`, `comparison-spatial-n.png`. Explore mass error is 1e-14 in all cases.

Reading: with SFINCS-matched settings Explore reproduces SFINCS closely on this rain-on-grid case. The old defaults (case B) gave a very different peak depth, so the defaults were changed to the SFINCS values. The flood extent at the shallow threshold 0.1 m differs more (CSI 0.80 in case C) because of the 0.05 m wet/dry threshold, so shallow-depth extent should not be quoted from Explore.

## What this does NOT show
- Only rain-on-grid redistribution on a closed domain. Open boundaries, river inflow, tide, drainage and infiltration are not compared.
- Not a validation: both models share the same DEM, roughness and rain, so errors in those inputs are not tested. Nothing here is compared with an observed flood.
- The EA 2D benchmark cases (Neelz and Pender 2013) are still to do.

## Reproduce
1. Build SFINCS: `git clone --branch v2.4.0_Galibier_release https://github.com/Deltares/SFINCS`, `apt-get install gfortran libnetcdff-dev autoconf automake libtool`, in `source/`: `./autogen.sh`, `./configure --prefix=$HOME/sfincs-bin`, `make -j1` (a parallel make fails on Fortran module order), `make install`, set `LD_LIBRARY_PATH=$HOME/sfincs-bin/lib`.
2. `python make_inputs.py dem_fabdem.pmtiles <dir>` (FABDEM tiles from the region pack release), then `python make_roughness.py lulc_worldcover_2021.pmtiles <dir> n` for case C.
3. Run `sfincs` in `<dir>`, then from `web/`: `npx vite-node ../verification/explore-vs-sfincs/run_explore.ts <dir> --tag parity_nfield`, then `python compare.py <dir> parity_nfield`.
SFINCS ASCII input notes: rows start at the south; the roughness file is binary float32 in column-major order over active cells; rainfall file lines are `seconds mm/h`; outputs `sfincs_map.nc` with `h` and `hmax`.
