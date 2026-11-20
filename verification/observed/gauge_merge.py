"""Gauge-adjusted IMERG rain for an observed flood (satellite timing, gauge totals).

  python verification/observed/gauge_merge.py <rain_imerg.json> <event id> <out rain json> [--L 10] [--report out.json] [--extra extra_gauges.json]

Method (a local multiplicative bias correction, the common satellite-gauge merging step; e.g. Vila et al. 2009 for the ratio form,
Shepard IDW for the spreading):
 1. Background: IMERG hourly rain (0.1 degree points) interpolated bilinearly to a 0.02 degree grid (no blocky 11 km zones).
 2. Each gauge with published coordinates (data/rain/gauges_events.json, plus --extra): gauge total G over its 07-07 WIB days that
    overlap the IMERG window; IMERG total S at the gauge over the same hours (only the overlap; hours before the IMERG window are
    missing in S, so G/S is too high there: the share of missing hours is reported per gauge).
 3. r = G / S clipped to [0.25, 4]; ln r spread by inverse distance weighting with a weight for "no change" (ln r = 0) of 1/L^2:
       ln r(x) = sum_i w_i ln r_i / (sum_i w_i + 1/L^2),   w_i = 1 / (d_i^2 + 1 km^2)
    so the correction fades to IMERG as is about L km away from every gauge.
 4. Hourly rain = background * r(x): IMERG keeps the timing, the gauges set the amount.
Check: leave one gauge out, predict its total from the others, compare with IMERG as is (report: mean absolute error, bias).
Writes the same point format as fetch.py (lon, lat, time, mm), so run_event.ts reads it unchanged.
"""
import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STEP = 0.02


def load_imerg(path: Path):
    d = json.loads(path.read_text())
    pts = d["points"]
    lons, lats = sorted({p["lon"] for p in pts}), sorted({p["lat"] for p in pts})
    times = pts[0]["time"]
    by = {(p["lon"], p["lat"]): p for p in pts}
    assert len(by) == len(lons) * len(lats) and all(p["time"] == times for p in pts), "IMERG points are not a full grid with one time axis"
    grid = [[[float(x or 0.0) for x in by[(lo, la)]["mm"]] for lo in lons] for la in lats]  # [lat][lon][hour]
    return d, lons, lats, times, grid


def bilinear(lons, lats, grid, lon, lat):
    """Hourly series at lon/lat (clamped to the grid)."""
    def pos(v, arr):
        if v <= arr[0]:
            return 0, 0.0
        if v >= arr[-1]:
            return len(arr) - 2, 1.0
        i = max(k for k in range(len(arr) - 1) if arr[k] <= v)
        return i, (v - arr[i]) / (arr[i + 1] - arr[i])
    i, fx = pos(lon, lons)
    j, fy = pos(lat, lats)
    a, b, c, e = grid[j][i], grid[j][i + 1], grid[j + 1][i], grid[j + 1][i + 1]
    return [(1 - fy) * ((1 - fx) * a[h] + fx * b[h]) + fy * ((1 - fx) * c[h] + fx * e[h]) for h in range(len(a))]


def km(lon1, lat1, lon2, lat2):
    return 111.32 * math.hypot((lon1 - lon2) * math.cos(math.radians((lat1 + lat2) / 2)), lat1 - lat2)


def hour_ends(times):
    return [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]  # value at T = rain of the hour ending at T


def gauge_totals(g, ends, series):
    """Gauge total over its days that overlap the IMERG window, IMERG total over the overlapping hours, share of gauge hours missing."""
    G = S = 0.0
    used, missing = [], 0
    for day, mm in g["days"].items():
        if mm is None:
            continue
        d1 = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)  # 07:00 WIB reading = 00:00 UTC
        d0 = d1 - timedelta(days=1)
        hrs = [h for h, t in enumerate(ends) if d0 < t <= d1]
        if len(hrs) < 18:  # a day mostly outside the IMERG window would set the ratio from hours IMERG does not have
            continue
        G += mm
        S += sum(series[h] for h in hrs)
        used.append(day)
        missing += 24 - len(hrs)
    return G, S, used, missing / (24 * len(used)) if used else 1.0


def field(gs, lon, lat, L, skip=None):
    num = den = 0.0
    for k, g in enumerate(gs):
        if k == skip:
            continue
        w = 1.0 / (km(lon, lat, g["lon"], g["lat"]) ** 2 + 1.0)
        num += w * g["lnr"]
        den += w
    return math.exp(num / (den + 1.0 / (L * L)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("imerg"), ap.add_argument("event"), ap.add_argument("out")
    ap.add_argument("--L", type=float, default=10.0)
    ap.add_argument("--mode", choices=("local", "mean"), default="local", help="local: ratio spread by distance; mean: one factor sum(G)/sum(S) everywhere")
    ap.add_argument("--report")
    ap.add_argument("--extra", help="more gauges in the same format (list under events.<id>.gauges)")
    a = ap.parse_args()
    d, lons, lats, times, grid = load_imerg(Path(a.imerg))
    ends = hour_ends(times)
    src = json.loads((ROOT / "data/rain/gauges_events.json").read_text())
    gauges = list(src["events"][a.event]["gauges"])
    if a.extra:
        gauges += json.loads(Path(a.extra).read_text())["events"].get(a.event, {}).get("gauges", [])
    gs, kept = [], []
    for g in gauges:  # the same gauge in two sources (within 1 km): the first listed is kept (published event list before the West Java set)
        if g.get("lat") is not None and any(km(g["lon"], g["lat"], k["lon"], k["lat"]) < 1.0 for k in kept):
            continue
        if g.get("lat") is not None:
            kept.append(g)
    for g in kept:
        if g.get("lat") is None or not (lons[0] - 0.05 <= g["lon"] <= lons[-1] + 0.05 and lats[0] - 0.05 <= g["lat"] <= lats[-1] + 0.05):
            continue
        G, S, used, miss = gauge_totals(g, ends, bilinear(lons, lats, grid, g["lon"], g["lat"]))
        if not used or miss > 0.25 or (G < 5 and S < 5):
            continue
        r = min(4.0, max(0.25, G / max(S, 1.0)))
        gs.append({"name": g["name"], "lon": g["lon"], "lat": g["lat"], "source": g.get("source"), "days": used,
                   "gauge_mm": round(G, 1), "imerg_mm": round(S, 1), "ratio": round(r, 3), "lnr": math.log(r), "missing_hours_share": round(miss, 2)})
    # leave-one-out check, for several fade distances (the chosen one is --L)
    loo = {}
    for L in sorted({5.0, 10.0, 20.0, a.L}):
        e_m, e_0 = [], []
        for k, g in enumerate(gs):
            pred = g["imerg_mm"] * field(gs, g["lon"], g["lat"], L, skip=k)
            e_m.append(pred - g["gauge_mm"])
            e_0.append(g["imerg_mm"] - g["gauge_mm"])
        n = max(1, len(gs))
        loo[str(L)] = {"n": len(gs), "mae_adjusted_mm": round(sum(map(abs, e_m)) / n, 1), "bias_adjusted_mm": round(sum(e_m) / n, 1),
                       "mae_imerg_mm": round(sum(map(abs, e_0)) / n, 1), "bias_imerg_mm": round(sum(e_0) / n, 1)}
    # one factor for the whole area (mean-field bias), with its own leave-one-out check
    sg, ss = sum(g["gauge_mm"] for g in gs), sum(g["imerg_mm"] for g in gs)
    F = sg / ss if ss > 0 else 1.0
    e_f = [g["imerg_mm"] * (sg - g["gauge_mm"]) / max(ss - g["imerg_mm"], 1e-9) - g["gauge_mm"] for g in gs]
    loo["mean_field"] = {"n": len(gs), "factor": round(F, 3), "mae_adjusted_mm": round(sum(map(abs, e_f)) / max(1, len(gs)), 1),
                         "bias_adjusted_mm": round(sum(e_f) / max(1, len(gs)), 1)}
    # adjusted fine grid
    flon = [round(lons[0] + i * STEP, 4) for i in range(int(round((lons[-1] - lons[0]) / STEP)) + 1)]
    flat = [round(lats[0] + j * STEP, 4) for j in range(int(round((lats[-1] - lats[0]) / STEP)) + 1)]
    pts, tot_bg, tot_adj = [], 0.0, 0.0
    for la in flat:
        for lo in flon:
            s = bilinear(lons, lats, grid, lo, la)
            r = F if a.mode == "mean" else field(gs, lo, la, a.L) if gs else 1.0
            mm = [round(x * r, 2) for x in s]
            tot_bg += sum(s)
            tot_adj += sum(mm)
            pts.append({"lon": lo, "lat": la, "time": times, "mm": mm})
    out = {"model": "imerg_gauge_adjusted", "units": d["units"],
           "source": f"{d['source']}; amounts adjusted to {len(gs)} published daily gauge totals (data/rain/gauges_events.json, verification/observed/gauge_merge.py, " + (f"one factor {F:.3f})" if a.mode == "mean" else f"local ratio, L={a.L} km)"),
           "files": d.get("files", []), "points": pts}
    Path(a.out).write_text(json.dumps(out, separators=(",", ":")))
    rep = {"event": a.event, "mode": a.mode, "L_km": a.L, "grid_deg": STEP, "n_gauges": len(gs),
           "mean_ratio_over_grid": round(tot_adj / max(tot_bg, 1e-9), 3), "leave_one_out": loo,
           "gauges": [{k: v for k, v in g.items() if k != "lnr"} for g in gs]}
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False))
    print(json.dumps({k: rep[k] for k in ("event", "n_gauges", "mean_ratio_over_grid", "leave_one_out")}, indent=1))


if __name__ == "__main__":
    main()
