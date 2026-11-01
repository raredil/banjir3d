"""Jakarta Satu (Pemprov DKI geoportal, Dinas Sumber Daya Air services): drainage channels with width and depth, pumps,
polders, sea and river walls, and official flood (genangan) polygons per RT.

  python pipeline/jakartasatu.py <out dir>

Writes jakartasatu.gpkg (layers below, EPSG:32748) and jakartasatu.json (counts, field summary, service URLs, access time).
The services state no licence (copyrightText empty, checked by verification/terrain/probe.py on 2026-11-01), so the raw
vectors stay on the Action runner: only derived products (carved channel cells in the engine pack, validation scores) and
counts are published, with attribution "Jakarta Satu, Dinas Sumber Daya Air Provinsi DKI Jakarta".
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

from b3d.util import http_get, now_utc

BASE = "https://jakartasatu.jakarta.go.id/server/rest/services"
LAYERS = {
    "drain_primary_line": "DSDA/Saluran_Drainase/FeatureServer/0",
    "drain_secondary_line": "DSDA/Saluran_Drainase/FeatureServer/1",
    "drain_secondary_area": "DSDA/Saluran_Drainase/FeatureServer/3",
    "drain_primary_area": "DSDA/Saluran_Drainase/FeatureServer/4",
    "pumps": "DSDA/Pompa__Pintu__Sistem_Polder_View/FeatureServer/0",
    "polders": "DSDA/Polder_Jakarta/FeatureServer/0",
    "wall_ncicd": "DSDA/Tanggul_NCICD_Jakarta/MapServer/0",
    "wall_river": "DSDA/Tanggul_Sungai_Jakarta/MapServer/0",
    "genangan": "DSDA/Genangan/MapServer/0",
    "awlr": "Hosted/Automatic_Water_Level_Recorder/FeatureServer/54",
}
PAGE = 1000


def fetch(path: str) -> gpd.GeoDataFrame:
    url = f"{BASE}/{path}/query"
    parts, off = [], 0
    while True:
        r = http_get(url, params={"where": "1=1", "outFields": "*", "outSR": 32748, "f": "geojson",
                                  "resultOffset": off, "resultRecordCount": PAGE, "orderByFields": "OBJECTID"}, timeout=180)
        fc = r.json()
        feats = fc.get("features", [])
        if not feats:
            break
        parts.append(gpd.GeoDataFrame.from_features(feats, crs="EPSG:32748"))
        if len(feats) < PAGE:
            break
        off += PAGE
    if not parts:
        return gpd.GeoDataFrame(geometry=[], crs="EPSG:32748")
    return gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs="EPSG:32748")


def num_range(v) -> float | None:
    """'18,1 - 18,1' / '4 - 10,5' / '8' / 5.0 -> mean of the numbers in metres (None when absent or zero)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v) if v > 0 else None
    xs = [float(t.replace(",", ".")) for t in str(v).replace("–", "-").split(" - ") if t.strip().replace(",", "").replace(".", "").isdigit()]
    xs = [x for x in xs if x > 0]
    return sum(xs) / len(xs) if xs else None


def channel_size(row) -> tuple[float | None, float | None]:
    """Width and depth (m) of a drainage record: mean of the min/max fields, else the text range fields."""
    w = [row.get(k) for k in ("LEBAR_MIN", "LEBAR_MAX", "LBR_MIN", "LBR_MAX")]
    d = [row.get(k) for k in ("KED_MIN", "KED_MAX", "DLM_MIN", "DLM_MAX")]
    w = [float(x) for x in w if isinstance(x, (int, float)) and x and x > 0]
    d = [float(x) for x in d if isinstance(x, (int, float)) and x and x > 0]
    width = sum(w) / len(w) if w else num_range(row.get("LEBAR_M") or row.get("LBR_M"))
    depth = sum(d) / len(d) if d else num_range(row.get("KEDALAMAN_") or row.get("DALAM_M"))
    return width, depth


def main(out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    gpkg = out / "jakartasatu.gpkg"
    gpkg.unlink(missing_ok=True)
    meta = {"source": "Jakarta Satu, Dinas Sumber Daya Air Provinsi DKI Jakarta", "accessed": now_utc(), "licence": "not stated (raw data not published)", "layers": {}}
    for name, path in LAYERS.items():
        try:
            g = fetch(path)
        except Exception as e:  # one missing service must not stop the others
            meta["layers"][name] = {"url": f"{BASE}/{path}", "error": f"{type(e).__name__}: {e}"[:200]}
            continue
        if name.startswith("drain_"):
            sz = g.apply(lambda r: channel_size(r), axis=1)
            g["width_m"] = [s[0] for s in sz]
            g["depth_m"] = [s[1] for s in sz]
        g = g[g.geometry.notna() & ~g.geometry.is_empty]
        info = {"url": f"{BASE}/{path}", "features": int(len(g))}
        if len(g):
            g.to_file(gpkg, layer=name, driver="GPKG")
            info["geometry"] = sorted(set(g.geom_type))
            if name.startswith("drain_"):
                info["with_depth"] = int(g["depth_m"].notna().sum())
                info["depth_m_min_median_max"] = [round(float(x), 2) for x in g["depth_m"].dropna().quantile([0, 0.5, 1])] if g["depth_m"].notna().any() else None
                info["width_m_min_median_max"] = [round(float(x), 2) for x in g["width_m"].dropna().quantile([0, 0.5, 1])] if g["width_m"].notna().any() else None
                info["length_km"] = round(float(g.length.sum()) / 1000, 1) if "Line" in info["geometry"][0] else None
            if name == "genangan" and "TGL" in g:
                d = pd.to_datetime(g["TGL"], unit="ms", utc=True).dt.tz_convert("Asia/Jakarta").dt.date.astype(str)
                info["by_date_top"] = d.value_counts().head(15).to_dict()
                info["years"] = g["TAHUN"].value_counts().sort_index().to_dict() if "TAHUN" in g else None
            if name == "pumps" and "TTLKPSTS" in g:
                info["capacity_m3s_total"] = round(float(pd.to_numeric(g["TTLKPSTS"], errors="coerce").sum()), 1)
        meta["layers"][name] = info
    (out / "jakartasatu.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False, default=str))
    print(json.dumps(meta, indent=1, ensure_ascii=False, default=str))
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    a = ap.parse_args()
    main(a.out)
