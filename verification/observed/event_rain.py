"""Compact event rain files for the app's "observed flood" mode (data/events/).

  python verification/observed/event_rain.py <observed dir (observed.tar.gz unpacked)> data/events

For each event in events.json: the IMERG hourly rain (mm in the hour ending at the time, UTC) on the 0.1 degree points, cut to
the model run window, rounded to 0.1 mm; plus the PetaBencana report COUNT and the score at drains 0 (records are not published:
licence unknown). Points are stored row by row (south to north, west to east).
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent


def main(obs: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for ev in json.loads((HERE / "events.json").read_text())["events"]:
        eid = ev["id"]
        rain = json.loads((obs / eid / "rain_imerg.json").read_text())
        t0 = datetime.fromisoformat(ev["utc"][0].replace("Z", "+00:00"))
        hours = ev["run_hours"]
        lons = sorted({p["lon"] for p in rain["points"]})
        lats = sorted({p["lat"] for p in rain["points"]})
        by = {(p["lon"], p["lat"]): p for p in rain["points"]}
        assert len(by) == len(lons) * len(lats), "rain points are not a full grid"
        mm = []
        for la in lats:
            for lo in lons:
                p, v = by[(lo, la)], [0.0] * hours
                for t, x in zip(p["time"], p["mm"]):
                    h = round((datetime.fromisoformat(t).replace(tzinfo=timezone.utc) - t0) / timedelta(hours=1)) - 1
                    if 0 <= h < hours:
                        v[h] = round(x or 0.0, 1)
                mm.append(v)
        sc = json.loads((HERE / f"scores-{eid}-imerg.json").read_text())
        r0 = next(r for r in sc["results"] if r["drain_mm_h"] == 0 and r.get("rain_scale", 1) == 1)
        rep = ev.get("reported", {})
        doc = {
            "id": eid, "wib": ev["wib"], "start_utc": ev["utc"][0], "hours": hours,
            "source": rain["source"], "units": "mm in the hour ending at start + (i + 1) h",
            "lon": lons, "lat": lats, "mm": mm,
            "reports": {"source": "PetaBencana.id (count only)", "n": r0["reports"]["n_reports"], "hit_rate": round(r0["reports"]["hit_rate"], 3),
                        "model": "whole region, 90 m, drains 0 mm/h"},
            "reported_km2": rep.get("flooded_km2"), "reported_rw": rep.get("flooded_rw"),
        }
        (out / f"{eid}_imerg.json").write_text(json.dumps(doc, separators=(",", ":")))
        index.append(eid)
        print(eid, len(mm), "points", hours, "h", (out / f"{eid}_imerg.json").stat().st_size, "bytes")
    return index


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
