# 0016 Dual grid: fast fine cells (building porosity on a compute grid, result drawn on every fine cell)

Date: 2026-11-08 · Status: accepted (owner: "super ngelag, terutama saat ukuran sel dibuat kecil … aku tetap mau ukuran sel kecil tapi sangat tidak ngelag")

## Context
Fine runs (ADR 0015) solved the flow on every 10/5/2/1 m cell with buildings as solid blocks. The explicit time step falls with the cell size and is set by the deepest water anywhere in the box (carved channels hold 3–6 m): 0.6 s at 10 m, 0.3 s at 5 m, about 0.06 s at 1 m. Cost grows with 1/dx³: a 1 km box at 1 m is about 10¹² cell updates (days on one CPU core, which does 11–18 million per second here). Each result frame also went to the page as a full fine grid and was converted there (page stutter), and building the fine grid held six float64 arrays of up to 6 million cells.

## Decision
1. **Dual grid** (Sanders and Schubert 2019): the result is drawn on the fine cells the owner picks; the flow is solved on the finest compute grid that fits a time budget of about 30 s (`chooseCompute`: compute cells per 30 m side divide the fine ones; estimate = land cells × steps from the CFL limit with the deepest carved channel + 1.5 m ÷ the device speed this browser measured on its last run, kept in localStorage; defaults 1.2·10⁷/s CPU, 3·10⁸/s WebGPU). WebGPU counts only when an adapter answers (headless browsers expose `navigator.gpu` without one and then ran on the CPU with the GPU budget). If the fine grid itself fits, it is solved cell by cell with building blocks as before.
2. **Building porosity** (Sanders et al. 2008) on coarser compute cells (`buildDualRun`): storage share = open fine cells; conveyance between two cell centres = weighted harmonic mean of the open share of each fine column (row) in between (a closed row of buildings blocks), capped at the storage share of both cells (stability of the explicit update); roof rain reaches the cell's own open ground, or the nearest ring (≤ 3 cells) of open cells when less than 10 % is open; sealed cells do not limit the time step. Same terms in the CPU solver and the WebGPU shader (`ex` buffer now 8 floats per cell; flag bit 6).
3. **Display**: the flood layer uploads the fine building mask (R8) and the 30 m ground with its channel flag (RG32F) once; the shader computes each fine cell's ground with the same rule as the engine (`fineGround`) and draws water surface minus fine ground, no water on buildings. Per frame only the compute grid is uploaded. Exports (depth/colour GeoTIFF, HTML) use the same fine cells (`fineResult`).
4. **Page load**: the worker sends frames as uint16 cm with the flooded area already summed; flooded area, conclusion and KPIs weight each compute cell by its open share (`count` is now a float share).
5. Fine-cell limit is now 4,096 per side only (16.8 million cells, one texture); the compute budget keeps run time bounded.

## Evidence (`verification/fine-speed/`)
2 m building blocks vs porosity, 250 m box in Johar Baru (44 % building cover, no channel), 377 mm design storm, 14 h: 260 s vs 7.0 s (6 m compute) and 1.5 s (10 m); mean depth −2 cm, depth RMSE 0.20–0.25 m, CSI 0.64–0.72 (> 0.15 m); flooded share 0.54–0.56 vs 0.62 (porosity drier: more water leaves the box; blocks trap roof rain in closed courtyards, which were 100 % flooded at 10 m). WebGPU = CPU with porosity on real terrain (RMSE of max depth 4.9·10⁻⁵ m, CSI 1.0).

## Consequences
- 1 m results on boxes up to 4 km per side; run time stays near the budget whatever the cell size picked.
- Porosity results are an approximation of the building-block grid (numbers above); fine runs remain uncalibrated (Methods §1, conclusion).
- Optional later: local time stepping (channels with small steps, streets with large), building drag term.
