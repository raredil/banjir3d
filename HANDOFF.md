# HANDOFF
Updated: 2026-10-29 | Commit: see `git log -1` on main | Phase: P0, Gate 0 accepted by owner (verbal) | Waiting for owner: DEMNAS licence screenshot (not blocking); Phase 1 look choice later

## SESSION LOG (newest first). Claude Code: read this before anything else
Each entry says WHERE the work was done. Entries marked **claude.ai chat** were done without visual checks, so they are NOT visually verified. A later session should audit them (see "Audit checklist"). **Correction 2026-10-29:** an earlier version of this file said there is no browser in the cloud chat. That was wrong: Chromium is preinstalled (see "Browser for visual tests" below). Only the `playwright install` download fails.

## Browser for visual tests (works in cloud sessions)
Do NOT run `npx playwright install` (download blocked). Use what is already there: `ls /opt/pw-browsers` (look for `chromium-*/chrome-linux64/chrome`) and Playwright at `/opt/npm-tools/node_modules/playwright`. Example: `CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node script.js`. In the 2026-10-29 chat sandbox the layout differed: Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, no `/opt/npm-tools`, but Python Playwright (`from playwright.sync_api import sync_playwright`, `executable_path=...`, args `--no-sandbox --use-gl=swiftshader --enable-unsafe-swiftshader`) works. Start `vite preview` and run the screenshot script in the SAME bash call, the server dies when the call ends, with `require('/opt/npm-tools/node_modules/playwright')` and `chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox']})`. Version numbers can change, so `ls` first. No GPU: screenshots are software-rendered (CORE §3). github.io is not reachable from the cloud session, so render the local build (`cd web && npm run build && npx vite preview`, PMTiles in `web/dist/data/jakarta/`).
- **2026-10-29 (later), claude.ai chat, screenshots taken.** Built web locally, downloaded release `region-jakarta-20261024-r2` PMTiles (10 files + manifest + verify-report) into `web/dist/data/jakarta/`, served with `vite preview`, screenshots with Python Playwright. Result: Map tab and Data catalog tab render correctly on desktop (1440x900) and mobile (390x844). Default layers (Sentinel-2, OSM water, boundaries, domain outline) look right, panel and legend readable, no JS errors. Only console error: `ERR_NAME_NOT_RESOLVED` (OpenFreeMap basemap tiles, not reachable from the sandbox; expected, not a bug). NOT checked yet: buildings layer at z14+ in dense tiles (possible dropped features), DEM/LULC/population layers toggled on, dark mode. FABDEM landing page recheck NOT possible from the chat sandbox (data.bris.ac.uk and doi.org are not in the allowed domains, DNS fails), so the ReadTimeout badge stays until verify_sources.py is re-run in an Action or Claude Code. Small note for later: DEMNAS card shows green "verified" while its licence is still "not yet read"; consider wording so it does not read as licence-verified. Only HANDOFF.md changed.
- **2026-10-29, claude.ai chat** (owner's Claude Code usage had run out). Cloned repo, `npm ci` + `npm run build` OK, downloaded release `region-jakarta-20261024-r2` PMTiles into `web/dist/data/jakarta/` (not committed). `pipeline/catalog_tools.py --write-bib`: catalog OK, REFERENCES.bib unchanged. Verify-report: all URLs HTTP 200 except FABDEM landing page (ReadTimeout, DOI registered; likely transient, recheck). No screenshot was taken in this entry (the `playwright install` download is blocked, and the preinstalled Chromium was not checked until later). Only HANDOFF.md changed in this entry.
- Owner answers 2026-10-29: (1) DEMNAS licence: "aman dipakai" (owner says it is safe to use; no screenshot or licence text yet, so `data/catalog.json` still says "not yet read" and ADR 0002 keeps DEMNAS private until the text is recorded). (2) Live site: map shows; there is no flood layer yet (expected, flood modelling starts in a later phase).

### Audit checklist (for a Claude Code session after a claude.ai chat session)
1. `git log --oneline -10` and `git diff <last Claude Code commit>..main --stat`: list everything done in chat sessions.
2. `cd pipeline && python -m pytest -q` and `cd web && npm run check && npm run build`.
3. Render the site with the release PMTiles and take screenshots (CORE §9); check anything marked "not visually verified" above.
4. Re-run `python pipeline/verify_sources.py` if the FABDEM timeout is still in the newest verify-report.
5. Record the audit result as a new line at the top of this log.

## How to open the current build
1. https://raredil.github.io/banjir3d/ — Pages deploy run 40137979397 (main, after merge of PR #3) succeeded, so Pages is on. github.io itself is blocked from the cloud session: ask the owner for a screenshot.
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
1. Done: merged (PR #3), Pages redeployed with `region-jakarta-20261024-r2`. Local build + release data fetch verified 2026-10-29 (claude.ai chat). Default-layer screenshots done 2026-10-29 (desktop, mobile, catalog: OK). Still to do in the CORE §9 review: buildings layer at z14+ in dense areas, DEM/LULC/population layers, dark mode.
2. Done 2026-10-29: catalog validated, REFERENCES.bib regenerated (no change). Catalog `status`/`checked` fields are curated; the site reads the release `verify-report.json` live, so nothing else to sync. Recheck the FABDEM landing page URL (timeout once): cannot be done from the chat sandbox (DNS blocked), re-run `pipeline/verify_sources.py` in an Action or Claude Code.
3. Gate 0: owner has seen the live site and says the map works; treat Gate 0 as accepted. No separate Gate 0 message needed.
4. Phase 1 prep (next): look-lock on the 10 × 10 km sample (BLUEPRINT §"3 test styles"). This needs screenshots (use the preinstalled Chromium, software-rendered) and an owner choice. Compare DEMNAS vs FABDEM vs GLO-30 on the sample (needs the private DEMNAS clip read inside an Action).
Owner actions pending: DEMNAS licence screenshot or text (to record in `data/catalog.json` and ADR 0002).

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
