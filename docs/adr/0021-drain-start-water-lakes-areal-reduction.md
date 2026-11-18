# ADR 0021: Drains start empty where the satellite saw land, water bodies are not floods, areal reduction for design rain (2026-11-17)

## Context
Owner: "sungai selalu banjir — masalah sungainya atau metodemu?", "kenapa area padat malah ga banjir tapi area terbuka banjir
parah?", "cek ulang semua sampai tahap terkecil", plus two files: `geology.zip` (geological map, 34 polygons, sheets Jakarta &
Kep. Seribu, Karawang, Serang, Anyer) and `kemang_ca.rar` (17 RT polygons in Kel. Bangka, Mampang Prapatan, with labels
flood_risk/floodrisk2 High/Medium/Low, and 1,197 building footprints). Neither is DEMNAS.

Audit on the e14 pack and the v21–v23 runs (scripts in the session scratchpad; numbers below):
1. **Carved DSDA drains started nearly full.** `carve_drains` filled the carved part up to the "water surface the DEM recorded".
   95 % of the 20,993 carved cells are cells where IO sees < 50 % water (drain narrower than 30 m): the DEM height there is the bank
   or the street. Result: median 3.2 m of start water, 68.4 Mm³ in all, median 0.28 m of room left (Sunter 0.19 m, Cakung 0.15 m).
2. **Permanent water counted as flood.** Land cells with ≥ 50 % IO water (situ, waduk, ponds, fishponds) not mapped as channel:
   45 % flagged flooded in 2020, mean depth 1.29 m (deepest class on open ground). 65 km² of such cells in the domain.
3. **Design rain upstream had no areal reduction.** The scenario depth (a point value) fell on every upstream catchment, up to
   1,100 km² (Cisadane).
4. Not errors, but explained to the owner: at 90 m (2020) dense built cells flood 14 % (60.5 of 82.8 km² DKI flooded area), open
   land 22 %, so dense areas are not dry; reports and DSDA Genangan RT records fall in built classes in the same shares as land;
   the distance-to-river distribution of modelled flood matches reports. Open land is on average only 0.08 m lower than its 330 m
   neighbourhood (FABDEM), so no DEM artefact there. OSM-only rivers are shallow in the model (median bed-to-bank 0.4–1 m, Kali
   Baru 0.33 m) because the DEM cannot see beds narrower than a cell (limitation, needs cross-section data).
5. Soil: geology in the domain = 48 % alluvial fan (Qav3), 22 % flood-plain clay (Qaf), 20 % alluvium (Qa), 5 % Banten tuff,
   2 % beach ridge; SoilGrids gives D on all of them. Upper bound (fans/tuff B, sand A, alluvium C, clays D): runoff of 150 mm over
   domain land 140.5 → 139.1 mm (−1.0 %), because 85 % of the land is built (CN 98). Soil groups kept.
6. Kemang RT labels vs 90 m runs: median max depth High 0.05–0.13 m, Medium 0.13 m, Low 0.21–0.24 m (n = 10/5/2): the 90 m
   grid does not resolve RT-scale risk; not used as a score.

## Decision
- `engine_pack.carve_drains(..., water_seen)`: start water up to the recorded surface where the 30 m cell is ≥ 50 % IO water;
  elsewhere the carved drain starts empty above 0 m and filled up to 0 m below it (`START_SEA_M`, tidal drains of the north).
  First version (e15) started them empty everywhere: 2020 DKI flood 82.8 -> 60.4 km2, 2021 44.7 -> 19.8, 2025 77.4 -> 54.3,
  report skill 2021 0.26 -> 0.18; the below-sea-level drains then took rain as storage they never have in reality. Pack info keeps both volumes (`initial_volume_million_m3`, `..._if_filled_everywhere_...`).
- Water bodies: cells with ≥ 50 % IO water that are not sea or channel get the channel flag (bit 0). Same treatment as rivers
  everywhere (not counted, not drawn, not scored, n 0.035, no drain sink). `channels.water_body_cells` in the pack header.
- `hydrology.arealReduction(A, D)` = 1 − exp(−1.1 D^0.25) + exp(−1.1 D^0.25 − 0.0039 A) (Leclerc and Schaake fit of TP-29, as in
  Allen and DeGaetano 2005), D held in 0.5–24 h, A ≤ 1,000 km². Applied in design and typed-hourly modes (panel), per catchment from
  its full upstream area; observed IMERG mode unchanged (already areal means).
- Methods §3, §4 (geology comparison), §5, §9; reference allen2005 (the original MIT report was not read: no DOI, not cited).
- Plain-language page for the owner: `docs/penjelasan/cara-kerja-banjir3d.html` (published as an Artifact).

## Consequences
- Engine pack e16. No-rain test (20 x 20 km box, 90 m): old pack floods 14.6 km2 from start water alone, e16 0.1 km2; the drain fix, not the water bodies, causes the change (hybrid packs). Scores v30-v32: window hit 44/33/35 % vs random 37/19/36 %, DKI flooded 62/20/55 km2 (was 83/45/77). Part of the old agreement came from phantom water; the model is now drier than reported (156 km2 in 2020).
- Remaining: river depth for OSM-only rivers (needs DSDA/BBWS cross-sections), satellite rain smoothing (gauge rain).
