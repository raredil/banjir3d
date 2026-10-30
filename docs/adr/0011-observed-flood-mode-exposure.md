# ADR 0011: Observed-flood mode and exposure per kecamatan (2026-10-30)

## Context
Owner decision (2026-10-30): finish event mode, a depth-bias check and simple exposure totals in one session. The "1 Jan 2020" button used a uniform 377 mm (Halim gauge) everywhere, wetter than the validation runs.

## Decision
- **Observed-flood mode** (rain option "Banjir nyata"): the three validation floods replayed with GPM IMERG Final V07 hourly rain per 0.1° point, cut to the run window (`data/events/<id>_imerg.json`, ~22 kB each, built by `verification/observed/event_rain.py`; NASA data, open). Each run cell and each upstream catchment takes its nearest point (`web/src/engine/event-rain.ts`; zones looked up per ~300 m block). CPU `rates` and WebGPU `zoneMm`. Clock shown in WIB. PetaBencana: report COUNT and hit share only (records not redistributable). The "1 Jan 2020" button now opens this mode.
- **Depth bias**: rain multiplied by 1.5 and 2 as a sensitivity run only (`validate.yml` `scales`); calibration stays at IMERG as observed, drains 0.
- **Exposure**: per 30 m engine cell, buildings (Overture footprint centroids), people (WorldPop 2025 100 m split evenly, totals kept) and kecamatan (Overture divisions = OSM, ODbL). Kota Bekasi and part of Depok have no kecamatan polygons: counted per kota. Built by `pipeline/exposure_pack.py` in the `exposure-pack.yml` Action (new region release `-x*`); the app loads `exposure_<region>.bin.gz` after a run. Affected = run cell deeper than 0.15 m outside channels (same rule as the flooded-area KPI), at the time shown or the maximum. KPIs: flooded area, deepest, buildings, people; table top 10 + CSV export of all units.

## Consequences
Exposure counts residents, not people present, and inherits depth errors. At coarse cells (60/90 m) buildings next to a channel block are not counted (the block counts as channel). geoBoundaries (ADM2 only in the pack) stays for map orientation.
