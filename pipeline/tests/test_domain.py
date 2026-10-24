from shapely.geometry import Point

from b3d import load_domain, load_regions


def test_jakarta_domain():
    region = load_regions()["jakarta"]
    d = load_domain(region)
    assert d.is_valid
    for lon, lat in [(106.83, -6.18), (106.76, -6.17), (106.80, -6.27), (106.90, -6.23), (106.90, -6.12)]:
        assert d.contains(Point(lon, lat))  # Pusat, Barat, Selatan, Timur, Utara
    assert d.contains(Point(106.64, -6.18))  # Kota Tangerang (Banten), inside the 10 km buffer
    assert d.contains(Point(107.00, -6.24))  # Kota Bekasi (Jawa Barat)
    assert not d.contains(Point(106.61, -5.745))  # Pulau Pramuka, Kepulauan Seribu: excluded
    assert not d.contains(Point(106.80, -6.60))  # Kota Bogor: beyond the buffer
    w, s, e, n = region["bbox"]
    dw, ds, de, dn = d.bounds
    assert w <= dw and s <= ds and e >= de and n >= dn
