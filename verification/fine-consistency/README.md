# Fine cells vs 30 m (ADR 0017)

`run.ts` runs one box at 30 m and at fine cells (building blocks and dual-grid porosity) with the same design rain and upstream
inflow, and compares the maximum depth per 30 m cell. `pockets.ts` counts open cells sealed off by building footprints.
`shoot.cjs` takes the same box in the browser at several cell sizes (before/after shots in `previews/fine-consistency/`).

From `web/`:

    npx vite-node ../verification/fine-consistency/run.ts <engine_jakarta.bin.gz> <buildings_overture.pmtiles> <out.json> "" 150 6 12 "30:1:1:0,10p:3:1:1,5p:6:3:1"

Cases are `name:r:rc:buildings` (r fine cells per 30 m side, rc compute cells; rc = r is the building-block grid). `OLD=1`
restores the channel roughness of the pack and the single-cell river entry. Results: `results.json`.
