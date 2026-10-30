# Phase 4 validation sources (checked 2026-10-30, from Actions runs of verification/observed/fetch.py)

| Source | What we got | Access | Licence / status |
|---|---|---|---|
| PetaBencana `/reports/archive?start&end[&geoformat=geojson]` | 2020-01-01 window: 264 reports; 2021-02-20: 434; 2025-03-04: 57. Fields: pkey, created_at, source, status, disaster_type, report_data, tags, text, title, url, image_url, partner_code | no key needed (catalog said "needs key": wrong) | no licence text found on docs.petabencana.id (client-rendered), data.petabencana.id; info.petabencana.id/legal/ 404. Treated as not redistributable: raw answers stay on the runner |
| PetaBencana `/floods/archive?start&end` | 482 / 159 / 5 area records: area_id, last_updated, max_state (no geometry) | no key | as above |
| PetaBencana `/floods?city=jbd&geoformat=geojson&minimum_state=1` | error (validation) | | RW shapes: other parameter names tried in fetch.py `pb_areas` |
| Open-Meteo archive, `models=era5` | hourly, 17 distinct 0.25° cells over the 90-point 0.1° grid. 2020-01-01 72 h window: mean 91 mm over central Jakarta, 64 mm upstream, max hourly 9.5 mm | open | CC BY 4.0 + Copernicus |
| Open-Meteo archive, `models=era5_land` | precipitation all zero / null at every point | open | not usable for rain |
| NOAA GSOD daily | 6 stations in the grid (Budiarto, Tanjung Priok, Observatory/Kemayoran, Soekarno-Hatta, Halim, Citeko). Most event days flagged A–C (sum of 1–3 six-hourly reports, partial) or I; Halim 99.99 (missing) | open | public domain |
| NOAA ISD `global-hourly/access/<year>/<id>.csv` | returned an HTML page, not data | | URL to re-check |
| GPM IMERG Final V07 (GES DISC) | not fetched: needs `EARTHDATA_TOKEN` (free NASA Earthdata login) | login | NASA open data |

Reference value for the 1 Jan 2020 storm: 377 mm/day at Halim Perdanakusuma (Lubis et al. 2022, research/phase2-methods-sources.md).
Reading: ERA5 has about a quarter of that over the whole window, so it cannot drive calibration of this event.

## Added 2026-10-30 (13th session)
| Source | Status |
|---|---|
| CHIRPS v2.0 daily p05 GeoTIFF (data.chc.ucsb.edu, no login; Funk et al. 2015 doi:10.1038/sdata.2015.66) | added to fetch.py as `rain_chirps.json`: daily totals per 0.1° point, hours shaped by ERA5. Assumption: CHIRPS day = UTC day (not confirmed). v3.0 tree searched when a v2.0 file is missing |
| Reported impact, 1 Jan 2020 (search results, NOT yet read in page text) | Antara (sumut.antaranews.com/berita/270492, citing the DKI coordination meeting of 7 Jan 2020): 390 RW, flooded area 156 km². Antara (antaranews.com/berita/1921596): 157 kelurahan (60 %) on 1 Jan, 390 RW (14.2 %) still flooded on 2 Jan. Pages fetched by the Action into `reported_excerpts.json` before any figure is used |
| Reported impact, 20 Feb 2021 (search results) | 113 RW / 342 RT on the day; 75 RW at 07:00 WIB (JAKI); 33 RW on 21 Feb (CNN Indonesia) |
| Reported impact, 4 Mar 2025 (search results) | only RT counts: 121 RT at 15:00 WIB, 117 RT at 22:00 WIB (Bisnis.com) |
| RW boundaries (open) | none found: PetaBencana `/floods?admin=ID-JK` 500; GADM/geoBoundaries stop at kelurahan; Jakarta GIS (gis-dpmptsp.jakarta.go.id) ArcGIS layers are per-RW samples, copyright Dinas Cipta Karya, no licence. Over-prediction check therefore uses flooded AREA inside the five mainland cities (compare.py `dki_flooded_km2`) |
