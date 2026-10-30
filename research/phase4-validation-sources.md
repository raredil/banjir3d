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
| CHIRPS daily (data.chc.ucsb.edu, no login) | v2.0 daily files 404 for these dates; v3.0 `daily/final/rnl/<year>/chirps-v3.0.rnl.<date>.tif` used (doi:10.15780/G2JQ0P, public domain per CHC). Event mean over the 0.1° grid: 2020-01-01 65 mm (ERA5 79), 2021-02-20 60 (37), 2025-03-04 64 (56): CHIRPS also misses the 2020 extreme. Assumption: CHIRPS day = UTC day (not confirmed) |
| GPM IMERG Final V07 | old guessed path (gpm1.gesdisc, `3B-HH.`) 404. Working: CMR `granules.json?short_name=GPM_3IMERGHH&version=07` → `https://data.gesdisc.earthdata.nasa.gov/data/GPM_L3/GPM_3IMERGHH.07/<yyyy>/<doy>/3B-HHR.MS.MRG.3IMERG.<date>-S..-E...<min>.V07B.HDF5` (~7.5 MB each) with Bearer token. 2020-01-01 window: 144 files, mean 119 mm, max 200 mm, cell at 106.85 E 6.25 S 166 mm (gauge Halim 377 mm/day: 0.1° average smooths the peak). 2021-02-20: mean 43; 2025-03-04: mean 86 |
| Reported impact, 1 Jan 2020 (CHECKED in page text, release o8 `reported_excerpts.json`) | Antara (sumut.antaranews.com/berita/270492, citing the DKI coordination meeting of 7 Jan 2020): 390 RW, flooded area 156 km². Antara (antaranews.com/berita/1921596): 157 kelurahan (60 %) on 1 Jan, 390 RW (14.2 %) still flooded on 2 Jan. Pages fetched by the Action into `reported_excerpts.json` before any figure is used |
| Reported impact, 20 Feb 2021 (search results) | 113 RW / 342 RT on the day; 75 RW at 07:00 WIB (JAKI); 33 RW on 21 Feb (CNN Indonesia) |
| Reported impact, 4 Mar 2025 (search results) | only RT counts: 121 RT at 15:00 WIB, 117 RT at 22:00 WIB (Bisnis.com) |
| RW boundaries (open) | none found: PetaBencana `/floods?admin=ID-JK` 500; GADM/geoBoundaries stop at kelurahan; Jakarta GIS (gis-dpmptsp.jakarta.go.id) ArcGIS layers are per-RW samples, copyright Dinas Cipta Karya, no licence. Over-prediction check therefore uses flooded AREA inside the five mainland cities (compare.py `dki_flooded_km2`) |

Page text, sumut.antaranews.com/berita/270492: 2020 156 km², 390 RW; 2007 455 km², 955 RW, 340 mm/day; 2013 240 km, 599 RW; 2015 281 km, 702 RW (the article writes "km" for 2013/2015). News sites rmol, cnnindonesia, merahputih, bisnis, mobil123 answer 403 to the Action.
