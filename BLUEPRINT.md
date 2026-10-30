# BLUEPRINT: Banjir3D (working name) — v2, research grade

## Ringkasan untuk Waw
1. Web app gratis untuk riset banjir: simulasi 3D, mulai Jabodetabek, nanti area mana saja di dunia.
2. Dua mesin: **Explore** (cepat, interaktif di browser) dan **Research Run** (model banjir resmi yang sudah terbit di jurnal, SFINCS, dijalankan gratis di GitHub). Angka untuk paper diambil dari Research Run.
3. Setiap export otomatis membawa: catatan pengolahan lengkap, versi data, parameter, metrik validasi, daftar sitasi (BibTeX/RIS), lisensi, dan ID unik supaya bisa diulang persis.
4. Layout peta mengikuti standar kartografi riset (judul, legenda, skala, panah utara, grid koordinat, sistem koordinat, sumber data, peta inset). Kamu tidak perlu tahu standarnya, template sudah disiapkan.
5. Jujur: app ini membuat hasil **transparan, bisa diulang, dan tervalidasi**. "Diakui" tetap ditentukan reviewer/pembimbing. Keterbatasan (drainase, pompa, penurunan tanah) ditulis otomatis di setiap output.

---

## 1. Vision and MUST list
- MUST-1 "web app realtime, simulasi banjir" with "data terbaru".
- MUST-2 "gratis" (build, hosting, use).
- MUST-3 "aku butuh jabodetabek" first.
- MUST-4 "beneran simulasi 3d" (hydrodynamic, water moves over time).
- MUST-5 world scope later, one region box at a time.
- MUST-6 "bisa di export ... bisa di layout kayak beneran peta untuk peta riset".
- MUST-7 "penutupan lahan terakurat saat ini dan badan2 air termasuk yang kecil2".
- MUST-8 "aku gamau ngolah apapun lewat aplikasi semua dari kamu".
- MUST-9 "akan digunakan riset ... outputnya maksimal ... standard riset dengan data terbaru terlengkap dan terakurat".
- MUST-10 "harus bisa diakui ... ada pencatatan pengolahan dan lain2nya juga, sitasi dan sebagainya" (full provenance, citations, reproducibility).
- MUST-11 "aku gatau gimana standard orang bikin peta": the app must apply cartographic standards by default.
- MUST-12 "simulasi lintas waktu juga ... pake range": simulate over a chosen date/time range and compare different years (see §9a).
- MUST-13 "visual 3d modern tapi tetap standard peta research", "bukan kotak2 SVG". **Owner update 2026-10-30 (RULE):** "konsep 3d ini kayanya ga works ... mending gausah maen 3d": the app is a flat 2D map; results must be "tajam tapi tetap smooth" (GPU water-level downscaling), never square cells, exports cartographically correct.
- MUST-14 (2026-10-30) inputs are only external forcing (rain, storm, sea level); everything else (rivers, capacity, infiltration, roughness, buildings) comes from mapped data; methods shown are the methods used; export as GeoTIFF and HTML; dashboard UI in blue with a full-screen map; little text, no "AI style".

## 2. Assumptions (owner replies "ok" or corrects)
- A1 Non-commercial academic use. Output licence is set automatically to the most restrictive input licence (likely CC BY-NC-SA 4.0 because of FABDEM).
- A2 Desktop Chrome/Edge with WebGPU for the interactive simulator.
- A3 Route B (public GitHub repo + Claude Code on Claude Pro).
- A4 English output for papers; Indonesian label option for local reports.
- A5 **Confirmed (2026-10-23):** the owner will download DEMNAS tiles once in his browser. Phase 0 must give him the exact tile list for Jabodetabek, click-by-click steps for tanahair.indonesia.go.id, and exactly where to upload the files. He does no processing.

## 3. Existing free tools (checked 2026-10-23)
None meets MUST-4/6/9/10 together. PetaBencana.id (crowd-sourced real-time reports) and BPBD "Pantau Banjir" are used as **validation sources**, not replacements. inaRISK, Google Flood Hub, Floodmap.net, Climate Central are static or bathtub maps.

## 4. Two-engine design (key for research credibility)

### 4.1 Explore engine (browser, WebGPU)
- Local-inertial 2D shallow-water scheme (Bates et al. 2010), the same equations as LISFLOOD-FP "ACC".
- Purpose: fast what-if exploration, teaching, choosing scenarios to send to Research Run.
- Must pass verification tests before use: selected UK Environment Agency 2D benchmark tests (Néelz & Pender 2013) and a comparison against SFINCS on the same sample area. Results published on the Validation page.
- Every Explore export is stamped "Exploratory result, not for quantitative conclusions".

### 4.2 Research Run engine (GitHub Actions, free)
- **SFINCS** (Deltares, GNU GPL v3, peer-reviewed: Leijnse et al. 2021, Coastal Engineering, doi:10.1016/j.coastaleng.2020.103796). Chosen because Jakarta flooding is **compound** (rain + rivers + tide/sea level), which SFINCS is designed for, with subgrid topography support.
- Model setup built automatically with **HydroMT-SFINCS** (logs every data source and step).
- Alternative/cross-check: **LISFLOOD-FP 8.x** (GPL v3, GMD papers 2021/2023/2025). Optional second model for model-uncertainty comparison.
- Runs on GitHub-hosted standard runners: free and unlimited for public repos; 4 vCPU/16 GB, 6-hour job limit (verify at build). Large runs are split into sub-domains or coarser grids to fit.
- Trigger without any secret in the website: the app's "Request Research Run" button opens a **pre-filled GitHub Issue** (scenario JSON in the body). The owner presses Submit. An Action validates the scenario, runs the model, converts output to COG, publishes a release, and comments the result link on the issue. The app then loads the result for 3D view and export.
- Ensemble option: N runs varying Manning's n, drainage loss and DEM source → **probability-of-inundation map** + uncertainty band. Default N = 10 (fits time limit at 60 m; adjust in Phase 2).

## 5. Data (latest, most complete, documented)
Phase 0 verifies every row: latest version, DOI, licence, access method, CORS. Each dataset gets a record in `data/catalog.json` (name, version, DOI, URL, access date, licence, resolution, vertical datum, citation in BibTeX).

| Theme | Primary | Alternatives / cross-check | Notes |
|---|---|---|---|
| Terrain | **DEMNAS** (BIG, 0.27 arcsec ≈ 8 m, EGM2008 datum) | FABDEM V1-2 (30 m, buildings and trees removed); Copernicus GLO-30 (30 m DSM) for world mode | DEMNAS needs a free account login (owner downloads tiles once). Check whether DEMNAS behaves as surface or terrain model in dense urban areas and its redistribution terms; if not redistributable, keep it out of the public repo and use it only inside Actions via a private data release. FABDEM is CC BY-NC-SA. |
| DEM epoch / subsidence | Peer-reviewed open InSAR subsidence-rate grid for Jakarta, if found | none | Used to shift terrain from DEM acquisition year to simulation year. If no open grid exists, reported as a limitation. |
| Sea boundary | BATNAS (BIG) bathymetry; tide/sea level from a verified free source (BIG tide stations or global tide model) | constant level slider | Needed for coastal/compound runs. |
| Land cover | **Impact Observatory/Esri 10 m Annual LULC** (latest year) | **ESA WorldCover 2021 v200** (10 m, independently validated ~77%); official KLHK land cover if accessible | Report both; let the researcher choose; show agreement map between them. |
| Water bodies | OpenStreetMap water polygons and waterways | BIG RBI hydrography; JRC Global Surface Water occurrence | Small situ, ponds, canals. OSM snapshot date recorded. |
| Buildings (exposure) | Google Open Buildings / Overture buildings (verify latest, licence) | OSM buildings | For "buildings flooded" statistics. |
| Population (exposure) | WorldPop or GHSL (latest) | none | For "people exposed" statistics. |
| Admin units | BIG/Indonesia Geospasial admin boundaries (kelurahan) | geoBoundaries | Stats per kecamatan/kelurahan. |
| Rain, historical | ERA5 / ERA5-Land via Open-Meteo archive (citable: Hersbach et al. 2020) | GPM IMERG (needs free NASA Earthdata account, stored as GitHub Secret, never in files); CHIRPS | Research runs use observed/reanalysis rain. |
| Rain, live/forecast | Open-Meteo forecast (free non-commercial, no key) | BMKG if an open feed is verified | Live mode = forecast scenario, labelled as such. |
| Satellite image | Sentinel-2 L2A (10 m), least-cloudy recent composite, scene IDs recorded | Landsat 8/9 | Export-safe licence. |
| Observed flood (validation) | Sentinel-1 SAR flood extent computed by pipeline for chosen events; Copernicus EMS products if an activation exists | PetaBencana reports; BPBD affected RW lists | Used for validation metrics. |
| River inflow | Water level/discharge for gauges (e.g., Katulampa, Depok) if open data verified | scenario values | If unavailable, inflow is a stated scenario assumption. |

## 6. Provenance, reproducibility, citation (MUST-10)
Every run and every export creates a **Provenance Record** with a short ID (e.g., `B3D-2026-0001`) printed on the map.

Record contents (JSON following W3C PROV ideas + human-readable PDF page):
- Input datasets: name, version, DOI, URL, access date, licence, SHA-256 checksum, spatial resolution, CRS, vertical datum.
- Processing chain: each step (clip, reproject, resample method, fill, burn-in of rivers, Manning lookup, subsidence shift), tool and version, parameters.
- Model: engine name + version + citation, grid size, domain, time step rule, boundary conditions, simulation period, all parameter values, ensemble settings.
- Software: app version, git commit hash, Action run ID and log link, container image digest.
- Outputs: file list with checksums, CRS, units, nodata values.
- Validation: metrics against observed data (see §7).
- Limitations: auto-generated list (missing drainage network, pumps, sea wall details, DEM epoch, resolution).
- Licence of the output (most restrictive input) and required attribution text.

Export bundle (ZIP):
- Map: PDF (vector text) and PNG/TIFF at 300 or 600 dpi.
- Data: GeoTIFF (COG) for max depth, max velocity, arrival time, duration, probability; GeoJSON/GeoPackage for extents; CSV statistics per kelurahan.
- `PROVENANCE.json`, `METHODS.md` (ready-to-paste methods paragraph in English and Indonesian, with in-text citations), `REFERENCES.bib`, `REFERENCES.ris`, `LICENSE.txt`, `README.txt`.
- Metadata: STAC Item JSON + ISO 19115-style XML for the GeoTIFFs.

Software citation:
- Repo has `CITATION.cff`. Each app release archived on **Zenodo** (free) to get a DOI. Methods text cites the app DOI + model + datasets.
- Reproduce button: load a Provenance ID → same inputs, same parameters, same results (checksums compared).

## 7. Validation and uncertainty (scientific defensibility)
- Event validation (Phase 4): at least 2 historical events (e.g., 1 Jan 2020 and one more recent event with Sentinel-1 coverage).
- Metrics (standard in flood inundation literature): Hit Rate, False Alarm Ratio, Critical Success Index (CSI), F1; plus point checks against PetaBencana/BPBD depth reports (RMSE where depths exist).
- Sensitivity analysis: Manning's n ±30%, drainage loss, DEM source (DEMNAS vs FABDEM), land cover source (IO vs WorldCover).
- Results published on an in-app **Validation page** and inside every Provenance Record.
- Never claim accuracy beyond what validation shows.

## 8. Cartographic standards (MUST-11), built in as templates
Templates: "Journal figure" (single 85 mm / double 175 mm width, configurable per journal), "A4/A3 report map", "Poster", "Indonesian report style" (BIG-like layout, SRGI 2013 note).

Required elements (template refuses to export if missing, unless the user turns off with a warning):
1. Title (what, where, when) and subtitle (scenario).
2. Main map with neatline.
3. Legend with units (e.g., "Max water depth (m)").
4. Scale bar + representative fraction (e.g., 1:100,000).
5. North arrow (grid north noted when in UTM).
6. Graticule or coordinate grid with labels.
7. CRS statement: WGS 84 / UTM zone 48S (EPSG:32748) default for Jabodetabek; vertical datum (EGM2008 or MSL).
8. Inset locator map.
9. Data sources with version/year + Provenance ID + QR link to the record.
10. Author, institution, date produced.
11. Model note and key limitations (1–2 lines).
12. Licence/attribution line.

Design rules:
- Colour-blind-safe sequential ramps (viridis / ColorBrewer) for depth; built-in colour-blind preview.
- Default depth classes: 0.05–0.15, 0.15–0.5, 0.5–1.0, 1.0–2.0, >2.0 m (editable; class source documented).
- Land cover colours follow each dataset's official legend.
- Fonts embedded in PDF; minimum 6–7 pt text at final print size; 300 dpi minimum raster.
- Map projection fixed per export; no Web Mercator in research exports.

## 9. Product spec (screens and tasks)
1. Home: region picker + "Live now" card.
2. Explore simulator: 3D view, layers, scenario panel (rain, river inflow, sea level, drainage), timeline, point inspector.
3. Research Runs: list of runs (status, Provenance ID), "Request Research Run", compare runs side by side.
4. 2D Map view.
5. Layout composer + export bundle.
6. Data catalog page (all datasets, versions, DOIs, licences, access dates).
7. Validation page (metrics, benchmark results).
8. Methods page (full model description with references).

Scale (owner correction 2026-10-24, ADR 0005): main region = mainland DKI Jakarta + 10 km buffer (≈ 52 × 51 km box, 2,129 km² domain; Kepulauan Seribu excluded); upstream catchments enter as river inflow boundaries. The cell counts below were written for the larger Jabodetabek box and are now upper bounds. Explore: 60 m full region (≈2.8 M cells), 30 m zoom (≈1 M cells for 30 × 30 km). Research Run: SFINCS subgrid allows coarse compute grid (e.g., 50–100 m) with fine DEM (8–30 m) inside cells; final grid chosen in Phase 2 to fit the 6-hour job.

## 9a. Time features (MUST-12)
Three kinds of "time" the app supports:
1. **Event range**: pick start and end date/time (e.g., 31 Dec 2019 00:00 to 3 Jan 2020 00:00). Hourly rain for that range is loaded (ERA5/IMERG for past, Open-Meteo for forecast). Model runs through the whole range. Timeline scrubber, play/pause, speed (1×–1000×), step by hour.
2. **Time outputs**: max depth, depth at any hour, flood arrival time, flood duration, time to recede; hydrographs (water depth vs time) at any clicked point or kelurahan; animation export (MP4/WebM/GIF) with time stamp and legend burned in.
3. **Across years (comparison)**: run the same rain event on different "world states":
   - Land cover year (IO/Esri annual series, 2017 to latest).
   - Terrain epoch (DEM shifted by subsidence rate to a chosen year, if open subsidence data exists).
   - Future scenario years (e.g., 2030, 2050) with user-set sea level rise and subsidence assumptions, always labelled as scenarios.
   - Output: difference maps (change in flooded area/depth), side-by-side and swipe views, statistics table per year.
Limits: one Research Run job ≤ 6 hours, so long ranges are split into chained jobs; the Provenance Record stores the exact range and time zone (WIB/UTC).

## 10. Visual direction
- Mood: "research atlas meets mission control". Light and dark.
- 3 test styles on a 10 × 10 km sample (Ciliwung, Kampung Melayu–Manggarai): satellite drape; land-cover drape; grey hillshade + strong depth ramp (print-friendly).
- Look-lock at end of Phase 1. Research exports always use print-safe styles.

Visual quality rules (MUST-13):
- Real GPU 3D (WebGPU, three.js): terrain mesh with adjustable vertical exaggeration, hillshade lighting, soft shadows, atmosphere/fog, smooth camera. No SVG, no blocky cell look.
- Water surface rendered from depth texture with bilinear/bicubic smoothing, animated normals, depth-based colour and transparency, shoreline blending, optional flow arrows/particles showing direction and speed.
- Sharp detail: 8 m DEMNAS terrain, 10 m land cover/satellite drape, optional 3D buildings for urban context.
- Level of detail and tiling so it stays smooth (target 60 fps on a mid-range laptop).
- Research-standard outputs from the same view:
  - 2D plan map (true scale) is the default figure, with all §8 elements.
  - 3D oblique figure allowed as a supporting figure: labelled "perspective view, not to scale", vertical exaggeration stated, legend + north indicator + Provenance ID kept.
  - Same colour ramps and depth classes in 3D and 2D so figures match.
- Phase 1 gate checks visuals against these rules with screenshots.

## 11. Tech stack and route
- Route B: public GitHub repo + Claude Code. Hosting: GitHub Pages. Compute: GitHub Actions. Archive: Zenodo.
- Front end: TypeScript + Vite, MapLibre GL JS, three.js (WebGPU), geotiff.js, PMTiles, Turf, PDF library, proj4js for UTM.
- Pipeline: Python, GDAL/rasterio, HydroMT-SFINCS, SFINCS (Docker image), optional LISFLOOD-FP, pystac, xarray.
- All versions pinned and recorded in Provenance; latest stable chosen in Phase 0 after advisory check.

## 12. Security plan
- Static site, no login, no backend, no secrets in files or the website.
- Issue-triggered runs: Action validates scenario JSON against a strict schema, rejects anything else; only the repo owner's issues (or a label he applies) start runs.
- Optional credentials (NASA Earthdata) only as GitHub Secrets, minimal permissions.
- Pinned actions by commit SHA, Dependabot, `npm audit`/`pip-audit` in CI, CSP limited to listed data hosts.

## 13. Tools and skills
Adopt only proven tools with evidence: SFINCS, HydroMT, LISFLOOD-FP (peer-reviewed, open source); MapLibre, three.js, geotiff.js (widely used). Measure performance in-app. Check licences before reusing any code (GPL code stays in the pipeline, not bundled into the website unless the website is also GPL).

## 14. Roadmap and gates
| Phase | Work | Owner sees at gate |
|---|---|---|
| 0. Data & licences | Verify every dataset (version, DOI, licence, access). Data catalog. Region pack Action. Owner does one-time DEMNAS download if he agrees. | Data catalog page + 2D map with all layers |
| 1. Look-lock | 3D sample in 3 styles | Pick style |
| 2. Engines | Explore engine + SFINCS Research Run on sample; benchmark tests | Same scenario in both engines, side by side |
| 3. Provenance | Provenance Record, Reproduce button, export bundle skeleton, CITATION.cff, Zenodo link | Download a ZIP with METHODS.md and REFERENCES.bib |
| 4. Validation | 2 historical events, CSI/Hit/False Alarm metrics, sensitivity | Validation page with honest numbers |
| 5. Full region + live | Jabodetabek full, live rain, ensembles | Probability map for a live forecast scenario |
| 6. Layout composer | Templates, required elements, colour-blind check | Export a journal-ready figure |
| 7. World mode | Any box; global datasets; Research Run supported | Run a city outside Indonesia |
| 8. Polish | Indonesian labels, mobile light view, docs | Final release v1.0 with DOI |

Feedback: NOW / RULE / LATER in `FEEDBACK.md`, then back to roadmap.

## 15. Top risks
1. **Urban flood accuracy** (no open drainage/pump/sea-wall data, DEM epoch vs subsidence). Mitigation: compound model, drainage parameter, subsidence correction if open data exists, ensemble uncertainty, validation metrics, auto-written limitations.
2. **Compute limits** (6-hour free job). Mitigation: subgrid coarse compute grid, sub-domains, ensembles split across parallel jobs.
3. **Data licences/redistribution** (DEMNAS terms, FABDEM non-commercial). Mitigation: Phase 0 licence check; most-restrictive-licence rule on outputs; private data release if needed.

## 16. Next action (owner)
1. Create a new **public** GitHub repo (e.g., `banjir3d`).
2. Upload: `CLAUDE.md`, `CORE.md`, `SECURITY.md`, `TOOLS.md`, `BLUEPRINT.md`.
3. Open claude.ai/code, select the repo, type:
   `Start the project. Follow CLAUDE.md. Begin with Phase 0 of BLUEPRINT.md.`
