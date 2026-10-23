"""Indonesian RBI map-sheet numbering (Nomor Lembar Peta), used to name DEMNAS tiles.

Scheme (BIG): origin 90°E, 15°S.
  1:250k  1.5° lon × 1° lat, code CCRR (column east, row north, both from 01).
  1:100k  30' sheets, 3 cols × 2 rows, numbered 1..6 from the SW corner, west→east, then north.
  1:50k   15' sheets, 2 × 2 inside a 1:100k, numbered 1..4 the same way.
  1:25k   7.5' sheets, 2 × 2 inside a 1:50k, numbered 1..4 the same way.
Checked against known sheets: Jakarta 1209-4 / 1210-1, Bogor 1:25k 1209-143,
Bandung 1:25k 1209-311..314 (see research/phase0-datasets.md).
"""
from __future__ import annotations

import math

_EPS = 1e-9


def _sub(lon: float, lat: float, lon0: float, lat0: float, size: float, ncols: int) -> tuple[int, float, float]:
    c = int(math.floor((lon - lon0) / size + _EPS))
    r = int(math.floor((lat - lat0) / size + _EPS))
    return r * ncols + c + 1, lon0 + c * size, lat0 + r * size


def sheet_code(lon: float, lat: float, scale: int = 50_000) -> str:
    """RBI sheet code containing the point (lon, lat) at the given scale."""
    col = int(math.floor((lon - 90.0) / 1.5 + _EPS)) + 1
    row = int(math.floor(lat + 15.0 + _EPS)) + 1
    code = f"{col:02d}{row:02d}"
    if scale == 250_000:
        return code
    lon0, lat0 = 90.0 + (col - 1) * 1.5, -15.0 + (row - 1)
    n, lon0, lat0 = _sub(lon, lat, lon0, lat0, 0.5, 3)
    code += f"-{n}"
    if scale == 100_000:
        return code
    n, lon0, lat0 = _sub(lon, lat, lon0, lat0, 0.25, 2)
    code += str(n)
    if scale == 50_000:
        return code
    n, _, _ = _sub(lon, lat, lon0, lat0, 0.125, 2)
    if scale == 25_000:
        return code + str(n)
    raise ValueError(f"unsupported scale {scale}")


SIZE = {250_000: (1.5, 1.0), 100_000: (0.5, 0.5), 50_000: (0.25, 0.25), 25_000: (0.125, 0.125)}


def sheets_in_bbox(bbox: list[float], scale: int = 50_000) -> list[dict]:
    """All sheets intersecting bbox [w, s, e, n], with their own bounds."""
    w, s, e, n = bbox
    dx, dy = SIZE[scale]
    out = []
    y = math.floor(s / dy) * dy
    while y < n - _EPS:
        x = math.floor(w / dx) * dx
        while x < e - _EPS:
            cx, cy = x + dx / 2, y + dy / 2
            out.append({"code": sheet_code(cx, cy, scale), "bounds": [round(x, 6), round(y, 6), round(x + dx, 6), round(y + dy, 6)]})
            x += dx
        y += dy
    return out
