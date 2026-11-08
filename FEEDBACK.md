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
| 2026-10-30 | Finish in one session: event mode, depth check, exposure per kecamatan | NOW | ADR 0011: observed-flood mode, rain ×1.5/×2 sensitivity (not used), buildings/people per kecamatan + CSV |
| 2026-10-31 | Kesimpulan otomatis bergaya riset dengan sitasi, akurat | NOW | ADR 0012: card "Kesimpulan" after each run, Harvard citations, copy/.md |
| 2026-10-31 | Pakai satelit Esri, tombol mata angin untuk memutar peta | NOW | ADR 0012: Esri World Imagery default, compass + ⟲/⟳, PNG north arrow follows bearing |
| 2026-11-01 | Jakarta Satu sudah izin lisan; peta lain yang terhambat izin boleh dipakai sampai tuntas | NOW | ADR 0014: Jakarta Satu + PetaBencana published as map layers, RW places (Sinking City, CC BY) in scoring, pumps in the model |
| 2026-11-01 | Hasil simulasi harus bisa dimatikan/dihapus | NOW | Result listed in "Lapisan aktif" (hide ✕ remove), replaced by each run |
| 2026-11-01 | Menu kiri makan tempat; panel kiri kelebaran; popup simulasi bisa disembunyikan | NOW / RULE | Rail hides at the left edge (hover opens), dock 306 px with smaller type, "Fokus peta" hides all floating cards |
| 2026-11-01 | Panel kanan kecil: lapisan aktif saja, urutan atas/bawah, centang sembunyi, bisa diciutkan; hasil simulasi masuk ke sana | NOW | `map.ts` active-layers card; order = drawing order (moveLayer); left checkbox stays on |
| 2026-11-01 | Drainase Jakarta Satu tidak terlihat; perhitungan benar? | NOW | Drains were in the engine (carved terrain) but not drawn; now map layers; Pages shows them after merge to main. Validation page states results incl. weaknesses |
| 2026-11-01 | Perhitungan harus bisa dipertanggungjawabkan untuk penelitian | RULE | Every number traced to a result file; validation on 3 floods + DSDA records reported as measured, weaknesses stated (Methods §8/§9) |
| 2026-11-08 | Sel terkecil 1 m untuk simulasi banjir (sekarang 30 m) | NOW | ADR 0015: 10/5/2/1 m for a drawn box; ground interpolated from 30 m (said openly), Overture building footprints as solid blocks; limits by cell count; not calibrated (stated) |
| 2026-11-08 | File Drainase_Tersier.gdb: bisa jadi perhitungan? | NOW | Map layer; not carved: source has no width/depth (would be invented). 77 % of its length is not a channel in the model (number in ADR 0015) |
| 2026-11-08 | Peta curah hujan di menu tampilan | NOW | Group 'Curah hujan banjir tercatat': IMERG event totals per 0.1° cell for the 3 floods |
| 2026-11-08 | Banjir model kebanyakan sungai meluap, kenyataannya jarang; disarankan waduk di hulu | NOW (analysis) + RULE | Attribution run: 83 % of modelled area floods with local rain alone; upstream water deepens river corridors. RULE: claims about interventions come from scenario differences (with/without), with validation scores stated |
| 2026-11-08 | Tidak ada angka bias; hanya tambahan yang berpengaruh langsung | RULE | No invented parameters (tertiary drains not carved without size); every new number traced to a file |
