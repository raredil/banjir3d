# Banjir3D (working name)

Free, open, reproducible flood simulation for research — starting with Jabodetabek.
Status: **Phase 0 — data & licences** (see `ROADMAP.md`).

## How to open
1. Website: **https://raredil.github.io/banjir3d/** (after GitHub Pages is switched on, see below).
2. **Map** tab: all data layers for Jabodetabek. **Data catalog** tab: every dataset with version, licence, DOI and citation.
3. Download all references: Data catalog → *Download REFERENCES.bib*.

One-time setting (owner): GitHub repo → **Settings** → **Pages** → *Build and deployment* → Source: **GitHub Actions**.

## How the data is made
- `Region pack` Action (Actions tab → Region pack → Run workflow) downloads and prepares every layer and publishes a release with provenance (`manifest.json`), checksums and a source check (`verify-report.json`).
- DEMNAS: owner downloads once (`docs/PANDUAN_DEMNAS.md`); kept private (ADR 0002).

## Repository map
`data/` catalog, regions, DEMNAS tile list · `pipeline/` Python data pipeline · `web/` website · `docs/` decisions, guides, logs · `research/` verified facts and sources.

## CODES
None (no codes in this project).
