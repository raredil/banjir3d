"""Add the fair report baselines (compare.fair_baselines, review 2026-11-20) to existing score files without re-running the model.

  python verification/observed/rescore_fair.py <run dir with <event>_*_hmax.f32[.gz], _mask.u8[.gz], _summary.json> <reports.geojson> <scores json> [...]

reports.geojson = the published PetaBencana layer (reports_petabencana.geojson: event, time, depth_cm, source). It holds the same
points as the archive the workflow scores (same counts per event). Writes the 'fair' block into results[*].reports of each score file.
"""
import gzip, json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import compare  # noqa: E402


def read(p: Path, dt):
    if p.exists():
        return np.fromfile(p, dt)
    return np.frombuffer(gzip.decompress(Path(str(p) + ".gz").read_bytes()), dt)


def main():
    rundir, repf = Path(sys.argv[1]), Path(sys.argv[2])
    allrep = json.loads(repf.read_text())["features"]
    for sf in map(Path, sys.argv[3:]):
        sc = json.loads(sf.read_text())
        ev = sc["event"]
        rep = [f for f in allrep if f["properties"].get("event") == ev]
        for r in sc["results"]:
            s = json.loads((rundir / f"{r['run']}_summary.json").read_text())
            h = read(rundir / f"{r['run']}_hmax.f32", np.float32).reshape(s["ny"], s["nx"])
            m = read(rundir / f"{r['run']}_mask.u8", np.uint8).reshape(s["ny"], s["nx"])
            inside = (m & 1).astype(bool) & ~(m & 2).astype(bool)
            land = inside & ~(m & 4).astype(bool)
            new = compare.report_scores(rep, h, s, land, compare.dki_mask(s))
            old = r["reports"]
            assert new["n_reports"] == old["n_reports"] and abs(new["hit_rate"] - old["hit_rate"]) < 1e-9, (ev, new["n_reports"], old["n_reports"])
            old["fair"] = new["fair"]
            print(ev, r["run"], json.dumps(new["fair"]))
        sf.write_text(json.dumps(sc, indent=1))


if __name__ == "__main__":
    main()
