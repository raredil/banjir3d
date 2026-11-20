# 0024 Gauge-adjusted rain for validation (no owner data needed)

Date: 2026-11-20. Status: accepted.

## Context
The owner has no BMKG Data Online account and no river or flood files. The open next step in the HANDOFF was gauge rain for the
three validation floods, because IMERG (0.1°) smooths storm peaks (Halim 377 mm/day vs IMERG ~157 mm in 2020).

## Decision
- Gauge totals from open, citable sources only: the West Java BMKG daily set (Saputra et al. 2026, doi:10.17632/d7j3s64vvr.3, CC BY 4.0;
  downloaded by `gauges.yml` into release `gauges-westjava-20261120-g1`, cut by `gauges_westjava.py` to `data/rain/gauges_westjava_events.json`),
  JICA 2022 Table 2-14 (28 gauges with coordinates, Jan 2020) and BMKG figures quoted in the press where a coordinate is published
  (`data/rain/gauges_events.json`; gauges without coordinates are listed, not used). Day key = date of the 07:00 WIB reading (checked
  on Citeko 2020 and Katulampa 2025).
- `verification/observed/gauge_merge.py`: local multiplicative ratio G/S per gauge (clip 0.25–4), IDW of ln r with a pull to 0 at
  L = 10 km, applied to bilinear IMERG on 0.02°; leave-one-out check reported every run. Rain option `imerg_gauge` in validate.yml.
- Validation input only; the app keeps IMERG (the effect on flood skill is small and mixed).

## Result (gauge-rain-r03.json, releases v39–v41)
Leave-one-out MAE 53→43, 35→32, 35→27 mm (a single area factor does not help). Report hit 49→50, 39→47, 39→35 %; fair random near
reports 45→46, 26→32, 35→33 %; depth at reports 0.10→0.10, 0.06→0.10, 0.07→0.05 m vs 0.55–0.70 m reported; verdicts unchanged.

## Consequences
Rain is not the main reason the model is too shallow. Next gains: terrain/river depth and cell size (30 m region-wide or tiles).
Halim 377 mm sits in one 2 km area; denser DKI gauges (DSDA network) would sharpen 2020 but are not open.
