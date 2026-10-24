"""OSM water parsing on a tiny synthetic OSM file (no network)."""
import pyogrio

from b3d import layers

OSM = """<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Overpass API">
<meta osm_base="2026-10-23T00:00:00Z"/>
<node id="1" lat="-6.2000" lon="106.8500"/><node id="2" lat="-6.2000" lon="106.8503"/>
<node id="3" lat="-6.2003" lon="106.8503"/><node id="4" lat="-6.2003" lon="106.8500"/>
<node id="5" lat="-6.2100" lon="106.8600"/><node id="6" lat="-6.2200" lon="106.8700"/>
<node id="7" lat="-6.2300" lon="106.8600"/><node id="8" lat="-6.2300" lon="106.8610"/>
<node id="9" lat="-6.2310" lon="106.8610"/><node id="10" lat="-6.2310" lon="106.8600"/>
<way id="100"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
  <tag k="natural" v="water"/><tag k="water" v="pond"/><tag k="name" v="Situ Kecil"/></way>
<way id="101"><nd ref="5"/><nd ref="6"/><tag k="waterway" v="river"/><tag k="name" v="Ciliwung"/></way>
<way id="102"><nd ref="7"/><nd ref="8"/><nd ref="9"/><nd ref="10"/><nd ref="7"/></way>
<relation id="200"><member type="way" ref="102" role="outer"/>
  <tag k="type" v="multipolygon"/><tag k="landuse" v="reservoir"/><tag k="name" v="Waduk"/></relation>
</osm>
"""


def test_osm_water(tmp_path, monkeypatch):
    osm = tmp_path / "water.osm"
    osm.write_text(OSM)
    monkeypatch.setattr(layers, "_fetch_osm_water", lambda bbox: (osm, "2026-10-23T00:00:00Z", {"op": "test"}))
    region = {"bbox": [106.8, -6.3, 106.9, -6.1], "crs": "EPSG:32748"}
    rec = layers.osm_water(region, tmp_path)
    assert rec["version"] == "OSM snapshot 2026-10-23T00:00:00Z"
    areas = pyogrio.read_dataframe(tmp_path / "water_osm.gpkg", layer="water_areas")
    lines = pyogrio.read_dataframe(tmp_path / "water_osm.gpkg", layer="waterways")
    assert set(areas["kind"]) == {"pond", "reservoir"}
    assert 800 < areas.loc[areas["kind"] == "pond", "area_m2"].iloc[0] < 1300  # ~33 m x 33 m pond kept
    assert list(lines["name"]) == ["Ciliwung"]
    assert (tmp_path / "water_osm.pmtiles").stat().st_size > 0
