# FEEDBACK (NOW / RULE / LATER)
| Date | Owner said | Triage | Action |
|---|---|---|---|
| 2026-10-29 | Check the chat-session work in depth | NOW | Audit: tests, code review, fixes (open boundary slope and roughness, theta comment, arbitrary presets), screenshots |
| 2026-10-29 | One page of full scientific argument with Harvard in-text citations and linked reference list; only certified sources | RULE | `#/methods` page from `data/methods/`; every later method change must update it (tests enforce citations) |
| 2026-10-29 | Paragraphs may be split but never cut sentences | RULE | Test: every paragraph starts with a capital, ends with a full stop, has 2+ sentences; equations follow complete sentences |
| 2026-10-29 | Improve methods where possible, accurate and recognised | NOW | ADR 0007: documented rain, transmissive edges, literature roughness range, analytical test |
| 2026-10-29 | Draw my own bounding box | NOW | Draw tool on `#/sample`, deep link `?box=` |
| 2026-10-29 | Others bring their own DEMNAS, easy UI, no GitHub | LATER | BACKLOG, Phase 7 |
| 2026-10-29 | Check other guidance files for token saving | NOW | Checked; new project skill `.claude/skills/visual-check/` |
| 2026-10-30 | Nothing blurry, map or flood simulation; data must be validated | NOW + RULE | Flood cells sharp (no interpolation), imagery re-tiled (99.7 % of source detail, was 82.5 %), real pixels above z15, automatic data checks in every pack build (ADR 0008). RULE: every display layer is checked against its source; results are never smoothed |
| 2026-10-30 | Satellite sharper for free | NOW (research) + owner decision | Free open imagery stops at 10 m (Sentinel-2). Sharper free options need an account/licence (Esri World Imagery free tier, display only). Asked owner. |
| 2026-10-30 | Drop 3D | RULE | 3D removed, flat north-up map (ADR 0009, BLUEPRINT MUST-13 note) |
| 2026-10-30 | River capacity etc. must come from the map, not typed numbers; only external variables | RULE | Engine v2: channels from OSM in DEM, CN from land cover + SoilGrids, n from land cover, upstream inflow from catchments; sliders only for rain, sea level, time |
| 2026-10-30 | Methods shown must be the ones used; Methods page shorter | RULE | methods.md rewritten for v2 (9 short sections) |
| 2026-10-30 | Data page: what each dataset is for | NOW | data/catalog-use.json shown on cards, filter by use |
| 2026-10-30 | Flood off the river line; nothing in my box; floods from several sources | NOW | Channels carved, upstream inflows, rain-on-grid with infiltration, sea level; box runs get river inflow |
| 2026-10-30 | Not tested against real data | LATER (Phase 4, next) | Validation page states it; PetaBencana archive + Sentinel-1 + drainage calibration next session |
| 2026-10-30 | Sharp but smooth | RULE | Water-level downscaling on GPU; ADR 0008 'never smooth' replaced: depth classes stay sharp, edges follow terrain |
| 2026-10-30 | Explain each slider | NOW | Help behind '?' buttons |
| 2026-10-30 | Export map; also HTML or TIFF | NOW | GeoTIFF (m), coloured GeoTIFF, HTML map, PNG figure, JSON record |
| 2026-10-30 | Lag | NOW | 3D terrain removed; engine in a worker; WebGPU solver |
| 2026-10-30 | UI like reference image, blue, full map, less text, no AI style | RULE | New design system (style.css), rail + floating cards, text trimmed |
| 2026-10-30 | Sharper imagery (Esri): later | LATER | Owner: "nanti aja"; Sentinel-2 stays; BACKLOG |
| 2026-10-30 | "gagal hasilnya" (Observed data run failed, screenshot) | NOW | Runs 2 and 3 were stale duplicates (HTTP 403 on publish); runs 1 and 4 hold all data; newer push now cancels a running fetch |
