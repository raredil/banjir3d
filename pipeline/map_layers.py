"""Map layers from Jakarta Satu (Dinas SDA DKI) and PetaBencana citizen flood reports (owner decision 2026-11-01, ADR 0014:
verbal permission to publish, attribution kept).

  python pipeline/map_layers.py <jakartasatu.gpkg> <petabencana dir> <pack dir>

Writes into <pack dir>:
  jakartasatu.pmtiles   vector, layer "js": drains (t = drain1 | drain2, width/depth), pumps (capacity m3/s), polders,
                        NCICD walls, official flood polygons per RT ("genangan": date WIB, year, depth cm)
  jakartasatu.gpkg      the same features in EPSG:4326 (download)
  reports_petabencana.pmtiles / .geojson   citizen reports of the validation events: time WIB, depth cm, source, event id
                        (no text, photos or user names: not needed for the map, kept out on purpose)
  map_layers.json       provenance and counts
and adds both datasets with their display files to manifest.json.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio

from b3d.util import now_utc, output_record

JS_ATTR = "Jakarta Satu, Dinas Sumber Daya Air Provinsi DKI Jakarta"
PB_ATTR = "PetaBencana.id (Yayasan Peta Bencana)"
# descriptive text fields worth showing in a popup (names, places); matched on the field name, values cut to 80 characters
PLACE = re.compile(r"^(NAMA|NAMOBJ|LOKASI|ALAMAT|KEL|KEC|KOTA|KAB|WIL|RW|RT|SUNGAI|SALURAN|POMPA|RUMAH|SISTEM|POLDER|PENYEBAB|STATUS|JENIS|TIPE)|(^|_)(NAMA|NM|NAME)(_|$)", re.I)
MAX_FIELDS = 6


# popup fields per layer type, as named in the Jakarta Satu services (field lists recorded in map_layers.json 'all_fields')
LABELS = {
    "drain": [("TOPONIMI", "Nama"), ("JENIS", "Jenis"), ("KONDISI", "Kondisi"), ("KNDS", "Kondisi")],
    "pump": [("LOKPOMPA", "Lokasi"), ("WADMKD", "Kelurahan"), ("WADMKC", "Kecamatan"), ("JMLPOMPA", "Jumlah pompa"), ("KONDISI", "Kondisi")],
    "polder": [("NAMOBJ", "Nama")],
    "wall": [("LOKASI", "Lokasi"), ("TIPE", "Tipe"), ("STATUS", "Status"), ("TAHUN", "Tahun")],
    "genangan": [("WADMRT", "RT"), ("WADMRW", "RW"), ("WADMKD", "Kelurahan"), ("WADMKC", "Kecamatan"), ("DRSGNGN", "Lama (DRSGNGN)"), ("KTGPNYB", "Penyebab")],
}


def describe(g: pd.DataFrame, kind: str = "") -> tuple[pd.Series, list[str]]:
    """'Label: value · Label: value' text from the known fields of the layer type, else from name/place-like fields."""
    known = [(c, lbl) for c, lbl in LABELS.get(kind, []) if c in g.columns]
    if not known:
        known = [(c, str(c).replace("_", " ").title()) for c in g.columns
                 if c != "geometry" and PLACE.match(str(c)) and (pd.api.types.is_string_dtype(g[c]) or g[c].dtype == object)][:MAX_FIELDS]
    if not known:
        return pd.Series([""] * len(g), index=g.index), []
    def val(v):
        if v is None or (isinstance(v, float) and v != v):
            return ""
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        v = str(v).strip()
        return "" if v in ("", "None", "nan", "-", "0") else v[:80]
    def one(r):
        return " · ".join(f"{lbl}: {val(r[c])}" for c, lbl in known if val(r[c]))
    return g.apply(one, axis=1), [c for c, _ in known]


def num(s) -> pd.Series:
    return pd.to_numeric(s, errors="coerce")


def jakartasatu(gpkg: Path) -> tuple[gpd.GeoDataFrame, dict]:
    have = set(pyogrio.list_layers(gpkg)[:, 0]) if gpkg.exists() else set()
    parts, info = [], {}
    for layer, t in (("drain_primary_line", "drain1"), ("drain_secondary_line", "drain2"), ("pumps", "pump"),
                     ("polders", "polder"), ("wall_ncicd", "wall"), ("wall_river", "wall"), ("genangan", "genangan")):
        if layer not in have:
            info[layer] = 0
            continue
        g = gpd.read_file(gpkg, layer=layer).to_crs("EPSG:4326")
        out = gpd.GeoDataFrame({"t": t}, index=g.index, geometry=g.geometry, crs="EPSG:4326")
        out["info"], used = describe(g, "drain" if t.startswith("drain") else t)
        if t.startswith("drain"):
            out["width_m"] = num(g.get("width_m")).round(1)
            out["depth_m"] = num(g.get("depth_m")).round(2)
        if t == "pump":
            out["cap_m3s"] = num(g.get("TTLKPSTS")).round(2)
        if t == "genangan":
            d = pd.to_datetime(num(g.get("TGL")), unit="ms", utc=True).dt.tz_convert("Asia/Jakarta")
            out["date"] = d.dt.strftime("%Y-%m-%d")
            out["year"] = d.dt.year.astype("Int64")
            dep = num(g.get("TGIMAX"))
            out["depth_cm"] = dep.where(dep > 0, num(g.get("TGIGNGN"))).round(0)
        parts.append(out)
        info[layer] = {"features": int(len(out)), "text_fields": used, "all_fields": [str(c) for c in g.columns if c != "geometry"][:60]}
    js = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs="EPSG:4326") if parts else gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    return js, info


def petabencana(pbdir: Path, events: list[dict]) -> gpd.GeoDataFrame:
    rows = []
    for ev in events:
        f = pbdir / ev["id"] / "pb_reports_archive_geojson.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        r = d.get("result", d) if isinstance(d, dict) else d
        for ft in (r.get("features", []) if isinstance(r, dict) else []):
            g, p = ft.get("geometry") or {}, ft.get("properties") or {}
            if g.get("type") != "Point" or p.get("disaster_type", "flood") != "flood":
                continue
            dep = (p.get("report_data") or {}).get("flood_depth")
            t = pd.Timestamp(p.get("created_at")).tz_convert("Asia/Jakarta") if p.get("created_at") else None
            rows.append({"event": ev["id"], "time_wib": t.strftime("%Y-%m-%d %H:%M") if t is not None else None,
                         "depth_cm": float(dep) if isinstance(dep, (int, float)) and dep > 0 else None,
                         "source": str(p.get("source") or "")[:20], "x": g["coordinates"][0], "y": g["coordinates"][1]})
    df = pd.DataFrame(rows, columns=["event", "time_wib", "depth_cm", "source", "x", "y"])
    return gpd.GeoDataFrame(df.drop(columns=["x", "y"]), geometry=gpd.points_from_xy(df["x"], df["y"]), crs="EPSG:4326")


def add_to_manifest(pack: Path, recs: list[dict]) -> None:
    path = pack / "manifest.json"
    m = json.loads(path.read_text())
    ids = {r["dataset"] for r in recs}
    m["layers"] = [l for l in m["layers"] if l.get("dataset") not in ids] + recs
    for r in recs:
        a = r.get("attribution")
        if a and a not in m.get("attribution", []):
            m.setdefault("attribution", []).append(a)
    path.write_text(json.dumps(m, indent=1, default=str) + "\n")


def extra_records(pack: Path) -> list[dict]:
    """DEMNAS and subsidence records written by their own scripts: their tile files go into the manifest as display files."""
    out = []
    for name, ds, attr in (("dem_demnas.json", "demnas", "DEMNAS © Badan Informasi Geospasial"),
                           ("subsidence_insar.json", "jakarta-subsidence-sinking-city", "Land subsidence: Shabrina et al. (2026), CC BY 4.0")):
        p = pack / name
        if not p.exists():
            continue
        r = json.loads(p.read_text())
        disp = [o for o in r.get("outputs", []) if o["file"].endswith(".pmtiles")]
        out.append({"dataset": r.get("dataset", ds), "accessed": r.get("created"), "sources": r.get("sources"), "status": "ok",
                    "attribution": r.get("attribution", attr), "outputs": [o for o in r.get("outputs", []) if o not in disp], "display": disp})
    return out


def main(gpkg: Path, pbdir: Path, pack: Path) -> dict:
    events = json.loads((Path(__file__).resolve().parents[1] / "verification/observed/events.json").read_text())["events"]
    js, info = jakartasatu(gpkg)
    rec = {"created": now_utc(), "decision": "owner 2026-11-01: verbal permission to publish Jakarta Satu and other maps (ADR 0014)", "jakartasatu": info}
    recs = []
    if len(js):
        pm, gp = pack / "jakartasatu.pmtiles", pack / "jakartasatu.gpkg"
        for p in (pm, gp):
            p.unlink(missing_ok=True)
        pyogrio.write_dataframe(js, pm, driver="PMTiles", layer="js", geometry_type="Unknown",
                                dataset_options={"MINZOOM": 9, "MAXZOOM": 15, "NAME": "Jakarta Satu DSDA"})
        pyogrio.write_dataframe(js, gp, layer="jakartasatu", driver="GPKG", geometry_type="Unknown")
        for t in js["t"].unique():  # per-type GeoJSON for the export menu (whole data, view or box, filtered in the browser)
            gj = pack / f"jakartasatu_{t}.geojson"
            gj.unlink(missing_ok=True)
            pyogrio.write_dataframe(js[js["t"] == t], gj, driver="GeoJSON", COORDINATE_PRECISION=6)
        recs.append({"dataset": "jakartasatu-dsda", "accessed": rec["created"], "status": "ok", "attribution": JS_ATTR,
                     "sources": ["https://jakartasatu.jakarta.go.id/server/rest/services/DSDA/"],
                     "steps": ["ArcGIS REST query (pipeline/jakartasatu.py)", "normalise fields, EPSG:4326 (pipeline/map_layers.py)"],
                     "outputs": [output_record(gp, features=int(len(js)))],
                     "display": [output_record(pm, kind="vector", layer="js", minzoom=9, maxzoom=15)]})
    pb = petabencana(pbdir, events)
    rec["petabencana"] = {e["id"]: int((pb["event"] == e["id"]).sum()) for e in events}
    if len(pb):
        pm, gj = pack / "reports_petabencana.pmtiles", pack / "reports_petabencana.geojson"
        for p in (pm, gj):
            p.unlink(missing_ok=True)
        pyogrio.write_dataframe(pb, pm, driver="PMTiles", layer="reports", dataset_options={"MINZOOM": 8, "MAXZOOM": 15, "NAME": "PetaBencana reports"})
        pyogrio.write_dataframe(pb, gj, driver="GeoJSON")
        recs.append({"dataset": "petabencana", "accessed": rec["created"], "status": "ok", "attribution": PB_ATTR,
                     "sources": ["https://data.petabencana.id/reports/archive"],
                     "steps": ["reports/archive per event window (verification/observed/fetch.py)", "keep point, time, depth, source (pipeline/map_layers.py)"],
                     "outputs": [output_record(gj, features=int(len(pb)))],
                     "display": [output_record(pm, kind="vector", layer="reports", minzoom=8, maxzoom=15)]})
    for src, layer, dst in (("water_osm.gpkg", None, "water_osm.geojson"), ("admin_geoboundaries.gpkg", None, "admin_geoboundaries.geojson")):
        if (pack / src).exists():  # other vector layers of the pack as GeoJSON for the export menu
            parts = [gpd.read_file(pack / src, layer=l).to_crs("EPSG:4326").assign(layer=l) for l in pyogrio.list_layers(pack / src)[:, 0]]
            (pack / dst).unlink(missing_ok=True)
            pyogrio.write_dataframe(gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs="EPSG:4326"), pack / dst, driver="GeoJSON", COORDINATE_PRECISION=6)
        recs += extra_records(pack)
    add_to_manifest(pack, recs)
    rec["manifest_added"] = [r["dataset"] for r in recs]
    (pack / "map_layers.json").write_text(json.dumps(rec, indent=1, ensure_ascii=False, default=str))
    print(json.dumps(rec, indent=1, ensure_ascii=False, default=str))
    return rec


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
