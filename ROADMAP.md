# ROADMAP
**Current position: Phase 2 in progress. Explore engine v1 live on the 3D sample page (documented rain inputs, own area box, analytical and SFINCS checks, Methods page with references); exploratory, not validated against observed floods. Next: EA benchmarks, canal burning, SFINCS Research Run in an Action. Phase 0 still open: DEMNAS licence text.**

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
