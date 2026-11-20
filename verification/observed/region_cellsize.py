"""Region-wide report scores at 90 m and 60 m cells with ONE rule for both (review 2026-11-20, R-04; ADR 0025).

  python verification/observed/region_cellsize.py <runs dir> <reports_petabencana.geojson> <out.json>

runs dir holds the run files of the validation releases (<event>_imerg_k<k>_d0_poff_{hmax.f32.gz,mask.u8.gz,landshare.u8.gz,summary.json})
for k = 3 (90 m, v33-v35), k = 2 (60 m, v42-v44) and k = 3 with the sub-grid channel (suffix _sub, v45-v47, ADR 0025). The headline score of compare.py uses the 3 x 3 window, which grows with
the cell (about 270 m wide at 90 m, 180 m at 60 m), so it cannot compare cell sizes. Here, as in box_cellsize.py: hit = the deepest
LAND cell whose centre lies within R_M of the report is at least HIT_M deep; also the land cell under the report. Only reports
inside DKI Jakarta count. Random baseline: the same rule at N_RANDOM points spread uniformly over DKI land (the same points at
both sizes). Distance classes (to the nearest river/water block) come from the 90 m grid for both sizes, so the same reports
fall in the same class. Wilson 95 % intervals; p = one-sided binomial against the random rate of the same class.
"""
import gzip
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import box_cellsize as bc  # noqa: E402
import compare  # noqa: E402

N_RANDOM = 4000
EVENTS = ["2020-01-01", "2021-02-20", "2025-03-04"]
CLASSES = [("le100", 0, 100), ("100_500", 100, 500), ("gt500", 500, 1e9)]


def load(d: Path, ev: str, k: int, suf: str = ""):
    base = d / f"{ev}_imerg_k{k}_d0_poff{suf}"
    p = Path(f"{base}_summary.json")
    if not p.exists():
        return None
    s = json.loads(p.read_text())
    sh = (s["ny"], s["nx"])
    h = np.frombuffer(gzip.decompress(Path(f"{base}_hmax.f32.gz").read_bytes()), np.float32).reshape(sh)
    m = np.frombuffer(gzip.decompress(Path(f"{base}_mask.u8.gz").read_bytes()), np.uint8).reshape(sh)
    inside = (m & 1).astype(bool) & ~(m & 2).astype(bool)
    land, w = compare.land_of(Path(f"{base}_landshare.u8.gz"), m, inside)
    return s, h, m, inside, land, w


def cell_of(s, x, y):
    x0, y0, dx, nx, ny, _ = compare.grid_of(s)
    i, j = int((x - x0) // dx), int((y0 - y) // dx)
    return (i, j) if 0 <= i < nx and 0 <= j < ny else None


def stats(rows, rand_rows):
    n = len(rows)
    out = {"n": n}
    if not n:
        return out
    kr, kc = sum(r[1] for r in rows), sum(r[0] for r in rows)
    rr = float(np.mean([r[1] for r in rand_rows])) if rand_rows else None
    rc = float(np.mean([r[0] for r in rand_rows])) if rand_rows else None
    out.update({"hit_radius": kr / n, "hit_radius_wilson95": compare.wilson(kr, n), "random_radius": rr,
                "p_radius_vs_random": compare.binom_p_greater(kr, n, rr) if rr is not None else None,
                "hit_cell": kc / n, "random_cell": rc, "model_median_m": float(np.median([r[2] for r in rows]))})
    return out


def main():
    runs, repf, outp = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    feats = json.loads(repf.read_text())["features"]
    res = {"_about": __doc__, "radius_m": bc.R_M, "hit_m": bc.HIT_M, "events": []}
    rng = np.random.default_rng(11)
    for ev in EVENTS:
        r90 = load(runs, ev, 3)
        if r90 is None:
            continue
        s90, h90, m90, in90, land90, _ = r90
        tr = compare.grid_of(s90)[5]
        dki = compare.dki_mask(s90)
        dist = compare.distance_to_water((m90 & 4).astype(bool) & in90, s90["dx"])
        x0, y0, dx = compare.grid_of(s90)[:3]
        # reports of this flood inside DKI (on the 90 m grid)
        rep, rcls = [], []
        for f in feats:
            if f["properties"].get("event") != ev:
                continue
            lon, lat = f["geometry"]["coordinates"][:2]
            x, y = tr.transform(lon, lat)
            c = cell_of(s90, x, y)
            if c and dki[c[1], c[0]] and in90[c[1], c[0]]:
                rep.append((x, y)); rcls.append(float(dist[c[1], c[0]]))
        # random points over DKI land of the 90 m grid (the same points at both sizes)
        jj, ii = np.nonzero(dki & land90)
        pick = rng.choice(len(ii), size=min(N_RANDOM, len(ii)), replace=False)
        rnd = [(x0 + (ii[p] + rng.random()) * dx, y0 - (jj[p] + rng.random()) * dx) for p in pick]
        dcls = [float(dist[jj[p], ii[p]]) for p in pick]
        out = {"event": ev, "n_reports_dki": len(rep), "sizes": {}}
        for k, suf, name in ((3, "", "90m"), (2, "", "60m"), (3, "_sub", "90m_subgrid")):
            r = r90 if (k, suf) == (3, "") else load(runs, ev, k, suf)
            if r is None:
                continue
            s, h, m, inside, land, w = r
            a, b = bc.rule(rep, s, h, land), bc.rule(rnd, s, h, land)
            bl = [v for v in b if v[3]]  # random points that fall on land of this grid
            blc = [d for v, d in zip(b, dcls) if v[3]]
            dk = compare.dki_mask(s)
            cell_km2 = (s["dx"] / 1000.0) ** 2
            row = stats(a, bl)
            row["dki_flooded_land_km2_gt015"] = round(float(((h >= compare.WET_M) * w * dk).sum() * cell_km2), 2)
            row["mass_error"] = s.get("massError")
            row["by_distance"] = {c: stats([v for v, d in zip(a, rcls) if lo <= d < hi or (lo == 0 and d == 0)],
                                           [v for v, d in zip(bl, blc) if lo <= d < hi or (lo == 0 and d == 0)]) for c, lo, hi in CLASSES}
            out["sizes"][name] = row
            print(ev, name, len(rep), {kk: (round(vv, 3) if isinstance(vv, float) else vv) for kk, vv in row.items() if kk not in ("by_distance", "hit_radius_wilson95")})
        res["events"].append(out)
    outp.write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
