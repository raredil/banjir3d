import json

import geopandas as gpd
import pyogrio
from shapely.geometry import LineString, Point, box

import map_layers


def test_map_layers(tmp_path):
    gp, pb, pack = tmp_path / "js.gpkg", tmp_path / "pb", tmp_path / "pack"
    pack.mkdir()
    crs = "EPSG:32748"
    gpd.GeoDataFrame({"NAMA_SALURAN": ["Kali A"], "width_m": [12.0], "depth_m": [3.5]}, geometry=[LineString([(700000, 9310000), (701000, 9310000)])], crs=crs).to_file(gp, layer="drain_primary_line")
    gpd.GeoDataFrame({"NAMA_POMPA": ["Pompa B"], "TTLKPSTS": [4.5], "SECRET_NOTE": ["x"]}, geometry=[Point(700500, 9310500)], crs=crs).to_file(gp, layer="pumps")
    gpd.GeoDataFrame({"TGL": [1577836800000], "TGIMAX": [80], "TGIGNGN": [50], "KELURAHAN": ["Kampung Melayu"]}, geometry=[box(700000, 9309000, 700300, 9309300)], crs=crs).to_file(gp, layer="genangan")
    (pb / "2020-01-01").mkdir(parents=True)
    (pb / "2020-01-01" / "pb_reports_archive_geojson.json").write_text(json.dumps({"result": {"features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [106.86, -6.22]},
         "properties": {"created_at": "2020-01-01T01:00:00Z", "source": "grasp", "text": "private words", "image_url": "u", "report_data": {"flood_depth": 70}}}]}}))
    (pack / "manifest.json").write_text(json.dumps({"layers": [{"dataset": "osm-water", "display": []}], "attribution": []}))
    rec = map_layers.main(gp, pb, pack)
    js = gpd.read_file(pack / "jakartasatu.gpkg")
    assert sorted(js["t"]) == ["drain1", "genangan", "pump"]
    g = js[js.t == "genangan"].iloc[0]
    assert g["date"] == "2020-01-01" and g["depth_cm"] == 80 and "Kampung Melayu" in g["info"]
    assert js[js.t == "pump"].iloc[0]["cap_m3s"] == 4.5 and "SECRET" not in js[js.t == "pump"].iloc[0]["info"]
    rep = gpd.read_file(pack / "reports_petabencana.geojson")
    assert str(rep["time_wib"][0])[:16] == "2020-01-01 08:00" and "text" not in rep.columns and rep["depth_cm"][0] == 70
    m = json.loads((pack / "manifest.json").read_text())
    files = {d["file"] for l in m["layers"] for d in l.get("display", [])}
    assert {"jakartasatu.pmtiles", "reports_petabencana.pmtiles"} <= files
    assert "Jakarta Satu, Dinas Sumber Daya Air Provinsi DKI Jakarta" in m["attribution"]
    assert rec["petabencana"]["2020-01-01"] == 1
    assert "js" in [x[0] for x in pyogrio.list_layers(pack / "jakartasatu.pmtiles")]
