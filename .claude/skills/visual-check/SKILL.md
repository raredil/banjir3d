---
name: visual-check
description: Build the web app, serve it with the region pack + engine pack and take screenshots (and run a small simulation) with the preinstalled Chromium (no playwright install). Use for every visual self-review (CORE §9) and gate preview.
---
# Visual check (cloud session)
1. Data (once per session): newest release with an engine pack (tag `region-jakarta-*-e*`): download `manifest.json verify-report.json data-check.json engine_jakarta.bin.gz engine_jakarta.json exposure_jakarta.bin.gz exposure_jakarta.json *.pmtiles` (exposure from a `-x*` release or newer) into `web/public/data/jakarta/` (gitignored; real files, not symlinks) and write `release.json` `{"tag": "<tag>"}`.
2. `cd web && npm run build` (public/ is copied into dist/).
3. Serve and shoot in ONE bash call (server dies with the call), 5-minute limit:
   `(npx vite preview --port 4173 --strictPort >/dev/null 2>&1 &) ; sleep 2; node ../.claude/skills/visual-check/shoot2.cjs <outdir> http://localhost:4173`
   Shots: map, sim-panel, sim-result + sim-max (CPU run of a 4.4 km box, about 40 s), exports (tif/html/json), data, methods, validation, mobile-sim.
4. GPU parity: `npx vite --port 5199 &` then `node ../verification/gpu-parity/parity.cjs "http://localhost:5199/verify-gpu.html?hours=2"` (WebGPU on SwiftShader: flags in the script; slow, numerics only).
5. Check PNGs with Read. Software rendering: never judge speed here. OpenFreeMap errors are expected in the sandbox.
