"""Build (part of) a region pack.

  python region_pack.py build  <region> <group> --out DIR   # one layer group, writes DIR/record-<group>.json
  python region_pack.py merge  <region> --out DIR           # merge records into DIR/manifest.json
  python region_pack.py retile <region> --out DIR           # re-render display tiles of a downloaded pack in DIR

Groups: see b3d.layers.LAYERS. A failing dataset is recorded (status "failed" + error) and does not stop the others.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from pathlib import Path

from b3d import DATA, load_regions
from b3d.layers import LAYERS
from b3d.util import now_utc, software_versions


def build(region_id: str, group: str, out: Path) -> int:
    region = load_regions()[region_id]
    out.mkdir(parents=True, exist_ok=True)
    records, failed = [], 0
    for fn in LAYERS[group]:
        print(f"== {group}/{fn.__name__}", flush=True)
        try:
            rec = fn(region, out)
            rec["status"] = "ok"
        except Exception as e:  # recorded, reported, and the job exits non-zero at the end
            traceback.print_exc()
            rec = {"dataset": getattr(fn, "dataset", fn.__name__), "status": "failed", "error": f"{type(e).__name__}: {e}", "accessed": now_utc()}
            failed += 1
        records.append(rec)
    (out / f"record-{group}.json").write_text(json.dumps(records, indent=1, default=str) + "\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:  # short status table, so the run can be checked without reading full logs
        with open(summary, "a") as f:
            f.write(f"### {region_id} / {group}\n\n| dataset | status | error |\n|---|---|---|\n")
            for r in records:
                err = str(r.get("error", "")).replace("|", "/").replace("\n", " ")[:300]
                f.write(f"| {r['dataset']} | {r['status']} | {err} |\n")
    for r in records:
        if r["status"] == "failed":
            print(f"::error title={r['dataset']} failed::{str(r['error'])[:300]}")
    return failed


def output_licence(licences: list[str]) -> str:
    """Most restrictive input licence wins (BLUEPRINT A1); ODbL inputs keep their share-alike database terms."""
    if any("NC-SA" in x for x in licences):
        return "CC-BY-NC-SA-4.0"
    if any("ODbL" in x for x in licences):
        return "ODbL-1.0 (vector data) + CC-BY-4.0 (rasters)"
    return "CC-BY-4.0"


def merge(region_id: str, out: Path) -> None:
    region = load_regions()[region_id]
    catalog = json.loads((DATA / "catalog.json").read_text())
    cat = {d["id"]: d for d in catalog["datasets"]}
    layers = []
    for f in sorted(out.glob("record-*.json")):
        layers += json.loads(f.read_text())
    licences = sorted({cat[r["dataset"]]["licence"]["id"] for r in layers if r.get("status") == "ok" and r["dataset"] in cat})
    attributions = sorted({cat[r["dataset"]]["licence"].get("attribution", "") for r in layers
                           if r.get("status") == "ok" and r["dataset"] in cat} - {""})
    run = os.environ.get("GITHUB_RUN_ID")
    repo = os.environ.get("GITHUB_REPOSITORY")
    manifest = {
        "type": "banjir3d-region-pack",
        "schema_version": 1,
        "region_id": region_id,
        "region": region,
        "created": now_utc(),
        "software": {**software_versions(), "git_commit": os.environ.get("GITHUB_SHA"),
                     "action_run": f"https://github.com/{repo}/actions/runs/{run}" if run else None},
        "catalog_version": catalog["catalog_version"],
        "licences": licences,
        "output_licence": output_licence(licences),
        "attribution": attributions,
        "layers": layers,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, default=str) + "\n")
    print(json.dumps({r["dataset"]: r["status"] for r in layers}, indent=1))


def retile(region_id: str, out: Path, source_tag: str | None) -> None:
    """Re-render the Sentinel-2 display tiles of an existing pack from its own COG (the source data is unchanged) and
    record the step in manifest.json."""
    from b3d.layers import imagery_display
    region = load_regions()[region_id]
    path = out / "manifest.json"
    manifest = json.loads(path.read_text())
    rec = next(r for r in manifest["layers"] if r["dataset"] == "sentinel-2-l2a" and r.get("status") == "ok")
    imagery_display(rec, out / "imagery_s2_rgb.tif", out, region)
    rec["steps"].append({"op": "re-tile display (sharper z14)", "tool": "b3d.layers.imagery_display", "date": now_utc(),
                         "params": {"from_release": source_tag, "resampling": "average; lanczos at z14", "webp_quality": 92}})
    manifest["retiled"] = {"date": now_utc(), "from_release": source_tag,
                           "software": {**software_versions(), "git_commit": os.environ.get("GITHUB_SHA")}}
    path.write_text(json.dumps(manifest, indent=1, default=str) + "\n")
    print(json.dumps(rec["display"], indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["build", "merge", "retile"])
    ap.add_argument("region")
    ap.add_argument("group", nargs="?")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--source-tag")
    a = ap.parse_args()
    if a.cmd == "build":
        sys.exit(1 if build(a.region, a.group, a.out) else 0)
    if a.cmd == "retile":
        retile(a.region, a.out, a.source_tag)
    else:
        merge(a.region, a.out)
