"""Add report scores per distance to the nearest river/water block (compare.distance_class_scores, review 2026-11-20 MT-06)
to existing score files without re-running the model.

  python verification/observed/rescore_distance.py <run dir with <run>_hmax.f32.gz, _mask.u8.gz, _landshare.u8.gz, _summary.json> \
      <reports_petabencana.geojson> <scores json> [...]

reports_petabencana.geojson = the published PetaBencana layer (map-layers release): same points as the archive the workflow scores.
Writes results[*].reports_by_distance of each score file and checks that the report count matches the headline score.
"""
import gzip, json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import compare  # noqa: E402


def read(p: Path, dt):
    return np.frombuffer(gzip.decompress(Path(str(p) + ".gz").read_bytes()), dt) if not p.exists() else np.fromfile(p, dt)


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
            land, _ = compare.land_of(rundir / f"{r['run']}_landshare.u8.gz", m, inside)
            new = compare.distance_class_scores(rep, h, s, land, (m & 4).astype(bool) & inside, inside)
            head = compare.report_scores(rep, h, s, land, compare.dki_mask(s))
            assert abs(head["hit_rate"] - r["reports"]["hit_rate"]) < 1e-9, (ev, head["hit_rate"], r["reports"]["hit_rate"])
            r["reports_by_distance"] = new
            print(ev, r["run"], new["n_reports"], "of", r["reports"]["n_reports"],
                  {k: (v["n"], None if v["hit_rate"] is None else round(v["hit_rate"], 2), None if v["random_same_class"] is None else round(v["random_same_class"], 2))
                   for k, v in new["classes"].items()})
        sf.write_text(json.dumps(sc, indent=1))


if __name__ == "__main__":
    main()
