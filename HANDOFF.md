# HANDOFF
Updated: 2026-10-30 | Commit: see `git log -1` on main | Phase: P2 engine v2 done, P4 validation next | Waiting for owner: yes (sharper imagery choice, see Next steps 0)

## SESSION LOG (newest first). Read this before anything else
- **2026-10-30 (eleventh entry), Claude Code, owner's 20 points (3D does not work, nothing typed in, data-driven river capacity, real floods, sharp but smooth, export TIFF/HTML, dashboard UI in blue, lag, PhD-grade).** Done: ADR 0009. Engine pack pipeline (`pipeline/engine_pack.py`, Action `engine-pack.yml`, release `region-jakarta-20261030-e1` with SoilGrids, C 17 % D 83 %). Engine v2 `web/src/engine/` (solver CPU, WebGPU `gpu.ts`, `hydrology.ts` upstream inflows, `pack.ts`). GPU = CPU on real terrain (RMSE 5e-5 m, `verification/gpu-parity/`). New UI: rail + full map + floating cards (`style.css`, `map.ts`, `sim/panel.ts`, `sim/flood-layer.ts` water-level downscaling in WebGL, `sim/export.ts` GeoTIFF/HTML/PNG/JSON, GeoTIFF read OK by GDAL). 3D page removed. Data page with "used for" (`data/catalog-use.json`), Validation page (`data/validation.json`), Methods rewritten for v2 (9 sections, refs checked by tests). Owner tools `tools/check.py`, `tools/make_map.py`, `PROJECT_MAP.md`. Owner said mid-session: "tulisan penuh, jangan gaya AI": help moved behind "?" buttons, text trimmed (RULE). Screenshots `previews/phase2/v2/`. `npm run check` 39 tests, build OK.
- Earlier entries (PR #9 to #14): Explore v0/v1, SFINCS comparison, Methods page, sharp display, data checks. Details in git history and ADR 0006 to 0008.

## Browser for visual tests (works in cloud sessions)
Project skill `.claude/skills/visual-check/SKILL.md` (data into `web/public/data/jakarta/`, build, `shoot2.cjs`, GPU parity). Chromium `/opt/pw-browsers/...`; `require("playwright")` works. WebGPU works headless with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` (slow). Reachable from the session: github.com, AWS S3 (Copernicus DEM, WorldCover, IO LULC, Overture, Sentinel-2 COGs), pypi, npm. NOT reachable: isric, geofabrik, overpass, data.jakarta, petabencana, arcgis, zenodo: use Actions for those.

## How to open the current build
1. https://raredil.github.io/banjir3d/ (Pages deploys from `main`, data from the newest `region-jakarta-*` release).
2. Menu: Peta (layers), Simulasi (run, timeline, Ekspor), Data, Metode, Validasi.
3. Local: copy release files into `web/public/data/jakarta/`, `cd web && npm run build && npx vite preview`.

## What works
- Engine pack (30 m UTM 48S, 1718 × 1737): carved OSM channels, n and CN from IO land cover 2024 + SoilGrids, sea mask, GLO-90 stream network (107k cells ≥ 1 km²).
- Engine v2: local inertial, CN runoff, upstream inflows (NRCS lag + UH, no double counting), sea level, transmissive edges; WebGPU in a worker with CPU fallback (region forced to 90 m without WebGPU).
- Whole-region run, 1 Jan 2020 storm, 90 m CPU (Node): 13.5 min, mass error 5e-15; water follows valleys/rivers. 4.4 km box at 30 m in the browser: 39 s CPU, flood along Ciliwung (Kampung Melayu–Bukit Duri).
- Exports: depth GeoTIFF (EPSG:32748, float32, nodata -9999), coloured GeoTIFF, HTML map (Leaflet + OSM from CDN), PNG figure (title, legend, scale, north, sources), JSON provenance.
- Tests: `cd web && npm run check` (39), `cd pipeline && python -m pytest -q` (9). `python3 tools/check.py` (2 warnings: IDEAS.md, MUST IDs format).

## Broken / Known gaps
- **Not validated against observed floods.** Results too wet: no city drains/pumps/sea walls (no open data). Whole region 1 Jan 2020 at 90 m: 777 km² > 0.15 m (provisional soil run) — unrealistic.
- Uniform scenario rain upstream overstates river peaks (Cisadane 8,660 m³/s at 377 mm). Real events need observed/reanalysis rain per catchment.
- D8 on GLO-90 may misroute in flat east (Bekasi/Cikarang entries near 107.06 E); check on a map.
- SFINCS comparison was on engine v1 (hMin 0.05); re-run with v2. EA benchmarks not done.
- KPI "deepest" can include permanent water not mapped as channel (situ, ponds).
- Real GPU speed unmeasured (cloud has no GPU). Imagery 10 m only (see Next steps 0).
- Lindsay 2016 and Karra 2021 DOIs unconfirmed: not cited. NEH chapters cited from memory: re-check text in an Action (`research/phase2-engine-v2-sources.md`).

## Locked decisions (look, mechanics, tech) with links
ADR 0001 hosting · 0002 DEMNAS private · 0003 web stack · 0004 pipeline · 0005 region · 0006 CPU Explore (superseded by 0009 WebGPU) · 0007 Methods page · 0008 data checks (display rule updated by 0009) · **0009 engine v2, 2D dashboard**. RULES: no 3D; only external forcing as user input; methods text = code; little text, help behind "?"; blue dashboard, full map.

## Decisions since last handoff (ADR links)
docs/adr/0009-engine-v2-data-driven.md.

## Owner feedback: applied / in BACKLOG
2026-10-30, 20 points: see FEEDBACK.md (12 rows). Open: sharper imagery (owner decision), validation (next).

## Security status (last check date, open items)
2026-10-30: no new dependencies; CSP unchanged (engine pack same-origin; exported HTML loads Leaflet/OSM from CDN only inside the downloaded file). New inputs: `#/sim?box=` (numbers, clipped to region), hourly rain (existing strict parser). npm audit not re-run this session (no dependency change).

## Next steps (ordered, specific, file paths)
0. Owner decision (asked in chat): sharper basemap. Free open data stops at 10 m (Sentinel-2). Option: Esri World Imagery free tier (owner makes a free ArcGIS Location Platform account and API key; display only, not in exports). Until then keep Sentinel-2.
1. Validation (Phase 4 now): Action that fetches PetaBencana `/reports/archive` (open, no key) for 31 Dec 2019–3 Jan 2020 and one recent event (Feb 2021 or Mar 2025), plus ERA5-Land / IMERG hourly rain per catchment (Open-Meteo archive). Script `verification/observed/`, metrics hit rate / CSI / depth RMSE at report points, shown on `#/validation` (`data/validation.json`).
2. Calibrate one effective drainage capacity (mm/h, built-up cells) on event 1, validate on event 2; add it to `engine/solver.ts` + `gpu.ts` (sink term), Methods §9, as a calibrated (not typed) parameter.
3. Event mode in the UI: "1 Jan 2020 as observed" using the fetched rain per catchment instead of uniform 377 mm.
4. Re-run SFINCS comparison with v2 (`verification/explore-vs-sfincs/`), then EA benchmarks 1, 2, 4.
5. Exposure: buildings/people flooded per kecamatan from Overture + WorldPop.
Owner actions pending: imagery choice; DEMNAS licence text.

## File map (key files, project skills)
`PROJECT_MAP.md` (auto, `python3 tools/make_map.py`) · `pipeline/engine_pack.py` · `data/engine/landcover-parameters.json` · `web/src/engine/` · `web/src/sim/` · `web/src/{main,map,catalog,layers,i18n}.ts` · `data/{catalog-use,validation}.json` · `data/methods/` · `verification/{gpu-parity,region-run}/` · `.github/workflows/engine-pack.yml` · skill `.claude/skills/visual-check/`.

## CODES
None.
