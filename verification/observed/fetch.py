"""Fetch observed data for validation (runs in GitHub Actions: these hosts are not reachable from the cloud session).

  python verification/observed/fetch.py <outdir> [--petabencana-only]

Per event in events.json:
  - PetaBencana.id flood reports and flooded-area archive (raw API answers, HTTP status kept),
  - ERA5 and ERA5-Land hourly rain (Open-Meteo archive API) on a 0.1 degree grid over the region and its upstream catchments,
  - NOAA ISD hourly and GSOD daily station records for the stations inside that grid (public domain),
  - GPM IMERG Final V07 half-hourly rain (NASA GES DISC) on its own 0.1 degree cells, only when EARTHDATA_TOKEN is set
    (free NASA Earthdata login; NASA data are open, the login is only for access),
  - CHIRPS daily rain (satellite + stations, 0.05 degree, no login), spread over the hours with the ERA5 hourly pattern.
Also the PetaBencana terms pages, so the licence decision (publish or not) is made from their own text.
manifest.json lists every request, its status, size and sha256. Stdlib only, except IMERG (h5py) and CHIRPS (rasterio).
"""
import csv, hashlib, io, json, os, re, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
UA = {"User-Agent": "banjir3d-validation (github.com/raredil/banjir3d)"}
# region bbox plus the upstream catchments (Ciliwung, Cisadane, Bekasi rivers reach the Puncak / Salak slopes near 6.8 S)
GRID = {"lon": (106.4, 107.2), "lat": (-6.85, -5.9), "step": 0.1}
manifest: list[dict] = []


def get(url: str, out: Path | None, tries: int = 3, headers: dict | None = None, log: bool = True) -> bytes | None:
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, **(headers or {})}), timeout=120) as r:
                body = r.read()
                status = r.status
            break
        except urllib.error.HTTPError as e:
            body, status = e.read(), e.code
            if e.code < 500:
                break
        except Exception as e:  # network
            body, status = str(e).encode(), -1
        time.sleep(5 * (k + 1))
    rec = {"url": url, "status": status, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
           "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    if out is not None:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(body)
        rec["file"] = out.name
    if log:
        manifest.append(rec)
    print(status, len(body), url, flush=True)
    return body if status == 200 else None


def grid_points():
    g = GRID
    nlon = round((g["lon"][1] - g["lon"][0]) / g["step"]) + 1
    nlat = round((g["lat"][1] - g["lat"][0]) / g["step"]) + 1
    return [(round(g["lon"][0] + i * g["step"], 3), round(g["lat"][0] + j * g["step"], 3)) for j in range(nlat) for i in range(nlon)]


def era5(ev: dict, out: Path):
    pts = grid_points()
    start, end = ev["utc"][0][:10], ev["utc"][1][:10]
    for model in ("era5", "era5_land"):
        series = []
        for k in range(0, len(pts), 50):  # Open-Meteo takes many coordinates per call
            chunk = pts[k:k + 50]
            q = urllib.parse.urlencode({"latitude": ",".join(str(p[1]) for p in chunk), "longitude": ",".join(str(p[0]) for p in chunk),
                                        "start_date": start, "end_date": end, "hourly": "precipitation", "models": model, "timezone": "UTC"})
            b = get(f"https://archive-api.open-meteo.com/v1/archive?{q}", None)
            if b is None:
                continue
            d = json.loads(b)
            for p, r in zip(chunk, d if isinstance(d, list) else [d]):
                series.append({"lon": p[0], "lat": p[1], "grid_lat": r.get("latitude"), "grid_lon": r.get("longitude"),
                               "time": r["hourly"]["time"], "mm": r["hourly"]["precipitation"]})
            time.sleep(2)
        (out / f"rain_{model}.json").write_text(json.dumps({"model": model, "units": "mm per hour ending at time (UTC)",
                                                             "source": "Open-Meteo archive API", "points": series}))


def imerg(ev: dict, out: Path, token: str):
    """Half-hourly files of the event window; cells whose centre is inside GRID (plus half a step). Stored as hourly sums (mm),
    the value at time T being the rain of the hour ending at T, like the Open-Meteo files."""
    import h5py
    import numpy as np

    g, half = GRID, GRID["step"] / 2
    t, t1 = datetime.fromisoformat(ev["utc"][0].replace("Z", "+00:00")), datetime.fromisoformat(ev["utc"][1].replace("Z", "+00:00"))
    hours: dict[str, np.ndarray] = {}
    lon = lat = sel = None
    n = 0
    while t < t1:
        mins = t.hour * 60 + t.minute
        e = t + timedelta(minutes=29, seconds=59)
        name = f"3B-HH.MS.MRG.3IMERG.{t:%Y%m%d}-S{t:%H%M%S}-E{e:%H%M%S}.{mins:04d}.V07B.HDF5"
        url = f"https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHH.07/{t:%Y}/{t.timetuple().tm_yday:03d}/{name}"
        b = get(url, None, headers={"Authorization": f"Bearer {token}"}, log=False)
        manifest.append({"url": url, "status": 200 if b else "failed", "bytes": len(b or b"")})
        if b:
            with h5py.File(io.BytesIO(b), "r") as f:
                if sel is None:
                    lon, lat = f["Grid/lon"][:], f["Grid/lat"][:]
                    sel = (np.nonzero((lon >= g["lon"][0] - half) & (lon <= g["lon"][1] + half))[0], np.nonzero((lat >= g["lat"][0] - half) & (lat <= g["lat"][1] + half))[0])
                pr = f["Grid/precipitation"][0][np.ix_(sel[0], sel[1])].astype(float)  # mm/h, (lon, lat)
            pr[pr < 0] = np.nan
            key = (t.replace(minute=0) + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
            hours[key] = hours.get(key, 0) + pr * 0.5  # half an hour at the half-hourly rate
            n += 1
        t += timedelta(minutes=30)
    if sel is None:
        return
    times = sorted(hours)
    pts = [{"lon": round(float(lon[i]), 3), "lat": round(float(lat[j]), 3), "time": times,
            "mm": [None if np.isnan(hours[k][a, b]) else round(float(hours[k][a, b]), 3) for k in times]}
           for b, j in enumerate(sel[1]) for a, i in enumerate(sel[0])]
    (out / "rain_imerg.json").write_text(json.dumps({"model": "imerg_final_v07", "units": "mm per hour ending at time (UTC)", "files": n,
                                                     "source": "GPM IMERG Final V07 half-hourly, NASA GES DISC, doi:10.5067/GPM/IMERG/3B-HH/07", "points": pts}))


CHIRPS = "https://data.chc.ucsb.edu/products/"


def chirps_file(day: datetime, tmp: Path) -> tuple[Path, str] | None:
    """CHIRPS v2.0 daily global GeoTIFF of that day; if it is not there, the v3.0 daily tree is searched (links followed only
    inside it, names with the date). Returns the local file and its URL."""
    y, md = f"{day:%Y}", f"{day:%Y.%m.%d}"
    for url in (f"{CHIRPS}CHIRPS-2.0/global_daily/tifs/p05/{y}/chirps-v2.0.{md}.tif.gz", f"{CHIRPS}CHIRPS-2.0/global_daily/tifs/p05/{y}/chirps-v2.0.{md}.tif"):
        b = get(url, None)
        if b:
            f = tmp / url.rsplit("/", 1)[1]
            f.write_bytes(b)
            return f, url
    todo, seen = [f"{CHIRPS}CHIRPS/v3.0/daily/"], set()
    while todo and len(seen) < 40:
        d = todo.pop(0)
        seen.add(d)
        b = get(d, None)
        if not b:
            continue
        for href in re.findall(r'href="([^"?#]+)"', b.decode("utf-8", "replace")):
            u = urllib.parse.urljoin(d, href)
            if not u.startswith(f"{CHIRPS}CHIRPS/v3.0/daily/") or u in seen:
                continue
            if u.endswith("/"):
                yr = re.search(r"/(\d{4})/$", u)
                if (not yr or yr.group(1) == y) and "prelim" not in u:  # other years and preliminary products skipped
                    todo.append(u)
            elif md in u and re.search(r"\.tif(\.gz)?$", u):
                b2 = get(u, None)
                if b2:
                    f = tmp / u.rsplit("/", 1)[1]
                    f.write_bytes(b2)
                    return f, u
    return None


def chirps(ev: dict, out: Path):
    """Daily CHIRPS totals on the 0.1 degree points of GRID (mean of the 2 x 2 CHIRPS cells inside each 0.1 degree cell), spread over
    the hours of the day with the ERA5 hourly pattern at the same point (or the region pattern when ERA5 has < 0.5 mm there that
    day, or evenly when ERA5 is dry everywhere). Assumption: a CHIRPS day is the UTC calendar day."""
    import gzip
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds

    era = out / "rain_era5.json"
    if not era.exists():
        return
    ep = json.loads(era.read_text())["points"]
    if not ep:
        return
    times = ep[0]["time"]
    days = sorted({t[:10] for t in times})
    tmp = Path(tempfile.mkdtemp())  # global daily files are only read here, never published
    g, half = GRID, GRID["step"] / 2
    daily, used = {}, []
    for dstr in days:
        r = chirps_file(datetime.fromisoformat(dstr), tmp)
        if r is None:
            continue
        f, url = r
        if f.suffix == ".gz":
            f2 = f.with_suffix("")
            f2.write_bytes(gzip.decompress(f.read_bytes()))
            f.unlink()
            f = f2
        with rasterio.open(f) as src:
            win = from_bounds(g["lon"][0] - half, g["lat"][0] - half, g["lon"][1] + half, g["lat"][1] + half, src.transform).round_offsets().round_lengths()
            a = src.read(1, window=win).astype(float)
            tr = src.window_transform(win)
            if src.nodata is not None:
                a[a == src.nodata] = np.nan
        a[a < 0] = np.nan
        vals = []
        for p in ep:
            c0, r0 = ~tr * (p["lon"] - half + 1e-6, p["lat"] + half - 1e-6)
            c1, r1 = ~tr * (p["lon"] + half - 1e-6, p["lat"] - half + 1e-6)
            blk = a[int(r0):int(r1) + 1, int(c0):int(c1) + 1]
            vals.append(None if blk.size == 0 or np.all(np.isnan(blk)) else round(float(np.nanmean(blk)), 2))
        daily[dstr] = vals
        used.append(url)
        f.unlink()
    if not daily:
        return
    E = np.array([[v or 0.0 for v in p["mm"]] for p in ep])  # points x hours
    region = E.mean(axis=0)
    pts = []
    for k, p in enumerate(ep):
        mm = [None] * len(times)
        for dstr, vals in daily.items():
            hrs = [m for m, t in enumerate(times) if t[:10] == dstr]
            tot = vals[k]
            if tot is None or not hrs:
                continue
            w = E[k, hrs] if E[k, hrs].sum() >= 0.5 else region[hrs]
            w = w / w.sum() if w.sum() > 0 else np.full(len(hrs), 1 / len(hrs))
            for m, x in zip(hrs, w):
                mm[m] = round(float(tot * x), 3)
        pts.append({"lon": p["lon"], "lat": p["lat"], "time": times, "mm": mm, "daily_mm": {d: daily[d][k] for d in daily}})
    (out / "rain_chirps.json").write_text(json.dumps({"model": "chirps_daily_era5_hourly_pattern", "units": "mm per hour ending at time (UTC)",
                                                      "source": "CHIRPS daily (Funk et al. 2015, doi:10.1038/sdata.2015.66), Climate Hazards Center UCSB; hourly pattern from ERA5 (Open-Meteo)",
                                                      "files": used, "day_assumed": "UTC calendar day", "points": pts}))


def stations(evs: list[dict], out: Path):
    b = get("https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv", None)
    if b is None:
        return
    g, sel = GRID, []
    for r in csv.DictReader(io.StringIO(b.decode("utf-8", "replace"))):
        try:
            lat, lon = float(r["LAT"]), float(r["LON"])
        except ValueError:
            continue
        if g["lat"][0] <= lat <= g["lat"][1] and g["lon"][0] <= lon <= g["lon"][1] and r["END"] >= "20191201":
            sel.append({"id": r["USAF"] + r["WBAN"], "name": r["STATION NAME"], "lat": lat, "lon": lon, "begin": r["BEGIN"], "end": r["END"]})
    (out / "stations.json").write_text(json.dumps(sel, indent=1))
    for y in sorted({e["utc"][0][:4] for e in evs} | {e["utc"][1][:4] for e in evs}):
        for s in sel:
            get(f"https://www.ncei.noaa.gov/data/global-summary-of-the-day/access/{y}/{s['id']}.csv", out / "noaa" / f"gsod_{y}_{s['id']}.csv")
            get(f"https://www.ncei.noaa.gov/data/global-hourly/access/{y}/{s['id']}.csv", out / "noaa" / f"isd_{y}_{s['id']}.csv")


def petabencana(ev: dict, out: Path):
    s, e = ev["wib"]
    for path in ("reports/archive", "floods/archive"):
        for extra in ({"geoformat": "geojson"}, {}):
            q = urllib.parse.urlencode({"start": s, "end": e, **extra})
            name = f"pb_{path.replace('/', '_')}{'_geojson' if extra else ''}.json"
            get(f"https://data.petabencana.id/{path}?{q}", out / name)



def pb_areas(out: Path):
    # RW polygons for the area_id of the flooded-area archive; parameter names differ between API versions, so try each
    for name, q in (("admin", "floods?admin=ID-JK&geoformat=geojson"), ("admin_topo", "floods?admin=ID-JK"),
                    ("admin_json", "floods?admin=ID-JK&format=json&geoformat=geojson"), ("states", "floods?admin=ID-JK&minimum_state=1&geoformat=geojson"),
                    ("flood_states", "floods/states?admin=ID-JK&format=json"), ("cities", "cities?format=json&geoformat=geojson")):
        get(f"https://data.petabencana.id/{q}", out / f"pb_areas_{name}.json")


def terms(out: Path):
    lines = []
    for url in ("https://docs.petabencana.id/", "https://docs.petabencana.id/routes/reports", "https://docs.petabencana.id/routes/floods",
                "https://petabencana.id/legal/", "https://info.petabencana.id/legal/", "https://data.petabencana.id/"):
        b = get(url, None)
        if b is None:
            continue
        text = re.sub(r"<[^>]+>", " ", b.decode("utf-8", "replace"))
        for ln in re.split(r"[\r\n]+|(?<=[.])\s{2,}", text):
            ln = " ".join(ln.split())
            if re.search(r"licen[cs]|ODbL|Open Database|Creative Commons|CC[ -]BY|terms|ketentuan|lisensi|api[ _-]?key|x-api-key", ln, re.I):
                lines.append({"url": url, "text": ln[:400]})
    (out / "petabencana_terms.json").write_text(json.dumps(lines, indent=1, ensure_ascii=False))


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    evs = json.loads((HERE / "events.json").read_text())["events"]
    if "--petabencana-only" in sys.argv:  # validation workflow: raw answers for scoring, never published
        pb_areas(out)
        for ev in evs:
            (out / ev["id"]).mkdir(exist_ok=True)
            petabencana(ev, out / ev["id"])
        return
    terms(out)
    pb_areas(out)
    for ev in evs:
        d = out / ev["id"]
        d.mkdir(exist_ok=True)
        petabencana(ev, d)
        era5(ev, d)
        chirps(ev, d)
        if os.environ.get("EARTHDATA_TOKEN"):
            imerg(ev, d, os.environ["EARTHDATA_TOKEN"])
        else:
            manifest.append({"url": "imerg", "status": "skipped: EARTHDATA_TOKEN not set"})
    stations(evs, out)
    (out / "manifest.json").write_text(json.dumps({"grid": GRID, "events": evs, "requests": manifest}, indent=1))


if __name__ == "__main__":
    main()
