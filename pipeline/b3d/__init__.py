"""Banjir3D data pipeline."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"


def load_regions() -> dict:
    return json.loads((DATA / "regions.json").read_text())
