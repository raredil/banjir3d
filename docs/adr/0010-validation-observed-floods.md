# ADR 0010: Validation against observed floods, drainage sink, rain per zone (2026-10-30)

## Context
Engine v2 was never compared with a real flood and has no city drains, so results are too wet. HANDOFF next steps 1–3: fetch observed data, calibrate one drainage capacity on one event, validate on others.

## Decision
- Events (`verification/observed/events.json`): 1 Jan 2020 (calibration), 20 Feb 2021 and 4 Mar 2025 (validation).
- Observations: PetaBencana.id flood reports (points, depth in cm) and flooded-area archive (RW, max_state). The archive answers without an API key. Their licence is not stated on any page we can read, so raw records are never published: the validation workflow fetches them on the runner and publishes aggregate scores only (`compare.py`). A public release holds the open inputs (Open-Meteo/ERA5 CC BY 4.0, NOAA public domain).
- Rain: hourly per 0.1° cell (each model cell takes the nearest cell; each upstream catchment the mean over its stream cells, `inflowsForSpatial`). ERA5 is far too smooth for convective storms (about 90 mm over central Jakarta in the whole 72 h window of the 1 Jan 2020 storm, against 377 mm in one day at Halim Perdanakusuma, Lubis et al. 2022), so calibration waits for GPM IMERG Final V07 (needs a free NASA Earthdata login, secret `EARTHDATA_TOKEN`). NOAA GSOD station days are mostly incomplete (6-hourly partial sums) and Halim is missing.
- Drainage sink: capacity D (mm/h) times the built-area share of the cell (new `built` array in the engine pack, IO land cover class 7), not on channels or sea; surface water up to that rate leaves the model and is counted in the water balance (`totals.drain`). CPU and WebGPU, parity checked. D is calibrated, never typed by the user.
- Scores: reports hit rate (model ≥ 0.10 m within one cell) and depth error; RW AUC (share of land cells > 0.15 m) and CSI (RW flooded at ≥ 10 % share).

## Consequences
Until IMERG (or another gauge-quality rain) is available, scores with ERA5 show the rain input error, not the model error. The drain removes water from the model (no routing through pipes to rivers or pumps), a simplification of the real system.
