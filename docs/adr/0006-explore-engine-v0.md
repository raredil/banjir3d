# ADR 0006: Explore engine v0 runs on the CPU in a Web Worker first, WebGPU later

Status: accepted for v0 (2026-10-29). Boundaries, rain input and presets superseded by ADR 0007. To revisit when the WebGPU port starts.

## Context
BLUEPRINT 4.1 specifies the Explore engine as a 2D local-inertial shallow-water solver (Bates et al. 2010, LISFLOOD-FP "ACC") in the browser, written for WebGPU. The chat sandbox used to build it has no GPU, so a WebGPU kernel could not be run or tested there. The owner wants a working flood map without more delay.

## Decision
- Implement the same scheme in plain TypeScript on typed arrays (`web/src/explore/local-inertial.ts`) and run it in a Web Worker (`sim.worker.ts`).
- Keep the solver free of DOM and MapLibre imports, so it is unit-tested in Node and can serve as the reference for the later WebGPU port.
- Grid: the FABDEM z12 pixel grid of the sample (about 263 x 263 cells of about 38 m), read in the browser from `dem_fabdem.pmtiles`.
- Show results as an image draped on the 3D terrain (MapLibre canvas source, no network request, so the strict CSP is unchanged).

## Scheme and options (v0)
Flux update with theta = 0.7 and Manning friction (n = 0.05, uniform), Froude limit at 1, wet/dry threshold 1 mm, CFL factor 0.7 (dt up to 15 s), a limiter so a cell never gives away more water than it holds. Sources: uniform rain-on-grid, a uniform drainage sink (mm/h), an optional river inflow into the lowest south-edge cell and its two neighbours. Boundaries: north edge open (normal flow with a fixed slope), others closed.

## Checks that pass (`local-inertial.test.ts`)
Lake at rest on flat and sloping beds stays still; mass is conserved to 1e-9 with rain and drainage; 1D dam break is mass-conserving and non-negative; a steady inflow leaves through the open edge within 5 percent. A 263 x 263 grid for 6 simulated hours takes about 10 s in Node.

## Not done, so results are exploratory
- Not yet verified against the EA 2D benchmarks (Neelz and Pender 2013) or compared with SFINCS on the same sample (BLUEPRINT 4.1 requires both before use).
- No infiltration, no canal or river channel burned into the DEM, no sewer network, no tide, uniform roughness, constant-intensity rain only.
- FABDEM is a 30 m bare-earth model, so buildings, embankments and narrow channels are not resolved. Pits in the DEM collect water.

## Consequences
Every result is stamped "EXPLORATORY RESULT, not for quantitative conclusions" on the map. Numbers for papers must come from the Research Run (SFINCS), as in the BLUEPRINT.
