# BACKLOG (deferred, with target phase)
| Item | Target |
|---|---|
| Read DEMNAS licence (owner screenshot) → decide public use | 0 |
| DEMNAS vs FABDEM vs GLO-30 comparison in dense urban areas (DSM/DTM question) | 2 |
| IO LULC 2025: use as soon as it appears on AWS / Planetary Computer (pipeline picks newest automatically) | 0–5 |
| Land-cover agreement map IO vs WorldCover | 1 |
| Subsidence grid (Zenodo 19456870): licence, units, Jakarta-only coverage → DEM epoch shift | 2 |
| BATNAS access/licence; tide source (BIG Ina-Sealevel vs FES2022) | 2 |
| Kelurahan (ADM4) boundaries with an open licence | 5 |
| PetaBencana archive (API key as GitHub Secret), Sentinel-1 flood maps for 2 events | 4 |
| River gauge data (Katulampa, Depok, Manggarai) | 4 |
| SFINCS re-run with engine v2 (Action) + EA benchmarks 1, 2, 4: postponed by owner 2026-10-30 ("ya") to finish in one session | later |
| Land-cover year series in the UI (2017–2024 already in the region pack) | 5 |
| CITATION.cff + Zenodo DOI | 3 |
| Kecamatan (ADM3) boundaries: geoBoundaries API has ADM2 only for IDN → BIG/BPS source with an open licence | 1 |
| River inflow boundary conditions at the domain edge (Ciliwung, Cisadane, Bekasi, Angke, Pesanggrahan…) from gauges or an upstream model (ADR 0005) | 2 |
| Check Overture buildings PMTiles for dropped features in dense z14 tiles | 1 |
| **Owner 2026-10-29: pass the tool to other people, each with their own DEM (DEMNAS), no GitHub steps.** Plan: "Use my own terrain" button reads a GeoTIFF in the browser (geotiff.js, file never leaves the computer), checks CRS/datum/no-data, builds the grid; land cover from public cloud-optimised WorldCover tiles for any box; one-page guide in Indonesian and English; optional installable offline app (PWA). Needs owner OK on look of the new screen | 7 (start after Phase 2 gate) |
| Clickable river inflow point (instead of the lowest south-edge cell) and inflow hydrograph | 2 |
| Infiltration (SCS curve number or Green-Ampt with an open soil map, e.g. HYSOGs250m) — check sources first | 2 |
| Hourly rain for 1 Jan 2020 (GPM IMERG or a published gauge series) to replace the design-storm shape of the event preset | 4 |
| Read SNI 2415:2016 itself (Mononobe wording) and record it in research/phase2-methods-sources.md | 2 |
| EA 2D benchmarks (Neelz and Pender 2013): tests 1, 2, 4, 8A in verification/ | 2 |
| Indonesian translation of the Methods page (text stays English for papers) | 8 |
| Map page: attribution box starts expanded and covers the map (fixed on 3D page only) | 8 |
| 2026-10-30 | Sharper basemap (Esri World Imagery free tier, owner account needed) | Owner decision | display only |
| 2026-10-30 | Validation vs observed floods + drainage calibration | Phase 4 (next) | HANDOFF Next steps 1-3 |
| 2026-10-30 | Event mode with observed rain per catchment | Phase 4 | |
| 2026-10-30 | SFINCS comparison with engine v2, EA benchmarks | Phase 2 | |
| 2026-10-30 | Buildings / people flooded per kecamatan | Phase 3 | Overture + WorldPop |
| **Owner 2026-11-13: other regions.** Pipeline is global except Jakarta-only layers (DSDA drains/pumps, subsidence, PetaBencana). Steps: (1) owner names the region (city + buffer); (2) `pipeline/make_domain.py` domain for it, `region-pack.yml` + `engine-pack.yml` + `exposure-pack.yml` with the region id; (3) app reads a region list (manifest per region) and a region menu; (4) no validation until flood records exist there: the app must say "belum diuji" for that region. DEMNAS may be shown, not used as terrain (ADR 0013) | 5 (needs owner's region choice) |
| River bed depth (no open bathymetry): candidate = bankfull depth from catchment area by hydraulic geometry (e.g. Andreadis et al. 2013 width database, Leopold and Maddock 1953 form), applied below the DEM water surface as filled storage + conveyance; must be re-validated on the 3 floods before use | 4 |
| Built-area curve number 98 assumes 100 % sealed built pixels (TR-55 urban districts 85–95 % sealed): sensitivity run with a residential composite CN on the 3 floods | 4 |
| Gauge rain: hourly BMKG/ DSDA rain gauges for the 3 floods (IMERG 0.1° smooths peaks; Halim 377 vs 166 mm) to separate rain error from drain/pump error | 4 |
| FathomDEM (Uhe et al. 2025, 30 m, CC BY-NC-SA, Zenodo 14523356, files on request): owner requests access; then terrain probe vs FABDEM/DEMNAS and the 3-flood scores (research/2026-11-13-open-terrain-rain-soil.md) | owner + 4 |
| Micro drains for the other kota (same DSDA layer with LEBAR/KEDALAMAN) and as river inflow instead of a sink | owner + 3 |
| LiDAR 2012 DKI (used in studies, not open): use only if the owner obtains a file with permission; shift by subsidence since 2012 | owner |
