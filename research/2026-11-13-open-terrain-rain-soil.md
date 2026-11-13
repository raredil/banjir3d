# Open terrain, gauge rain, soil (owner points 3–4, 2026-11-13)

## Better terrain than FABDEM, open
- Jakarta LiDAR DTM: no open download found (studies use it; FIG 2023 paper builds Cesium terrain from it). Unchanged: owner only.
- **FathomDEM** (Uhe et al. 2025, Environ. Res. Lett. 20, 034002, doi 10.1088/1748-9326/ada972): 30 m global DTM, successor of
  FABDEM; conference abstract: MAE and RMSE about half of FABDEM; flood models on it close to LiDAR. Zenodo record 14523356,
  CC BY-NC-SA 4.0 (same licence as FABDEM), **files restricted: access must be requested on Zenodo** (owner action).
  Urban-specific error not seen in the abstracts: check the paper's tables before adopting; validate with the three floods.
- FathomDEM+ (10 m) is commercial: not usable.
- Sources: https://zenodo.org/records/14523356, https://www.fathom.global/academic-papers/fathomdem-research-paper/,
  https://meetingorganizer.copernicus.org/EGU25/EGU25-7538.html

## Gauge rain
- BMKG Data Online (dataonline.bmkg.go.id): free account, login, one month per download; FAQ documents daily data, hourly/AWS
  not confirmed; no API. Owner could register and download Kemayoran/Tanjung Priok/Halim days of the 3 floods.
- Sources: https://dataonline.bmkg.go.id/faq/3

## Soil
- Already in the model: SoilGrids 2.0 sand/clay -> hydrologic soil group (83 % D, 17 % C in the region) -> curve number per 30 m
  cell together with land cover (Methods §4). Built pixels CN 98 regardless of soil, so soil matters only on open/green land.
- Infiltration acts on the rain falling on each cell (runoff = rain − infiltration, CN method); water flowing over a more
  permeable cell is not absorbed again (no run-on infiltration): conservative (wetter). A flood is not "cut" at a soil boundary.
