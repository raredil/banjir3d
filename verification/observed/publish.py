"""Pack what fetch.py got into release files.  python verification/observed/publish.py <obsdir> <pubdir>

observed.tar.gz: rain, station records, terms excerpt, manifest (all open). PetaBencana answers go in petabencana.tar.gz only if
their terms text names an open licence; otherwise petabencana_summary.json holds status, counts and field names, no records.
"""
import json, re, sys, tarfile
from pathlib import Path

OPEN = re.compile(r"ODbL|Open Database Licen[cs]e|Creative Commons|CC[ -]BY|CC0", re.I)


def features(b: bytes):
    try:
        d = json.loads(b)
    except ValueError:
        return None, []
    r = d.get("result", d) if isinstance(d, dict) else d
    if isinstance(r, dict) and "features" in r:
        f = r["features"]
        return len(f), sorted(f[0].get("properties", {}).keys()) if f else []
    if isinstance(r, dict) and "objects" in r:  # topojson
        o = next(iter(r["objects"].values()), {})
        g = o.get("geometries", [])
        return len(g), sorted(g[0].get("properties", {}).keys()) if g else []
    if isinstance(r, list):
        return len(r), sorted(r[0].keys()) if r and isinstance(r[0], dict) else []
    return None, sorted(r.keys()) if isinstance(r, dict) else []


def structure(b: bytes) -> dict:
    """Field names one level down and the range of numeric fields: what compare.py needs, no records."""
    try:
        d = json.loads(b)
    except ValueError:
        return {}
    r = d.get("result", d) if isinstance(d, dict) else d
    items = r.get("features", []) if isinstance(r, dict) else r if isinstance(r, list) else []
    if isinstance(r, dict) and "objects" in r:
        items = next(iter(r["objects"].values()), {}).get("geometries", [])
    sub, num, geom = {}, {}, set()
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        geom.add((it.get("geometry") or {}).get("type") if "geometry" in it else it.get("type"))
        props = it.get("properties", it)
        for k, v in props.items():
            if isinstance(v, dict):
                sub.setdefault(k, set()).update(v.keys())
                for k2, v2 in v.items():
                    if isinstance(v2, (int, float)) and not isinstance(v2, bool):
                        lo, hi = num.get(f"{k}.{k2}", (v2, v2)); num[f"{k}.{k2}"] = (min(lo, v2), max(hi, v2))
            elif isinstance(v, (int, float)) and not isinstance(v, bool):
                lo, hi = num.get(k, (v, v)); num[k] = (min(lo, v), max(hi, v))
            elif isinstance(v, str) and k in ("source", "status", "disaster_type", "max_state", "state"):
                sub.setdefault(f"{k}=", set()).add(v[:20])
    return {"subfields": {k: sorted(map(str, v)) for k, v in sub.items()}, "numeric_ranges": num, "geometry": sorted(map(str, geom))}


def main():
    obs, pub = Path(sys.argv[1]), Path(sys.argv[2])
    pub.mkdir(parents=True, exist_ok=True)
    terms = json.loads((obs / "petabencana_terms.json").read_text())
    hits = [t for t in terms if OPEN.search(t["text"])]
    pb = sorted(obs.glob("*/pb_*.json")) + sorted(obs.glob("pb_*.json"))
    with tarfile.open(pub / "observed.tar.gz", "w:gz") as t:
        for p in sorted(obs.rglob("*")):
            if p.is_file() and not p.name.startswith("pb_"):
                t.add(p, p.relative_to(obs).as_posix())
    summary = {"open_licence_lines": hits, "published_records": bool(hits), "files": []}
    for p in pb:
        b = p.read_bytes()
        n, keys = features(b)
        rec = {"file": p.relative_to(obs).as_posix(), "bytes": len(b), "count": n, "fields": keys, **structure(b)}
        if n is None:
            rec["answer"] = b[:300].decode("utf-8", "replace")  # error messages, not records
        summary["files"].append(rec)
    if hits:
        with tarfile.open(pub / "petabencana.tar.gz", "w:gz") as t:
            for p in pb:
                t.add(p, p.relative_to(obs).as_posix())
    (pub / "petabencana_summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    print(json.dumps(summary, indent=1, ensure_ascii=False)[:4000])


if __name__ == "__main__":
    main()
