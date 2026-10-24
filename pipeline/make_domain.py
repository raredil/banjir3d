"""Build a region's simulation domain from administrative boundaries + a metric buffer.

  python make_domain.py jakarta [--adm2 FILE]

Region 'jakarta' (owner decision 2026-10-24, ADR 0005): the five mainland cities of DKI Jakarta
(Jakarta Barat, Pusat, Selatan, Timur, Utara), Kepulauan Seribu excluded, dissolved and buffered
10,000 m outward in UTM 48S. Parts of Banten (Tangerang) and Jawa Barat (Bekasi, Depok, Bogor) inside the
buffer are included. Writes data/regions/<id>_domain.geojson and updates the bbox in data/regions.json.
"""
from __future__ import annotations

import argparse
import json
import math
import tempfile
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping

from b3d import DATA, load_regions
from b3d.util import download, now_utc, sha256

# geoBoundaries gbOpen IDN ADM2 (BPS / WFP / OCHA ROAP 2020, CC BY 3.0 IGO). Git LFS file, so the media host.
GB_ADM2 = ("https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/"
           "releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2.geojson")

DOMAINS = {
    "jakarta": {
        "units": ["Kota Jakarta Barat", "Kota Jakarta Pusat", "Kota Jakarta Selatan",
                  "Kota Jakarta Timur", "Kota Jakarta Utara"],
        "excluded": ["Kepulauan Seribu"],
        "buffer_m": 10_000,
    },
}


def _round(geom, nd=6):
    m = mapping(geom)

    def r(c):
        return [r(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], nd), round(c[1], nd)]

    return {"type": m["type"], "coordinates": r(m["coordinates"])}


def build(region_id: str, adm2: Path) -> dict:
    spec = DOMAINS[region_id]
    region = load_regions()[region_id]
    crs = region["crs"]
    g = gpd.read_file(adm2)
    sel = g[g.shapeName.isin(spec["units"])]
    if sorted(sel.shapeName) != sorted(spec["units"]):
        raise SystemExit(f"units not found: {set(spec['units']) - set(sel.shapeName)}")
    admin = sel.to_crs(crs).geometry.union_all().buffer(0)
    domain = admin.buffer(spec["buffer_m"], quad_segs=32)
    # admin outline for display only: 5 m simplification keeps the file small
    admin_ll = gpd.GeoSeries([admin.simplify(5)], crs=crs).to_crs("EPSG:4326").iloc[0]
    domain_ll = gpd.GeoSeries([domain.simplify(1)], crs=crs).to_crs("EPSG:4326").iloc[0]
    src = {"dataset": "geoboundaries-idn", "url": GB_ADM2, "sha256": sha256(adm2), "accessed": now_utc(),
           "boundary": "IDN ADM2 (BPS/WFP/OCHA ROAP 2020), CC BY 3.0 IGO"}
    fc = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"role": "domain", "region": region_id, "buffer_m": spec["buffer_m"],
                                               "area_km2": round(domain.area / 1e6, 1), "crs_of_buffer": crs},
             "geometry": _round(domain_ll)},
            {"type": "Feature", "properties": {"role": "admin", "units": spec["units"], "excluded": spec["excluded"],
                                               "area_km2": round(admin.area / 1e6, 1)},
             "geometry": _round(admin_ll)},
        ],
        "source": src,
    }
    out = DATA / "regions" / f"{region_id}_domain.geojson"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(fc) + "\n")
    # bbox = domain bounds rounded outward to 0.001° (~110 m)
    w, s, e, n = domain_ll.bounds
    f = 1000
    bbox = [math.floor(w * f) / f, math.floor(s * f) / f, math.ceil(e * f) / f, math.ceil(n * f) / f]
    regions = load_regions()
    regions[region_id]["bbox"] = bbox
    (DATA / "regions.json").write_text(json.dumps(regions, indent=2, ensure_ascii=False) + "\n")
    print(out, "bbox", bbox, "domain km²", fc["features"][0]["properties"]["area_km2"],
          "admin km²", fc["features"][1]["properties"]["area_km2"])
    return fc


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("region", choices=sorted(DOMAINS))
    ap.add_argument("--adm2", type=Path, help="local copy of the geoBoundaries IDN ADM2 GeoJSON")
    a = ap.parse_args()
    if a.adm2:
        build(a.region, a.adm2)
    else:
        with tempfile.TemporaryDirectory() as td:
            build(a.region, download(GB_ADM2, Path(td) / "adm2.geojson"))
