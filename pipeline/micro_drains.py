"""Micro drains (saluran mikro) with recorded width and depth: map file and drain sink per model cell.

Source: Dinas Sumber Daya Air DKI Jakarta, "Saluran Mikro" (Jakarta Satu update 2024, cut 3 November 2026), Jakarta Selatan;
shapefile supplied by the project owner on 2026-11-13. Fields used: TOPONIMI, KELURAHAN, KECAMATAN, LEBAR (m), KEDALAMAN (m),
JNSSLRN (open / closed), KONSTRUKSI, KONDISI, HILIR. Records marked "PENGHAPUSAN 2024" (removed in 2024) are left out.
Fields not published: SEGMEN (house numbers), BGNLIAR (buildings over the drain), KODSLRN, LTKJLN, STATUS.

Two steps:
  convert  owner shapefile -> data/drains/saluran_mikro_jaksel.geojson (WGS84, lines simplified by 0.5 m, 6 decimals)
  sink     the GeoJSON + an engine pack (z, flags) -> sink rate per 30 m cell (m/s), used by engine_pack.py (array "mdr")

Sink rule (data/methods/methods.md §4, "Saluran mikro"):
  1. Full-flow capacity of each drain with a size (Manning): Q = A R^(2/3) S^(1/2) / n, rectangle w x d; open drains wetted
     perimeter w + 2d, closed drains (box) 2(w + d); n from the construction (Chow 1959, Table 5-6); S = slope of the 30 m
     terrain smoothed over 270 m at the drain, kept within 0.1-2 % (the 30 m terrain cannot resolve the slope of one street drain).
  2. Drains that touch each other (an end within JOIN_M of another drain) form one network.
  3. A network empties into the model's rivers and carved DSDA drains through its outlets: drains with a point within one cell of
     a channel cell. Network capacity = sum of its outlet capacities; a network with no outlet uses its largest drain.
  4. Every land cell within SERVE_M of a drain with a size is served by the network of its nearest drain.
     Sink rate of the cell = network capacity / network served area (rational method read backwards: the steady rain the network
     can carry away with all the rain reaching it; Chow, Maidment and Mays 1988).
  The water a drain takes leaves the model (it is not added to the river it empties into): a lower bound on river water.
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
from pathlib import Path

import numpy as np

SOURCE = ("Dinas Sumber Daya Air Provinsi DKI Jakarta, Saluran Mikro Jakarta Selatan (Jakarta Satu update 2024, cut 3 November 2026); "
          "file supplied by the project owner 2026-11-13")
N_BY_CONSTRUCTION = {  # Chow (1959) Table 5-6, normal values for lined channels
    "beton u-ditch": 0.013,  # precast concrete, smooth forms
    "cor beton": 0.015,  # cast concrete, unfinished / float finish
    "turap batu bata/hebel": 0.015,  # brick in cement mortar
    "turap batu kali": 0.025,  # cemented rubble masonry
}
N_OTHER = 0.020  # construction missing or "Lainnya": between concrete and rubble masonry
SLOPE_MIN, SLOPE_MAX = 0.001, 0.02
SMOOTH_CELLS = 9  # 270 m
JOIN_M = 10.0
SERVE_M = 100.0


def num(v) -> float:
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return float("nan")


def clean(v) -> str:
    s = str(v or "").strip()
    return "" if s.lower() in ("", "0", "-", "tidak diketahui") else s


def convert(shp: Path, out: Path) -> dict:
    import geopandas as gpd

    g = gpd.read_file(shp)
    removed = g["KETERANGAN"].fillna("").str.upper().str.contains("PENGHAPUSAN")
    g = g[~removed & g.geometry.notna() & ~g.geometry.is_empty].copy()
    g["geometry"] = g.geometry.simplify(0.5)
    g = g.to_crs("EPSG:4326")
    feats = []
    for _, r in g.iterrows():
        w, d = num(r["LEBAR"]), num(r["KEDALAMAN"])
        props = {"name": clean(r["TOPONIMI"]), "kel": clean(r["KELURAHAN"]), "kec": clean(r["KECAMATAN"]),
                 "w_m": round(w, 2) if w > 0 else None, "d_m": round(d, 2) if d > 0 else None,
                 "jenis": clean(r["JNSSLRN"]), "konstruksi": clean(r["KONSTRUKSI"]), "kondisi": clean(r["KONDISI"]), "hilir": clean(r["HILIR"])}
        geom = json.loads(gpd.GeoSeries([r.geometry]).to_json())["features"][0]["geometry"]
        feats.append({"type": "Feature", "properties": props, "geometry": round_coords(geom)})
    fc = {"type": "FeatureCollection", "name": "saluran_mikro_jaksel", "source": SOURCE,
          "fields_left_out": "SEGMEN (house numbers), BGNLIAR, KODSLRN, LTKJLN, STATUS; records marked PENGHAPUSAN 2024", "features": feats}
    out.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")))
    sized = sum(1 for f in feats if f["properties"]["w_m"] and f["properties"]["d_m"])
    return {"records_in": int(len(removed)), "removed_2024": int(removed.sum()), "written": len(feats), "with_size": sized, "bytes": out.stat().st_size}


def round_coords(geom: dict) -> dict:
    def r(c):
        return [round(c[0], 6), round(c[1], 6)] if isinstance(c[0], (int, float)) else [r(x) for x in c]
    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def manning_n(konstruksi: str) -> float:
    return N_BY_CONSTRUCTION.get(konstruksi.strip().lower(), N_OTHER)


def capacity(w: float, d: float, closed: bool, n: float, s: float) -> float:
    """Full-flow capacity (m3/s) of a rectangular drain w x d (Manning)."""
    a = w * d
    p = 2 * (w + d) if closed else w + 2 * d
    return a * (a / p) ** (2 / 3) * s ** 0.5 / n


def lines_utm(fc: dict):
    """Yield (properties, Nx2 array of UTM 48S points) per line part."""
    from pyproj import Transformer

    tf = Transformer.from_crs("EPSG:4326", "EPSG:32748", always_xy=True)
    for f in fc["features"]:
        g = f["geometry"]
        parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for part in parts:
            if len(part) < 2:
                continue
            a = np.asarray(part, np.float64)
            x, y = tf.transform(a[:, 0], a[:, 1])
            yield f["properties"], np.column_stack([x, y])


def sink(fc: dict, z: np.ndarray, chan: np.ndarray, sea: np.ndarray, origin: tuple[float, float], dx: float) -> tuple[np.ndarray, dict]:
    """Sink rate (m/s) per cell of the model grid (rows from the north edge), and a summary."""
    from scipy.ndimage import uniform_filter
    from scipy.spatial import cKDTree

    ny, nx = z.shape
    x0, y0 = origin
    land = ~chan & ~sea
    zs = uniform_filter(z, SMOOTH_CELLS, mode="nearest")
    gy, gx = np.gradient(zs, dx)
    slope = np.clip(np.hypot(gx, gy), SLOPE_MIN, SLOPE_MAX)

    def cell(px, py):
        j = np.clip(((px - x0) // dx).astype(int), 0, nx - 1)
        i = np.clip(((y0 - py) // dx).astype(int), 0, ny - 1)
        return i, j

    segs, caps, pts, owner = [], [], [], []
    skipped = 0
    for props, xy in lines_utm(fc):
        w, d = props.get("w_m") or 0, props.get("d_m") or 0
        if not (w > 0 and d > 0):
            skipped += 1
            continue
        mid = xy[len(xy) // 2]
        i, j = cell(np.array([mid[0]]), np.array([mid[1]]))
        closed = "tertutup" in (props.get("jenis") or "").lower()
        k = len(segs)
        segs.append(xy)
        caps.append(capacity(w, d, closed, manning_n(props.get("konstruksi") or ""), float(slope[i[0], j[0]])))
        # densify to about 10 m so nearest-drain search and outlet test see the whole line
        for a, b in zip(xy[:-1], xy[1:]):
            m = max(1, int(np.hypot(*(b - a)) // 10))
            t = np.linspace(0, 1, m, endpoint=False)[:, None]
            pts.append(a + t * (b - a))
            owner.append(np.full(m, k))
        pts.append(xy[-1:])
        owner.append(np.array([k]))
    caps = np.asarray(caps)
    P = np.vstack(pts)
    O = np.concatenate(owner)
    tree = cKDTree(P)
    # 2. networks: union-find over drains whose end lies within JOIN_M of another drain's point
    parent = np.arange(len(segs))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for k, xy in enumerate(segs):
        for e in (xy[0], xy[-1]):
            for q in tree.query_ball_point(e, JOIN_M):
                o = O[q]
                if o != k:
                    ra, rb = find(k), find(o)
                    if ra != rb:
                        parent[ra] = rb
    net = np.array([find(k) for k in range(len(segs))])
    # 3. outlets: a drain point inside or next to a channel cell
    i, j = cell(P[:, 0], P[:, 1])
    near_chan = np.zeros_like(chan)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            near_chan |= np.roll(np.roll(chan, di, 0), dj, 1)
    is_out = np.zeros(len(segs), bool)
    is_out[np.unique(O[near_chan[i, j]])] = True
    nets, inv = np.unique(net, return_inverse=True)
    qnet = np.zeros(len(nets))
    np.add.at(qnet, inv[is_out], caps[is_out])
    no_out = qnet == 0
    qmax = np.zeros(len(nets))
    np.maximum.at(qmax, inv, caps)
    qnet[no_out] = qmax[no_out]
    # 4. served land cells: nearest drain within SERVE_M
    ii, jj = np.nonzero(land)
    cx, cy = x0 + (jj + 0.5) * dx, y0 - (ii + 0.5) * dx
    dist, q = tree.query(np.column_stack([cx, cy]), distance_upper_bound=SERVE_M)
    ok = np.isfinite(dist)
    cnet = inv[O[q[ok]]]
    area = np.bincount(cnet, minlength=len(nets)) * dx * dx
    rate_net = np.where(area > 0, qnet / np.maximum(area, 1), 0)
    rate = np.zeros(z.shape, np.float64)
    rate[ii[ok], jj[ok]] = rate_net[cnet]
    mm_h = rate[rate > 0] * 3.6e6
    sizes = np.bincount(inv)
    info = {
        "source": SOURCE, "drains_with_size": len(segs), "drains_without_size": skipped, "networks": int(len(nets)),
        "networks_with_outlet": int((~no_out).sum()), "largest_network_drains": int(sizes.max()),
        "outlet_drains": int(is_out.sum()), "capacity_outlets_m3s": round(float(caps[is_out].sum()), 1),
        "capacity_m3s_p10_50_90": [round(float(v), 3) for v in np.percentile(caps, [10, 50, 90])],
        "served_km2": round(float(ok.sum() * dx * dx / 1e6), 1),
        "rate_mm_h_p10_50_90": [round(float(v), 1) for v in np.percentile(mm_h, [10, 50, 90])] if mm_h.size else None,
        "rate_mm_h_area_mean": round(float(mm_h.mean()), 1) if mm_h.size else None,
        "rule": (f"Manning full flow (n by construction, slope of 270 m-smoothed terrain within {SLOPE_MIN:.1%}-{SLOPE_MAX:.0%}); "
                 f"drains joined within {JOIN_M:.0f} m form networks; network capacity = sum of drains touching a channel cell "
                 f"(largest drain when none); land cells within {SERVE_M:.0f} m served by the nearest drain's network; "
                 "sink = network capacity / served area; drained water leaves the model"),
    }
    return rate, info


def read_engine_pack(path: Path) -> tuple[dict, dict]:
    raw = gzip.open(path, "rb").read()
    n = int.from_bytes(raw[:4], "little")
    h = json.loads(raw[4:4 + n])
    base = 4 + n
    arr = {a["name"]: np.frombuffer(raw, a["dtype"], a["length"], base + a["offset"]) for a in h["arrays"]}
    return h, arr


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("convert")
    c.add_argument("shp", type=Path)
    c.add_argument("out", type=Path)
    s = sub.add_parser("sink", help="summary of the sink on an existing engine pack (engine_pack.py writes the array)")
    s.add_argument("geojson", type=Path)
    s.add_argument("engine_pack", type=Path)
    s.add_argument("--save", type=Path, default=None, help="write the rate (0.01 mm/h, uint16) as .npy")
    a = ap.parse_args()
    if a.cmd == "convert":
        print(json.dumps(convert(a.shp, a.out), indent=1))
        return
    h, arr = read_engine_pack(a.engine_pack)
    g = h["grid"]
    shape = (g["ny"], g["nx"])
    z = arr["z"].reshape(shape) / 100.0 - 20.0
    fl = arr["flags"].reshape(shape)
    rate, info = sink(json.loads(a.geojson.read_text()), z, (fl & 1) > 0, (fl & 2) > 0, tuple(g["origin"]), g["dx"])
    if a.save:
        np.save(a.save, np.clip(np.round(rate * 3.6e6 * 100), 0, 65535).astype(np.uint16))
    print(json.dumps(info, indent=1))


if __name__ == "__main__":
    main()
