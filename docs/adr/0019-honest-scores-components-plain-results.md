# ADR 0019: honest report scores, switchable model components, plain results (2026-11-13)

## Context
Owner (16 points): fine cells look fragmented next to his building map; RTH, pumps and other elements should be switchable; the
conclusion is hard to read; lag; a file to paste into other AIs; which layers are used; other regions; LiDAR; rain beyond 24 h;
why 30 m and coarser differ; river depth/width; "do not be sloppy, this goes to an international forum".

The audit found three real faults:
1. **Report hit rate was inflated.** `compare.report_scores` took the deepest cell in a 3 × 3 window INCLUDING river channels, so every
   report next to a river was a hit (rivers always hold water). With about 15 % of DKI land flooded, a random point already has a high
   chance to be "hit" under that rule. The published "~80 % of reports hit" therefore says little.
2. **The design storm silently dropped rain.** "Total hujan 24 jam 150 mm" with 6 h duration put 94.5 mm on the map (Mononobe: the
   most intense 6 h of a 150 mm day). Users read the slider as the total.
3. **Fine cells**: building cut-outs changed no number but made the map look broken (ADR 0018 drew them).

## Decision
- Report scoring: land cells only (channels, sea excluded); two rules, same cell and 3 × 3 land window; a random baseline (share of
  DKI land cells passing the same rule) and skill = (hit − random) / (1 − random). Old rule kept as `legacy_window_with_channels`.
  All three floods re-run (pumps off/on × soil normal/wet) with the new rule; the app, Methods, Validation and the AI file use it.
- Design storm: the user sets the total and a duration of 1–72 h; all of it falls (`designStorm`, Mononobe shape scaled to the
  duration; > 24 h is an assumption, stated). Weekly/monthly/yearly totals are NOT simulated as one storm: they enter as the
  antecedent runoff condition (AMC I/II/III from the 5-day rain, Chow et al. 1988), applied to cells and upstream catchments.
- "Komponen model" card: switches for upstream inflow, infiltration (RTH), soil wetness, subsidence, polder pumps, small-drain sink,
  sea level; tags "Diuji" (part of the tested set-up) and "Skenario"; fixed and missing components listed with the reason.
- Fine cells: smooth water surface, no building cut-outs, no building download; the trial flow among buildings is no longer offered.
- Conclusion: plain summary first (what was run, extent, depth in body terms, impact, where the water came from, how far to trust
  it with the validation numbers), the research text folded under it; card resizable. KPI, timeline and legend cards slimmer.
- Layers: each layer shows its role (data/layer-roles.json, tested to cover every layer).
- AI context file `web/public/banjir3d-konteks-ai.md`, generated from the guide, layer roles, skill numbers, Methods and references;
  a test fails when it is stale. "Salin untuk AI" copies the conclusion and the run record.
- Time-step factor α 0.5 → 0.7 (LISFLOOD-FP value): ~30 % faster, same result (verification/speed).

## Not done, and why
- LiDAR: a 2012 DKI LiDAR DEM is used in studies but is not openly downloadable; the pipeline can take it if the owner obtains it.
- Other regions: the pipeline is global except the Jakarta-specific layers; a second region needs a region pack Action run and has no
  validation until flood reports exist there (BACKLOG).
- River bed depth: no open bathymetry; candidate method (hydraulic geometry from catchment area) needs re-validation (BACKLOG).
- Owner's new map (point 15): no file arrived in the session.
