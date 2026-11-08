# Fine cells, tertiary drains, rain maps, flood source (2026-11-08)

## Facts
- Overture buildings in the region: 4,305,825 footprints (OSM 2.77 M, Google 0.97 M, Microsoft 0.56 M), tiles z14 only (`record-buildings.json`, release region-jakarta-20261101-m4). [verified]
- Schubert, J.E., Sanders, B.F. (2012) Building treatments for urban flood inundation models and implications for predictive skill and modeling efficiency. Advances in Water Resources 41, 49–64, doi:10.1016/j.advwatres.2012.02.012 (ScienceDirect page, OSTI listing, Google Scholar). Four methods: building resistance, block, hole, porosity; all reach high skill for extent. [verified]
- Drainase_Tersier.gdb: layer DRAINASE_LN_5K, MultiLineString, WGS 84 + EGM2008, 1,844 features, 1,105 km, NAMOBJ 1,051 distinct (mostly "Sal. Phb"), 258 kelurahan, 43 kecamatan, 5 kota; FCODE HA02080620; REMARK, METADATA, SRS_ID, KONCOU, THNPBN, THNOPR, TJDRLG empty in all rows. [verified, read with GDAL 3.12.4]
- Sampled every ~11 m (158,453 points): 22.9 % on an engine-pack channel cell, 27.6 % within 30 m. [verified, engine pack 2026-11-01]
- Jakarta Satu also has a tertiary layer (1,211 records) and micro drains (60,718), size mostly missing (catalog note, 2026-11-01). [from catalog]

## Source attribution, 1 Jan 2020 (whole region, 90 m, IMERG, 48 h)
See `verification/observed/attribution-2020-01-01.json`. Rain only 247.8 km², with upstream 300.0 km²; >1 m: 14.6 → 26.2 km²; 17 % of flooded area within 90 m of a channel.

## Fine-run check (browser, CPU, software rendering)
1.0 × 1.0 km box at 106.848–106.857 E, 6.232–6.223 S, 5 m, design rain 150 mm/6 h, 3 h: 204 × 204 cells, 44.6 % building cells, 42 s, mass error −1.2e-15. Preview `previews/fine-rain/`.
