# 0025 Sub-grid channel in coarse river blocks; 60 m scored region-wide

Date: 2026-11-20. Status: accepted.

## Context
Review follow-ups (ADR 0023) found that reports within 100 m of a river were hit no better than random. They also found that the model
was 0.5 m or more too shallow at those reports. On 60 and 90 m runs a block that holds a river was set to the river bed as a whole. A
30 m river then stored and carried water like a 90 m trench. On a straight test channel it rose 0.37 m at 90 m, against 1.19 m at 30 m,
and spilled 17 % of the 30 m bank volume. Another open question (ADR 0023) was whether 60 m cells region-wide would help.

## Decision
- **Sub-grid channel** (in the spirit of Neal, Schumann and Bates 2012, doi:10.1029/2012WR012514), in `web/src/engine/solver.ts`
  (CPU) and `gpu.ts` (WGSL), with inputs from `pack.ts subgridOf` (channel share s = 1 − landShare, bank height Δz = landZ − bed).
  - Storage: V = φ (s · min(h, Δz) + max(0, h − Δz)); depth comes from the volume (`volAt`, `depthAt`).
  - Face width w: s_f = min(s₁, s₂) up to d = the higher of the two bank heights, then (s_f·d + h_f − d)/h_f. Fluxes are stored per
    metre of the full face, and momentum uses q/w.
  - No new parameter: s and Δz come from the 30 m pack.
- **Default on** for 60 and 90 m runs: in the app (`web/src/sim/panel.ts`, only without building porosity; the two are not tested
  together), in `run_event.ts --subgrid on|off` (default on) and in validate.yml `subgrid` (default ["on"]). 30 m runs are unchanged,
  and the result is identical to before when every s is 1 (test).
- **60 m is not made the default.** It wets more land everywhere, random points included, so the margin over chance improves in
  2021 only, at about 2.5–3 times the Actions run time (v42–v44: 47–55 min; v45–v47: 16–22 min).

## Evidence
- Tests (`engine.test.ts`, "sub-grid channel"):
  - River rise on the test channel: 1.38 m with the sub-grid, against 1.19 m at 30 m.
  - Water on the banks: 79 % of the 30 m volume.
  - Mass error < 1e-9.
- GPU parity with the sub-grid: RMSE 8.3e-5 m, CSI 1.00.
- Real 4–5 km boxes: 90 m moves toward 30 m (box B flooded land 3.92 → 5.61 km², against 5.59 at 30 m; box E depth at reports
  0.21 → 0.46 m, against 0.64). Box D stays at 0.05 m, against 0.33 m at 30 m.
- Region-wide, one rule for every size (`verification/observed/region_cellsize.py`, `cellsize-region-r04.json`):
  - Rule: a land cell within 200 m of the report ≥ 0.10 m deep; random points over DKI land.
  - Releases: v33–v35 at 90 m, v42–v44 at 60 m, v45–v47 at 90 m with the sub-grid.

  | DKI reports (2020 / 2021 / 2025: 188 / 265 / 17) | hit % | random % |
  |---|---|---|
  | 90 m | 47 / 36 / 24 | 49 / 30 / 49 |
  | 60 m | 56 / 53 / 29 | 64 / 43 / 64 |
  | 90 m + sub-grid | 54 / 41 / 53 | 55 / 31 / 54 |

  - Within 100 m of a river in 2021: 24 → 33 % (random 24 → 25 %, p = 0.03).
  - Median depth at the reports with the sub-grid: 0.13 / 0.07 / 0.15 m (reported 0.55–0.70 m).

## Consequences
- The validation runs and the app now share the river treatment. The 'Current scores' (v33–v35) in Methods §8 predate it.
- Still open:
  - The model is still too shallow at the reports.
  - 2020 stays at chance.
  - Box D lags 30 m: terrain detail other than rivers (embankments, road levels) is a likely cause, not tested.
- Building porosity and the sub-grid channel are not combined. Large boxes with building porosity keep the old river blocks.
