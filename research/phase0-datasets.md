# Phase 0 dataset verification (2026-10-23)

Method: web search (summaries) + direct HTTP probes from the cloud session (only GitHub, AWS S3, Google Cloud Storage, npm, PyPI reachable; other hosts blocked by the session network policy). Hosts that could not be probed here are re-checked automatically by `pipeline/verify_sources.py` in GitHub Actions (open internet); its report is `data/verify-report.json`.

Confidence tags: `verified` (2+ sources or direct probe), `single-source`, `unverified` (needs Action check / owner check).

| Dataset | Version / latest | DOI / citation | Licence | Access | Confidence | Sources |
|---|---|---|---|---|---|---|
| DEMNAS (BIG) | v1.0 tiles, 0.27″ (~8 m) | BIG (no DOI found) | Terms not found online; treat as non-redistributable → private draft release only | Ina-Geoportal login, tiles per RBI 1:50k sheet (`DEMNAS_xxxx-yy_v1.0.tif`), 15′×15′ | verified (format/res), unverified (licence) | spasialkan.com 2019; mapvisionindo.com; mendeley h4tfpp7xyr (sources: IFSAR 5 m, TerraSAR-X 5 m, ALOS PALSAR 11.25 m + mass points; datum EGM2008) |
| RBI sheet numbering | origin 90°E 15°S; 1:250k = 1.5°×1°, 1:100k = 30′ (6 per 250k), 1:50k = 15′ (4 per 100k), 1:25k = 7.5′ | — | — | — | verified by 3 known sheets: Jakarta = 1209-4 & 1210-1 (GSJ GEOLIS 20199078), Bogor 1:25k = 1209-143 (BAKOSURTANAL guide), Bandung = 1209-311..314 | syafraufgisqu.wordpress.com 2013; geomapi.wordpress.com 2016 |
| DEMNAS DSM vs DTM | open question | "Indonesian DEMNAS: DSM or DTM?" (2019 conf. paper, not retrieved) | — | — | unverified | — |
| FABDEM | V1-2 (2023) | 10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn; Hawker et al. 2022 ERL 10.1088/1748-9326/ac4d4f | CC BY-NC-SA 4.0 | data.bris.ac.uk (blocked here; Action) | single-source (licence via GEE catalog) | gee-community-catalog.org/projects/fabdem |
| Copernicus DEM GLO-30 | AWS copy = 2021 release; ESA has DGED 2023_1 | 10.5270/ESA-c5d3d65 (unverified) | Copernicus DEM licence (free, attribution) | s3://copernicus-dem-30m (probe 206 OK) | verified (access) | registry.opendata.aws/copernicus-dem; catalog.data.gov |
| IO/Esri 10 m Annual LULC | AWS bucket 2017–2024 (probed); Esri announced 2025 | Karra et al. 2021 IGARSS 10.1109/IGARSS47720.2021.9553499 | CC BY 4.0 | s3://io-10m-annual-lulc `{zone}{band}_{year}.tif`, Jakarta = 48M (probe OK 2017–2024, 404 for 2025) | verified | planetarycomputer io-lulc-annual-v02; esri.com newsroom 2025 release |
| ESA WorldCover | 2021 v200 | 10.5281/zenodo.7254221 (Zanaga et al. 2022) | CC BY 4.0 | s3://esa-worldcover (probe OK); tiles S06E105, S09E105 | verified; OA 76.7% (2021) single-source | zenodo 7254221; IIASA pure 18478; GEE |
| JRC Global Surface Water | v1.4 (1984–2021) | Pekel et al. 2016 Nature 10.1038/nature20584 | CC BY 4.0 (to confirm in Action) | GCS `global-surface-water/downloads2021/occurrence/occurrence_100E_0Nv1_4_2021.tif` (probe OK) | verified (access/version) | GEE catalog JRC/GSW1_4 |
| OpenStreetMap water | live snapshot | OSM contributors | ODbL 1.0 | Overpass API (Action) | verified | — |
| Overture buildings | 2026-10-21.0 (probed) | Overture Maps Foundation | ODbL (buildings theme) | s3://overturemaps-us-west-2/release/2026-10-21.0/theme=buildings (probe OK) | verified | docs.overturemaps.org release notes & FAQ |
| Google Open Buildings | v3 polygons; Temporal V1 2016–2023 | Sirko et al. 2021 arXiv 2107.12283 | CC BY 4.0 / ODbL (to confirm) | GCS open-buildings-data/v3 (probe OK) — included inside Overture | single-source | GEE catalog |
| WorldPop | Global2 R2025A v1 (alpha), 2015–2030, 100 m constrained | 10.5258/SOTON/WP00839 | CC BY 4.0 (to confirm) | data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/{year}/IDN/v1/100m/constrained | single-source | hub.worldpop.org listing 135 |
| GHSL GHS-POP | R2023A (1975–2030) | 10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE; Pesaresi et al. 2024 IJDE 10.1080/17538947.2024.2390454 | CC BY 4.0 | JRC FTP (Action) | verified | data.europa.eu; GHSL Data Package 2023 |
| Admin boundaries | geoBoundaries (ADM3 kecamatan; ADM4 not confirmed); BIG kelurahan boundaries indicative only | Runfola et al. 2020 PLoS ONE 10.1371/journal.pone.0231866 | geoBoundaries CC BY 4.0 (per-file) ; HDX BPS ADM4 2017 "not specified" | geoboundaries API (Action) | single-source | GEE geoBoundaries; HDX |
| Subsidence (InSAR) | "Sinking City" Jakarta 2016–2024 raster, Zenodo v1 2026-04-07 | Zenodo record 19456870 | not found → check | Zenodo (Action) | single-source | zenodo 19456870; PMC13380226 data paper |
| BATNAS | 6″, MSL datum | BIG | unverified | Ina-Geoportal | single-source | big.go.id/en/content/produk/demnas |
| ERA5 via Open-Meteo | archive API | Hersbach et al. 2020 QJRMS 10.1002/qj.3803 | Open-Meteo data CC BY 4.0; ERA5 Copernicus licence | archive-api.open-meteo.com (Action) | verified (licence page) | open-meteo.com |
| GPM IMERG | V07 Final (3.5-month latency), Late (14 h), Early (4 h) | Huffman et al. GPM_3IMERGHH V07 | NASA open data | Earthdata login (secret) | verified (version) | UCAR GDEX d734000 |
| CHIRPS | v2.0 / v3 status unknown | Funk et al. 2015 Sci Data 10.1038/sdata.2015.66 | CC (check) | — | unverified | — |
| Sentinel-2 L2A | COGs, Earth Search STAC | Copernicus Sentinel data [year] | Copernicus open (attribution) | s3://sentinel-cogs (probe OK, tile 48MYU has 2026 scenes) | verified | — |
| PetaBencana | API, archive needs key | PetaBencana.id | check terms | data.petabencana.id | single-source | docs.petabencana.id |
| Katulampa / river gauges | no open API found; manual readings shown by BPBD DKI | — | — | — | unverified → scenario inflow | news only |
| Copernicus EMS Jan 2020 | no EMSR found; Sentinel Asia + Disasters Charter activation 638 (2020-01-01) | — | — | — | single-source | sentinel-asia.org 2020; disasterscharter.org |
| SFINCS | v2.4.0 "Galibier" (2026-06-15), docker `deltares/sfincs-cpu:sfincs-v2.4.0-Galibier-Release` | Leijnse et al. 2021 10.1016/j.coastaleng.2020.103796 | GPL-3.0 | Docker Hub | verified | github Deltares/SFINCS releases |
| HydroMT-SFINCS | stable 1.2.2 (2025-12-02); 2.0.0-rc3 (2026-05-22) | Zenodo | MIT | PyPI | verified | pypi; conda-forge |

## Open items (carried to BACKLOG)
- DEMNAS licence/redistribution text: owner reads it once on the portal while downloading (no processing).
- DEMNAS DSM/DTM behaviour in Jakarta: compare against FABDEM in Phase 2.
- IO LULC 2025: pipeline uses newest year found (Planetary Computer STAC checked first, AWS fallback).
- Subsidence grid licence (Zenodo 19456870).
- BATNAS licence/access; tide source (BIG Ina-Sealevel vs FES2022) → Phase 2.
- River gauge data → Phase 4.
