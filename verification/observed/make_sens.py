"""Summarise the sensitivity runs (review 2026-11-20, R-08) into verification/observed/sensitivity-r08.json.

  python verification/observed/make_sens.py scores-2020-01-01-imerg-sens.json scores-2021-02-20-imerg-sens.json scores-2025-03-04-imerg-sens.json

Each score file holds one run per variant (sens: none, n0.7, n1.3, cnb92, dem1..dem10; web/src/engine/sensitivity.ts), all with the
tested set-up (90 m, IMERG, pumps off, drains 0, AMC II). Per variant: report hit (3 x 3 land window), fair random near reports,
verdict, DKI flooded km2, median model depth at reports, hit near rivers (in a river block or within 100 m) and far (> 500 m).
Terrain members (dem*) are given as median and min-max over the members."""
import json
import sys
from pathlib import Path

import numpy as np

here = Path(__file__).parent


def row(r):
    rp, fa = r["reports"], r["reports"].get("fair") or {}
    bd = (r.get("reports_by_distance") or {}).get("classes") or {}
    pool = lambda ks: (sum(bd[k]["n"] * (bd[k]["hit_rate"] or 0) for k in ks if k in bd) / max(1, sum(bd[k]["n"] for k in ks if k in bd))) if bd else None
    return {"hit": rp["window_3x3_land"]["hit_rate"], "randomNear": fa.get("random_near_reports"), "pNear": fa.get("p_vs_near_reports"),
            "verdict": fa.get("verdict"), "dkiKm2": r["dki_flooded_km2"], "modelMedianM": rp.get("model_median_m"),
            "hitNear": pool(["water", "le100"]), "hitFar": pool(["gt500"]), "massError": r["mass_error"]}


def spread(rows, key):
    v = [x[key] for x in rows if x.get(key) is not None]
    return {"median": float(np.median(v)), "min": float(min(v)), "max": float(max(v)), "n": len(v)} if v else None


out = {"_about": __doc__.split("\n\n")[0] + " Source files: " + ", ".join(Path(f).name for f in sys.argv[1:]), "events": []}
for f in sys.argv[1:]:
    d = json.loads(Path(f).read_text())
    by = {r.get("sens", "none"): row(r) for r in d["results"]}
    dem = [v for k, v in by.items() if k.startswith("dem")]
    e = {"id": d["event"], "variants": {k: v for k, v in by.items() if not k.startswith("dem")}}
    if dem:
        e["dem"] = {k: spread(dem, k) for k in ("hit", "randomNear", "dkiKm2", "modelMedianM", "hitNear", "hitFar")}
        e["dem"]["verdicts"] = sorted(x["verdict"] for x in dem if x["verdict"])
    out["events"].append(e)
(here / "sensitivity-r08.json").write_text(json.dumps(out, indent=1) + "\n")
for e in out["events"]:
    print(e["id"])
    for k, v in e["variants"].items():
        print(f"  {k:6} hit {v['hit']:.3f} near-random {v['randomNear']:.3f} p {v['pNear']:.3g} {v['verdict']:10} DKI {v['dkiKm2']:6.1f} km2  depth {v['modelMedianM']:.3f}  near/far {v['hitNear']:.2f}/{v['hitFar']:.2f}")
    if "dem" in e:
        g = e["dem"]
        print("  dem x%d hit %.3f (%.3f-%.3f)  DKI %.1f (%.1f-%.1f)  depth %.3f (%.3f-%.3f) near %.2f far %.2f  verdicts %s" % (
            g["hit"]["n"], g["hit"]["median"], g["hit"]["min"], g["hit"]["max"], g["dkiKm2"]["median"], g["dkiKm2"]["min"], g["dkiKm2"]["max"],
            g["modelMedianM"]["median"], g["modelMedianM"]["min"], g["modelMedianM"]["max"], g["hitNear"]["median"], g["hitFar"]["median"], g["verdicts"]))
