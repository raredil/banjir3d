from b3d.rbi import sheet_code, sheets_in_bbox


def test_known_100k_sheets():
    assert sheet_code(106.83, -6.18, 100_000) == "1209-4"  # Jakarta
    assert sheet_code(106.80, -5.80, 100_000) == "1210-1"  # Jakarta north / Kep. Seribu
    assert sheet_code(106.80, -6.60, 100_000) == "1209-1"  # Bogor


def test_known_25k_sheets():
    assert sheet_code(106.80, -6.595, 25_000) == "1209-143"  # Bogor (BAKOSURTANAL guide)
    bandung = {sheet_code(lon, lat, 25_000) for lon in (107.56, 107.69) for lat in (-6.98, -6.85)}
    assert bandung == {"1209-311", "1209-312", "1209-313", "1209-314"}


def test_bbox_tiles():
    tiles = sheets_in_bbox([106.5, -6.5, 107.0, -6.0], 50_000)
    assert sorted(t["code"] for t in tiles) == ["1209-41", "1209-42", "1209-43", "1209-44"]


def test_every_builder_has_catalog_id():
    import json
    from b3d import DATA
    from b3d.layers import LAYERS
    ids = {d["id"] for d in json.loads((DATA / "catalog.json").read_text())["datasets"]}
    for fns in LAYERS.values():
        for fn in fns:
            assert fn.dataset in ids
