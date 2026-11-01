# 0013 Land subsidence in the engine, DEMNAS public, Jakarta Satu drains

Date: 2026-11-01 · Status: accepted (owner chose options A and B; owner decision on DEMNAS)

## Decision
1. **DEMNAS is public** (replaces ADR 0002). The owner found no licence or use restriction on the BIG download page and decided it may be used and published with attribution "DEMNAS © Badan Informasi Geospasial". `pipeline/demnas_public.py` copies the 8 m mosaic from the draft release into the region pack (`dem_demnas.tif`, `dem_demnas.pmtiles`, z5-14); map layers "Ketinggian DEMNAS 8 m" and hillshade.
2. **DEMNAS is not the model terrain.** Terrain probe (`verification/terrain/probe.py`, 2026-11-01), DEMNAS averaged to the 30 m grid: built cells median +0.79 m above FABDEM; regression of (DEMNAS − FABDEM) on (GLO-30 − FABDEM) in built cells slope 0.62, r 0.44, i.e. ~60 % of building/tree height kept; sea and inland water at a constant ~−3.26 m (18.6 % of cells < 0 m vs 0.1 % FABDEM); sub-cell SD median 0.58 m in built cells. A partly-surface model blocks street flow, so FABDEM stays.
3. **Land subsidence shifts the terrain to the run date.** Rates from Shabrina et al. (2026), Zenodo 10.5281/zenodo.19456870, CC BY 4.0: kriged annual Sentinel-1 LOS velocities 2016-2024 (LiCSBAS, ascending frame 098A_09673_121312). `pipeline/subsidence.py`: mean of the nine years (single years noisy: each year's p99 shows +17 to +46 mm/yr "uplift"), vertical = LOS / U (LiCSAR metadata U 0.766-0.792), uplift capped at 0 (as the authors), stored as `sub` (int16 mm/yr) in the engine pack with `subsidence.epoch` 2013.0 (Copernicus DEM acquisitions 2011-2015). The web engine (`buildRun(..., year)`) and `run_event.ts` lower each cell by rate × (year − 2013.0); event mode uses the event date, scenarios today. DKI Jakarta only; rate 0 elsewhere.
4. **Jakarta Satu (option A):** see Notes for the reachability result. No drain geometry is used unless its service is public.

## Notes
- Constant-rate extrapolation outside 2016-2024 is an assumption (rates were higher before 2010 in places, Abidin et al. 2011).
- The same Zenodo record holds 2,728 RW polygons (DKI, with residential-morphology attributes): first open RW shapes found; candidate for place-by-place validation (HANDOFF next steps).
