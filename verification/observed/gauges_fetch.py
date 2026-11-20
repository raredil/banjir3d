"""Download the open West Java daily gauge dataset (BMKG stations, CC BY 4.0) for gauge-adjusted event rain.

  python verification/observed/gauges_fetch.py <out dir>

Dataset: Saputra, Dasanto, Tarigan, Santikayasa, Darmawan (2026), "Daily Rainfall Observations from 460 Stations and Flood Event
Records across West Java, Indonesia (2020-2025)", Mendeley Data v3, doi:10.17632/d7j3s64vvr.3, licence CC BY 4.0.
data.mendeley.com is not reachable from the cloud session, so this runs in an Action (gauges.yml). The file listing is saved as it
came (listing.json), every file up to 300 MB is downloaded, and manifest.json records name, size, sha256 and the URL used.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

DS, VER = "d7j3s64vvr", 3
UA = {"User-Agent": "banjir3d-validation/1.0", "Accept": "application/json"}
LIMIT = 300 * 1024 * 1024


def get(url: str, accept_json=True) -> bytes | None:
    req = urllib.request.Request(url, headers=UA if accept_json else {"User-Agent": UA["User-Agent"]})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read(LIMIT + 1)
    except Exception as e:  # noqa: BLE001 - every failure is recorded, not fatal
        print("fail", url, e)
        return None


def walk(o, out: list):
    """Collect (filename, size, download url) from any nesting of the listing (the schema is not documented)."""
    if isinstance(o, dict):
        name = o.get("filename") or o.get("name")
        cd = o.get("content_details") if isinstance(o.get("content_details"), dict) else {}
        url = cd.get("download_url") or o.get("download_url")
        size = cd.get("size") or o.get("size")
        if name and url:
            out.append({"name": str(name), "size": size, "url": str(url), "id": o.get("id")})
        for v in o.values():
            walk(v, out)
    elif isinstance(o, list):
        for v in o:
            walk(v, out)


def main(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    listing, files = {}, []
    for key, url in (("dataset", f"https://data.mendeley.com/public-api/datasets/{DS}?version={VER}"),
                     ("files", f"https://data.mendeley.com/public-api/datasets/{DS}/files?folder_id=root&version={VER}")):
        b = get(url)
        if b:
            try:
                listing[key] = json.loads(b)
            except ValueError:
                listing[key] = b[:2000].decode("utf-8", "replace")
    (out / "listing.json").write_text(json.dumps(listing, indent=1))
    walk(listing, files)
    seen, man = set(), []
    for f in files:
        name = Path(f["name"]).name
        if name in seen or not name or name.startswith("."):
            continue
        seen.add(name)
        b = get(f["url"], accept_json=False)
        rec = {"name": name, "url": f["url"], "listed_size": f["size"]}
        if b is None or len(b) > LIMIT:
            rec["status"] = "failed" if b is None else "too large"
        else:
            (out / name).write_bytes(b)
            rec.update(status="ok", bytes=len(b), sha256=hashlib.sha256(b).hexdigest())
        man.append(rec)
        print(rec["status"], name, rec.get("bytes"))
    (out / "manifest.json").write_text(json.dumps({
        "dataset": f"doi:10.17632/{DS}.{VER}", "licence": "CC BY 4.0",
        "citation": "Saputra H, Dasanto BD, Tarigan SD, Santikayasa IP, Darmawan Y (2026). Daily Rainfall Observations from 460 Stations "
                    "and Flood Event Records across West Java, Indonesia (2020-2025). Mendeley Data, V3.",
        "files": man}, indent=1))
    if not any(m["status"] == "ok" for m in man):
        print("::warning::no file downloaded; see listing.json")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
