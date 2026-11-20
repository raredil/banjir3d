# ADR 0023: Where the model misses, cell size and sensitivity (review follow-ups R-04, R-08, MT-06)

Status: accepted (2026-11-20)

## Context
The six-tester review (ADR 0022) left three open checks: report scores per distance to rivers (02 MT-06), whether the 90 m scores
hold for the 30 m runs the app makes (05 R-04), and the sensitivity runs promised in BLUEPRINT §7 (05 R-08). It also asked to stop
calling untested causes "known" (R-09) and to drop the old attribution numbers (R-10).

## Decisions
1. `compare.distance_class_scores`: every report is classed by the distance of its cell to the nearest river/water block (in the block,
   land <= 100 m, 100-500 m, > 500 m; model grid) and set against random cells of the same class. Part of every new score file;
   added to the v8 files by `rescore_distance.py`; `skill.json` `byDistance`; the conclusion states it from those numbers (`nearFar`).
2. Sensitivity variants are a research option only (`web/src/engine/sensitivity.ts`, `run_event.ts --sens`, `validate.yml` `sens` axis,
   allow-listed): Manning x 0.7 / x 1.3, built CN 92, ten terrain-error members (0.5 m sd, ~250 m smoothing, seeded; ASSUMED values).
   The app's default model is unchanged.
3. Cell size is checked on boxes (`box_cellsize.py`), with a rule that does not change with the cell (report's own land cell;
   200 m radius reported but not used to judge, it is too lenient at 30 m). The conclusion says when a run is not at 90 m.
4. Causes of the misfit are written as untested guesses everywhere (conclusion, AI guide).

## Results
- Distance: 43/51/56 % of reports lie in a river block or within 100 m (29 % of the grid). There the model is about as good as random
  cells equally close to a river (2020 50 vs 43 %, 2021 33 vs 25 %), and 0.03-0.12 m deep against 0.60-0.85 m reported; > 500 m from a
  river it hits 66 % (2020) and 64 % (2021) against 47 and 31 %. Rain ponding is caught better than river overflow into the banks.
- Cell size (5 boxes, 177 reports): for 2021, 30 m gives depths at reports of 0.33-0.71 m (90 m: 0.03-0.43; reported 0.83-1.01) and
  32-65 % more flooded land; own-cell hits 19-31 % vs 9-11 % random (90 m: 2-24 vs 6-7 %). 2020 boxes stay shallow at every size.
- Sensitivity (v36-v38, 42 runs): no verdict changes; depth at reports stays 0.04-0.11 m; terrain error moves the DKI area most
  (2021: 22-47 km² vs 31). The near-river weakness remains in every variant.
- GPU parity after the edge change (ADR 0022): RMSE 7.7e-5 m, CSI 1.00.

## Consequences
Roughness, built-area infiltration and a 0.5 m terrain error do not explain the shallow bias. Remaining candidates, in order of the
evidence: cell size (strong in 2021 boxes), rain (2020 shallow at every size; IMERG vs gauge), river-bank processes (gates,
embankments, channel size). A region-wide 30 m validation needs more compute than one Actions job (90 m takes ~17 min, 30 m ~27x).
