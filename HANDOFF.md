# HANDOFF
Updated: 2026-10-24 | Commit: see `git log -1` on main | Phase: P0, step 5 | Waiting for owner: yes. Needs (1) switch on GitHub Pages, (2) DEMNAS download + upload, (3) screenshot of the DEMNAS licence terms

## How to open the current build
1. https://raredil.github.io/banjir3d/ (after Settings → Pages → Source: GitHub Actions).
2. Map tab = all layers; Data catalog tab = datasets, licences, DOIs, BibTeX.
3. Data appears after the `Region pack` Action has run (Actions → Region pack → Run workflow → region `jabodetabek`).

## What works
- `data/catalog.json` (21 datasets) + schema + `REFERENCES.bib` (generated: `cd pipeline && python catalog_tools.py --write-bib`).
- DEMNAS tile list: 25 RBI 1:50k sheets (`data/demnas/jabodetabek_tiles.json`, `pipeline/b3d/rbi.py`, tested on known sheets). Owner guide `docs/PANDUAN_DEMNAS.md`.
- Pipeline tested locally on `sample-ciliwung`: GLO-30, IO LULC 2017–2024, WorldCover, GSW, Overture buildings (330k in 10 × 10 km), Sentinel-2 composite. OSM water is tested only on synthetic data (Overpass is blocked in the cloud session).
- Web app: map (MapLibre 6, PMTiles, EN/ID, light/dark), catalog page; screenshots reviewed (software-rendered).

## Broken / Known gaps
- Not yet run in Actions: FABDEM (zip listing regex on data.bris.ac.uk), OSM Overpass, WorldPop, geoBoundaries, `verify_sources.py`, and the full-region size/time of buildings and Sentinel-2. Check the first Region pack run and fix whatever fails.
- Pages site size must stay < 1 GB (buildings tiled at z14 only).
- DEMNAS ingest (`demnas.yml`) has not been tested (no upload yet).
- Cloud session network: only GitHub/S3/GCS/npm/PyPI are reachable; all other data hosts work only inside Actions.

## Locked decisions (look, mechanics, tech) with links
- Data hosting: ADR 0001. DEMNAS private: ADR 0002. Web stack: ADR 0003. Pipeline libs: ADR 0004.
- Look NOT locked (Phase 1). Current UI = neutral research style, IBM Plex.

## Decisions since last handoff (ADR links)
docs/adr/0001–0004 (all new this session).

## Owner feedback: applied / in BACKLOG
None yet (FEEDBACK.md empty).

## Security status (last check date, open items)
2026-10-23: npm audit 0, pip-audit clean, CSP, actions pinned by SHA, Dependabot. Open: DEMNAS licence. docs/SECURITY_LOG.md.

## Next steps (ordered, specific, file paths)
First Region pack run (Actions run 39964714045, release `region-jabodetabek-20261023-r1`): dem ✅ (GLO-30 + FABDEM), landcover ✅. Failures and fixes in `pipeline/b3d/layers.py`:
1. `worldpop`: "Range downloading not supported" → download the whole IDN tif with `download()` first, then window-read locally.
2. `geoboundaries`: `gpd.read_file(github.com/.../raw/...)` fails (redirect/LFS) → `download()` to a temp file, then read.
3. `osm_water`: Overpass 504 → Geofabrik `asia/indonesia/java-latest.osm.pbf` (+ .md5), `osmium extract -b <bbox> --strategy smart`, then `osmium tags-filter` (natural=water, water, landuse=reservoir,basin, natural=wetland, waterway=river,riverbank,canal,stream,drain,ditch); add `sudo apt-get install -y osmium-tool` to region-pack.yml; snapshot from `osmium fileinfo`. Put the fetch in `_fetch_osm_water()` so `tests/test_osm_water.py` can monkeypatch it.
4. `sentinel2_composite`: `KeyError: 'red'` (some items use `B04/B03/B02/SCL` keys) → asset lookup with fallbacks (red|B04, green|B03, blue|B02, scl|SCL); skip items lacking them.
5. `overture_buildings`: runner shut down after ~70 s (likely out of memory on the full region) → stream `dset.to_batches()`, write GeoParquet incrementally, build PMTiles from the file; or split the bbox into 4 parts.
6. `verify` job failed: read its log first (`tail_lines` ≤ 60).
Then: re-run Region pack, update `data/catalog.json` statuses from `verify-report.json`, send the Gate 0 message.
Owner actions pending (re-sent 2026-10-24): enable Pages; DEMNAS download/upload; DEMNAS licence screenshot; ok on A6/A7 (`docs/ASSUMPTIONS.md`).

## Token-saving rules (owner asked, 2026-10-24)
- Hand off at ~half context OR at every gate/merge point, whichever comes first.
- Never read full Action logs: `get_job_logs` with `tail_lines` ≤ 60; make region_pack.py write a short error summary to `$GITHUB_STEP_SUMMARY`.
- Release assets and artifact storage are NOT reachable from the cloud session; logs are the only window.
- No repeated web research: facts live in `research/phase0-datasets.md`.
- No big greps into node_modules or large files in chat.
- Force-push is blocked by the permission classifier: update the branch with `git merge --ff-only origin/main`.

## File map (key files, project skills)
`data/` catalog, regions, demnas tile list · `pipeline/b3d/{layers,tiles,grid,rbi,util}.py` · `pipeline/region_pack.py` (build/merge) · `pipeline/verify_sources.py` · `pipeline/demnas_ingest.py` · `web/src/{main,map,catalog,layers,i18n,util}.ts` · `.github/workflows/{ci,region-pack,pages,demnas}.yml`. Local preview: `cd web && npm run build && npx vite preview` (put PMTiles in `web/dist/data/jabodetabek/`). No project skills yet.

## CODES
None.
