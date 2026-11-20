# ADR 0022: Six-tester review (20 Nov 2026): engine fixes, fair scores, rewritten conclusion

Status: accepted (2026-11-20)

## Context
The owner reported that rivers look like large floods where no river is visible, that tests used single points, that matching the model
to real floods had no stated method, that the conclusion was unreadable and lacked per-place reasons, and that the domain is only Jakarta.
Six independent tester agents reviewed the project (reports `verification/review-2026-11-18/01..06`, images in `img/`).

## Decisions
1. Edges: an edge cell also drains by its own Manning flow down the bed slope where the ground falls outward (`S_EDGE`, CPU + WebGPU).
2. River entries snap to the nearest channel cell within 600 m (`ENTRY_SNAP_M`, `snapEntry` in pack.ts); 34 of 61 entries fell on land.
3. Coarse channel blocks keep `landZ`/`landShare`; flooded area, exposure, map drawing (`landSurface`), exports and validation
   (`hmax` = depth above land, `landshare.u8`) count the water above the land level on the land share; start water = block mean.
4. The map and CPU exports draw no water on a cell the model keeps dry.
5. Scores: fair random baselines (all grid land; land within 1 km of reports), Wilson and 1 km block-bootstrap intervals, one-sided
   binomial p, verdict better / not_better / too_few (`compare.fair_baselines`, `make_skill.py`). The three floods are called an
   in-sample check, not a validation (Klemeš 1986).
6. Conclusion: plain summary (water in and out, fair verdict per flood, depth and area gaps, use and non-use), computed
   "Mengapa di sini tergenang?" for the three largest flooded places (`places.ts`), pumps-off stated as an adjustment.
7. Honesty: Sentinel-1 marked planned, exploratory stamp on exports, README states the real domain, older Validation cards "usang".

## Results (v33–v35, scores-*-imerg-v8.json)
Hit 49/39/39 % vs fair random 45/26/35 %; better than random only in 2021 (p < 0.001); 2020 p = 0.11; 2025 too few reports.
Median depth at reports 0.10/0.06/0.07 m vs 0.70/0.65/0.55 m; DKI area 73/31/66 km² (2020 reported 156 km²).

## Not done (need data or owner decision)
River beds for OSM rivers (cross-sections or hydraulic geometry as a tested assumption), valley flow lines without OSM rivers,
gauge rain, a pre-registered calibration/validation protocol (review 03 §5.4), domain beyond DKI + 10 km, SFINCS research run,
sensitivity runs (Manning, DEM, land cover, built CN 98 vs 92), sub-catchment routing for the large catchments.
