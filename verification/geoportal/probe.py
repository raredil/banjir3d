"""Probe two sources the cloud session cannot reach (runs in GitHub Actions, workflow probe.yml):

  python verification/geoportal/probe.py <outdir>

A) Jakarta Satu geoportal (Pemprov DKI, ArcGIS Enterprise): is the ArcGIS REST directory public? Which services/layers hold
   river catchments (DAS), primary drains (saluran), AWLR / water-level gauges (pos duga air, pintu air), pumps, polders?
   Also the portal item search and the site's terms text, so the licence decision is made from their own words.
B) "Sinking City" Jakarta subsidence (Zenodo 10.5281/zenodo.19456870): licence, authors, files; the land-subsidence zip is
   downloaded and every raster described (CRS, extent, pixel size, units text, value range).
Writes summary.json (printed to the log) and keeps raw answers in <outdir>. Nothing here is published.
"""
import hashlib, json, re, sys, time, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path

UA = {"User-Agent": "banjir3d-probe (github.com/raredil/banjir3d)"}
KEYS = re.compile(r"das\b|daerah.aliran|saluran|drain|awlr|duga|tma|muka.air|pintu.air|pompa|polder|sungai|kali\b|banjir|genangan|tanggul|waduk|situ|embung|river|water|hidro|sda", re.I)
SITES = ["https://jakartasatu.jakarta.go.id", "https://tataruang.jakarta.go.id"]
REST_ROOTS = ["/server/rest/services", "/arcgis/rest/services", "/gis/rest/services", "/hosting/rest/services", "/mapserver/rest/services"]
PORTALS = ["/portal/sharing/rest", "/arcgis/sharing/rest", "/sharing/rest"]
SEARCH = ["awlr", "duga air", "tinggi muka air", "saluran", "drainase", "DAS", "sungai", "pintu air", "pompa", "polder", "banjir", "genangan"]
EXTRA = ["https://pantaubanjir.jakarta.go.id/", "https://poskobanjir.dsdadki.web.id/", "https://bpbd.jakarta.go.id/waterlevel",
         "https://satudata.jakarta.go.id/", "https://data.jakarta.go.id/", "https://jakartasatu.jakarta.go.id/portal/home/"]
ZENODO = "https://zenodo.org/api/records/19456870"
log: list[dict] = []


def get(url: str, tries: int = 2, timeout: int = 60):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                body, status, final = r.read(), r.status, r.geturl()
            break
        except urllib.error.HTTPError as e:
            body, status, final = e.read(), e.code, url
            if e.code < 500:
                break
        except Exception as e:
            body, status, final = str(e)[:300].encode(), -1, url
        time.sleep(3 * (k + 1))
    log.append({"url": url, "status": status, "bytes": len(body), "final": final if final != url else None})
    print(status, len(body), url, flush=True)
    return status, body


def js(url: str):
    s, b = get(url)
    if s != 200:
        return None
    try:
        return json.loads(b)
    except Exception:
        return None


def walk_rest(root: str, out: dict) -> None:
    """ArcGIS REST directory: folders -> services -> layers (name, geometry, fields, count)."""
    d = js(root + "?f=json")
    if not d or ("services" not in d and "folders" not in d):
        return
    out.setdefault("roots", []).append(root)
    todo = [(root, d)]
    for f in d.get("folders", [])[:80]:
        fd = js(f"{root}/{urllib.parse.quote(f)}?f=json")
        if fd:
            todo.append((f"{root}/{urllib.parse.quote(f)}", fd))
    for base, dd in todo:
        for s in dd.get("services", []):
            name, typ = s.get("name", ""), s.get("type", "")
            surl = f"{root}/{urllib.parse.quote(name)}/{typ}"
            rec = {"service": name, "type": typ, "url": surl}
            out.setdefault("services", []).append(rec)
            if typ not in ("MapServer", "FeatureServer") or not KEYS.search(name):
                continue
            meta = js(surl + "?f=json") or {}
            rec["description"] = (meta.get("serviceDescription") or meta.get("description") or "")[:300]
            rec["copyright"] = (meta.get("copyrightText") or "")[:300]
            rec["layers"] = []
            for L in (meta.get("layers") or [])[:60]:
                lm = js(f"{surl}/{L['id']}?f=json") or {}
                cnt = js(f"{surl}/{L['id']}/query?where=1%3D1&returnCountOnly=true&f=json") or {}
                rec["layers"].append({"id": L["id"], "name": L.get("name"), "geometry": lm.get("geometryType"),
                                      "fields": [f.get("name") for f in (lm.get("fields") or [])][:40], "count": cnt.get("count"),
                                      "max_record": lm.get("maxRecordCount"), "query": "Query" in (lm.get("capabilities") or meta.get("capabilities") or "")})


def jakartasatu() -> dict:
    res: dict = {"pages": {}, "rest": {}, "portal": {}}
    for site in SITES:
        s, b = get(site + "/")
        html = b.decode("utf-8", "replace")
        res["pages"][site] = {"status": s, "title": (re.findall(r"<title>(.*?)</title>", html, re.S) or [""])[0].strip()[:200],
                              "links": sorted(set(re.findall(r"https?://[^\"' <>]+(?:rest/services|/apps/|/portal/|webmap|item\.html|MapServer|FeatureServer)[^\"' <>]*", html)))[:60]}
        for r in REST_ROOTS:
            walk_rest(site + r, res["rest"].setdefault(site, {}))
        for p in PORTALS:
            info = js(f"{site}{p}/portals/self?f=json")
            if not info:
                continue
            res["portal"][site + p] = {"name": info.get("name"), "access": info.get("access"), "anonymous_access": info.get("canSearchPublic"),
                                       "licenseInfo": (info.get("licenseInfo") or "")[:500], "items": []}
            seen = set()
            for q in SEARCH:
                sr = js(f"{site}{p}/search?q={urllib.parse.quote(q)}&num=50&f=json") or {}
                for it in sr.get("results", []):
                    if it["id"] in seen:
                        continue
                    seen.add(it["id"])
                    res["portal"][site + p]["items"].append({"id": it["id"], "title": it.get("title"), "type": it.get("type"), "url": it.get("url"),
                                                              "owner": it.get("owner"), "access": it.get("access"),
                                                              "licenseInfo": re.sub(r"<[^>]+>", " ", it.get("licenseInfo") or "")[:300],
                                                              "modified": it.get("modified")})
    for u in EXTRA:
        s, b = get(u)
        html = b.decode("utf-8", "replace")
        res["pages"][u] = {"status": s, "title": (re.findall(r"<title>(.*?)</title>", html, re.S) or [""])[0].strip()[:200],
                           "api_like": sorted(set(re.findall(r"[\"'](/?(?:api|data|ajax|json)[^\"' <>]{2,120})[\"']", html)))[:40],
                           "licence_words": sorted(set(m.lower() for m in re.findall(r"creative commons|cc[- ]by[^ <]{0,8}|open data|lisensi[^<]{0,80}|syarat dan ketentuan|terms of use", html, re.I)))[:10]}
    return res


def zenodo(out: Path) -> dict:
    rec = js(ZENODO)
    if not rec:
        return {"error": "record not reachable"}
    md = rec.get("metadata", {})
    res = {"title": md.get("title"), "doi": rec.get("doi"), "publication_date": md.get("publication_date"), "version": md.get("version"),
           "licence": md.get("license") or md.get("rights"), "access_right": md.get("access_right"),
           "creators": [c.get("name") for c in md.get("creators", [])], "related": md.get("related_identifiers"),
           "description": re.sub(r"<[^>]+>", " ", md.get("description") or "")[:3000],
           "files": [{"key": f.get("key"), "size": f.get("size"), "checksum": f.get("checksum"), "link": (f.get("links") or {}).get("self")} for f in rec.get("files", [])]}
    sub = [f for f in res["files"] if f["key"] and "subsid" in f["key"].lower()]
    if not sub:
        return res
    f = sub[0]
    s, b = get(f["link"], timeout=600)
    if s != 200:
        return res
    zp = out / "subsidence.zip"
    zp.write_bytes(b)
    res["zip_sha256"] = hashlib.sha256(b).hexdigest()
    z = zipfile.ZipFile(zp)
    res["zip_members"] = [{"name": i.filename, "size": i.file_size} for i in z.infolist()][:200]
    d = out / "subsidence"
    z.extractall(d)
    import numpy as np, rasterio

    res["rasters"] = []
    for p in sorted(d.rglob("*")):
        if p.suffix.lower() not in (".tif", ".tiff", ".img", ".asc", ".nc"):
            if p.suffix.lower() in (".txt", ".md", ".csv", ".xml", ".json", ".prj") and p.stat().st_size < 20000:
                res.setdefault("texts", {})[str(p.relative_to(d))] = p.read_text("utf-8", "replace")[:3000]
            continue
        try:
            with rasterio.open(p) as src:
                a = src.read(1, masked=True).astype("float64")
                v = a.compressed()
                q = np.percentile(v, [1, 5, 25, 50, 75, 95, 99]).round(4).tolist() if v.size else None
                res["rasters"].append({"file": str(p.relative_to(d)), "crs": str(src.crs), "bounds": [round(x, 5) for x in src.bounds],
                                       "res": [round(src.res[0], 6), round(src.res[1], 6)], "shape": [src.height, src.width], "count": src.count,
                                       "dtype": src.dtypes[0], "nodata": src.nodata, "units": src.units, "descriptions": src.descriptions,
                                       "tags": {k: str(v_)[:200] for k, v_ in list(src.tags().items())[:20]}, "valid": int(v.size),
                                       "min": float(v.min()) if v.size else None, "max": float(v.max()) if v.size else None,
                                       "mean": round(float(v.mean()), 4) if v.size else None, "percentiles_1_5_25_50_75_95_99": q})
        except Exception as e:
            res["rasters"].append({"file": str(p.relative_to(d)), "error": str(e)[:200]})
    return res


if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    summary = {"jakartasatu": jakartasatu(), "zenodo_subsidence": zenodo(out)}
    summary["requests"] = log
    (out / "summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    print("=== SUMMARY ===")
    print(json.dumps(summary, ensure_ascii=False, separators=(",", ":")))
