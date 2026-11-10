# 0018 Fine cells draw the 30 m flood; rivers are not drawn as flood squares

Date: 2026-11-10 · Status: accepted (owner: "hasilnya beda keliatannya masa 30m sama dibawah 10m, masa gitu sih, beda perhitungan? terus kok masih mozaik sekarang 30 m juga mozaik, terutama sekitar sungai, jelek banget semua, terus perhitungan dan analisisnya ini salah dan gagal semua deh")

## Context
After ADR 0017 the same 2.2 km box on the Ciliwung (Kampung Melayu, 150 mm in 6 h, upstream inflow) still gave two different answers:
- 30 m: 0.4 km², deepest 0.80 m, 2,186 buildings, 9,328 people; 10 m (porosity on a 30 m compute grid): 0.4 km², deepest 4.46 m, 6,444 buildings, 26,191 people. The 1 km check box of ADR 0017 had a critical success index of only 0.06–0.17 between 30 m and the fine runs: the area matched, the places did not.
- The 30 m map drew every river, canal and drain cell with its carved bed as ground (ADR 0017 rule 4), so channels showed as a staircase of deep 30 m squares; the DSDA drains start filled (h0), so they showed as squares too. Fine maps showed 10 m building squares as speckle.

The pack has no ground detail below 30 m. A fine flow grid only adds interpolated ground and a different building treatment (blocks or porosity and street roughness 0.016 instead of the built-area n 0.15 that the 30–90 m calibration rests on). These are two different models, and only the 30–90 m one is checked against recorded floods.

## Decision
1. **Fine cells (10, 5, 2, 1 m) are a drawing grid by default** (`withFineDrawing`): the flow is the 30 m run of the box, unchanged; its water surface is drawn on the fine cells, building footprints left dry. Area, depth, buildings, people, conclusion and exports have the same numbers as at 30 m; exports are on the chosen fine cells. On the map the footprints are drawn on cells near 2 m (`drawFactor`, within the 4,096 texture limit) so 10 m and 5 m show building shapes, not speckle.
2. The earlier fine-flow methods (building blocks / porosity, ADR 0015–0017) stay as an option, off by default: "Hitung aliran di sela bangunan (uji coba)", labelled not validated. Kept, not deleted (owner decides on deleting).
3. **Land surface for drawing** (`landGround`): a channel cell takes the mean level of the land around it (filled outwards for wide channels) and the surface is interpolated plainly bilinear (continuous, `bilinearAt`, same in the shader). Depth drawn = water surface − land surface: water inside a channel up to its banks is the river, not a flood, and is not drawn; water above the banks is drawn as a smooth sheet. This replaces ADR 0017 rule 4 for drawing and exports; the solver keeps the carved bed (`groundAt`, `fineGround` are unchanged for the trial fine-flow method). Flood hazard maps usually mask permanent water the same way.

## Evidence
Same 2.2 km box, browser, CPU (shots `previews/fine-draw/`): 30 m, 10 m, 5 m and 2 m all give 0.4 km², 0.80 m, 2,186 buildings, 9,328 people, water balance error ≤ 1e-14; the river no longer shows as squares. Tests: `landGround`, `bilinearAt`, `withFineDrawing`, `drawFactor`, river drawing in `export.test.ts`.

## Consequences
- 30/60/90 m runs: numbers unchanged (physics unchanged); the map and depth exports no longer show water inside channels below bank level.
- Fine cells no longer simulate water steered by single buildings; that remains a trial option until it can be checked against recorded floods (Next steps: fine runs around report clusters).
- Fine runs are as fast as a 30 m run of the same box.
