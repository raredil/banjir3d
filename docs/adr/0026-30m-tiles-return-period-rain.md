# 0026 Headline with the sub-grid channel, region-wide 30 m in tiles, return-period design rain

Date: 2026-11-20. Status: accepted.

## Context
- ADR 0025 made the sub-grid channel the default for 60/90 m, but the headline scores (skill.json, Validation card, Methods §8) were still from runs without it (v33–v35).
- 30 m is the app's default cell size, yet it had only been scored in five 4–5 km boxes (ADR 0023). A 30 m run of the whole region on one CPU takes hours, longer than an Actions job allows.
- The owner asked for rain by return period (HANDOFF Next steps 1). The validation floods use observed rain; scenarios needed a defensible R24.

## Decision
- **Headline = 90 m with the sub-grid channel** (v45–v47, `scores-*-imerg-v9-sub.json` → `data/skill.json`, card `observed-subgrid`; card `observed-review` marked old).
- **Region-wide 30 m in tiles** (`verification/observed/mosaic_tiles.py`, request key `tiles` in `validate.yml`):
  - Box 106.60–107.05 E, 6.08–6.42 S cut into 5 × 4 cores.
  - Each tile runs as an app box run (`run_event.ts --box`) with a 2 km margin on every side: upstream rivers enter as inflows and the tile edge has free outflow.
  - Stitching keeps each 30 m cell from the tile whose core holds its centre. A seam check compares cells that a neighbouring tile also computed.
  - Tiles are scored by `compare.py` like a whole-region run and with the size-independent 200 m rule (`region_cellsize.py`).
  - Not made a default or the headline: the headline rule of `compare.py` (3 × 3 window) changes meaning with the cell size.
- **Return-period design rain** (`pipeline/design_rain*.py`, `design-rain.yml`, `data/rain/design_rain_jakarta.json`, app option "Kala ulang"):
  - Annual maximum daily rain of every satellite cell inside DKI.
  - Gumbel (method of moments) and log-Pearson III, Chow et al. (1988); the one with the smaller median Kolmogorov–Smirnov distance is used.
  - The app offers the median over the cells for T = 2–100 years, with a 24 h Mononobe storm.
  - Source: CHIRPS v2.0 1981–2025 was the first choice. Its server answered 403/429 to the Action (2026-11-20), so GPM IMERG V07 daily 2001–2025 through GES DISC OPeNDAP is the fallback. The file records which was used.
  - Gauge check: open BMKG/partner gauges within 15 km of DKI (2020–2025), annual maxima against the satellite cell. The ratio is shown, not applied.
- `CITATION.cff` added (no licence chosen: owner decision).

## Evidence
- Sub-grid headline (fair random near reports): hit 55 / 43 / 51 % vs 49 / 27 / 42 %; 2020 and 2021 better than chance (p = 0.03, < 0.001), 2025 too few reports; depth at reports 0.12 / 0.09 / 0.13 m vs 0.70 / 0.65 / 0.55 m.
- 30 m tiles (v48–v50; 20 jobs of 13–33 min per flood; mass error < 1e-12):
  - Seams agree wet/dry on 93–95 % of the cells.
  - 200 m rule in DKI: 84 / 83 / 76 % vs random 88 / 71 / 88 %; only 2021 beats chance.
  - Depth near reports 0.25 / 0.26 / 0.32 m (90 m sub-grid 0.13 / 0.07 / 0.15 m).
  - DKI flooded > 0.15 m: 112 / 47 / 100 km² (2020 reported 156).
- Rain adjusted to gauges (ADR 0024), the sub-grid channel (ADR 0025) and 30 m cells (this ADR) do not close the depth gap. Untested remaining causes: terrain error, blocked/overtopped drains, reports from the deepest spots.

## Consequences
- The conclusion card and the AI context use the sub-grid headline.
- Larger tile sets or other events can be run by editing `request.json` (`tiles`, k 1, one set-up).
- Return-period values are satellite area values for 5–11 km cells. For a single point they are likely too low (see the gauge ratio).
