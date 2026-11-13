# ADR 0020: South Jakarta micro drains as a network-capacity sink (2026-11-13)

## Context
Owner sent `Saluran_Mikro_Jakarta_Selatan_Cut_3_November_2026.rar` (Dinas SDA, Jakarta Satu update 2024): 12,481 street-drain
sections, 2,606 km, with LEBAR/KEDALAMAN (width/depth) for 8,551 sections (median 0.5 × 0.5 m). Earlier owner file (tertiary,
ADR 0015) had no sizes, so the small drains were only a uniform calibrated sink (0 mm/h).

## Decision
- A 0.5 m drain cannot be carved into a 30 m cell (area-equivalent lowering of a few cm). It enters as a **sink per cell**:
  Manning full-flow capacity per section (n by lining, Chow 1959; slope of the 270 m-smoothed terrain, 0.1–2 %), sections joined
  within 10 m form networks, network capacity = sum of sections touching a channel cell (largest section if none), spread over the
  land cells within 100 m that are nearest to it (rational method read backwards). Pack array `mdr` (0.01 mm/h).
- Result: 444 networks, 115 km² served, mean 38 mm/h (median 29, p10–p90 6–73).
- Switch "Saluran mikro Jakarta Selatan", tag Skenario, **off until the three-flood test** (`validate.yml` micro axis,
  `compare.py` `reports_micro_area` = reports inside the served land with their own random baseline).
- Drained water leaves the model (as pumps): rivers get less water than in reality. Upper bound of drain uptake: no internal
  bottlenecks, sediment, inlets or backwater.
- Published fields: name, kelurahan, kecamatan, width, depth, open/closed, lining, condition, outlet. Left out: SEGMEN (house
  numbers), BGNLIAR (buildings over drains), codes; 311 records marked PENGHAPUSAN 2024.

## Evidence
1 Jan 2020 IMERG, box 106.74–106.88 E, 6.37–6.20 S, 90 m, 48 h, pumps off: flooded > 0.15 m 28.3 → 19.7 km², drains took 20.8 of
46.8 Mm³ rain, mass error 1e-14. Browser box Mampang–Kemang 4.4 km, 150 mm/6 h, 30 m: 5.0 → 3.2 km², no console errors
(`previews/micro-drains/`).

## Consequences
The model was already drier than reports (ADR 0019); the switch will likely lower hit rates unless rain improves. Its default is
set by the score, not by preference. Other kota need the same size data.
