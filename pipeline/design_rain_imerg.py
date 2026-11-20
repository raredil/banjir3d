"""Daily GPM IMERG Final (V07) rain over Jakarta, 2001-2025, for the return-period design rain when CHIRPS is not reachable
(the CHIRPS server answered 403/429 to the Action on 2026-11-20). Same output as design_rain_fetch.py, so design_rain.py runs unchanged.

  EARTHDATA_TOKEN=... python pipeline/design_rain_imerg.py <out dir> [first year] [last year]

Files: NASA CMR lists the daily granules (GPM_3IMERGDF version 07); only the 7 x 8 cells around DKI are read from each file through
the GES DISC OPeNDAP server (DAP2 ASCII subset), so no global file is downloaded. The token is sent only to NASA hosts
(verification/observed/fetch.py get). IMERG: Huffman et al. (2023), doi:10.5067/GPM/IMERGDF/DAY/07. Grid 0.1 degree, cell centres at
-179.95 + 0.1 i (lon), -89.95 + 0.1 j (lat); values mm/day of the UTC day.
"""
import datetime
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "verification/observed"))
import fetch  # noqa: E402  (get, nasa_host: the token only ever goes to NASA hosts)

I0, I1, J0, J1 = 2865, 2871, 833, 840  # lon 106.55..107.15, lat -6.65..-5.95 (cell centres)
TOKEN = os.environ.get("EARTHDATA_TOKEN", "")
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def granules(y0: int, y1: int) -> dict:
    out = {}
    for page in range(1, 40):
        q = urllib.parse.urlencode({"short_name": "GPM_3IMERGDF", "version": "07", "temporal": f"{y0}-01-01T00:00:00Z,{y1}-12-31T23:59:59Z",
                                    "page_size": 2000, "page_num": page, "sort_key": "start_date"})
        b = fetch.get(f"https://cmr.earthdata.nasa.gov/search/granules.json?{q}", None, log=False)
        items = json.loads(b)["feed"]["entry"] if b else []
        if not items:
            break
        for g in items:
            day = g["time_start"][:10]
            links = [l["href"] for l in g.get("links", []) if l.get("href", "").startswith("https://")]
            od = [l for l in links if "/opendap/" in l and re.search(r"\.nc4$", l)]
            data = [l for l in links if re.search(r"/data/GPM_L3/.+\.nc4$", l)]
            if od:
                out[day] = od[0]
            elif data:  # GES DISC: the same path under /opendap/ on the OPeNDAP host
                out[day] = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/" + data[0].split("/data/", 1)[1]
        if len(items) < 2000:
            break
    return out


NUM = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|nan|NaN")
ORDER = {"lon_first": True}  # set from the DDS by probe(): precipitation[time][lon][lat] (V07 daily) or [time][lat][lon]


def subset_url(url: str) -> str:
    a, b = (f"[{I0}:{I1}]", f"[{J0}:{J1}]") if ORDER["lon_first"] else (f"[{J0}:{J1}]", f"[{I0}:{I1}]")
    return f"{url}.ascii?precipitation[0:0]{a}{b}"


def parse(body: bytes):
    """Values of the precipitation block of a DAP2 ASCII answer, in the requested order, as [lat north to south, lon]."""
    txt = body.decode("utf-8", "replace")
    vals = []
    for line in txt.splitlines():
        t = line.strip()
        if t.startswith("[") and "," in t:  # data rows look like "[0][3], v, v, ..." (index prefix, then values)
            vals += [float(v) for v in NUM.findall(t.split(",", 1)[1])]
    nlon, nlat = I1 - I0 + 1, J1 - J0 + 1
    if len(vals) < nlon * nlat:
        return None
    a = np.array(vals[: nlon * nlat], np.float32)
    a = a.reshape(nlon, nlat).T if ORDER["lon_first"] else a.reshape(nlat, nlon)  # -> [lat south to north, lon]
    a[~np.isfinite(a) | (a < 0)] = np.nan
    return a[::-1].copy()


def probe(url: str):
    dds = fetch.get(f"{url}.dds", None, tries=3, headers=AUTH, log=False)
    print("DDS:", (dds or b"")[:600].decode("utf-8", "replace"))
    m = re.search(r"precipitation\[(\w+) = \d+\]\[(\w+) = \d+\]\[(\w+) = \d+\]", (dds or b"").decode("utf-8", "replace"))
    if not m:
        sys.exit("no precipitation array in the DDS (see above)")
    ORDER["lon_first"] = m.group(2) == "lon"
    b = fetch.get(subset_url(url), None, tries=3, headers=AUTH, log=False)
    print("ASCII:", (b or b"")[:1200].decode("utf-8", "replace"))
    a = parse(b or b"")
    if a is None:
        sys.exit("the ASCII answer could not be read (see above)")
    print("probe ok, dims", m.groups(), "max", np.nanmax(a))


def read(day_url):
    day, url = day_url
    for attempt in range(4):
        b = fetch.get(subset_url(url), None, tries=2, headers=AUTH, log=False)
        a = parse(b) if b else None
        if a is not None:
            return day, a, None
        time.sleep(5 * (attempt + 1))
    print("failed", day, url)
    return day, None, None


def main(out: Path, y0: int, y1: int):
    if not TOKEN:
        sys.exit("EARTHDATA_TOKEN missing")
    out.mkdir(parents=True, exist_ok=True)
    g = granules(y0, y1)
    print(len(g), "granules listed")
    if len(g) < 300 * (y1 - y0 + 1):
        sys.exit(f"only {len(g)} IMERG granules listed")
    days = sorted(g)
    probe(g[days[len(days) // 2]])
    with ThreadPoolExecutor(int(os.environ.get("DR_WORKERS", "8"))) as ex:
        res = list(ex.map(read, [(d, g[d]) for d in days]))
    ok = [(d, a) for d, a, _ in res if a is not None]
    lon = -179.95 + 0.1 * np.arange(I0, I1 + 1)
    lat = (-89.95 + 0.1 * np.arange(J0, J1 + 1))[::-1]
    np.savez_compressed(out / "chirps_daily_jakarta.npz", dates=np.array([d for d, _ in ok]), lon=lon, lat=lat, rain=np.stack([a for _, a in ok]))
    every, d = [], datetime.date(y0, 1, 1)
    while d <= datetime.date(y1, 12, 31):
        every.append(str(d))
        d += datetime.timedelta(days=1)
    missing = sorted(set(every) - {d for d, _ in ok})
    (out / "manifest.json").write_text(json.dumps({
        "source": "GPM IMERG Final Run V07 daily, 0.1 degree (Huffman et al. 2023, doi:10.5067/GPM/IMERGDF/DAY/07), NASA GES DISC",
        "base_url": "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/", "box_index": [I0, I1, J0, J1],
        "first": ok[0][0], "last": ok[-1][0], "n_days": len(ok), "missing_days": missing,
        "npz_sha256": hashlib.sha256((out / "chirps_daily_jakarta.npz").read_bytes()).hexdigest(), "made_by": "pipeline/design_rain_imerg.py"}, indent=1))
    print(len(ok), "days,", len(missing), "missing")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(Path(a[0]), int(a[1]) if len(a) > 1 else 2001, int(a[2]) if len(a) > 2 else 2025)
