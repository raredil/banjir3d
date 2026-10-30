# HANDOFF
Updated: 2026-10-30 | Commit: see `git log -1` on main | Phase: P2 in progress (Explore engine v1) | Waiting for owner: no (DEMNAS licence text still welcome, not blocking)

## SESSION LOG (newest first). Read this before anything else
Each entry says WHERE the work was done. **claude.ai chat** entries were not visually verified unless stated; a Claude Code session audits them.
- **2026-10-30 (tenth entry), Claude Code, owner: "nothing blurry (map, flood); data must be validated".** Flood overlay now draws every 38 m cell as a sharp square, no interpolation (`explore/ui.ts`, `palette.ts overlayScale`). Measured imagery blur: old Sentinel-2 z14 tiles kept 82.5 % of source detail (average kernel + WebP 82); new `imagery_display` (Lanczos at z14, WebP 92) keeps 99.7 % (pytest `test_tiles.py`). Map: data grids nearest, Sentinel-2 nearest from z15 (real 10 m pixels), max zoom 18 (`util.ts rasterResampling`). New `verification/data-checks/check_pack.py` (checksums; terrain the engine reads = FABDEM within 0.0039 m over the region; land cover 100 %; imagery detail ≥ 95 %), runs in `region-pack.yml` and new `retile.yml`, result `data-check.json` shown on the Data catalog page. Methods section 5 paragraph added. ADR 0008. `npm run check` 46 tests, pytest 9, build OK, npm audit 0, no console errors. Previews `previews/phase2/sharp-*`, `data-checks-catalog.png`. Merged (PR #13); `retile.yml` run 1 published `region-jakarta-20261030-t1` (data checks 4 × pass, 35 files checksum ok) and Pages redeployed. FABDEM landing page still times out in `verify_sources` (DOI registered).
- **2026-10-29 (ninth entry), Claude Code, audit of all chat work + Explore v1.** Audit: `npm run check` (24 tests) and build OK, pytest 8 OK; screenshots OK. Code review found and fixed: open north edge used an arbitrary slope 0.0005 and uniform n even with the n field (now transmissive edges, no parameter); wrong theta attribution in a comment (theta is de Almeida et al. 2012); rain presets and 20 mm/h drainage arbitrary (replaced); built-up low/high n "assumed" (now HEC-RAS range 0.12–0.20). New (ADR 0007): rain = design storm (R24, Mononobe, alternating block) / typed hourly / constant; default = 1 Jan 2020 event (377 mm/day Halim, Lubis et al. 2022); presets only this event and the SFINCS check case; edges open/closed; analytical wave test (Hunter et al. 2005), 1–6 % of boundary depth; draw-your-own box on `#/sample` (deep link `?box=W,S,E,N`, block-averaged grid above 160k cells); flooded area now > 0.15 m; **Methods page `#/methods`** (2,500 words, 19 verified references, Harvard, DOI links, METHODS.md and .bib downloads; tests enforce citations and whole paragraphs); mobile nav scrolls; project skill `.claude/skills/visual-check/`. `npm run check` 44 tests, build OK, npm audit 0, no console errors. Screenshots `previews/phase2/explore-v1-*`. Run in a drawn 2.4 × 1.9 km box with the default event: peak 1.27 m, 1.71 km² > 0.15 m, mass error 1.5e-14, 6 s (software GL).
- Earlier entries (all 2026-10-29, claude.ai chat, now audited): WorldCover roughness in the browser (PR #11); Explore vs SFINCS 2.4.0 on the sample, RMSE 0.04–0.06 m, CSI 0.92–0.96, solver defaults theta 1.0 / alpha 0.5 / hMin 0.05 (PR #10, `verification/explore-vs-sfincs/`); Explore engine v0 (PR #9, ADR 0006); three looks on `#/sample` (PR #8); outline toggles; CORE §9 layer review (all layers and dark mode OK); FABDEM landing page timeout once (recheck with `pipeline/verify_sources.py` in an Action).
- Owner answers 2026-10-29: DEMNAS licence "aman dipakai" (no text yet, so ADR 0002 keeps DEMNAS private); Gate 0 accepted; Phase 1: keep all three looks.

## Browser for visual tests (works in cloud sessions)
Use the project skill `.claude/skills/visual-check/SKILL.md` (data download, build, preview server and screenshots in one call). Chromium `/opt/pw-browsers/chromium-*/chrome-linux64/chrome`; `require("playwright")` works globally. Never run `playwright install`. github.io, doi.org, crossref, arxiv and publisher sites are NOT reachable from the cloud session; github.com release downloads and WebSearch are.

## How to open the current build
1. https://raredil.github.io/banjir3d/ (Pages deploys from `main`).
2. Tabs: Map (all layers), 3D sample (looks + flood simulation + draw your own area), Data catalog, Methods (full methods text with references).
3. Local: `cd web && npm run build && npx vite preview` with the release PMTiles in `web/dist/data/jakarta/`.

## What works
- Region = mainland DKI Jakarta + 10 km buffer (ADR 0005); region pack release `region-jakarta-20261030-t1` (= `20261024-r2` with sharper imagery tiles), all 10 datasets ok, data checks pass. DEMNAS ingest in the private draft release (ADR 0002).
- Explore engine v1 (`web/src/explore/`): local-inertial solver (`local-inertial.ts`), rain (`rain.ts`), scenario (`scenario.ts`), worker, UI; per-cell WorldCover n (`data/roughness/worldcover-manning.json` v0.2.0); open/closed edges; own area box (`sample3d.ts`, helpers in `sample-look.ts`).
- Verification: unit tests (rest, mass, dam break, inflow, open edges, analytical wave); `verification/analytical-wave/`; `verification/explore-vs-sfincs/`.
- Methods page: `data/methods/methods.md` + `references.json`, renderer `web/src/methods/cite.ts`, page `web/src/methods/page.ts`. Sources and checks: `research/phase2-methods-sources.md`.
- Tests: `cd pipeline && python -m pytest -q` (9), `cd web && npm run check && npm run build` (46). Data checks: `python -I verification/data-checks/check_pack.py <pack dir> out.json`.

## Broken / Known gaps
- Explore is not validated against observed floods; no infiltration, sewers, tide, canal burning; inflow only at the lowest south-edge cell; hourly shape of the 1 Jan 2020 preset is a design shape, not observed.
- An open box gets no runoff from outside it (stated in the Methods text).
- SNI 2415:2016 text itself not read (web search only); Methods text words it carefully.
- geoBoundaries ADM2 only (no kecamatan/kelurahan); buildings PMTiles may drop features in dense z14 tiles; DEMNAS licence unknown.
- Map page attribution box starts expanded (LATER).
- Imagery is 10 m (free Sentinel-2): houses are not visible; sharper imagery needs a licensed source (owner decision: cost/licence). Terrain display tiles stop at z12 (38 m): hillshade softens past z13.

## Locked decisions (look, mechanics, tech) with links
ADR 0001 data hosting · 0002 DEMNAS private · 0003 web stack · 0004 pipeline libs · 0005 region · 0006 Explore on CPU · 0007 Explore v1 inputs and Methods page · 0008 sharp display + data checks (RULE: never smooth results; every display layer checked against its source). Look: all three looks kept (owner). UI: neutral research style, IBM Plex.

## Decisions since last handoff (ADR links)
docs/adr/0007-explore-methods-upgrade.md, docs/adr/0008-sharp-display-data-checks.md.

## Owner feedback: applied / in BACKLOG
2026-10-29 (FEEDBACK.md): audit (done), Methods page with Harvard citations (RULE, done), whole paragraphs (RULE, test), method upgrades (done), own bounding box (done), others use their own DEMNAS without GitHub (LATER, BACKLOG Phase 7, plan written), guidance files check (done).

## Security status (last check date, open items)
2026-10-29: npm audit 0. New inputs: typed hourly rain (strict number regex, 0–500 mm, ≤ 72 values), `?box=` deep link (regex + clipped to region), Methods text escaped before citation links are added; downloads via Blob, no new dependency, CSP unchanged. Open: DEMNAS licence. docs/SECURITY_LOG.md.

## Next steps (ordered, specific, file paths)
1. Phase 2 continues in this order: (a) EA 2D benchmarks (Neelz and Pender 2013) tests that need no external data first (test 1, 2, 4) in `verification/ea-benchmarks/`; (b) burn rivers and canals from `water_osm` lines into the grid (`dem-grid.ts`), document in Methods section 5; (c) clickable inflow point + hydrograph; (d) infiltration with an open soil map (check sources, then Methods section 7); (e) Research Run: HydroMT-SFINCS in a GitHub Action, then the Phase 2 gate "same scenario in both engines". Technology choices in (e) and the WebGPU port go to the owner as 2–3 options.
2. Every method change: update `data/methods/methods.md` (+ `references.json`, only verified sources, record in `research/`), keep tests green.
3. Phase 4: validation against observed events (needs network in an Action: IMERG/ERA5 rain, Sentinel-1 or reported extents).
4. Phase 7 (owner wish): own-DEM upload and sharing without GitHub (BACKLOG plan).
Owner actions pending: DEMNAS licence screenshot or text.

## Token-saving rules
- Hand off at ~half context or at every gate/merge. Use the visual-check skill, do not re-derive the browser setup.
- Never read full Action logs (`tail_lines` ≤ 60). No repeated web research: facts live in `research/phase0-datasets.md` and `research/phase2-methods-sources.md`.
- Force-push is blocked: update branches with merges.
- Guidance files present: CLAUDE.md, CORE.md, SECURITY.md, TOOLS.md, BLUEPRINT.md, HANDOFF.md. `START.md` and `MODULE_*.md` named in CLAUDE.md do not exist in this repo (not needed: BLUEPRINT exists; the app module is covered by BLUEPRINT §9–11).

## File map (key files, project skills)
`data/` catalog, regions, roughness, methods · `pipeline/` (Python region pack, DEMNAS) · `web/src/{main,map,catalog,layers,i18n,util,sample3d,sample-look}.ts` · `web/src/explore/` · `web/src/methods/` · `verification/` · `.github/workflows/{ci,region-pack,pages,demnas}.yml` · project skill `.claude/skills/visual-check/` (screenshots).

## CODES
None.
