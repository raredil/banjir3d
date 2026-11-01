# 0014 Jakarta Satu and the other permission-blocked maps are published

Date: 2026-11-01 · Status: accepted (owner decision)

## Decision
The owner reports **verbal permission** to publish the Jakarta Satu data, and says the other maps held back for lack of a licence may be used too. No written permission is needed; it will be issued only if a problem arises. This replaces the "raw data not published" rule of ADR 0010 (PetaBencana) and ADR 0013 §4 (Jakarta Satu).

1. **Jakarta Satu (Dinas SDA DKI)** is published as map layers: `pipeline/map_layers.py` (Action `map-layers.yml`) writes `jakartasatu.pmtiles` (vector layer `js`, field `t` = drain1 | drain2 | pump | polder | wall | genangan) and `jakartasatu.gpkg` (download) into the region pack. Kept fields: drain width/depth, pump capacity (m³/s), flood date (WIB), year, depth (cm), and up to 6 name/place text fields per layer (chosen by field name, listed in `map_layers.json`).
2. **PetaBencana** citizen reports of the three validation floods are published as points (`reports_petabencana.pmtiles/.geojson`): event, time WIB, depth cm, source. Report text, photos and user names are left out on purpose (not needed; privacy).
3. Attribution stays on every layer, in the manifest and in exports: "Jakarta Satu, Dinas Sumber Daya Air Provinsi DKI Jakarta", "PetaBencana.id (Yayasan Peta Bencana)".
4. The same script writes the DEMNAS and subsidence tiles into `manifest.json` (they were in the pack since release e6 but not in the manifest, so the map could not switch them on).
5. App: new layer groups "Prasarana air DKI" (drains, pumps, polders, NCICD walls) and "Banjir tercatat" (official flood polygons per RT with year filter, citizen reports); click shows the source values. In observed-flood mode, "Tampilkan banjir tercatat hari itu" filters both to the event window, next to the model water (warm colours = recorded, blue = model).

## Notes
- If a data owner objects, the files can be removed by publishing a region pack without them; the website follows the newest pack.
- The Jakarta GIS (DPMPTSP / Cipta Karya) RW samples are not needed: the Sinking City record (Zenodo 19456870, CC BY 4.0) holds 2,728 RW polygons for place-by-place scoring.
