"""Region-wide 30 m runs in tiles (Next steps 00(3)): plan the tiles and stitch their results into one grid for compare.py.

  python3 verification/observed/mosaic_tiles.py plan '<tiles json>'          -> JSON list "idx:W,S,E,N" (stdlib only; validate.yml prep)
  python verification/observed/mosaic_tiles.py stitch <release dir> '<tiles json>'

tiles json: {"box": [W, S, E, N], "n": [columns, rows], "buffer_km": B}. The box is cut into equal cores in longitude/latitude; each
tile runs as a box run of the app (run_event.ts --box core + B km on every side, upstream rivers entering the tile as inflows, free
outflow at its edge). Stitching keeps, for every 30 m cell, the tile whose CORE holds the cell centre, so tile edges (where water
can leave freely or arrive late) never reach the scores when B is larger than the distance water travels along a tile edge.
Tile files in the release are named tile<idx>-<run name>_{hmax.f32.gz, mask.u8.gz, landshare.u8.gz, summary.json}; the stitched run
is written as <run name>_tiles<c>x<r>_* so compare.py scores it like a whole-region run (cells outside every core are inactive).
"""
import gzip
import json
import math
import re
import sys
from pathlib import Path


def plan(spec: dict) -> list[str]:
    W, S, E, N = (float(v) for v in spec["box"])
    nc, nr = (int(v) for v in spec["n"])
    b = float(spec.get("buffer_km", 2.0))
    assert 105.0 < W < E < 108.0 and -7.5 < S < N < -5.5 and 1 <= nc <= 6 and 1 <= nr <= 6 and nc * nr <= 25 and 0 <= b <= 5
    lat0 = (S + N) / 2
    bx, by = b / (111.32 * math.cos(math.radians(lat0))), b / 110.57
    out = []
    for r in range(nr):
        for c in range(nc):
            w, e = W + (E - W) * c / nc, W + (E - W) * (c + 1) / nc
            s, n = N - (N - S) * (r + 1) / nr, N - (N - S) * r / nr
            out.append(f"{r * nc + c}:{w - bx:.5f},{s - by:.5f},{e + bx:.5f},{n + by:.5f}")
    return out


def cores(spec: dict):
    W, S, E, N = (float(v) for v in spec["box"])
    nc, nr = (int(v) for v in spec["n"])
    return nc, nr, [(W + (E - W) * c / nc, N - (N - S) * (r + 1) / nr, W + (E - W) * (c + 1) / nc, N - (N - S) * r / nr)
                    for r in range(nr) for c in range(nc)]


def stitch(rdir: Path, spec: dict):
    import numpy as np
    from pyproj import Transformer
    nc, nr, cb = cores(spec)
    groups = {}
    for f in rdir.glob("tile*-*_summary.json"):
        m = re.fullmatch(r"tile(\d+)-(.+)_summary\.json", f.name)
        if m:
            groups.setdefault(m.group(2), {})[int(m.group(1))] = f
    for name, tiles in groups.items():
        if len(tiles) != nc * nr:
            print(f"::warning::{name}: {len(tiles)} of {nc * nr} tiles; not stitched")
            continue
        S = {i: json.loads(p.read_text()) for i, p in tiles.items()}
        dx = S[0]["dx"]
        zone = S[0]["utm"]["zone"]
        x0 = min(s["utm"]["x0"] for s in S.values())
        y0 = max(s["utm"]["y0"] for s in S.values())
        nx = int(round((max(s["utm"]["x0"] + s["nx"] * dx for s in S.values()) - x0) / dx))
        ny = int(round((y0 - min(s["utm"]["y0"] - s["ny"] * dx for s in S.values())) / dx))
        H = np.zeros((ny, nx), np.float32)
        M = np.zeros((ny, nx), np.uint8)
        L = np.full((ny, nx), 255, np.uint8)
        O = np.full((ny, nx), -1, np.int16)  # owner tile of each cell
        tr = Transformer.from_crs(f"EPSG:327{zone}", "EPSG:4326", always_xy=True)
        X, Y = np.meshgrid(x0 + (np.arange(nx) + 0.5) * dx, y0 - (np.arange(ny) + 0.5) * dx)
        lon, lat = tr.transform(X, Y)
        loaded = {}
        for i, s in S.items():
            w, so, e, n = cb[i]
            sel = (lon >= w) & (lon < e) & (lat >= so) & (lat < n)
            base = rdir / tiles[i].name.replace("_summary.json", "")
            sh = (s["ny"], s["nx"])
            h = np.frombuffer(gzip.decompress(Path(f"{base}_hmax.f32.gz").read_bytes()), np.float32).reshape(sh)
            m = np.frombuffer(gzip.decompress(Path(f"{base}_mask.u8.gz").read_bytes()), np.uint8).reshape(sh)
            ls = np.frombuffer(gzip.decompress(Path(f"{base}_landshare.u8.gz").read_bytes()), np.uint8).reshape(sh)
            oi = int(round((s["utm"]["x0"] - x0) / dx))
            oj = int(round((y0 - s["utm"]["y0"]) / dx))
            jj, ii = np.nonzero(sel)
            ti, tj = ii - oi, jj - oj
            ok = (ti >= 0) & (ti < s["nx"]) & (tj >= 0) & (tj < s["ny"])
            assert ok.mean() > 0.999, f"tile {i} does not cover its core"
            O[jj[ok], ii[ok]] = i
            loaded[i] = (oi, oj, h)
            H[jj[ok], ii[ok]] = h[tj[ok], ti[ok]]
            M[jj[ok], ii[ok]] = m[tj[ok], ti[ok]]
            L[jj[ok], ii[ok]] = ls[tj[ok], ti[ok]]
        # seam check: cells inside a neighbour's core that a tile also covers with its buffer; the owner's value is the one kept
        agree, diffs = [], []
        for i, (oi, oj, h) in loaded.items():
            sub = O[oj:oj + h.shape[0], oi:oi + h.shape[1]]
            hs = H[oj:oj + h.shape[0], oi:oi + h.shape[1]]
            hh = h[:sub.shape[0], :sub.shape[1]]
            other = (sub >= 0) & (sub != i)
            a1, a2 = hh[other] >= 0.1, hs[other] >= 0.1
            agree.append((a1 == a2).sum()); diffs.append(np.abs(hh[other] - hs[other])[a1 | a2])
            agree[-1] = (agree[-1], other.sum())
        d = np.concatenate(diffs) if diffs else np.zeros(0)
        seam = {"cells": int(sum(n for _, n in agree)), "same_wet_dry_share": float(sum(a for a, _ in agree) / max(1, sum(n for _, n in agree))),
                "median_abs_diff_m_where_wet": float(np.median(d)) if len(d) else None,
                "about": "cells inside a neighbouring tile's core, as computed by the tile that covers them with its buffer vs the owner tile; threshold 0.1 m"}
        print("seam", seam)
        out = dict(S[0])
        cells = {i: s["nx"] * s["ny"] for i, s in S.items()}
        out.update({"nx": nx, "ny": ny, "utm": {**S[0]["utm"], "x0": x0, "y0": y0}, "massError": max(abs(s["massError"]) for s in S.values()),
                    "mean_rain_mm": sum(s["mean_rain_mm"] * cells[i] for i, s in S.items()) / sum(cells.values()),
                    "wall_s": max(s["wall_s"] for s in S.values()), "tiles": {**spec, "files": len(S), "rule": "each cell from the tile whose core holds its centre", "seam": seam},
                    "flooded_km2_gt015_outside_channels": None, "inflows": [], "corners": None})
        tag = f"{name}_tiles{nc}x{nr}"
        (rdir / f"{tag}_hmax.f32.gz").write_bytes(gzip.compress(H.tobytes()))
        (rdir / f"{tag}_mask.u8.gz").write_bytes(gzip.compress(M.tobytes()))
        (rdir / f"{tag}_landshare.u8.gz").write_bytes(gzip.compress(L.tobytes()))
        (rdir / f"{tag}_summary.json").write_text(json.dumps(out, indent=1))
        print("stitched", tag, nx, "x", ny)


if __name__ == "__main__":
    if sys.argv[1] == "plan":
        print(json.dumps(plan(json.loads(sys.argv[2]))))
    elif sys.argv[1] == "stitch":
        stitch(Path(sys.argv[2]), json.loads(sys.argv[3]))
