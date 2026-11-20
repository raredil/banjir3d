"""Does the report score depend on the cell size? (review 2026-11-20, R-04)

  python verification/observed/box_cellsize.py <runs dir> <reports_petabencana.geojson> <jobs.txt> <out.json>

runs dir holds <box>_k<k>/ (hmax.f32, mask.u8, landshare.u8, summary.json from run_event.ts with --box, k = 1, 2, 3 = 30, 60, 90 m).
jobs.txt lines: <box> <year> <start UTC> <W,S,E,N>. Reports of that flood inside the box and at least EDGE_M from its edge count.
Same rule at every size (the old 3 x 3 window grew with the cell): hit = the deepest LAND cell whose centre lies within R_M of the
report is at least HIT_M deep; also the land cell under the report. Random baseline: the same rule at N_RANDOM points spread
uniformly over the same inner box (the same points at every size), counted where they fall on land. Wilson 95 % intervals."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import compare  # noqa: E402

R_M, EDGE_M, N_RANDOM, HIT_M = 200.0, 300.0, 4000, compare.HIT_M


def load(d: Path):
    s = json.loads((d / "summary.json").read_text())
    sh = (s["ny"], s["nx"])
    h = np.fromfile(d / "hmax.f32", np.float32).reshape(sh)
    m = np.fromfile(d / "mask.u8", np.uint8).reshape(sh)
    ls = np.fromfile(d / "landshare.u8", np.uint8).reshape(sh) / 255.0
    inside = (m & 1).astype(bool) & ~(m & 2).astype(bool)
    land = inside & (~(m & 4).astype(bool) | (ls >= 0.5))
    return s, h, land, inside


def rule(xy, s, h, land):
    """For UTM points xy (n x 2): (cell hit, radius hit, radius depth, on land) per point."""
    x0, y0, dx, nx, ny, _ = compare.grid_of(s)
    r = int(np.ceil(R_M / dx)) + 1
    out = []
    for x, y in xy:
        i, j = int((x - x0) // dx), int((y0 - y) // dx)
        if not (0 <= i < nx and 0 <= j < ny):
            out.append((False, False, 0.0, False)); continue
        best = 0.0
        for jj in range(max(0, j - r), min(ny, j + r + 1)):
            for ii in range(max(0, i - r), min(nx, i + r + 1)):
                cx, cy = x0 + (ii + 0.5) * dx, y0 - (jj + 0.5) * dx
                if land[jj, ii] and (cx - x) ** 2 + (cy - y) ** 2 <= R_M * R_M and h[jj, ii] > best:
                    best = float(h[jj, ii])
        out.append((bool(land[j, i] and h[j, i] >= HIT_M), best >= HIT_M, best, bool(land[j, i])))
    return out


def main():
    runs, repf, jobs, outp = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
    feats = json.loads(repf.read_text())["features"]
    ev_of = {"2020": "2020-01-01", "2021": "2021-02-20", "2025": "2025-03-04"}
    res = {"_about": __doc__, "boxes": []}
    rng = np.random.default_rng(11)
    for line in jobs.read_text().split("\n"):
        if not line.strip():
            continue
        b, yr, _, box = line.split()
        W, S, E, N = map(float, box.split(","))
        sizes = [k for k in (1, 2, 3) if (runs / f"{b}_k{k}" / "summary.json").exists()]
        if not sizes:
            continue
        s1 = load(runs / f"{b}_k{sizes[0]}")[0]
        tr = compare.grid_of(s1)[5]
        # inner box in UTM (corners of the lon/lat box, shrunk by EDGE_M)
        cx, cy = tr.transform([W, E, E, W], [S, S, N, N])
        xa, xb, ya, yb = max(cx[0], cx[3]) + EDGE_M, min(cx[1], cx[2]) - EDGE_M, max(cy[0], cy[1]) + EDGE_M, min(cy[2], cy[3]) - EDGE_M
        rep = []
        for f in feats:
            p = f["properties"]
            if p.get("event") != ev_of[yr]:
                continue
            x, y = tr.transform(*f["geometry"]["coordinates"][:2])
            if xa <= x <= xb and ya <= y <= yb:
                rep.append((x, y, (p.get("depth_cm") or 0) / 100.0))
        rnd = np.column_stack([rng.uniform(xa, xb, N_RANDOM), rng.uniform(ya, yb, N_RANDOM)])
        row = {"box": b, "event": ev_of[yr], "lonlat": [W, S, E, N], "n_reports": len(rep), "sizes": {}}
        for k in sizes:
            s, h, land, inside = load(runs / f"{b}_k{k}")
            rr = rule([(x, y) for x, y, _ in rep], s, h, land)
            rb = [v for v in rule(rnd, s, h, land) if v[3]]
            n, kc, kr = len(rr), sum(v[0] for v in rr), sum(v[1] for v in rr)
            dep = [(o, v[2]) for (_, _, o), v in zip(rep, rr) if o > 0]
            row["sizes"][f"{int(s['dx'])}m"] = {
                "hit_radius": kr / n if n else None, "hit_radius_wilson95": compare.wilson(kr, n),
                "random_radius": float(np.mean([v[1] for v in rb])) if rb else None,
                "hit_cell": kc / n if n else None, "random_cell": float(np.mean([v[0] for v in rb])) if rb else None,
                "p_radius_vs_random": compare.binom_p_greater(kr, n, float(np.mean([v[1] for v in rb]))) if n and rb else None,
                "model_median_m": float(np.median([d for _, d in dep])) if dep else None,
                "observed_median_m": float(np.median([o for o, _ in dep])) if dep else None,
                "flooded_land_km2_gt015": float(((h > 0.15) & land).sum() * s["dx"] ** 2 / 1e6), "mass_error": s["massError"],
            }
        res["boxes"].append(row)
        print(b, ev_of[yr], len(rep), {k: (round(v["hit_radius"] or 0, 2), round(v["random_radius"] or 0, 2), round(v["hit_cell"] or 0, 2),
              round(v["flooded_land_km2_gt015"], 2), v["model_median_m"] and round(v["model_median_m"], 2)) for k, v in row["sizes"].items()})
    outp.write_text(json.dumps(res, indent=1) + "\n")


if __name__ == "__main__":
    main()
