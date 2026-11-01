"""Compare engine results with PetaBencana.id observations (runs in the validation workflow, next to the raw answers, which are not
redistributed: their licence is not stated). Writes aggregate scores only.

  python verification/observed/compare.py <obsdir> <event id> <run dir with *_summary.json + *_hmax.f32.gz> <out.json> [jakartasatu.gpkg]

Reports (points): flood reports inside the run area. Model depth = largest max depth within one cell (location of a phone report is
approximate). Hit = model >= 0.10 m. Depth error where the report gives a depth.
RW areas: an RW counts as observed flooded when the flooded-area archive lists it with max_state >= 1. Model score per RW = share of
its land cells (not channel or sea) with max depth > 0.15 m. AUC (no threshold) and CSI with RW flooded when the share >= 10 %.
Area: modelled flooded land (> 0.15 m, not channel or sea) inside the five mainland Jakarta cities (data/regions/jakarta_domain.geojson,
admin feature), to set against the flooded area the city reported for the event ('reported' in events.json): the over-prediction check.
"""
import gzip, json, sys
from pathlib import Path

import numpy as np
from pyproj import Transformer

HIT_M, WET_M, RW_SHARE = 0.10, 0.15, 0.10


def load_json(p: Path):
    d = json.loads(p.read_text())
    return d.get("result", d) if isinstance(d, dict) else d


def features(r):
    if isinstance(r, dict) and "features" in r:
        return r["features"]
    if isinstance(r, dict) and "objects" in r:
        raise ValueError("topojson not handled")
    return []


def auc(score: np.ndarray, label: np.ndarray) -> float | None:
    pos, neg = score[label], score[~label]
    if not len(pos) or not len(neg):
        return None
    r = np.argsort(np.argsort(np.concatenate([pos, neg]), kind="stable"), kind="stable") + 1.0
    # ties: average ranks
    allv = np.concatenate([pos, neg])
    for v in np.unique(allv):
        m = allv == v
        if m.sum() > 1:
            r[m] = r[m].mean()
    return float((r[: len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def grid_of(summary: dict):
    u = summary["utm"]
    return u["x0"], u["y0"], summary["dx"], summary["nx"], summary["ny"], Transformer.from_crs("EPSG:4326", f"EPSG:327{u['zone']}", always_xy=True)


def report_scores(rep, h, summary, wet_mask):
    x0, y0, dx, nx, ny, tr = grid_of(summary)
    out, depths = [], []
    for f in rep:
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        p = f.get("properties", {})
        if p.get("disaster_type", "flood") != "flood":
            continue
        x, y = tr.transform(*g["coordinates"][:2])
        i, j = int((x - x0) // dx), int((y0 - y) // dx)
        if not (1 <= i < nx - 1 and 1 <= j < ny - 1) or not wet_mask[j, i]:
            continue
        m = float(h[j - 1 : j + 2, i - 1 : i + 2].max())
        d = (p.get("report_data") or {}).get("flood_depth")
        out.append(m)
        if isinstance(d, (int, float)) and d > 0:
            depths.append((d / 100.0, m))
    out = np.array(out)
    res = {"n_reports": int(len(out)), "hit_rate": float((out >= HIT_M).mean()) if len(out) else None}
    if depths:
        o, m = np.array(depths).T
        res.update({"n_with_depth": int(len(o)), "depth_bias_m": float((m - o).mean()), "depth_mae_m": float(np.abs(m - o).mean()),
                    "depth_rmse_m": float(np.sqrt(((m - o) ** 2).mean())), "observed_median_m": float(np.median(o)), "model_median_m": float(np.median(m))})
    return res


def rw_scores(areas, flooded_ids, h, summary, land):
    from rasterio import features as rf
    from rasterio.transform import from_origin
    import shapely
    from shapely.geometry import shape

    x0, y0, dx, nx, ny, tr = grid_of(summary)
    shapes = []
    for k, f in enumerate(areas):
        aid = str((f.get("properties") or {}).get("area_id", ""))
        if not aid or not f.get("geometry"):
            continue
        shapes.append((aid, shapely.transform(shape(f["geometry"]), lambda xy: np.column_stack(tr.transform(xy[:, 0], xy[:, 1])))))
    lab = rf.rasterize(((g, k + 1) for k, (_, g) in enumerate(shapes)), out_shape=(ny, nx), transform=from_origin(x0, y0, dx, dx), dtype="int32")
    wet = (h > WET_M) & land
    ids = lab.ravel()
    cnt = np.bincount(ids, weights=land.ravel(), minlength=len(shapes) + 1)[1:]
    wc = np.bincount(ids, weights=wet.ravel(), minlength=len(shapes) + 1)[1:]
    keep = cnt >= 3  # RW with at least 3 land cells in the run grid
    share = np.where(cnt > 0, wc / np.maximum(cnt, 1), 0)[keep]
    obs = np.array([a in flooded_ids for a, _ in shapes])[keep]
    mod = share >= RW_SHARE
    hits, fa, miss = int((mod & obs).sum()), int((mod & ~obs).sum()), int((~mod & obs).sum())
    return {"n_rw": int(keep.sum()), "n_rw_observed_flooded": int(obs.sum()), "n_rw_model_flooded": int(mod.sum()), "auc": auc(share, obs),
            "csi": hits / max(1, hits + fa + miss), "hit_rate": hits / max(1, hits + miss), "false_alarm_ratio": fa / max(1, hits + fa),
            "rw_share_threshold": RW_SHARE}


def dki_flooded_km2(h, summary, land):
    from rasterio import features as rf
    from rasterio.transform import from_origin
    import shapely
    from shapely.geometry import shape

    x0, y0, dx, nx, ny, tr = grid_of(summary)
    dom = json.loads((Path(__file__).parents[2] / "data/regions/jakarta_domain.geojson").read_text())
    adm = [f for f in dom["features"] if f["properties"].get("role") == "admin"][0]
    g = shapely.transform(shape(adm["geometry"]), lambda xy: np.column_stack(tr.transform(xy[:, 0], xy[:, 1])))
    inside = rf.rasterize([(g, 1)], out_shape=(ny, nx), transform=from_origin(x0, y0, dx, dx), dtype="uint8").astype(bool)
    return float(((h > WET_M) & land & inside).sum() * dx * dx / 1e6), float((inside & land).sum() * dx * dx / 1e6)


def genangan_scores(gpkg: Path, ev: str, h, summary, land):
    """Official flood polygons of Dinas SDA DKI (Jakarta Satu 'Genangan', one record per RT and date, observed depth in cm) dated
    within the event window +- 1 day. Model depth per polygon = largest max depth over the land cells it touches.
    Raw polygons stay on the runner (licence not stated); only these aggregates are written."""
    import geopandas as gpd
    import pandas as pd
    from rasterio import features as rf
    from rasterio.transform import from_origin

    e = next(e for e in json.loads((Path(__file__).parent / "events.json").read_text())["events"] if e["id"] == ev)
    t0 = pd.Timestamp(e["utc"][0], tz="UTC") - pd.Timedelta(days=1)
    t1 = pd.Timestamp(e["utc"][1], tz="UTC") + pd.Timedelta(days=1)
    g = gpd.read_file(gpkg, layer="genangan")
    tg = pd.to_datetime(g["TGL"], unit="ms", utc=True)
    g = g[(tg >= t0) & (tg <= t1)].copy()
    if g.empty:
        return {"n_polygons": 0, "window_utc": [str(t0), str(t1)]}
    x0, y0, dx, nx, ny, _ = grid_of(summary)
    trf = from_origin(x0, y0, dx, dx)
    g = g.to_crs("EPSG:32748")
    obs_cm = pd.to_numeric(g.get("TGIMAX"), errors="coerce").where(lambda v: v > 0, pd.to_numeric(g.get("TGIGNGN"), errors="coerce"))
    model, observed = [], []
    for geom, o in zip(g.geometry, obs_cm):
        m = rf.rasterize([(geom, 1)], out_shape=(ny, nx), transform=trf, all_touched=True, dtype="uint8").astype(bool) & land
        if not m.any():
            continue
        model.append(float(h[m].max()))
        observed.append(float(o) / 100 if o == o and o > 0 else np.nan)
    model, observed = np.array(model), np.array(observed)
    hit = model >= HIT_M
    both = np.isfinite(observed)
    out = {"source": "Jakarta Satu, Dinas SDA DKI, layer Genangan (aggregates only)", "window_utc": [str(t0), str(t1)],
           "n_polygons": int(len(model)), "hit_rate": float(hit.mean()) if len(model) else None,
           "median_model_depth_m": float(np.median(model)) if len(model) else None}
    if both.any():
        out.update({"n_with_depth": int(both.sum()), "median_observed_depth_m": float(np.median(observed[both])),
                    "median_model_depth_at_observed_m": float(np.median(model[both])),
                    "mean_error_m": float(np.mean(model[both] - observed[both])),
                    "share_model_ge_half_observed": float(np.mean(model[both] >= 0.5 * observed[both]))})
    return out


def main():
    obs, ev, rundir, outp = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4])
    rep = features(load_json(obs / ev / "pb_reports_archive_geojson.json"))
    arch = load_json(obs / ev / "pb_floods_archive.json")
    arch = arch if isinstance(arch, list) else [f.get("properties", f) for f in features(arch)]
    flooded = {str(a["area_id"]) for a in arch if (a.get("max_state") or 0) >= 1}
    areas = []
    for name in ("admin", "admin_json"):  # all RW of Jakarta (minimum_state answers hold only areas flooded now)
        p = obs / f"pb_areas_{name}.json"
        if p.exists():
            try:
                areas = features(load_json(p))
            except (ValueError, json.JSONDecodeError):
                areas = []
            if areas:
                break
    results = []
    for sp in sorted(rundir.glob(f"{ev}_*_summary.json")):
        s = json.loads(sp.read_text())
        h = np.frombuffer(gzip.decompress((rundir / sp.name.replace("_summary.json", "_hmax.f32.gz")).read_bytes()), np.float32).reshape(s["ny"], s["nx"])
        m = np.frombuffer(gzip.decompress((rundir / sp.name.replace("_summary.json", "_mask.u8.gz")).read_bytes()), np.uint8).reshape(s["ny"], s["nx"])
        inside = (m & 1).astype(bool) & ~(m & 2).astype(bool)  # active, not sea
        land = inside & ~(m & 4).astype(bool)  # and not a mapped channel
        r = {"run": sp.name.replace("_summary.json", ""), "drain_mm_h": s["drain_mm_h"], "rain": s["rain"], "rain_scale": s.get("rain_scale", 1), "terrain_year": s.get("terrain_year"),
             "mean_rain_mm": s["mean_rain_mm"], "flooded_km2": s["flooded_km2_gt015_outside_channels"], "mass_error": s["massError"],
             "reports": report_scores(rep, h, s, inside)}
        if areas:
            r["rw"] = rw_scores(areas, flooded, h, s, land)
        r["dki_flooded_km2"], r["dki_land_km2"] = dki_flooded_km2(h, s, land)
        if len(sys.argv) > 5 and Path(sys.argv[5]).exists():
            try:
                r["genangan_dsda"] = genangan_scores(Path(sys.argv[5]), ev, h, s, land)
            except Exception as ex:  # a missing layer must not lose the other scores
                r["genangan_dsda"] = {"error": f"{type(ex).__name__}: {ex}"[:200]}
        results.append(r)
    reported = next((e.get("reported") for e in json.loads((Path(__file__).parent / "events.json").read_text())["events"] if e["id"] == ev), None)
    out = {"event": ev, "source": "PetaBencana.id flood reports and flooded-area archive (aggregate scores only)", "reported": reported,
           "n_flooded_area_records": len(flooded), "rw_shapes": len(areas), "results": results}
    outp.write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
