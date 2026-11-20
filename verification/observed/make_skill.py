"""Summarise the three-flood scores into data/skill.json (conclusion card, AI context file).
Usage: python verification/observed/make_skill.py scores-2020-01-01-imerg-v6.json scores-2021-02-20-imerg-v6.json scores-2025-03-04-imerg-v6.json
Tested set-up = pumps off, drains 0, AMC 2, rain scale 1, terrain year auto."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]


def pick(results, pumps, amc):
    for r in results:
        if bool(r.get("pumps")) == pumps and r.get("amc", 2) == amc and r.get("drain_mm_h", 0) == 0 and r.get("rain_scale", 1) == 1:
            return r
    return None


events = []
for f in sys.argv[1:]:
    d = json.loads(Path(f).read_text())
    base, pon, wet = pick(d["results"], False, 2), pick(d["results"], True, 2), pick(d["results"], False, 3)
    rp = base["reports"]
    e = {"id": d["event"], "n": rp["n_reports"], "hit": round(rp["window_3x3_land"]["hit_rate"], 3), "random": round(rp["window_3x3_land"]["random_hit_rate"], 3),
         "hitCell": round(rp["cell"]["hit_rate"], 3), "randomCell": round(rp["cell"]["random_hit_rate"], 3),
         "legacyHit": round(rp["legacy_window_with_channels"]["hit_rate"], 3),
         "obsMedianM": rp["observed_median_m"], "modelMedianM": round(rp["model_median_m"], 3), "dkiKm2": round(base["dki_flooded_km2"], 1),
         "reportedKm2": (d.get("reported") or {}).get("flooded_km2")}
    if pon:
        e.update({"pumpsOnHit": round(pon["reports"]["window_3x3_land"]["hit_rate"], 3), "pumpsOnDkiKm2": round(pon["dki_flooded_km2"], 1)})
    if wet:
        e.update({"wetHit": round(wet["reports"]["window_3x3_land"]["hit_rate"], 3), "wetDkiKm2": round(wet["dki_flooded_km2"], 1)})
    fa = rp.get("fair")
    if fa:  # fair baselines and uncertainty (review 2026-11-20): the verdict shown to users comes from here
        e.update({"randomDomain": round(fa["random_domain_land"], 3), "randomNear": round(fa["random_near_reports"], 3),
                  "ci95": [round(v, 3) for v in fa["block_bootstrap95"]], "pNear": round(fa["p_vs_near_reports"], 4),
                  "verdict": fa["verdict"], "nDki": fa["inside_dki"]["n"], "hitDki": round(fa["inside_dki"]["hit_rate"], 3),
                  "randomDki": round(fa["inside_dki"]["random_dki"], 3)})
    rwp = (base.get("rw_places") or {}).get("reports_or_dsda") or {}
    for k_, k2 in (("csi", "rwCsi"), ("false_alarm_ratio", "rwFar"), ("auc", "rwAucAll")):
        if rwp.get(k_) is not None:
            e[k2] = round(rwp[k_], 3)
    rw = (base.get("rw_places") or {}).get("reports")
    if rw and "auc" in rw:
        e["rwAuc"] = rw["auc"]
    events.append(e)
out = {"_about": "How the tested set-up (90 m, GPM IMERG, pumps off, small-drain sink 0, average soil, subsidence to the event date) matched three recorded floods; from " + ", ".join(Path(f).name for f in sys.argv[1:]) + " (verification/observed/make_skill.py). hit/random: 3 x 3 land window (about 270 m), cell: same land cell; random = points spread at random over DKI land with the same rule (old, unfair: a third of the reports lie outside DKI); randomDomain = all land of the grid, randomNear = land within 1 km of a report (fair baselines), ci95 = 1 km block bootstrap of hit, pNear = one-sided binomial p against randomNear, verdict better|not_better|too_few (p < 0.05 against both fair baselines, at least 100 reports); hitDki/randomDki = reports inside DKI only; legacyHit: the old rule that counted river channels.",
       "events": events}
(root / "data/skill.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
print(json.dumps(out, indent=1))
