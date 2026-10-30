"""Fetch observed data for validation (runs in GitHub Actions: these hosts are not reachable from the cloud session).

  python verification/observed/fetch.py <outdir>

Per event in events.json:
  - PetaBencana.id flood reports and flooded-area archive (raw API answers, HTTP status kept),
  - ERA5 and ERA5-Land hourly rain (Open-Meteo archive API) on a 0.1 degree grid over the region and its upstream catchments,
  - NOAA ISD hourly and GSOD daily station records for the stations inside that grid (public domain).
Also the PetaBencana terms pages, so the licence decision (publish or not) is made from their own text.
manifest.json lists every request, its status, size and sha256. Stdlib only.
"""
import csv, hashlib, io, json, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
UA = {"User-Agent": "banjir3d-validation (github.com/raredil/banjir3d)"}
# region bbox plus the upstream catchments (Ciliwung, Cisadane, Bekasi rivers reach the Puncak / Salak slopes near 6.8 S)
GRID = {"lon": (106.4, 107.2), "lat": (-6.85, -5.9), "step": 0.1}
manifest: list[dict] = []


def get(url: str, out: Path | None, tries: int = 3) -> bytes | None:
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
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
    for y in sorted({e["utc"][0][:4] for e in evs}):
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
    get("https://data.petabencana.id/floods?city=jbd&geoformat=geojson&minimum_state=1", out / "pb_floods_current_geojson.json")


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
    terms(out)
    for ev in evs:
        d = out / ev["id"]
        d.mkdir(exist_ok=True)
        petabencana(ev, d)
        era5(ev, d)
    stations(evs, out)
    (out / "manifest.json").write_text(json.dumps({"grid": GRID, "events": evs, "requests": manifest}, indent=1))


if __name__ == "__main__":
    main()
