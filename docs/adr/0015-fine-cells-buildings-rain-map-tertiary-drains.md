# 0015 Fine cells with buildings, event rain maps, tertiary drains as a map layer

Date: 2026-11-08 · Status: accepted (owner request "pixel paling kecil 1", "file tambahan", "peta curah hujan")

## Context
The owner asked for 1 m as the smallest simulation cell (30 m was the smallest), whether the new file `Drainase_Tersier.gdb` can enter the calculation, and for rainfall maps in the layer menu. He also asked why the model floods mostly by river overflow while real floods in Jakarta rarely are, and for "no biased numbers".

## Decision
1. **Cells of 10, 5, 2 and 1 m for a drawn box** (`buildFineRun` in `web/src/engine/pack.ts`). No open terrain finer than 30 m exists for the region (DEMNAS 8 m keeps ~60 % of building height, ADR 0013), so the ground is interpolated bilinearly between 30 m land-cell centres (channels keep their bed level; n, CN, sea and channel flags from the holding 30 m cell). The detail that is real at this size is the **building footprint** (Overture, 4.3 million in the region, read in the browser from `buildings_overture.pmtiles` z14 with a small vector-tile reader, `web/src/sim/buildings.ts`): footprint cells are raised 10 m (building-block method, Schubert and Sanders 2012), so water flows in streets and alleys and roof rain runs to the street. Buildings are excluded from the flooded area and the map; buildings and people of a 30 m exposure cell are spread over its open fine cells (no double counting). Limits: 6 million cells with WebGPU, 1 million on the CPU, 4,096 cells per side (one WebGL texture). Fine runs are not calibrated; the conclusion and Methods §1 say so.
2. **Drainase_Tersier.gdb** (DRAINASE_LN_5K, 1,844 lines, 1,105 km, KUGI HA02080620): every size, year and material field is empty. Carving needs a depth, so the lines are **not carved** (any depth would be invented). They are a map layer (`data/drains/drainase_tersier_dki.geojson`, copied to `meta/`), with name, kelurahan, kecamatan and length in the popup, and the analysis below. 22.9 % of the line length lies on a channel cell of the engine pack (27.6 % within 30 m): about three quarters of this drain network is not in the model.
3. **Event rain maps**: one layer per recorded flood (2020-01-01, 2021-02-20, 2025-03-04), the IMERG totals per 0.1° cell from `data/events/*` (the exact rain the model runs on), wettest hour in the popup. Green to purple, never blue (blue = model water).
4. **Source attribution run** (`run_event.ts --upstream off`): 1 Jan 2020, whole region, 90 m. Local rain alone floods 248 km², with upstream river water 300 km²; upstream water adds one sixth of the area but doubles the area deeper than 1 m (15 → 26 km²); 17 % of the flooded area lies within 90 m of a channel. Stored in `verification/observed/attribution-2020-01-01.json`, Methods §8.

## Consequences
- A 1 m run is possible on boxes up to about 2.4 km (WebGPU) or 1 km (CPU); 1–2 m in practice needs WebGPU (time step falls with cell size).
- Tertiary drains can enter the engine only with a size source: Jakarta Satu's tertiary layer (1,211 records, size "mostly missing") or a sensitivity range run in the validation Action, reported as such.
