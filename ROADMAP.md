# ROADMAP
**Current position: Phase 4 validation done for three observed floods (ADR 0010/0011). 2026-11-01: terrain upgrade (ADR 0013): InSAR land subsidence shifts the terrain to the run date, Jakarta Satu (DSDA) drains carved with width/depth, DEMNAS 8 m public as map layer. 2026-11-01 (17th): Jakarta Satu + PetaBencana published as map layers (ADR 0014), polder pumps in the engine, new pack validated (depth better, 2020 drier), map UI (active-layers card, hidden rail). Next: pump validation, 2020 dryness. Owner options open: C (Sentinel-1 flood extent), D (terrain-edit scenarios).**

| Phase | Work | Gate (owner sees) | Status |
|---|---|---|---|
| 0 | Data & licences: verify datasets, catalog, region pack Action, DEMNAS guide | Data catalog page + 2D map with all layers | in progress |
| 1 | Look-lock: 3D sample in 3 styles (Ciliwung 10 × 10 km) | Pick style | done (all three kept, selectable) |
| 2 | Engines: Explore (WebGPU) + SFINCS Research Run, benchmarks | Same scenario in both engines | in progress (Explore v1 on CPU, ADR 0006/0007, Methods page) |
| 3 | Provenance: record, Reproduce, export ZIP, CITATION.cff, Zenodo | ZIP with METHODS.md + REFERENCES.bib | — |
| 4 | Validation: 2 events, CSI/Hit/FAR, sensitivity | Validation page | — |
| 5 | Full region + live rain + ensembles | Probability map | — |
| 6 | Layout composer (cartographic templates) | Journal-ready figure | — |
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
