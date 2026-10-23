"""Re-check every catalog dataset from the open internet (GitHub Actions) and write verify-report.json.

Checks: landing URL reachable, DOI registered (doi.org handle API), plus dataset-specific facts
(Zenodo licence, newest Overture release, newest IO LULC year, FABDEM V1-2 listing, WorldPop file).
Text from remote pages is stored as data only.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import requests

from b3d import DATA
from b3d.util import USER_AGENT, now_utc

H = {"User-Agent": USER_AGENT}


def get(url, **kw):
    try:
        return requests.get(url, headers=H, timeout=60, **kw)
    except requests.RequestException as e:
        return e


def status(r):
    return r.status_code if isinstance(r, requests.Response) else f"error: {type(r).__name__}"


def zenodo_licence(record_id: str) -> dict:
    r = get(f"https://zenodo.org/api/records/{record_id}")
    if not isinstance(r, requests.Response) or r.status_code != 200:
        return {"status": status(r)}
    m = r.json().get("metadata", {})
    return {"status": 200, "title": m.get("title"), "version": m.get("version"),
            "licence": (m.get("license") or {}).get("id"), "publication_date": m.get("publication_date"),
            "creators": [c.get("name") for c in m.get("creators", [])][:12]}


def extra_checks() -> dict:
    out = {}
    out["zenodo_worldcover"] = zenodo_licence("7254221")
    out["zenodo_sinking_city"] = zenodo_licence("19456870")
    r = get("https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/",
            params={"list-type": "2", "prefix": "release/", "delimiter": "/"})
    if isinstance(r, requests.Response):
        out["overture_latest_release"] = sorted(re.findall(r"<Prefix>release/([^<]+)/</Prefix>", r.text))[-1:]
    years = [y for y in range(2017, 2031)
             if status(get(f"https://io-10m-annual-lulc.s3.amazonaws.com/48M_{y}.tif", headers={**H, "Range": "bytes=0-0"})) == 206]
    out["io_lulc_years_aws"] = years
    r = get("https://planetarycomputer.microsoft.com/api/stac/v1/collections/io-lulc-annual-v02")
    if isinstance(r, requests.Response) and r.status_code == 200:
        out["io_lulc_pc_interval"] = r.json().get("extent", {}).get("temporal", {}).get("interval")
    r = get("https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/")
    if isinstance(r, requests.Response):
        out["fabdem_v12_zip_count"] = len(set(re.findall(r"_FABDEM_V1-2\.zip", r.text)))
        out["fabdem_page_mentions_cc_by_nc_sa"] = "NC-SA" in r.text or "noncommercial" in r.text.lower()
    r = get("https://data.bris.ac.uk/data/dataset/s5hqmjcdj8yo2ibzi9b4ew3sn")
    if isinstance(r, requests.Response):
        lic = re.findall(r"(Creative Commons[^<]{0,80})", r.text)
        out["fabdem_landing_licence_text"] = lic[:2]
    r = get("https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2025/IDN/v1/100m/constrained/")
    if isinstance(r, requests.Response):
        out["worldpop_idn_2025_files"] = re.findall(r'href="([^"]+\.tif)"', r.text)[:3]
    r = get("https://www.geoboundaries.org/api/current/gbOpen/IDN/ALL/")
    if isinstance(r, requests.Response) and r.status_code == 200:
        try:
            out["geoboundaries_idn_levels"] = [{k: x.get(k) for k in ("boundaryType", "boundaryID", "boundaryLicense", "boundaryYearRepresented")} for x in r.json()]
        except ValueError:
            pass
    return out


def main() -> int:
    catalog = json.loads((DATA / "catalog.json").read_text())
    rows = []
    for d in catalog["datasets"]:
        row = {"id": d["id"], "url": d["url"], "url_status": status(get(d["url"], allow_redirects=True))}
        if d.get("doi"):
            r = get(f"https://doi.org/api/handles/{d['doi']}")
            row["doi"] = d["doi"]
            row["doi_registered"] = isinstance(r, requests.Response) and r.status_code == 200 and r.json().get("responseCode") == 1
        rows.append(row)
        print(row, flush=True)
    report = {"checked": now_utc(), "catalog_version": catalog["catalog_version"], "datasets": rows, "facts": extra_checks()}
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "verify-report.json"
    out.write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps(report["facts"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
