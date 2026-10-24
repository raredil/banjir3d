# HANDOFF
Updated: 2026-10-24 | Commit: see `git log -1` on main | Phase: P0, step 5 (Gate 0 ready) | Waiting for owner: yes. Needs (1) switch on GitHub Pages, (2) screenshot of the DEMNAS licence terms

## How to open the current build
1. https://raredil.github.io/banjir3d/ (after Settings → Pages → Source: GitHub Actions).
2. Map tab = all layers; Data catalog tab = datasets, licences, DOIs, BibTeX.
3. Data = newest release `region-jakarta-*` (Actions → Region pack → Run workflow → region `jakarta`). Pages workflow then copies its PMTiles into the site.
4. Region preview image: `previews/gate0/region-jakarta.jpg`.

## What works
- **Region = mainland DKI Jakarta + 10 km buffer** (owner correction 2026-10-24, ADR 0005). `pipeline/make_domain.py jakarta` → `data/regions/jakarta_domain.geojson` (features `domain`, `admin`); `b3d.load_domain(region)`. bbox 106.595–107.064 E, 5.998–6.462 S; domain 2,129 km²; DKI 643 km². Old `jabodetabek` region removed.
- Region pack run 2 (release `region-jakarta-20261024-r2`, Actions run 40115445991): **all 10 datasets ok** (GLO-30, FABDEM, IO LULC 2017–2024, WorldCover, GSW, OSM water via Geofabrik+osmium, Overture buildings 4.3 M in domain, WorldPop 2025, geoBoundaries ADM2, Sentinel-2). verify job ok. Release 464 MB, PMTiles 73 MB.
- DEMNAS: owner uploaded 25 sheets to draft release `demnas-private`; ingest (run 40137567057) uses the 6 inside the domain → `dem_demnas_jakarta_utm48s_8m.tif` + `demnas_report.json` in the same draft. QA: DKI no-data 0 %, min/p1/p50/p99/max = −4.56/−1.92/9.68/66.1/91.47 m (EGM2008). Tiles have **no CRS tag** → `warp_to_grid(..., assume_crs="EPSG:4326")`; CRS-less sources now raise unless assume_crs is given.
- Release assets of public releases ARE reachable from the cloud session (`curl -L github.com/.../releases/download/...`) and the public REST API (60 req/h unauthenticated).
- Tests: `cd pipeline && python -m pytest -q` (8), `cd web && npm run check && npm run build`.

## Broken / Known gaps
- geoBoundaries API returns ADM2 only for IDN (ADM3/ADM4 skipped). Kecamatan/kelurahan boundaries need another source (BIG / BPS) → BACKLOG.
- Buildings PMTiles (z14 only, MAX_SIZE 2 MB/tile, 46 MB) may drop features in the densest tiles — check visually on the live site.
- Pages workflow on `main` must loop `jakarta` (done in this branch; takes effect after merge). Pages not yet switched on by the owner.
- DEMNAS licence still unknown → stays private (ADR 0002).
- Upstream catchments are outside the domain → river inflow boundary conditions needed (Phase 2, ADR 0005).

## Locked decisions (look, mechanics, tech) with links
- Data hosting ADR 0001 · DEMNAS private ADR 0002 · Web stack ADR 0003 · Pipeline libs ADR 0004 · Region DKI+10 km ADR 0005.
- Look NOT locked (Phase 1). Current UI = neutral research style, IBM Plex.

## Decisions since last handoff (ADR links)
docs/adr/0005-region-jakarta-buffer.md. A5 done, A6 corrected+confirmed, A7 confirmed (docs/ASSUMPTIONS.md).

## Owner feedback: applied / in BACKLOG
2026-10-24: region correction (applied); DEMNAS notes from BIG (used: confirmed format, geographic CRS, EGM2008 = same datum as GLO-30/FABDEM, so no datum conversion; gdal_merge/GMT steps not needed, the pipeline does it).

## Security status (last check date, open items)
2026-10-23: npm audit 0, pip-audit clean, CSP, actions pinned by SHA, Dependabot. New: osmium-tool from Ubuntu apt in region-pack water job; Geofabrik download md5-checked. Open: DEMNAS licence. docs/SECURITY_LOG.md.

## Next steps (ordered, specific, file paths)
1. After merge: run Pages (`pages.yml` on main) so the site shows `region-jakarta-20261024-r2`; screenshot the map (domain outline, buildings at z14) for Gate 0; review against CORE §9.
2. Update `data/catalog.json` statuses from the release `verify-report.json` (download via curl, see above); regenerate `REFERENCES.bib`.
3. Send Gate 0 message (catalog page + map + region preview + DEMNAS QA numbers).
4. Phase 1 prep: look-lock on the 10 × 10 km sample (BLUEPRINT §"3 test styles"); compare DEMNAS vs FABDEM vs GLO-30 on the sample (needs DEMNAS clip read in an Action — private).
Owner actions pending: enable Pages; DEMNAS licence screenshot.

## Token-saving rules (owner asked, 2026-10-24)
- Hand off at ~half context OR at every gate/merge point, whichever comes first.
- Never read full Action logs: `get_job_logs` with `tail_lines` ≤ 60; region_pack.py writes a status table to `$GITHUB_STEP_SUMMARY` and `::error` annotations.
- `list_workflow_jobs` output is large; prefer `get_workflow_job` for one job.
- No repeated web research: facts live in `research/phase0-datasets.md`.
- Force-push is blocked by the permission classifier: update the branch with `git merge --ff-only origin/main`.

## File map (key files, project skills)
`data/` catalog, regions (+ `regions/jakarta_domain.geojson`), demnas tile list (`demnas/jakarta_tiles.*`) · `pipeline/b3d/{layers,tiles,grid,rbi,util}.py` · `pipeline/make_domain.py` · `pipeline/region_pack.py` · `pipeline/verify_sources.py` · `pipeline/demnas_ingest.py` · `pipeline/demnas_tiles.py` · `web/src/{main,map,catalog,layers,i18n,util}.ts` · `.github/workflows/{ci,region-pack,pages,demnas}.yml`. Local preview: `cd web && npm run build && npx vite preview` (put PMTiles in `web/dist/data/jakarta/`). No project skills yet.

## CODES
None.
