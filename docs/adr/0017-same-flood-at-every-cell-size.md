# 0017 Same flood at every cell size (channel roughness, street roughness, river entry, one ground rule)

Date: 2026-11-10 · Status: accepted (owner: "cek lagi apakah semua perhitungan udah tepat akurat, sama ini yang dibawah 30m kok jadinya lebih pecah2 dan kayak beda gitu hasil analisis banjirnya, perbaiki")

## Context
The same box gave a very different flood at 30 m and at 10/5 m (`verification/fine-consistency/`, 1 km box in Kampung Melayu on the Ciliwung, 150 mm in 6 h, 12 h, upstream inflow on): with the code of 2026-11-08 the 30 m run flooded 43 % of the land cells (> 0.15 m) and the 10 m run without buildings 4 % (CSI 0.08 between them). The cause was found by elimination:
1. **Channel roughness.** `engine_pack.py` gave every cell, channel cells too, the area-weighted Manning n of its 10 m land-cover pixels. Rivers in Jakarta are narrower than or hidden under those pixels, so the Ciliwung cells had built-area n = 0.15, about four times a natural channel's. The river ran 9–10 m deep at 30 m and spilled; at 10 m (finer numerics, same n) it stayed near 7 m. With channel n = 0.035 the 30 m and 10 m runs agree (mean depth difference −0.01 m, RMSE 0.04 m).
2. **Buildings counted twice.** Fine runs put the buildings in the grid (blocks or porosity) and kept n = 0.15 on the open ground between them, the value that on 30 m cells stands for those buildings (Beretta et al. 2018). Water in the streets was too slow and too deep.
3. **River entry.** A fine run put the whole upstream river discharge (hundreds of m³/s) into one fine cell: a deep spike, a tiny time step and a different flood near the entry.
4. **Display.** Building-block runs (fine grid solved cell by cell) were drawn with the coarse rule, which blends the +10 m blocks into the street ground, so street water next to buildings was hidden (patchy map). The 30 m map blended the river bed into the banks, which drew a band of water along rivers that stayed within their banks; the fine map did not, so the two looked different even for the same water levels.
5. **Sealed pockets.** At 10 m about 8 % of open cells (2 m: 1 %) are courtyards or alleys closed in by the footprint mask; they filled with roof rain as isolated ponds.

## Decision
1. Channel cells: n = 0.035 (land-cover class Water; Chow 1959, clean natural or excavated channels), applied when the pack is read (`parsePack`, `CHANNEL_N`) and in `engine_pack.py` for new packs; a coarse block holding a channel keeps the channel's n as it keeps its level.
2. Fine runs with footprints: open ground n = pack n − built share × (0.15 − 0.016) (`openGroundN`, street n 0.016 = rough asphalt, Chow 1959). Without footprints (tiles failed) the 30 m n stays.
3. Upstream inflow on fine grids is spread over the open cells of its 30 m entry cell (`inflowSpread`, by open share).
4. One ground rule for every map and export (`groundAt`): inside a channel cell its bed, elsewhere bilinear between land cells only. Building-block runs carry a fine grid (s = 1) and are drawn like dual-grid runs (buildings are holes).
5. Open cells sealed off by buildings (`sealedPockets`, 4-connected, not reaching the box edge or a channel) join the block.

## Evidence
`verification/fine-consistency/results.json` (before/after per cell size) and browser shots `previews/fine-consistency/` (same box, 30/10/5 m, before and after). Whole-region validation on the three recorded floods re-run with the new channel roughness (`verification/observed/scores-*-imerg-v5.json`, Validation page).

## Consequences
- Rivers convey more: fewer cells flood from river overflow at 30–90 m; the whole-region scores changed (Validation page, Methods §8).
- Fine results now differ from 30 m mainly where the buildings really change the flow (streets between blocks), not because of numerics.
- Fine runs stay uncalibrated.
