# ROADMAP
**Current position (2026-11-20): Phases 0–4 delivered (data, look, engine v2 with WebGPU, provenance/exports, validation on three observed floods with fair baselines). Since then: accuracy work without owner data (gauge rain, sub-grid river blocks, region-wide 30 m in tiles) and return-period design rain (CHIRPS 1981–2025). Open: depth at reports still too shallow; Zenodo DOI (owner account); other regions (owner choice).**

| Phase | Work | Gate (owner sees) | Status |
|---|---|---|---|
| 0 | Data & licences: verify datasets, catalog, region pack Action, DEMNAS guide | Data catalog page + 2D map with all layers | done |
| 1 | Look-lock: 3D sample in 3 styles (Ciliwung 10 × 10 km) | Pick style | done (all three kept, selectable) |
| 2 | Engines: Explore (WebGPU) + SFINCS Research Run, benchmarks | Same scenario in both engines | done for engine v2 (WebGPU + CPU, GPU parity, mass/analytical tests); SFINCS re-run postponed by owner |
| 3 | Provenance: record, Reproduce, export ZIP, CITATION.cff, Zenodo | ZIP with METHODS.md + REFERENCES.bib | done except Zenodo DOI (needs owner account) |
| 4 | Validation: 2 events, CSI/Hit/FAR, sensitivity | Validation page | done (3 floods, fair baselines, sensitivity, cell size); accuracy work continues |
| 5 | Full region + live rain + ensembles | Probability map | partial: whole-region runs, return-period rain; no live rain/ensembles |
| 6 | Layout composer (cartographic templates) | Journal-ready figure | partial: PNG figure (title, legend, scale, north, sources), GeoTIFF, HTML map |
| 7 | World mode | City outside Indonesia | — |
| 8 | Polish, Indonesian labels, docs | v1.0 with DOI | — |

## Phase 0 steps
1. ✅ Verify datasets (`research/phase0-datasets.md`)
2. ✅ Data catalog (`data/catalog.json`, schema, `REFERENCES.bib`)
3. ✅ DEMNAS tile list (25 sheets) + guide (`docs/PANDUAN_DEMNAS.md`)
4. ✅ Region pack pipeline + Actions (`pipeline/`, `.github/workflows/`)
5. ⏳ First Region pack run on GitHub; fix any source that fails there
6. ⏳ DEMNAS upload by owner → `DEMNAS ingest` Action
7. Gate 0 preview
