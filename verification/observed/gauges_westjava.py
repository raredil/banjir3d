"""Cut the open West Java gauge dataset (doi:10.17632/d7j3s64vvr.3, CC BY 4.0) to the validation floods.

  python -I verification/observed/gauges_westjava.py <dir with 01_Data-Ch-Jabar-2020-2025.xlsx and 02_..._Metadata_Lengkap.xlsx> data/rain/gauges_westjava_events.json

The xlsx files come from the release gauges-westjava-* (gauges.yml). Dates are the day of the 07:00 WIB reading (checked: Citeko
60.0 / 73.7 mm on 1 / 2 Jan 2020 in JICA 2022 Table 2-14 = 60 / 73 here; Katulampa 232.5 mm on 4 Mar 2025 = BMKG's 232 mm/day).
Keeps stations inside the IMERG box with a value on every day that overlaps the event window by >= 18 h. Values as published (NaN =
missing after the dataset's own quality control).
"""
import datetime
import json
import math
import sys
from pathlib import Path

import openpyxl

HERE = Path(__file__).parent
BOX = (106.30, -6.90, 107.30, -5.80)


def days_for(ev):
    t0 = datetime.datetime.fromisoformat(ev["utc"][0].replace("Z", "+00:00"))
    t1 = datetime.datetime.fromisoformat(ev["utc"][1].replace("Z", "+00:00"))
    out, d = [], (t0 - datetime.timedelta(days=1)).date()
    while d <= t1.date() + datetime.timedelta(days=1):
        end = datetime.datetime.combine(d, datetime.time(0), datetime.timezone.utc)  # 07:00 WIB
        ov = (min(end, t1) - max(end - datetime.timedelta(days=1), t0)).total_seconds() / 3600
        if ov >= 18:
            out.append(str(d))
        d += datetime.timedelta(days=1)
    return out


def main(src: Path, out: Path):
    meta = list(openpyxl.load_workbook(src / "02_West_Java_Rainfall_Station_Metadata_Lengkap.xlsx", read_only=True)["metadata"].iter_rows(values_only=True))
    cols = meta[0]
    st = {r[cols.index("Rainfall_station")]: dict(zip(cols, r)) for r in meta[1:] if r[0]}
    evs = json.loads((HERE / "events.json").read_text())["events"]
    want = {e["id"]: days_for(e) for e in evs}
    alld = {d for v in want.values() for d in v}
    it = openpyxl.load_workbook(src / "01_Data-Ch-Jabar-2020-2025.xlsx", read_only=True)["DATA"].iter_rows(values_only=True)
    hdr = list(next(it))
    rows = {}
    for r in it:
        d = r[0].date() if isinstance(r[0], datetime.datetime) else r[0]
        if str(d) in alld:
            rows[str(d)] = r
    doc = {"_about": "Daily gauge rain (mm, 24 h to the 07:00 WIB reading of the date) for the validation floods, cut by verification/observed/gauges_westjava.py.",
           "source": "Saputra H, Dasanto BD, Tarigan SD, Santikayasa IP, Darmawan Y (2026). Daily Rainfall Observations from 460 Stations and Flood Event Records across West Java, Indonesia (2020-2025). Mendeley Data V3, doi:10.17632/d7j3s64vvr.3. CC BY 4.0. Data from BMKG dataonline.bmkg.go.id and partner networks.",
           "events": {}}
    for eid, days in want.items():
        gs = []
        for i, name in enumerate(hdr[1:], start=1):
            m = st.get(name)
            if not m:
                continue
            la, lo = float(m["Latitude"]), float(m["Longitude"])
            if not (BOX[0] <= lo <= BOX[2] and BOX[1] <= la <= BOX[3]):
                continue
            vals = {d: rows[d][i] for d in days if d in rows}
            if len(vals) != len(days) or any(v is None or (isinstance(v, float) and math.isnan(v)) or not isinstance(v, (int, float)) for v in vals.values()):
                continue
            gs.append({"name": str(name), "id": str(m["Station_Id"]), "lat": round(la, 5), "lon": round(lo, 5), "district": m["District"],
                       "days": {d: float(v) for d, v in vals.items()}, "source": "westjava2026"})
        doc["events"][eid] = {"days": days, "gauges": gs}
        print(eid, days, len(gs), "gauges")
    out.write_text(json.dumps(doc, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
