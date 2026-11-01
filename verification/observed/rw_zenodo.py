"""RW (rukun warga) boundaries of DKI Jakarta from the Sinking City record (Shabrina et al. 2026, Zenodo 19456870, CC BY 4.0),
file group "05": the first polygon layer with 1,000-6,000 features. Writes <out>/rw.gpkg (layer rw, EPSG:32748, rw_id + names).

  python verification/observed/rw_zenodo.py <out dir>
"""
import hashlib, json, re, sys, zipfile
from pathlib import Path

import geopandas as gpd
import requests

RECORD = "https://zenodo.org/api/records/19456870"


def main(out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    rec = requests.get(RECORD, timeout=60).json()
    f = next(f for f in rec["files"] if f["key"].startswith("05"))
    zp = out / "rw.zip"
    zp.write_bytes(requests.get(f["links"]["self"], timeout=600).content)
    algo, want = f.get("checksum", "md5:").split(":", 1)
    if want and hashlib.new(algo, zp.read_bytes()).hexdigest() != want:
        raise SystemExit(f"checksum mismatch for {f['key']}")
    work = out / "rw_zip"
    with zipfile.ZipFile(zp) as z:
        for m in z.infolist():  # no absolute paths or '..' from the archive
            if m.filename.startswith("/") or ".." in Path(m.filename).parts:
                raise SystemExit(f"unsafe path in zip: {m.filename}")
        z.extractall(work)
    for p in sorted(work.rglob("*")):
        if p.suffix.lower() not in (".shp", ".gpkg", ".geojson"):
            continue
        g = gpd.read_file(p)
        if not (1000 <= len(g) <= 6000) or not g.geom_type.isin(["Polygon", "MultiPolygon"]).all():
            continue
        names = [c for c in g.columns if re.match(r"^(RW|KEL|KEC|KOTA|WADMK|NAMOBJ|DESA)", str(c), re.I)][:4]
        g = g[names + ["geometry"]].to_crs("EPSG:32748").reset_index(drop=True)
        g.insert(0, "rw_id", range(1, len(g) + 1))
        g.to_file(out / "rw.gpkg", layer="rw", driver="GPKG")
        info = {"source": f"Zenodo 19456870 / {f['key']} / {p.relative_to(work)}", "licence": "CC BY 4.0", "n": int(len(g)), "fields": names}
        (out / "rw.json").write_text(json.dumps(info, indent=1))
        print(json.dumps(info))
        return info
    raise SystemExit("no RW polygon layer found in the 05 file")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
