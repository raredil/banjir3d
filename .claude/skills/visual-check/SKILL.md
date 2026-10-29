---
name: visual-check
description: Build the web app, serve it with the region pack data and take screenshots with the preinstalled Chromium (no playwright install). Use for every visual self-review (CORE §9) and gate preview.
---
# Visual check (cloud session)
1. Data (once per session, about 21 MB): `D=/tmp/claude-0/pack; mkdir -p $D; B=https://github.com/raredil/banjir3d/releases/download/<newest region-jakarta tag>; for f in manifest.json verify-report.json dem_fabdem.pmtiles imagery_s2.pmtiles lulc_io_latest.pmtiles lulc_worldcover_2021.pmtiles water_osm.pmtiles admin_geoboundaries.pmtiles; do curl -sSLf -o $D/$f $B/$f; done; echo '{"tag":"<tag>"}' > $D/release.json`
2. Build and copy: `cd web && npm run build && mkdir -p dist/data/jakarta && cp /tmp/claude-0/pack/* dist/data/jakarta/`
3. Serve and shoot in ONE bash call (the server dies when the call ends), 5-minute limit:
   `(npx vite preview --port 4173 --strictPort >/dev/null 2>&1 &) ; sleep 3; node ../.claude/skills/visual-check/shoot.cjs <outdir> http://localhost:4173 [shots]`
   Shots: methods, methods-refs, methods-mobile, sample, sample-mobile, draw-run (draws a box, runs the default event; about 1 to 3 min software-rendered).
4. Check the PNGs with Read (downscale or crop if large). Screenshots are software-rendered (SwiftShader), not final quality; never judge speed here.
Notes: Chromium path `/opt/pw-browsers/chromium-*/chrome-linux64/chrome` (set `CHROME` if the version number changed). `require("playwright")` works globally. OpenFreeMap basemap errors (`ERR_NAME_NOT_RESOLVED`) are expected in the sandbox.
