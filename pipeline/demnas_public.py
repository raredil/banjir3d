"""Publish DEMNAS (owner decision 2026-11-01, ADR 0013): copy the 8 m mosaic built by demnas_ingest.py from the draft release
'demnas-private' and render display tiles, so the map can show it next to FABDEM and GLO-30.

  python pipeline/demnas_public.py <out dir> [--region jakarta]      (GITHUB_TOKEN, GITHUB_REPOSITORY)

Outputs: dem_demnas.tif (8 m, EPSG:32748, EGM2008), dem_demnas.pmtiles (terrarium, zoom 5-14), dem_demnas.json (provenance,
comparison with FABDEM). DEMNAS is not used as model terrain: in built-up cells it keeps about 60 % of the building and tree
height that GLO-30 (a surface model) has over FABDEM (verification/terrain/probe.py, Methods section 3).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

import requests
from rasterio.warp import Resampling

from b3d import load_regions
from b3d.tiles import render_pmtiles, terrarium
from b3d.util import now_utc, output_record

API = "https://api.github.com"


def main(out: Path, region_id: str) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    repo, tok = os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_TOKEN"]
    h = {"Authorization": f"Bearer {tok}", "X-GitHub-Api-Version": "2022-11-28"}
    rel = next((r for r in requests.get(f"{API}/repos/{repo}/releases", headers=h, params={"per_page": 100}, timeout=60).json()
                if r["tag_name"] == "demnas-private"), None)
    asset = next((a for a in (rel or {}).get("assets", []) if a["name"] == f"dem_demnas_{region_id}_utm48s_8m.tif"), None)
    if asset is None:
        raise SystemExit("no DEMNAS mosaic in the draft release 'demnas-private' (run demnas.yml first)")
    tmp = out / asset["name"]
    with requests.get(asset["url"], headers={**h, "Accept": "application/octet-stream"}, stream=True, timeout=600) as r, open(tmp, "wb") as f:
        r.raise_for_status()
        shutil.copyfileobj(r.raw, f, length=1 << 20)
    cog = out / "dem_demnas.tif"
    tmp.rename(cog)
    region = load_regions()[region_id]
    pm = render_pmtiles(cog, out / "dem_demnas.pmtiles", bbox=region["bbox"], minzoom=5, maxzoom=14,
                        render=lambda d, v: terrarium(d[0], v), resampling=Resampling.bilinear,
                        metadata={"encoding": "terrarium", "source": cog.name})
    rec = {"dataset": "demnas", "created": now_utc(), "sources": [f"draft release demnas-private / {asset['name']}"],
           "licence": "BIG download page states no licence; published with attribution by owner decision 2026-11-01 (ADR 0013)",
           "attribution": "DEMNAS © Badan Informasi Geospasial",
           "steps": ["owner download per RBI sheet", "mosaic + reproject EPSG:32748 8 m bilinear (demnas_ingest.py)", "terrarium tiles z5-14"],
           "outputs": [output_record(cog, units="m", vertical_datum="EGM2008"),
                       output_record(pm, kind="raster-dem", encoding="terrarium", minzoom=5, maxzoom=14)]}
    (out / "dem_demnas.json").write_text(json.dumps(rec, indent=1))
    return rec


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--region", default="jakarta")
    a = ap.parse_args()
    main(a.out, a.region)
