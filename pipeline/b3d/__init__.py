"""Banjir3D data pipeline."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"


def load_regions() -> dict:
    return json.loads((DATA / "regions.json").read_text())


def load_domain(region: dict):
    """Simulation domain polygon (EPSG:4326, shapely). Falls back to the bbox when a region has no 'domain' file."""
    from shapely.geometry import box, shape

    if not region.get("domain"):
        return box(*region["bbox"])
    fc = json.loads((DATA / region["domain"]).read_text())
    return shape(next(f["geometry"] for f in fc["features"] if f["properties"]["role"] == "domain"))
