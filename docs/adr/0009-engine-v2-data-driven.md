# ADR 0009: Flood engine v2, data-driven inputs, 2D dashboard (2026-10-30)

## Context
Owner feedback 2026-10-30 (20 points): the 3D view does not help (flat imagery); river capacity, drainage and roughness must not be typed in; the simulation must use current mapped conditions (terrain, rivers, buildings/land cover, slope) with only external forcing as input; flooding must follow the rivers and come from several sources; results must be sharp but smooth, exportable (GeoTIFF, HTML), fast, and defensible at PhD level; UI less "AI-like", dashboard style in blue, main page = full map.

## Decision
- Drop 3D (RULE): flat, north-up 2D map; `#/sample` removed. BLUEPRINT MUST-13 "3D visual" is replaced by the owner's later instruction.
- Engine pack (`pipeline/engine_pack.py`, Action `engine-pack.yml`): 30 m UTM grid from FABDEM; OSM channels carved in (lowest value within one cell + 150 m 1-D opening); Manning n and NRCS curve number from IO land cover (newest year) and SoilGrids soil groups; sea mask; GLO-90 D8 stream network (routing burn with Overture rivers/streams, canals excluded) with upstream area, CN, slope, flow length.
- Engine v2 (`web/src/engine/`): local inertial on a masked grid, CN runoff per cell, upstream inflows (NRCS lag + dimensionless UH, no double counting), fixed sea level, transmissive edges, hMin 0.001 m. WebGPU solver with CPU reference; parity verified.
- Inputs exposed to the user: rain (design storm or hourly), upstream rain on/off, sea level, simulated time, cell size, area. Removed: drainage, river inflow number, roughness choice, edge type.
- Display: water-level downscaling in a WebGL layer (smooth edges, discrete depth classes). Exports: depth GeoTIFF (float, EPSG:32748), coloured GeoTIFF, self-contained HTML map, PNG figure, JSON provenance.
- UI: navigation rail + full-screen map + floating cards (owner reference image, blue), help text behind "?".

## Consequences
Without drains/pumps the results are too wet (whole-region 1 Jan 2020 run: 777 km² > 0.15 m at 90 m with provisional soil); calibration of an effective drainage capacity against observed floods is the next step (Phase 4 pulled forward). SFINCS comparison must be re-run with v2.
