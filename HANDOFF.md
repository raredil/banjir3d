# HANDOFF
Updated: 2026-10-30 | Commit: see `git log -1` on main | Phase: P4 validation started | Waiting for owner: yes (NASA Earthdata token, see Next steps 0; Esri imagery postponed by owner: "nanti aja")

## SESSION LOG (newest first). Read this before anything else
- **2026-10-30 (twelfth entry), Claude Code, continue + "Esri later".** Done: ADR 0010. Action `observed.yml` (fetch.py/publish.py): PetaBencana archive answers WITHOUT a key (264/434/57 reports, 482/159/5 RW records for the 3 events in `verification/observed/events.json`); licence not stated, so raw records never published (scores only). ERA5 hourly via Open-Meteo (ERA5-Land precipitation empty), NOAA GSOD (mostly partial days, Halim missing). Release `observed-jakarta-20261030-o4`. Engine: rain zones + drainage sink (built share x D mm/h) in CPU and WebGPU (parity 1.5e-6 m), `inflowsForSpatial` (each catchment its own rain), engine pack now has `built` (release `region-jakarta-20261030-e2`). Action `validate.yml` (push `verification/observed/request.json`): whole region 90 m, matrix over D, then `compare.py` scores on the runner. First result (ERA5): 259 reports, hit 54 % (D 0) / 5 % (D 20), median depth reports 0.70 m vs model 0.12 m: ERA5 rain far too low (66 mm vs 377 mm Halim) -> calibration needs IMERG. Validation page shows it ("berjalan"). Owner saw run 2/3 failures (HTTP 403 when publishing): stale duplicate runs; now `concurrency cancel-in-progress`. `research/phase4-validation-sources.md`.
- **2026-10-30 (eleventh entry), Claude Code, owner's 20 points (3D does not work, nothing typed in, data-driven river capacity, real floods, sharp but smooth, export TIFF/HTML, dashboard UI in blue, lag, PhD-grade).** Done: ADR 0009. Engine pack pipeline (`pipeline/engine_pack.py`, Action `engine-pack.yml`, release `region-jakarta-20261030-e1` with SoilGrids, C 17 % D 83 %). Engine v2 `web/src/engine/` (solver CPU, WebGPU `gpu.ts`, `hydrology.ts` upstream inflows, `pack.ts`). GPU = CPU on real terrain (RMSE 5e-5 m, `verification/gpu-parity/`). New UI: rail + full map + floating cards (`style.css`, `map.ts`, `sim/panel.ts`, `sim/flood-layer.ts` water-level downscaling in WebGL, `sim/export.ts` GeoTIFF/HTML/PNG/JSON, GeoTIFF read OK by GDAL). 3D page removed. Data page with "used for" (`data/catalog-use.json`), Validation page (`data/validation.json`), Methods rewritten for v2 (9 sections, refs checked by tests). Owner tools `tools/check.py`, `tools/make_map.py`, `PROJECT_MAP.md`. Owner said mid-session: "tulisan penuh, jangan gaya AI": help moved behind "?" buttons, text trimmed (RULE). Screenshots `previews/phase2/v2/`. `npm run check` 39 tests, build OK.
- Earlier entries (PR #9 to #14): Explore v0/v1, SFINCS comparison, Methods page, sharp display, data checks. Details in git history and ADR 0006 to 0008.

## Browser for visual tests (works in cloud sessions)
Project skill `.claude/skills/visual-check/SKILL.md` (data into `web/public/data/jakarta/`, build, `shoot2.cjs`, GPU parity). Chromium `/opt/pw-browsers/...`; `require("playwright")` works. WebGPU works headless with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` (slow). Reachable from the session: github.com, AWS S3 (Copernicus DEM, WorldCover, IO LULC, Overture, Sentinel-2 COGs), pypi, npm. NOT reachable: isric, geofabrik, overpass, data.jakarta, petabencana, arcgis, zenodo: use Actions for those.

## How to open the current build
1. https://raredil.github.io/banjir3d/ (Pages deploys from `main`, data from the newest `region-jakarta-*` release).
2. Menu: Peta (layers), Simulasi (run, timeline, Ekspor), Data, Metode, Validasi.
3. Local: copy release files into `web/public/data/jakarta/`, `cd web && npm run build && npx vite preview`.

## What works
- Validation pipeline: `observed.yml` -> `validate.yml` (edit `verification/observed/request.json`: event, drains, rain `era5`|`imerg` after step 0, k) -> release `validation-jakarta-<event>-v<n>` with hmax/mask/summary per D and `<event>_scores.json`.
- Engine pack (30 m UTM 48S, 1718 × 1737): carved OSM channels, n and CN from IO land cover 2024 + SoilGrids, sea mask, GLO-90 stream network (107k cells ≥ 1 km²).
- Engine v2: local inertial, CN runoff, upstream inflows (NRCS lag + UH, no double counting), sea level, transmissive edges; WebGPU in a worker with CPU fallback (region forced to 90 m without WebGPU).
- Whole-region run, 1 Jan 2020 storm, 90 m CPU (Node): 13.5 min, mass error 5e-15; water follows valleys/rivers. 4.4 km box at 30 m in the browser: 39 s CPU, flood along Ciliwung (Kampung Melayu–Bukit Duri).
- Exports: depth GeoTIFF (EPSG:32748, float32, nodata -9999), coloured GeoTIFF, HTML map (Leaflet + OSM from CDN), PNG figure (title, legend, scale, north, sources), JSON provenance.
- Tests: `cd web && npm run check` (39), `cd pipeline && python -m pytest -q` (9). `python3 tools/check.py` (2 warnings: IDEAS.md, MUST IDs format).

## Broken / Known gaps
- **Validated only with ERA5 rain (too low): drains not calibrated yet.** PetaBencana RW shapes: `/floods?admin=ID-JK` gives 500, `city` rejected, so RW scores (CSI/AUC in compare.py) not computed; need RW boundaries from another open source (e.g. Action fetching BIG/Jakarta Satu RW polygons) or `/floods` with the right parameters.
- NOAA ISD hourly URL returns HTML (re-check path).
- Previously: Results too wet: no city drains/pumps/sea walls (no open data). Whole region 1 Jan 2020 at 90 m: 777 km² > 0.15 m (provisional soil run) — unrealistic.
- Uniform scenario rain upstream overstates river peaks (Cisadane 8,660 m³/s at 377 mm). Real events need observed/reanalysis rain per catchment.
- D8 on GLO-90 may misroute in flat east (Bekasi/Cikarang entries near 107.06 E); check on a map.
- SFINCS comparison was on engine v1 (hMin 0.05); re-run with v2. EA benchmarks not done.
- KPI "deepest" can include permanent water not mapped as channel (situ, ponds).
- Real GPU speed unmeasured (cloud has no GPU). Imagery 10 m only (see Next steps 0).
- Lindsay 2016 and Karra 2021 DOIs unconfirmed: not cited. NEH chapters cited from memory: re-check text in an Action (`research/phase2-engine-v2-sources.md`).

## Locked decisions (look, mechanics, tech) with links
ADR 0001 hosting · 0002 DEMNAS private · 0003 web stack · 0004 pipeline · 0005 region · 0006 CPU Explore (superseded by 0009 WebGPU) · 0007 Methods page · 0008 data checks (display rule updated by 0009) · **0009 engine v2, 2D dashboard** · **0010 validation, drains, rain zones**. RULES: no 3D; only external forcing as user input; methods text = code; little text, help behind "?"; blue dashboard, full map.

## Decisions since last handoff (ADR links)
docs/adr/0009-engine-v2-data-driven.md, docs/adr/0010-validation-observed-floods.md.

## Owner feedback: applied / in BACKLOG
2026-10-30, 20 points: see FEEDBACK.md (12 rows). Open: sharper imagery (owner decision), validation (next).

## Security status (last check date, open items)
2026-10-30 (12th): no web dependency change. New workflows `observed.yml`, `validate.yml`: inputs validated (event id regex, rain/k allow-list, drains numeric 0-500, max 8), passed via env, pinned action SHAs, `contents: write` only on publishing jobs. Secret `EARTHDATA_TOKEN` only sent as Bearer header to gpm1.gesdisc.eosdis.nasa.gov, never logged. PetaBencana raw records never published (licence unknown). Actions-only pip: h5py 3.15.1.
2026-10-30: no new dependencies; CSP unchanged (engine pack same-origin; exported HTML loads Leaflet/OSM from CDN only inside the downloaded file). New inputs: `#/sim?box=` (numbers, clipped to region), hourly rain (existing strict parser). npm audit not re-run this session (no dependency change).

## Next steps (ordered, specific, file paths)
0. Owner action (asked in chat): free NASA Earthdata account + token as repo secret `EARTHDATA_TOKEN`. Then push any change to `verification/observed/events.json` (re-runs `observed.yml`, which then adds `rain_imerg.json`; check the Bearer-token download works, file name pattern `3B-HH.MS.MRG.3IMERG.<date>-S..-E...<min>.V07B.HDF5`). Esri imagery: postponed by owner.
1. Calibrate D on 2020-01-01 with IMERG: `request.json` {"rain": "imerg", drains [0, 5, 10, 20, 40]}; add "imerg" to the allowed rain values in `validate.yml` (prep step + download step). Objective: report hit rate AND an over-prediction check (RW shapes, or modelled flooded area vs BPBD/BNPB reported area with a source). Then validate on 2021-02-20 and 2025-03-04 with the same D.
2. Put calibrated D into the app (`sim/panel.ts`, `sim/worker.ts`: grid.drain = D x run.built; not a slider), Methods §2/§9 + references, Validation page numbers from `verification/observed/scores-*.json`.
3. Event mode in the UI: "1 Jan 2020 as observed" with IMERG per zone (GPU supports `zoneMm`).
4. SFINCS re-run with v2 must run in an Action (cloning Deltares/SFINCS is outside this session's GitHub scope); EA benchmarks 1, 2, 4.
5. Exposure: buildings/people flooded per kecamatan (Overture + WorldPop).
Owner actions pending: Earthdata token; DEMNAS licence text; imagery choice (later).

## File map (key files, project skills)
`PROJECT_MAP.md` (auto, `python3 tools/make_map.py`) · `pipeline/engine_pack.py` · `data/engine/landcover-parameters.json` · `web/src/engine/` · `web/src/sim/` · `web/src/{main,map,catalog,layers,i18n}.ts` · `data/{catalog-use,validation}.json` · `data/methods/` · `verification/{gpu-parity,region-run}/` · `.github/workflows/{engine-pack,observed,validate}.yml` · `verification/observed/` · skill `.claude/skills/visual-check/`.

## CODES
None.
