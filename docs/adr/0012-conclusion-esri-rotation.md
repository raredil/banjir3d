# 0012 Automatic conclusion, Esri imagery, map rotation

Date: 2026-10-31 · Status: accepted (owner request)

## Decision
1. After every run a "Kesimpulan" card writes a research-style paragraph set from the run itself (`web/src/sim/conclusion.ts`, pure, tested): study area, model and data with Harvard citations from `data/methods/references.json`, rain forcing (design / hourly / IMERG event), upstream inflow, flooded area from the maximum-depth map (threshold 0.15 m, depth classes, mean and deepest point with kecamatan), peak and final instantaneous area, exposure (WorldPop, Overture) rounded to 3 significant figures, reported reference figures and PetaBencana hit share (event mode, whole-region validation), limitations, water-balance error. Copy and .md download; reference list + other sources appended.
2. Default base map = Esri World Imagery + Esri place labels (attribution "Powered by Esri | Esri, Maxar, Earthstar Geographics, and the GIS User Community"); OpenFreeMap street map and "none" remain; Sentinel-2 layer off by default. CSP allows `https://server.arcgisonline.com` (img, connect).
3. Map rotation allowed (right-drag, two fingers, ⟲/⟳ 15° buttons, compass click = north). Replaces the north-up rule of ADR 0009; the PNG export rotates its north arrow by the map bearing. GeoTIFF/HTML exports are grid-based and unaffected.

## Notes
Text only states numbers the run produced or validation files hold; nothing typed by hand. Reported figures (Antara/Pemprov DKI) apply to all of DKI Jakarta, said so in the text when a box is used.
