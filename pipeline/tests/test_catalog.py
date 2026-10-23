from catalog_tools import check


def test_catalog_valid():
    assert check() == []
