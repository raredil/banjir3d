# ADR 0001 — Region data: GitHub Release + PMTiles on GitHub Pages
Date: 2026-10-23 · Status: accepted

**Context.** The site is static (GitHub Pages, free). GitHub release assets do not send CORS headers, so the browser cannot read them directly. Pages serves files from the same origin and supports HTTP range requests.

**Decision.** The *Region pack* Action builds all layers and publishes them as a GitHub release (archive: COG / GeoPackage / GeoParquet + `manifest.json` provenance + `SHA256SUMS`). The Pages workflow copies only the display files (`*.pmtiles`, manifest, verify report) of the newest release into the site. Analysis files stay downloadable from the release.

**Consequences.** One source of truth per region version (release tag). Pages limit 1 GB per site: buildings are tiled at zoom 14 only (overzoomed on the client). Re-running the Action creates a new dated release; old ones stay for reproducibility.
