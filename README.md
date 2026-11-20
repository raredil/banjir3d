# Banjir3D (working name)

Free, open flood simulation for research. Current model area: DKI Jakarta plus a 10 km buffer (2,129 km²); the rest of Jabodetabek (most of Bogor, Bekasi and Tangerang regencies, all of Kota Bogor) is not modelled yet.
Status: **working research tool** (engine, observed-flood validation, exports, provenance); accuracy work continues (see `ROADMAP.md`, `HANDOFF.md`). How to cite: `CITATION.cff`.

## How to open
1. Website: **https://raredil.github.io/banjir3d/**
2. Menu: **Peta** (layers), **Simulasi** (rain incl. return periods 2–100 years, observed floods, run, timeline, exports), **Data**, **Metode**, **Validasi**.
3. Download all references: Data → *Download REFERENCES.bib*.

One-time setting (owner): GitHub repo → **Settings** → **Pages** → *Build and deployment* → Source: **GitHub Actions**.

## How the data is made
- `Region pack` Action (Actions tab → Region pack → Run workflow) downloads and prepares every layer and publishes a release with provenance (`manifest.json`), checksums and a source check (`verify-report.json`).
- DEMNAS: owner downloads once (`docs/PANDUAN_DEMNAS.md`); kept private (ADR 0002).

## Repository map
`data/` catalog, regions, DEMNAS tile list · `pipeline/` Python data pipeline · `web/` website · `docs/` decisions, guides, logs · `research/` verified facts and sources.

## CODES
None (no codes in this project).
