"""Return-period design rain (R24) for Jakarta from 45 years of daily CHIRPS (1981-2025), with a check against rain gauges.

  python pipeline/design_rain.py <chirps_daily_jakarta.npz> <manifest.json> <gauge dir or -> data/rain/design_rain_jakarta.json

Method (Chow, Maidment and Mays 1988, ch. 12): annual maximum daily rain, fitted with
  - Gumbel (extreme value type I) by the method of moments: x_T = mean + K_T s, K_T = -(sqrt 6 / pi) (0.5772 + ln ln (T / (T - 1)))
  - log-Pearson type III on log10 values (mean, s, skew with the n / ((n - 1)(n - 2)) correction), K_T from the Pearson III quantile
goodness of fit by the Kolmogorov-Smirnov distance (critical value 1.36 / sqrt(n) at 5 %). Done for (a) every CHIRPS cell whose
centre lies inside DKI (point-like rain of a 5 km cell) and (b) the DKI area mean. The gauge check compares the annual maxima of
open BMKG and partner gauges within 15 km of DKI (doi:10.17632/d7j3s64vvr.3, 2020-2025) with the CHIRPS cell that holds each gauge
in the same year (gauge day = 24 h to 07:00 WIB = the UTC day before).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PERIODS = (2, 5, 10, 25, 50, 100)


def gumbel_k(T: float) -> float:
    return -(math.sqrt(6) / math.pi) * (0.5772 + math.log(math.log(T / (T - 1))))


def moments(x):
    x = np.asarray(x, float)
    n = len(x)
    m, s = x.mean(), x.std(ddof=1)
    g = n * ((x - m) ** 3).sum() / ((n - 1) * (n - 2) * s ** 3)
    return m, s, g


def gumbel_fit(x):
    m, s, _ = moments(x)
    return {"mean": m, "s": s, "R": {T: m + gumbel_k(T) * s for T in PERIODS}}


def gumbel_cdf(v, m, s):
    a = math.sqrt(6) * s / math.pi
    u = m - 0.5772 * a
    return np.exp(-np.exp(-(np.asarray(v, float) - u) / a))


def lp3_fit(x):
    from scipy.stats import pearson3
    y = np.log10(np.asarray(x, float))
    m, s, g = moments(y)
    return {"meanLog": m, "sLog": s, "skewLog": g, "R": {T: float(10 ** pearson3.ppf(1 - 1 / T, g, loc=m, scale=s)) for T in PERIODS}}


def lp3_cdf(v, f):
    from scipy.stats import pearson3
    return pearson3.cdf(np.log10(np.asarray(v, float)), f["skewLog"], loc=f["meanLog"], scale=f["sLog"])


def ks_distance(x, cdf) -> float:
    x = np.sort(np.asarray(x, float))
    n = len(x)
    F = cdf(x)
    i = np.arange(1, n + 1)
    return float(max((i / n - F).max(), (F - (i - 1) / n).max()))


def analyse(series):
    gf, lf = gumbel_fit(series), lp3_fit(series)
    return {"gumbel": gf, "lp3": lf, "ksGumbel": ks_distance(series, lambda v: gumbel_cdf(v, gf["mean"], gf["s"])),
            "ksLp3": ks_distance(series, lambda v: lp3_cdf(v, lf))}


def dki_cells(lon, lat):
    import shapely
    from shapely.geometry import shape
    dom = json.loads((ROOT / "data/regions/jakarta_domain.geojson").read_text())
    adm = shape([f for f in dom["features"] if f["properties"].get("role") == "admin"][0]["geometry"])
    X, Y = np.meshgrid(lon, lat)
    return shapely.contains_xy(adm, X, Y), adm


def annual_max(dates, cube):
    years = np.array([int(d[:4]) for d in dates])
    ys = sorted(set(years.tolist()))
    return ys, np.stack([np.nanmax(cube[years == y], axis=0) for y in ys]), years


def gauge_check(gdir: Path, adm, dates, rain, lon, lat):
    import datetime
    import openpyxl
    meta = list(openpyxl.load_workbook(gdir / "02_West_Java_Rainfall_Station_Metadata_Lengkap.xlsx", read_only=True)["metadata"].iter_rows(values_only=True))
    cols = meta[0]
    st = {}
    for r in meta[1:]:
        if not r[0]:
            continue
        m = dict(zip(cols, r))
        lo, la = float(m["Longitude"]), float(m["Latitude"])
        from shapely.geometry import Point
        dkm = adm.distance(Point(lo, la)) * 111.0
        if dkm <= 15 and lon[0] - 0.025 <= lo <= lon[-1] + 0.025 and min(lat) - 0.025 <= la <= max(lat) + 0.025:
            st[m["Rainfall_station"]] = {"lat": la, "lon": lo, "km_from_dki": round(dkm, 1), "district": m["District"]}
    it = openpyxl.load_workbook(gdir / "01_Data-Ch-Jabar-2020-2025.xlsx", read_only=True)["DATA"].iter_rows(values_only=True)
    hdr = list(next(it))
    idx = {name: i for i, name in enumerate(hdr) if name in st}
    vals = {name: {} for name in idx}
    for r in it:
        d = r[0].date() if isinstance(r[0], datetime.datetime) else r[0]
        if not isinstance(d, datetime.date):
            continue
        utc_day = str(d - datetime.timedelta(days=1))
        for name, i in idx.items():
            v = r[i]
            if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)) and v >= 0:
                vals[name][utc_day] = float(v)
    pos = {d: k for k, d in enumerate(dates)}
    pairs, used = [], []
    for name, dv in vals.items():
        s = st[name]
        i = int(np.argmin(np.abs(lon - s["lon"])))
        j = int(np.argmin(np.abs(lat - s["lat"])))
        for y in range(2020, 2026):
            days = [d for d in dv if d.startswith(str(y)) and d in pos]
            if len(days) < 330:  # a near-complete year only
                continue
            g = max(dv[d] for d in days)
            c = float(np.nanmax([rain[pos[d], j, i] for d in days]))
            if c > 0:
                pairs.append({"station": str(name), "year": y, "gaugeMax": g, "chirpsMax": round(c, 1), "ratio": round(g / c, 3)})
        if any(p["station"] == str(name) for p in pairs):
            used.append({"name": str(name), **s})
    r = np.array([p["ratio"] for p in pairs]) if pairs else np.array([])
    out = {"stations": used, "n_station_years": len(pairs), "pairs": pairs}
    if len(r):
        out.update({"ratio_median": round(float(np.median(r)), 3), "ratio_q25": round(float(np.percentile(r, 25)), 3),
                    "ratio_q75": round(float(np.percentile(r, 75)), 3),
                    "ratio_of_means": round(float(np.mean([p["gaugeMax"] for p in pairs]) / np.mean([p["chirpsMax"] for p in pairs])), 3)})
    return out


def r1(v):
    return round(float(v), 1)


def main(npz: Path, manifest: Path, gdir: str, out: Path):
    z = np.load(npz)
    dates, lon, lat, rain = [str(d) for d in z["dates"]], z["lon"], z["lat"], z["rain"]
    man = json.loads(manifest.read_text())
    inside, adm = dki_cells(lon, lat)
    ys, amax, years = annual_max(dates, rain)
    full = [y for y in ys if (years == y).sum() >= 360]
    keep = np.array([y in full for y in ys])
    amax = amax[keep]
    cells = np.argwhere(inside)
    per = [analyse(amax[:, j, i]) for j, i in cells]
    area_series = np.array([np.nanmax(np.nanmean(rain[years == y][:, inside], axis=1)) for y in full])
    area = analyse(area_series)
    n = len(full)
    crit = 1.36 / math.sqrt(n)
    ksg = float(np.median([p["ksGumbel"] for p in per]))
    ksl = float(np.median([p["ksLp3"] for p in per]))
    passg = sum(p["ksGumbel"] < crit for p in per)
    passl = sum(p["ksLp3"] < crit for p in per)
    chosen = "gumbel" if ksg <= ksl else "lp3"

    def table(key):
        return {str(T): {"median": r1(np.median([p[key]["R"][T] for p in per])), "min": r1(min(p[key]["R"][T] for p in per)),
                         "max": r1(max(p[key]["R"][T] for p in per)), "areaMean": r1(area[key]["R"][T])} for T in PERIODS}

    cell_series = {f"{lon[i]:.3f},{lat[j]:.3f}": [r1(v) for v in amax[:, j, i]] for j, i in cells}
    gc = gauge_check(Path(gdir), adm, dates, rain, lon, lat) if gdir != "-" else None
    doc = {
        "_about": "Return-period design rain for DKI Jakarta: 24 h (daily) rain depth that is reached or exceeded on average once in T years. Made by pipeline/design_rain.py from daily CHIRPS rain; R24 per return period from the annual maximum daily rain of every CHIRPS cell whose centre lies inside DKI (median, min and max over the cells) and of the DKI area mean. 'chosen' = the distribution with the smaller median Kolmogorov-Smirnov distance over the cells. Satellite daily rain is smoother than a rain gauge: see gaugeCheck (gauge annual maximum / CHIRPS cell annual maximum in the same year).",
        "source": man["source"], "files": {"manifest": man.get("made_by"), "npz_sha256": man.get("npz_sha256"), "base_url": man.get("base_url")},
        "method": "annual maximum daily rain; Gumbel (method of moments) and log-Pearson III (moments of log10, skew corrected), Chow, Maidment and Mays (1988) ch. 12; Kolmogorov-Smirnov goodness of fit, critical value 1.36/sqrt(n) (5 %)",
        "years": [full[0], full[-1]], "n_years": n, "missing_days": len(man.get("missing_days", [])), "n_cells": int(len(cells)), "cell_deg": round(float(lon[1] - lon[0]), 4),
        "periods": list(PERIODS), "chosen": chosen,
        "R24": {"gumbel": table("gumbel"), "lp3": table("lp3")},
        "fit": {"ks_critical": round(crit, 3), "ks_median_gumbel": round(ksg, 3), "ks_median_lp3": round(ksl, 3), "cells_pass_gumbel": int(passg), "cells_pass_lp3": int(passl),
                "area_ks_gumbel": round(area["ksGumbel"], 3), "area_ks_lp3": round(area["ksLp3"], 3),
                "area_mean_mm": r1(area["gumbel"]["mean"]), "area_s_mm": r1(area["gumbel"]["s"]), "area_skew_log": round(area["lp3"]["skewLog"], 3)},
        "annualMax": {"years": full, "areaMean": [r1(v) for v in area_series], "wettestCell": [r1(np.nanmax(amax[k][inside])) for k in range(n)], "cells": cell_series},
        "gaugeCheck": gc,
    }
    out.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    t = doc["R24"][chosen]
    print("chosen", chosen, "KS", round(ksg, 3), round(ksl, 3), "crit", round(crit, 3))
    print({T: t[str(T)] for T in PERIODS})
    if gc:
        print("gauge check", gc.get("n_station_years"), gc.get("ratio_median"), gc.get("ratio_q25"), gc.get("ratio_q75"))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4]))
