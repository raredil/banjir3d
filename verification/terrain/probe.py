"""Probe three terrain/drainage sources that the cloud session cannot reach; prints JSON facts to the log.

1. Jakarta Satu geoportal (Pemprov DKI): which ArcGIS REST services are public, and which layers look like
   drains / rivers / catchments (DAS) / water-level gauges (AWLR) / pumps / polders.
2. Zenodo record 19456870 ("Sinking City", Jakarta land subsidence 2016-2024): licence, files, raster facts.
3. DEMNAS 8 m (draft release 'demnas-private') against FABDEM and GLO-30 on the 30 m grid, per land cover class
   (does DEMNAS behave like a surface model with buildings, or like bare earth?).

Usage: python probe.py <workdir> <region_pack_dir>   (GITHUB_TOKEN + GITHUB_REPOSITORY for part 3)
Only facts and statistics are printed; no raw DEMNAS or Jakarta Satu data leaves the runner.
"""
from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from pathlib import Path

import requests

UA = {"User-Agent": "banjir3d-probe (research; github.com/raredil/banjir3d)"}
INTEREST = re.compile(r"saluran|drain|drainase|sungai|kali|river|das\b|daerah.aliran|catch|awlr|tinggi.muka|tma|pos.duga|"
                      r"pompa|pump|polder|waduk|situ|tanggul|dike|levee|pintu.air|banjir|flood|genangan|rw|kelurahan", re.I)
session = requests.Session()
session.headers.update(UA)


def get(url, **kw):
    try:
        r = session.get(url, timeout=kw.pop("timeout", 40), **kw)
        return r
    except Exception as e:  # network facts are the result here
        return e


def out(tag, obj):
    print(f"##PROBE {tag} " + json.dumps(obj, ensure_ascii=False, default=str), flush=True)


# ---------------------------------------------------------------- 1. Jakarta Satu
JS_ROOTS = [
    "https://jakartasatu.jakarta.go.id/server/rest/services",
    "https://jakartasatu.jakarta.go.id/arcgis/rest/services",
    "https://jakartasatu.jakarta.go.id/gisserver/rest/services",
    "https://tataruang.jakarta.go.id/server/rest/services",
    "https://gis.jakarta.go.id/server/rest/services",
]
JS_PAGES = ["https://jakartasatu.jakarta.go.id/", "https://jakartasatu.jakarta.go.id/portal/home/",
            "https://jakartasatu.jakarta.go.id/portal/sharing/rest/search?q=AWLR&f=json&num=100",
            "https://jakartasatu.jakarta.go.id/portal/sharing/rest/search?q=saluran&f=json&num=100",
            "https://jakartasatu.jakarta.go.id/portal/sharing/rest/search?q=drainase&f=json&num=100",
            "https://jakartasatu.jakarta.go.id/portal/sharing/rest/search?q=DAS&f=json&num=100"]


def walk_arcgis(root, budget):
    found, seen = [], set()
    stack = [(root, 0)]
    while stack and budget[0] > 0:
        url, depth = stack.pop()
        if url in seen:
            continue
        seen.add(url)
        budget[0] -= 1
        r = get(url, params={"f": "json"})
        if isinstance(r, Exception) or r.status_code != 200:
            found.append({"url": url, "status": getattr(r, "status_code", type(r).__name__)})
            continue
        try:
            j = r.json()
        except ValueError:
            found.append({"url": url, "status": "not json", "head": r.text[:120]})
            continue
        if "error" in j:
            found.append({"url": url, "error": j["error"]})
            continue
        if depth < 3:
            for f in j.get("folders", []):
                stack.append((f"{root}/{f}", depth + 1))
        for s in j.get("services", []):
            surl = f"{root}/{s['name']}/{s['type']}"
            budget[0] -= 1
            sr = get(surl, params={"f": "json"})
            layers = []
            if not isinstance(sr, Exception) and sr.status_code == 200:
                try:
                    sj = sr.json()
                    layers = [{"id": l.get("id"), "name": l.get("name"), "geom": l.get("geometryType")} for l in sj.get("layers", [])]
                except ValueError:
                    pass
            found.append({"service": surl, "status": getattr(sr, "status_code", type(sr).__name__), "layers": layers})
    return found


def jakarta_satu():
    budget = [400]
    for page in JS_PAGES:
        r = get(page)
        if isinstance(r, Exception):
            out("js.page", {"url": page, "error": type(r).__name__, "msg": str(r)[:200]})
            continue
        txt = r.text
        links = sorted(set(re.findall(r"https?://[\w.\-]+(?:/[\w.\-]+)*/rest/services[\w/\-]*", txt)))
        items = []
        if "sharing/rest/search" in page:
            try:
                items = [{"title": i.get("title"), "type": i.get("type"), "url": i.get("url"), "access": i.get("access"),
                          "licenseInfo": (i.get("licenseInfo") or "")[:300]} for i in r.json().get("results", [])]
            except ValueError:
                pass
        out("js.page", {"url": page, "status": r.status_code, "bytes": len(txt), "rest_links": links[:40], "items": items[:60]})
        for l in links:
            base = l.split("/rest/services")[0] + "/rest/services"
            if base not in JS_ROOTS:
                JS_ROOTS.append(base)
    hits = []
    for root in JS_ROOTS:
        res = walk_arcgis(root, budget)
        out("js.root", {"root": root, "entries": len(res), "sample": res[:3]})
        for e in res:
            for l in e.get("layers", []):
                if INTEREST.search(l["name"] or "") or INTEREST.search(e["service"]):
                    hits.append({"service": e["service"], **l})
            if "layers" not in e:
                continue
        out("js.services", [{"service": e.get("service"), "n_layers": len(e.get("layers", []))} for e in res if "service" in e])
    # counts and fields for the interesting layers (first 60)
    for h in hits[:60]:
        lurl = f"{h['service']}/{h['id']}"
        meta = get(lurl, params={"f": "json"})
        cnt = get(f"{lurl}/query", params={"where": "1=1", "returnCountOnly": "true", "f": "json"})
        m = {}
        if not isinstance(meta, Exception) and meta.status_code == 200:
            try:
                mj = meta.json()
                m = {"fields": [f.get("name") for f in mj.get("fields", [])][:40], "maxRecordCount": mj.get("maxRecordCount"),
                     "copyright": (mj.get("copyrightText") or "")[:200], "desc": re.sub(r"<[^>]+>", " ", mj.get("description") or "")[:300],
                     "capabilities": mj.get("capabilities"), "extent": mj.get("extent")}
            except ValueError:
                pass
        c = None
        if not isinstance(cnt, Exception) and cnt.status_code == 200:
            try:
                c = cnt.json().get("count", cnt.json())
            except ValueError:
                c = cnt.text[:80]
        out("js.layer", {**h, "count": c, **m})


# ---------------------------------------------------------------- 2. Zenodo subsidence
def zenodo(work: Path):
    r = get("https://zenodo.org/api/records/19456870")
    if isinstance(r, Exception) or r.status_code != 200:
        out("zen.record", {"error": str(r)[:200] if isinstance(r, Exception) else r.status_code})
        return
    j = r.json()
    md = j.get("metadata", {})
    out("zen.record", {"title": md.get("title"), "creators": [c.get("name") for c in md.get("creators", [])],
                       "license": md.get("license"), "publication_date": md.get("publication_date"),
                       "related": md.get("related_identifiers"), "description": re.sub(r"<[^>]+>", " ", md.get("description") or "")[:3000],
                       "files": [{"key": f["key"], "size": f["size"], "link": f["links"].get("self")} for f in j.get("files", [])]})
    for f in j.get("files", []):
        if "subsid" not in f["key"].lower() or f["size"] > 400e6:
            continue
        dst = work / "subsidence.zip"
        with session.get(f["links"]["self"], stream=True, timeout=600) as rr, open(dst, "wb") as fh:
            for chunk in rr.iter_content(1 << 20):
                fh.write(chunk)
        z = zipfile.ZipFile(dst)
        out("zen.zip", {"file": f["key"], "members": [(i.filename, i.file_size) for i in z.infolist()][:200]})
        z.extractall(work / "subs")
        raster_facts(sorted(p for p in (work / "subs").rglob("*") if p.suffix.lower() in (".tif", ".tiff", ".asc", ".img", ".nc")))
        for p in sorted((work / "subs").rglob("*")):
            if p.suffix.lower() in (".txt", ".md", ".csv", ".xml", ".json", ".prj") and p.stat().st_size < 20000:
                out("zen.text", {"file": str(p.relative_to(work)), "text": p.read_text(errors="replace")[:1500]})
            if p.suffix.lower() in (".shp", ".gpkg", ".geojson"):
                try:
                    import geopandas as gpd
                    g = gpd.read_file(p)
                    out("zen.vector", {"file": str(p.relative_to(work)), "crs": str(g.crs), "n": len(g), "cols": list(g.columns)[:30],
                                       "head": g.drop(columns="geometry").head(3).to_dict("records"), "bounds": list(g.total_bounds)})
                except Exception as e:
                    out("zen.vector", {"file": str(p), "error": str(e)[:200]})


def raster_facts(paths):
    import numpy as np
    import rasterio
    for p in paths[:40]:
        try:
            with rasterio.open(p) as s:
                a = s.read(1, masked=True)
                v = a.compressed()
                out("zen.raster", {"file": p.name, "crs": str(s.crs), "bounds": list(s.bounds), "res": s.res, "size": [s.width, s.height],
                                   "dtype": s.dtypes[0], "nodata": s.nodata, "tags": s.tags(), "band_desc": s.descriptions,
                                   "units": s.units, "count": s.count, "valid": int(v.size),
                                   "p0_1_5_50_95_99_100": np.percentile(v, [0, 1, 5, 50, 95, 99, 100]).round(4).tolist() if v.size else None})
        except Exception as e:
            out("zen.raster", {"file": str(p), "error": str(e)[:200]})


# ---------------------------------------------------------------- 3. DEMNAS vs FABDEM / GLO-30
def demnas(work: Path, pack: Path):
    import numpy as np
    import rasterio
    from rasterio.warp import Resampling, reproject

    repo, tok = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not (repo and tok):
        out("dem.skip", "no token")
        return
    h = {"Authorization": f"Bearer {tok}", "X-GitHub-Api-Version": "2022-11-28"}
    rel = next((x for x in requests.get(f"https://api.github.com/repos/{repo}/releases", headers=h, params={"per_page": 100}, timeout=60).json()
                if x["tag_name"] == "demnas-private"), None)
    asset = next((a for a in (rel or {}).get("assets", []) if a["name"].startswith("dem_demnas")), None)
    if asset is None:
        out("dem.skip", "no dem_demnas asset")
        return
    dst = work / asset["name"]
    with requests.get(asset["url"], headers={**h, "Accept": "application/octet-stream"}, stream=True, timeout=600) as r, open(dst, "wb") as f:
        for chunk in r.iter_content(1 << 20):
            f.write(chunk)
    rep = next((a for a in rel["assets"] if a["name"] == "demnas_report.json"), None)
    if rep:
        rj = requests.get(rep["url"], headers={**h, "Accept": "application/octet-stream"}, timeout=60).json()
        out("dem.report", {k: rj.get(k) for k in ("checked", "files", "tiles_found", "missing_tiles", "qa")})
    with rasterio.open(pack / "dem_fabdem.tif") as s:
        fab = s.read(1, masked=True).filled(np.nan).astype("float32")
        tr, crs, shp = s.transform, s.crs, (s.height, s.width)
    def onto(path, rs):
        a = np.full(shp, np.nan, "float32")
        with rasterio.open(path) as s:
            reproject(rasterio.band(s, 1), a, dst_transform=tr, dst_crs=crs, resampling=rs, dst_nodata=np.nan)
        return a
    dn = onto(dst, Resampling.average)
    dn_std = None
    with rasterio.open(dst) as s:  # sub-cell roughness: std of 8 m values inside each 30 m cell (via mean of squares)
        sq = s.read(1, masked=True).astype("float64")
        sq = (sq * sq).filled(np.nan).astype("float32")
        tmp = np.full(shp, np.nan, "float32")
        reproject(sq, tmp, src_transform=s.transform, src_crs=s.crs, dst_transform=tr, dst_crs=crs, resampling=Resampling.average,
                  src_nodata=np.nan, dst_nodata=np.nan)
        dn_std = np.sqrt(np.clip(tmp - dn.astype("float64") ** 2, 0, None)).astype("float32")
    glo = onto(pack / "dem_glo30.tif", Resampling.bilinear)
    io = sorted(pack.glob("lulc_io_*.tif"))[-1]
    lc = np.zeros(shp, "uint8")
    with rasterio.open(io) as s:
        reproject(rasterio.band(s, 1), lc, dst_transform=tr, dst_crs=crs, resampling=Resampling.mode)
    names = {1: "water", 2: "trees", 4: "flooded veg", 5: "crops", 7: "built", 8: "bare", 11: "rangeland"}
    ok = np.isfinite(dn) & np.isfinite(fab) & np.isfinite(glo)
    def stats(m):
        if m.sum() < 50:
            return None
        d1, d2 = (dn - fab)[m], (dn - glo)[m]
        q = lambda x: np.percentile(x, [5, 25, 50, 75, 95]).round(2).tolist()
        return {"cells": int(m.sum()), "demnas_minus_fabdem_p5_25_50_75_95": q(d1), "demnas_minus_glo30_p5_25_50_75_95": q(d2),
                "glo30_minus_fabdem_median": round(float(np.median((glo - fab)[m])), 2),
                "subcell_std_median": round(float(np.nanmedian(dn_std[m])), 2),
                "mae_vs_fabdem": round(float(np.mean(np.abs(d1))), 2), "mae_vs_glo30": round(float(np.mean(np.abs(d2))), 2)}
    res = {"all": stats(ok)}
    for k, n in names.items():
        res[n] = stats(ok & (lc == k))
    # low coastal band (FABDEM < 5 m), where flood depth is decided
    res["low_lt5m"] = stats(ok & (fab < 5))
    res["low_lt5m_built"] = stats(ok & (fab < 5) & (lc == 7))
    res["below_0"] = {"demnas_share": round(float((dn[ok] < 0).mean()), 4), "fabdem_share": round(float((fab[ok] < 0).mean()), 4),
                      "glo30_share": round(float((glo[ok] < 0).mean()), 4)}
    out("dem.compare", res)
    # Bulk DSM test: in built cells a DSM sits above bare earth by building height; regress DEMNAS-FABDEM on GLO30-FABDEM
    m = ok & (lc == 7)
    x, y = (glo - fab)[m], (dn - fab)[m]
    slope = float(np.polyfit(x, y, 1)[0]) if m.sum() > 100 else None
    out("dem.dsm_test", {"built_cells": int(m.sum()), "slope_dn_vs_glo_excess": None if slope is None else round(slope, 3),
                         "corr": None if slope is None else round(float(np.corrcoef(x, y)[0, 1]), 3),
                         "note": "slope ~1: DEMNAS carries the same building/tree excess as the GLO-30 DSM; ~0: bare earth like FABDEM"})


def main():
    work, pack = Path(sys.argv[1]), Path(sys.argv[2])
    work.mkdir(parents=True, exist_ok=True)
    for name, fn in (("jakarta_satu", jakarta_satu), ("zenodo", lambda: zenodo(work)), ("demnas", lambda: demnas(work, pack))):
        try:
            fn()
        except Exception as e:
            out(f"{name}.crash", {"error": f"{type(e).__name__}: {e}"[:400]})


if __name__ == "__main__":
    main()
