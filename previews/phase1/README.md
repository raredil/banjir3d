# Phase 1 look-test previews (2026-10-29, claude.ai chat)

Three candidate looks for the 10 x 10 km sample (Ciliwung, Kampung Melayu-Manggarai, ASSUMPTIONS A7). Software-rendered (no GPU), MapLibre terrain, FABDEM, vertical exaggeration x4. Look test only: this is not the final 3D renderer (BLUEPRINT MUST-13: WebGPU/three.js, decided later in Phase 1).

- `style1-satellite.jpg`: Sentinel-2 10 m drape + soft hillshade + rivers/canals (OSM).
- `style2-landcover.jpg`: Impact Observatory/Esri 10 m land cover drape + hillshade + rivers/canals.
- `style3-grey-depth.jpg`: print-friendly grey elevation tint + hillshade + blue depth ramp. The water is ILLUSTRATIVE ONLY: a flat 6 m level poured over FABDEM (bathtub fill), not a flood model result.
- `contact.jpg`: the three side by side.
- `lookdev.html`: the test page. To re-render: build the web app, put the release PMTiles in `web/dist/data/jakarta/`, copy `maplibre-gl.mjs`, `maplibre-gl-shared.mjs`, `maplibre-gl-worker.mjs`, `maplibre-gl.css` (from `web/node_modules/maplibre-gl/dist/`) and `pmtiles.js` (from `web/node_modules/pmtiles/dist/`) next to it in `web/dist/lookdev/`, serve with `vite preview`, open `lookdev/index.html?style=1|2|3`.

## In the app (added 2026-10-29)
The owner chose to keep all three looks. They are now selectable on the app's `#/sample` page ("3D sample" tab): `app-3d-sample-sat.jpg`, `app-3d-sample-lc.jpg`, `app-3d-sample-grey.jpg` (deep links `#/sample?look=sat|lc|grey`). Sliders: vertical exaggeration, tilt, and (grey look only) an illustrative water level. `lookdev.html` above is the earlier standalone test page and is kept only for reference.
