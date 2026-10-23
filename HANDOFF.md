# HANDOFF
Updated: 2026-10-23 | Commit: see `git log -1` on main | Phase: P0, step 5 | Waiting for owner: yes. Needs (1) switch on GitHub Pages, (2) DEMNAS download + upload, (3) screenshot of the DEMNAS licence terms

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
1. Check the Region pack run (`.github/workflows/region-pack.yml`); fix failing builders in `pipeline/b3d/layers.py`; re-run.
2. Check `verify-report.json` in the release; update `data/catalog.json` statuses (FABDEM licence, WorldPop licence, Zenodo 19456870 licence, IO 2025) → `catalog_tools.py --write-bib`.
3. When the owner says "DEMNAS sudah diupload": run `DEMNAS ingest` Action; read `demnas_report.json` in the draft release.
4. Gate 0 message (CORE Appendix B) with screenshots of the live site; then Phase 1 (look-lock, 3 styles on `sample-ciliwung`).

## File map (key files, project skills)
`data/` catalog, regions, demnas tile list · `pipeline/b3d/{layers,tiles,grid,rbi,util}.py` · `pipeline/region_pack.py` (build/merge) · `pipeline/verify_sources.py` · `pipeline/demnas_ingest.py` · `web/src/{main,map,catalog,layers,i18n,util}.ts` · `.github/workflows/{ci,region-pack,pages,demnas}.yml`. Local preview: `cd web && npm run build && npx vite preview` (put PMTiles in `web/dist/data/jabodetabek/`). No project skills yet.

## CODES
None.
