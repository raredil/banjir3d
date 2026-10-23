# ADR 0003 — Web stack for Phase 0
Date: 2026-10-23 · Status: accepted (3D renderer decided in Phase 1)

- Vite 8 + TypeScript 7, no UI framework (small surface, few dependencies).
- MapLibre GL JS 6.15 (BSD-3) for the 2D map; `color-relief` + `hillshade` from Terrarium-encoded DEM tiles; worker bundled by Vite (`?worker&url`, MapLibre 6 otherwise looks for it next to its own module).
- pmtiles 4.5 (BSD-3) protocol for single-file tile archives with range requests.
- Fonts: IBM Plex Sans/Mono (OFL) self-hosted via @fontsource → no font CDN.
- Basemap: OpenFreeMap Positron (free, no key, OSM data ODbL); “None” option and automatic fallback to a plain background.
- Strict CSP in `index.html`: only `'self'` plus `tiles.openfreemap.org`.
- Bilingual UI (EN/ID); dataset metadata stays English.
