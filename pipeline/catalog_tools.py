"""Validate data/catalog.json and build data/REFERENCES.bib.

Usage: python catalog_tools.py [--write-bib]
Exit code 1 on any problem (used in CI).
"""
from __future__ import annotations

import json
import re
import sys

from jsonschema import Draft202012Validator, FormatChecker

from b3d import DATA


def load():
    return json.loads((DATA / "catalog.json").read_text()), json.loads((DATA / "catalog.schema.json").read_text())


def bib_entries(catalog: dict) -> dict[str, str]:
    """Split every record's BibTeX into entries keyed by citation key (duplicates must be identical)."""
    entries: dict[str, str] = {}
    for d in catalog["datasets"]:
        for chunk in re.split(r"\n(?=@)", d["citation"]["bibtex"].strip()):
            m = re.match(r"@\w+\{([^,]+),", chunk)
            if not m:
                raise ValueError(f"{d['id']}: bad BibTeX entry")
            key = m.group(1)
            if key in entries and entries[key] != chunk:
                raise ValueError(f"BibTeX key {key} defined differently in {d['id']}")
            entries[key] = chunk
    return entries


def check() -> list[str]:
    catalog, schema = load()
    errors = [f"{'/'.join(map(str, e.path))}: {e.message}" for e in Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(catalog)]
    ids = [d["id"] for d in catalog["datasets"]]
    errors += [f"duplicate id {i}" for i in set(ids) if ids.count(i) > 1]
    try:
        bib_entries(catalog)
    except ValueError as e:
        errors.append(str(e))
    for d in catalog["datasets"]:
        if d["doi"] and d["doi"] not in d["citation"]["bibtex"] and d["doi"] not in d["citation"]["text"]:
            errors.append(f"{d['id']}: DOI not in citation")
    return errors


def write_bib() -> None:
    catalog, _ = load()
    entries = bib_entries(catalog)
    head = f"% Generated from data/catalog.json (catalog {catalog['catalog_version']}, {catalog['updated']}). Do not edit by hand.\n\n"
    (DATA / "REFERENCES.bib").write_text(head + "\n\n".join(entries[k] for k in sorted(entries)) + "\n")


if __name__ == "__main__":
    problems = check()
    for p in problems:
        print("ERROR", p)
    if problems:
        sys.exit(1)
    if "--write-bib" in sys.argv:
        write_bib()
    print("catalog OK")
