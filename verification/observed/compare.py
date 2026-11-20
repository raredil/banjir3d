"""Compare engine results with PetaBencana.id observations and the official DSDA flood polygons (runs in the validation workflow).
Writes aggregate scores; the observations themselves are published as map layers (pipeline/map_layers.py, ADR 0014).

  python verification/observed/compare.py <obsdir> <event id> <run dir with *_summary.json + *_hmax.f32.gz> <out.json> [jakartasatu.gpkg] [rw.gpkg]

Reports (points): flood reports inside the run area. Model depth = largest max depth within one cell (location of a phone report is
approximate). Hit = model >= 0.10 m. Depth error where the report gives a depth.
RW areas: an RW counts as observed flooded when the flooded-area archive lists it with max_state >= 1. Model score per RW = share of
its land cells (not channel or sea) with max depth > 0.15 m. AUC (no threshold) and CSI with RW flooded when the share >= 10 %.
RW places (rw.gpkg, Sinking City RW polygons, CC BY 4.0): an RW counts as observed flooded when a PetaBencana report of the event
lies in it or a DSDA flood polygon dated in the event window touches it; model flooded when >= 10 % of its land is wetter than 0.15 m.
Reports are incomplete, so an RW without a record is "not recorded", not "dry": the false-alarm ratio is an upper bound.
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


def land_window_max(h, land):
    """Largest max depth over the land cells (no channel, no sea) of the 3 x 3 window around each cell; 0 where none."""
    hl = np.where(land, h, 0.0).astype(np.float32)
    p = np.pad(hl, 1)
    out = np.zeros_like(hl)
    for dj in range(3):
        for di in range(3):
            out = np.maximum(out, p[dj:dj + hl.shape[0], di:di + hl.shape[1]])
    return out


def wilson(k: int, n: int, z: float = 1.96):
    """95 % Wilson interval of a proportion k/n."""
    if not n:
        return None
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    r = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [float(c - r), float(c + r)]


def binom_p_greater(k: int, n: int, p0: float) -> float:
    """One-sided exact binomial p-value P(X >= k | n, p0) (no scipy needed on the runner)."""
    from math import comb
    if p0 <= 0:
        return 0.0 if k > 0 else 1.0
    if p0 >= 1:
        return 1.0
    return float(min(1.0, sum(comb(n, x) * p0 ** x * (1 - p0) ** (n - x) for x in range(k, n + 1))))


def fair_baselines(ij, hit, win, land, dki, dx, seed=7, n_boot=2000):
    """Fair comparison for the report hit rate (review 2026-11-20, finding V-04/V-05).
    The older baseline put random points on DKI land only, while about a third of the reports lie outside DKI. Here:
    - domain_land: random points on ALL land of the run grid (where reports can fall);
    - near_reports: random points on land within 1 km of any report of the event (where people actually report; reports cluster
      in dense, connected places);
    - wilson95: 95 % interval of the hit rate; block_bootstrap95: interval with 1 km blocks resampled (reports cluster in space);
    - p_*: one-sided exact binomial p of hit >= the baseline. Verdict 'better' only when p < 0.05 against near_reports AND domain_land.
    Also hit rate for reports inside DKI only, set against the DKI baseline."""
    i, j = ij
    n, k = len(i), int(hit.sum())
    ok = win >= HIT_M
    occ = np.zeros(land.shape, bool)
    occ[j, i] = True
    r = max(1, int(round(1000 / dx)))
    near = occ.copy()
    for _ in range(r):  # square dilation, r cells (about 1 km)
        p = np.pad(near, 1)
        near = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    near &= land
    b_dom = float(ok[land].mean()) if land.any() else None
    b_near = float(ok[near].mean()) if near.any() else None
    b_dki = float(ok[dki & land].mean()) if (dki & land).any() else None
    rng = np.random.default_rng(seed)
    blk = (j // r) * 100000 + (i // r)
    ub, inv = np.unique(blk, return_inverse=True)
    hits_b, cnt_b = np.bincount(inv, weights=hit.astype(float)), np.bincount(inv)
    bs = []
    for _ in range(n_boot):
        pick = rng.integers(0, len(ub), len(ub))
        bs.append(hits_b[pick].sum() / max(1, cnt_b[pick].sum()))
    ind = dki[j, i]
    pn = binom_p_greater(k, n, b_near) if b_near is not None else None
    pd_ = binom_p_greater(k, n, b_dom) if b_dom is not None else None
    verdict = "too_few" if n < 100 else ("better" if (pn is not None and pn < 0.05 and pd_ is not None and pd_ < 0.05) else "not_better")
    return {
        "hit_rate": k / n if n else None, "n": n, "wilson95": wilson(k, n), "block_bootstrap95": [float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))],
        "random_domain_land": b_dom, "random_near_reports": b_near, "p_vs_domain_land": pd_, "p_vs_near_reports": pn,
        "inside_dki": {"n": int(ind.sum()), "hit_rate": float(hit[ind].mean()) if ind.any() else None, "random_dki": b_dki,
                       "p_vs_dki": binom_p_greater(int(hit[ind].sum()), int(ind.sum()), b_dki) if ind.any() and b_dki is not None else None},
        "verdict": verdict,
        "rule": "verdict 'better' = p < 0.05 against both fair baselines; 'too_few' = fewer than 100 reports (a 10-point gain cannot be told from chance)",
    }


def report_scores(rep, h, summary, land, dki, area=None):
    """Citizen reports against the model (2026-11-13, ADR 0019). A report counts as hit when the model is at least HIT_M deep on LAND
    (river channels and sea excluded: a river always holds water, so counting it made every report next to a river a hit):
    - cell: the land cell under the report;
    - window: the deepest land cell in the 3 x 3 window (about 270 m at 90 m cells; report locations are approximate).
    Random baseline: the hit rate that points placed at random on DKI land would get with the same rule (the share of DKI land
    cells that pass it); skill = (hit - random) / (1 - random), 0 = no better than random, 1 = perfect.
    area: only reports inside this mask count, and the random baseline uses it instead of DKI (micro-drain area check).
    Earlier scores (before 2026-11-13) used the window rule WITH channel cells: kept as legacy_window_with_channels for comparison."""
    x0, y0, dx, nx, ny, tr = grid_of(summary)
    win = land_window_max(h, land)
    inside = land | (h >= 0)  # every cell (only used for the legacy rule's location check)
    legacy, cell, wnd, depths, ii, jj = [], [], [], [], [], []
    for f in rep:
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        p = f.get("properties", {})
        if p.get("disaster_type", "flood") != "flood":
            continue
        x, y = tr.transform(*g["coordinates"][:2])
        i, j = int((x - x0) // dx), int((y0 - y) // dx)
        if not (1 <= i < nx - 1 and 1 <= j < ny - 1) or not inside[j, i] or (area is not None and not area[j, i]):
            continue
        legacy.append(float(h[j - 1 : j + 2, i - 1 : i + 2].max()))
        c = float(h[j, i]) if land[j, i] else 0.0
        w = float(win[j, i])
        cell.append(c); wnd.append(w); ii.append(i); jj.append(j)
        d = (p.get("report_data") or {}).get("flood_depth")
        if isinstance(d, (int, float)) and d > 0:
            depths.append((d / 100.0, c, w))
    n = len(cell)
    res = {"n_reports": n, "rule": f"hit = model max depth >= {HIT_M} m on land (channels and sea excluded)"}
    if not n:
        return res
    cell, wnd, legacy = np.array(cell), np.array(wnd), np.array(legacy)
    dl = (dki if area is None else area) & land
    base_c = float((h[dl] >= HIT_M).mean()) if dl.any() else None
    base_w = float((win[dl] >= HIT_M).mean()) if dl.any() else None
    skill = lambda hit, b: None if b is None or b >= 1 else (hit - b) / (1 - b)
    hc, hw = float((cell >= HIT_M).mean()), float((wnd >= HIT_M).mean())
    res.update({
        "cell": {"hit_rate": hc, "random_hit_rate": base_c, "skill": skill(hc, base_c)},
        "window_3x3_land": {"hit_rate": hw, "random_hit_rate": base_w, "skill": skill(hw, base_w)},
        "legacy_window_with_channels": {"hit_rate": float((legacy >= HIT_M).mean())},
        "hit_rate": hw,  # the headline figure from now on: window on land only
    })
    if area is None:
        res["fair"] = fair_baselines((np.array(ii), np.array(jj)), wnd >= HIT_M, win, land, dki, dx)
    if depths:
        o, mc, mw = np.array(depths).T
        res.update({"n_with_depth": int(len(o)), "observed_median_m": float(np.median(o)),
                    "model_median_m": float(np.median(mw)), "model_median_cell_m": float(np.median(mc)),
                    "depth_bias_m": float((mw - o).mean()), "depth_mae_m": float(np.abs(mw - o).mean()),
                    "depth_rmse_m": float(np.sqrt(((mw - o) ** 2).mean())), "depth_note": "model depth = window_3x3_land value"})
    return res


DIST_CLASSES = [("water", "in a river or water block of the model"), ("le100", "land within 100 m of a river or water block"),
                ("100_500", "land 100-500 m from a river or water block"), ("gt500", "land more than 500 m from a river or water block")]


def distance_to_water(water, dx, cap_m=500.0):
    """Distance (m, cell centre to cell centre) to the nearest water cell, exact up to cap_m, cap_m + 1 beyond (no scipy on the runner)."""
    r = int(cap_m // dx)
    d = np.where(water, 0.0, cap_m + 1).astype(np.float32)
    ny, nx = water.shape
    p = np.pad(water, r)
    for dj in range(-r, r + 1):
        for di in range(-r, r + 1):
            s = dx * float(np.hypot(di, dj))
            if s == 0 or s > cap_m:
                continue
            sh = p[r + dj : r + dj + ny, r + di : r + di + nx]
            np.minimum(d, np.where(sh, s, cap_m + 1), out=d)
    return d


def distance_class_scores(rep, h, summary, land, water, region):
    """Report scores per distance to the nearest river/water block (review 2026-11-20, MT-06): shows WHERE the model misses.
    Per class: number of reports, the share of the run's land/water cells in that class (reports cluster near rivers when this share
    is lower), hit rate with the headline rule (deepest land cell of the 3 x 3 window >= HIT_M), the random hit rate of cells of the
    same class (fair: same distance to a river), 95 % Wilson interval, one-sided binomial p, and median depths where reports give one.
    region = cells that count (inside the run, not sea). Distances on the model grid (cell centres), so at 90 m 'within 100 m' means
    the eight neighbouring cells only (diagonal 127 m falls in 100-500 m)."""
    x0, y0, dx, nx, ny, tr = grid_of(summary)
    win = land_window_max(h, land)
    dist = distance_to_water(water, dx)
    cls = np.full(h.shape, -1, np.int8)
    cls[region & water] = 0
    cls[region & ~water & (dist <= 100)] = 1
    cls[region & ~water & (dist > 100) & (dist <= 500)] = 2
    cls[region & ~water & (dist > 500)] = 3
    inside = land | (h >= 0)
    got = [[] for _ in DIST_CLASSES]
    for f in rep:
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        p = f.get("properties", {})
        if p.get("disaster_type", "flood") != "flood":
            continue
        x, y = tr.transform(*g["coordinates"][:2])
        i, j = int((x - x0) // dx), int((y0 - y) // dx)
        if not (1 <= i < nx - 1 and 1 <= j < ny - 1) or not inside[j, i] or cls[j, i] < 0:
            continue
        d = (p.get("report_data") or {}).get("flood_depth")
        if d is None and isinstance(p.get("depth_cm"), (int, float)):
            d = p["depth_cm"]
        got[cls[j, i]].append((float(win[j, i]), float(d) / 100.0 if isinstance(d, (int, float)) and d > 0 else None))
    ok = win >= HIT_M
    ncell = int((cls >= 0).sum())
    out, ntot = {}, sum(len(g) for g in got)
    for c, (key, label) in enumerate(DIST_CLASSES):
        g = got[c]
        n, k = len(g), sum(1 for w, _ in g if w >= HIT_M)
        sel = cls == c
        base = float(ok[sel].mean()) if sel.any() else None
        dep = [(o, w) for w, o in g if o is not None]
        out[key] = {
            "label": label, "n": n, "share_of_reports": n / ntot if ntot else None,
            "share_of_cells": float(sel.sum() / ncell) if ncell else None,
            "hit_rate": k / n if n else None, "wilson95": wilson(k, n), "random_same_class": base,
            "p_vs_random_same_class": binom_p_greater(k, n, base) if n and base is not None else None,
            "n_with_depth": len(dep),
            "observed_median_m": float(np.median([o for o, _ in dep])) if dep else None,
            "model_median_m": float(np.median([w for _, w in dep])) if dep else None,
        }
    return {"rule": f"hit = deepest land cell of the 3 x 3 window >= {HIT_M} m; random = same rule on all cells of the class",
            "distance": "model grid, cell centre to nearest river/water block (channel flag), exact to 500 m", "n_reports": ntot,
            "classes": out}


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


def rw_place_scores(rw_gpkg: Path, rep, js_gpkg: Path | None, ev: str, h, summary, land):
    import geopandas as gpd
    import pandas as pd
    from rasterio import features as rf
    from rasterio.transform import from_origin

    x0, y0, dx, nx, ny, _ = grid_of(summary)
    rw = gpd.read_file(rw_gpkg, layer="rw").to_crs("EPSG:32748")
    lab = rf.rasterize(((g, int(i)) for g, i in zip(rw.geometry, rw["rw_id"])), out_shape=(ny, nx), transform=from_origin(x0, y0, dx, dx), dtype="int32")
    n = int(rw["rw_id"].max()) + 1
    wet = (h > WET_M) & land
    cnt = np.bincount(lab.ravel(), weights=land.ravel(), minlength=n)
    wc = np.bincount(lab.ravel(), weights=wet.ravel(), minlength=n)
    ids = rw["rw_id"].to_numpy()
    keep = cnt[ids] >= 3
    share = np.where(cnt[ids] > 0, wc[ids] / np.maximum(cnt[ids], 1), 0)
    pts = [f["geometry"]["coordinates"][:2] for f in rep if (f.get("geometry") or {}).get("type") == "Point" and (f.get("properties") or {}).get("disaster_type", "flood") == "flood"]
    by_rep = set()
    if pts:
        pg = gpd.GeoDataFrame(geometry=gpd.points_from_xy([p[0] for p in pts], [p[1] for p in pts]), crs="EPSG:4326").to_crs("EPSG:32748")
        by_rep = set(gpd.sjoin(pg, rw[["rw_id", "geometry"]], predicate="within")["rw_id"].tolist())
    by_gen = set()
    if js_gpkg is not None and js_gpkg.exists():
        e = next(e for e in json.loads((Path(__file__).parent / "events.json").read_text())["events"] if e["id"] == ev)
        t0, t1 = pd.Timestamp(e["utc"][0], tz="UTC") - pd.Timedelta(days=1), pd.Timestamp(e["utc"][1], tz="UTC") + pd.Timedelta(days=1)
        g = gpd.read_file(js_gpkg, layer="genangan")
        tg = pd.to_datetime(g["TGL"], unit="ms", utc=True)
        g = g[(tg >= t0) & (tg <= t1)].to_crs("EPSG:32748")
        if len(g):
            by_gen = set(gpd.sjoin(rw[["rw_id", "geometry"]], g[["geometry"]], predicate="intersects")["rw_id"].tolist())
    out = {"source": "RW polygons: Shabrina et al. (2026), Zenodo 19456870, CC BY 4.0", "n_rw": int(keep.sum()), "rw_share_threshold": RW_SHARE,
           "note": "RW without a record = not recorded (reports are incomplete): false_alarm_ratio is an upper bound"}
    for name, obs_set in (("reports_or_dsda", by_rep | by_gen), ("reports", by_rep), ("dsda", by_gen)):
        obs = np.isin(ids, list(obs_set))[keep]
        mod = (share >= RW_SHARE)[keep]
        hits, fa, miss = int((mod & obs).sum()), int((mod & ~obs).sum()), int((~mod & obs).sum())
        out[name] = {"n_observed": int(obs.sum()), "n_model": int(mod.sum()), "hits": hits, "hit_rate": hits / max(1, hits + miss),
                     "false_alarm_ratio": fa / max(1, hits + fa), "csi": hits / max(1, hits + fa + miss), "auc": auc(share[keep], obs)}
    return out


def dki_mask(summary):
    from rasterio import features as rf
    from rasterio.transform import from_origin
    import shapely
    from shapely.geometry import shape

    x0, y0, dx, nx, ny, tr = grid_of(summary)
    dom = json.loads((Path(__file__).parents[2] / "data/regions/jakarta_domain.geojson").read_text())
    adm = [f for f in dom["features"] if f["properties"].get("role") == "admin"][0]
    g = shapely.transform(shape(adm["geometry"]), lambda xy: np.column_stack(tr.transform(xy[:, 0], xy[:, 1])))
    return rf.rasterize([(g, 1)], out_shape=(ny, nx), transform=from_origin(x0, y0, dx, dx), dtype="uint8").astype(bool)


def land_of(share_file: Path, m, inside):
    """Land mask and land weight per cell. Since 2026-11-20 run_event writes hmax as depth above the LAND level and a land share per
    cell (landshare.u8, x 255): a channel block of a 60/90 m run holding at least half land counts as land for report hits, and every
    channel block counts its land share for areas. Older runs (no file): channel cells are not land, as before."""
    ch = (m & 4).astype(bool)
    if share_file.exists():
        sh = np.frombuffer(gzip.decompress(share_file.read_bytes()), np.uint8).reshape(m.shape) / 255.0
        return inside & (~ch | (sh >= 0.5)), np.where(inside, np.where(ch, sh, 1.0), 0.0)
    land = inside & ~ch
    return land, land.astype(float)


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
    w = land if land.dtype != bool else land.astype(float)
    return float((w * ((h > WET_M) & inside)).sum() * dx * dx / 1e6), float((w * inside).sum() * dx * dx / 1e6)


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
        land, lw = land_of(rundir / sp.name.replace("_summary.json", "_landshare.u8.gz"), m, inside)
        r = {"run": sp.name.replace("_summary.json", ""), "drain_mm_h": s["drain_mm_h"], "rain": s["rain"], "rain_scale": s.get("rain_scale", 1), "terrain_year": s.get("terrain_year"), "pumps": s.get("pumps"), "pump_m3s": s.get("pump_m3s"), "amc": s.get("amc", 2), "infiltration": s.get("infiltration", True), "sens": s.get("sens", "none"),
             "mean_rain_mm": s["mean_rain_mm"], "flooded_km2": s["flooded_km2_gt015_outside_channels"], "mass_error": s["massError"],
             "reports": report_scores(rep, h, s, land, dki_mask(s)),
             "reports_by_distance": distance_class_scores(rep, h, s, land, (m & 4).astype(bool) & inside, inside)}
        r["micro"] = s.get("micro", False)
        served = (m & 8).astype(bool)
        if served.any():  # land served by South Jakarta micro drains (pipeline/micro_drains.py), scored on its own
            r["reports_micro_area"] = report_scores(rep, h, s, land, dki_mask(s), area=served)
            r["micro_area_flooded_km2"] = round(float(((h >= 0.15) & land & served).sum() * s["dx"] ** 2 / 1e6), 2)
        if areas:
            r["rw"] = rw_scores(areas, flooded, h, s, land)
        r["dki_flooded_km2"], r["dki_land_km2"] = dki_flooded_km2(h, s, lw)
        if len(sys.argv) > 5 and Path(sys.argv[5]).exists():
            try:
                r["genangan_dsda"] = genangan_scores(Path(sys.argv[5]), ev, h, s, land)
            except Exception as ex:  # a missing layer must not lose the other scores
                r["genangan_dsda"] = {"error": f"{type(ex).__name__}: {ex}"[:200]}
        if len(sys.argv) > 6 and Path(sys.argv[6]).exists():
            try:
                js = Path(sys.argv[5]) if len(sys.argv) > 5 else None
                r["rw_places"] = rw_place_scores(Path(sys.argv[6]), rep, js, ev, h, s, land)
            except Exception as ex:
                r["rw_places"] = {"error": f"{type(ex).__name__}: {ex}"[:200]}
        results.append(r)
    reported = next((e.get("reported") for e in json.loads((Path(__file__).parent / "events.json").read_text())["events"] if e["id"] == ev), None)
    out = {"event": ev, "source": "PetaBencana.id flood reports and flooded-area archive (aggregate scores only)", "reported": reported,
           "n_flooded_area_records": len(flooded), "rw_shapes": len(areas), "results": results}
    outp.write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
