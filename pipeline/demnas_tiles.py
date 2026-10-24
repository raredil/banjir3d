"""List the DEMNAS tiles (RBI 1:50k sheets) needed for a region, with a land check.

Usage: python demnas_tiles.py jakarta
Writes data/demnas/<region>_tiles.json and .geojson (shown on the app map).
Land check: share of ESA WorldCover 2021 pixels that are land (not water/no data)
inside the part of each sheet that lies in the region domain (bounding box of sheet ∩ domain).
"""
from __future__ import annotations

import json
import sys

import numpy as np
import rasterio
from rasterio.windows import from_bounds

from shapely.geometry import box

from b3d import DATA, load_domain, load_regions
from b3d.rbi import sheet_code, sheets_in_bbox

WC = "/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"


def wc_tile(lon: float, lat: float) -> str:
    la = int(np.floor(lat / 3) * 3)
    lo = int(np.floor(lon / 3) * 3)
    return f"{'S' if la < 0 else 'N'}{abs(la):02d}{'W' if lo < 0 else 'E'}{abs(lo):03d}"


def land_fraction(b: list[float]) -> float:
    vals = []
    for lat in np.linspace(b[1] + 1e-4, b[3] - 1e-4, 3):
        for lon in np.linspace(b[0] + 1e-4, b[2] - 1e-4, 3):
            vals.append(wc_tile(lon, lat))
    land = total = 0
    for t in sorted(set(vals)):
        with rasterio.open(WC.format(tile=t)) as src:
            sb = src.bounds
            w, s, e, n = max(b[0], sb.left), max(b[1], sb.bottom), min(b[2], sb.right), min(b[3], sb.top)
            if w >= e or s >= n:
                continue
            win = from_bounds(w, s, e, n, src.transform)
            # read a decimated version (~100 m) to keep it fast
            out_shape = (max(1, int(win.height // 10)), max(1, int(win.width // 10)))
            a = src.read(1, window=win, out_shape=out_shape)
            land += int(np.count_nonzero((a != 0) & (a != 80)))
            total += a.size
    return land / total if total else 0.0


def main(region_id: str) -> None:
    region = load_regions()[region_id]
    domain = load_domain(region)
    tiles = []
    for t in sheets_in_bbox(region["bbox"], 50_000):
        tb = t["bounds"]
        part = box(*tb).intersection(domain)
        frac = land_fraction(list(part.bounds)) if not part.is_empty else 0.0
        t["land_fraction_in_region"] = round(frac, 4)
        t["needed"] = frac > 0.001
        t["file_name"] = f"DEMNAS_{t['code']}_v1.0.tif"
        t["sub_sheets_25k"] = [
            sheet_code(tb[0] + dx, tb[1] + dy, 25_000) for dy in (0.0625, 0.1875) for dx in (0.0625, 0.1875)
        ]
        tiles.append(t)
        print(t["code"], t["needed"], t["land_fraction_in_region"], flush=True)
    out = DATA / "demnas"
    out.mkdir(exist_ok=True)
    meta = {
        "region": region_id,
        "bbox": region["bbox"],
        "domain": region.get("domain"),
        "scheme": "RBI 1:50,000 sheet (15' x 15'), origin 90E 15S; see pipeline/b3d/rbi.py",
        "land_check": "ESA WorldCover 2021 v200, land = classes other than 0 and 80",
        "tiles": tiles,
    }
    (out / f"{region_id}_tiles.json").write_text(json.dumps(meta, indent=1) + "\n")
    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"code": t["code"], "needed": t["needed"]},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[x, y] for x, y in (
                        (t["bounds"][0], t["bounds"][1]), (t["bounds"][2], t["bounds"][1]),
                        (t["bounds"][2], t["bounds"][3]), (t["bounds"][0], t["bounds"][3]),
                        (t["bounds"][0], t["bounds"][1]))]],
                },
            }
            for t in tiles
        ],
    }
    (out / f"{region_id}_tiles.geojson").write_text(json.dumps(fc) + "\n")
    need = [t["code"] for t in tiles if t["needed"]]
    print(f"{len(need)} tiles needed:", ", ".join(need))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "jakarta")
