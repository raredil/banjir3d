#!/usr/bin/env python3
"""make_map.py: builds/updates PROJECT_MAP.md automatically from the code.

Usage (from the repo root):  python3 tools/make_map.py
- Rewrites only the part between AUTO:START and AUTO:END.
- Keeps everything else (Data, Fragile spots, Notes) written by the AI.
- Safe: read-only on project files; only writes PROJECT_MAP.md.
- Never needs internet or extra packages (Python 3 standard library only).
"""
import hashlib
import os
import re
import sys
from datetime import date

ROOT = os.getcwd()
MAP_FILE = os.path.join(ROOT, "PROJECT_MAP.md")
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "__pycache__",
             "previews", "legacy", "research", ".claude", "vendor", "venv", ".venv"}
CODE_EXT = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".gs", ".html",
            ".htm", ".vue", ".svelte", ".gd", ".cs", ".css", ".json", ".yml", ".yaml"}
MAX_SYMBOLS = 8
MAX_LINKS = 6
MAX_FILES_DETAILED = 60

SYMBOL_PATTERNS = [
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)", re.M),
    re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(", re.M),   # Python
    re.compile(r"^\s*func\s+([A-Za-z_]\w*)\s*\(", re.M),               # GDScript
]
DATA_PATTERN = re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,})\s*=\s*[\[{]", re.M)
LINK_PATTERNS = [
    re.compile(r"""(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]"""),
    re.compile(r"""<script[^>]+src\s*=\s*['"]([^'"]+)['"]""", re.I),
    re.compile(r"""<link[^>]+href\s*=\s*['"]([^'"]+\.css)['"]""", re.I),
    re.compile(r"^\s*from\s+(\.[\w.]*)\s+import", re.M),
]
STORAGE_PATTERN = re.compile(r"""(?:localStorage|sessionStorage)\.(?:getItem|setItem)\(\s*['"]([^'"]+)['"]""")


def project_files():
    out = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
        for name in sorted(files):
            ext = os.path.splitext(name)[1].lower()
            if ext in CODE_EXT and name not in ("package-lock.json", "make_map.py", "check.py"):
                path = os.path.join(base, name)
                if os.path.getsize(path) <= 5_000_000:
                    out.append(os.path.relpath(path, ROOT).replace(os.sep, "/"))
    return out


def read(path):
    try:
        with open(os.path.join(ROOT, path), encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def fingerprint(files):
    h = hashlib.sha256()
    for p in files:
        h.update(p.encode())
        h.update(hashlib.sha256(read(p).encode()).digest())
    return h.hexdigest()[:16]


def analyse(path, text):
    ext = os.path.splitext(path)[1].lower()
    lines = text.count("\n") + 1 if text else 0
    minified = any(len(l) > 3000 for l in text.splitlines()[:50])
    symbols, data, links, storage = [], [], [], []
    if ext not in (".json", ".css", ".yml", ".yaml") and not minified:
        for pat in SYMBOL_PATTERNS:
            for m in pat.finditer(text):
                if m.group(1) not in symbols:
                    symbols.append(m.group(1))
        data = sorted(set(DATA_PATTERN.findall(text)))
        storage = sorted(set(STORAGE_PATTERN.findall(text)))
    for pat in LINK_PATTERNS:
        for m in pat.finditer(text):
            target = m.group(1)
            if target not in links:
                links.append(target)
    return {"lines": lines, "symbols": symbols, "data": data, "links": links,
            "storage": storage, "minified": minified}


def cap(items, n):
    if len(items) <= n:
        return ", ".join(items)
    return ", ".join(items[:n]) + f" (+{len(items) - n} more)"


def build_auto(files):
    info = {p: analyse(p, read(p)) for p in files}
    total = sum(i["lines"] for i in info.values())
    owner = {}
    for p, i in info.items():
        for s in i["symbols"]:
            if len(s) > 3:
                owner.setdefault(s, p)
    # Cross-file use: a file mentions a symbol defined in another file.
    uses = {}
    for p in files:
        text = read(p)
        words = set(re.findall(r"[A-Za-z_$][\w$]{3,}", text))
        hits = sorted({owner[w] for w in words if w in owner and owner[w] != p})
        uses[p] = hits

    out = [f"Files: {len(files)} | Lines: {total} | Fingerprint: {fingerprint(files)} | Generated: {date.today()}",
           "", "### Files"]
    detailed = files if len(files) <= MAX_FILES_DETAILED else [p for p in files if info[p]["symbols"]][:MAX_FILES_DETAILED]
    for p in detailed:
        i = info[p]
        line = f"- `{p}` ({i['lines']} lines)"
        if i["minified"]:
            line += " minified, not indexed"
        if i["symbols"]:
            line += f": {cap(i['symbols'], MAX_SYMBOLS)}"
        out.append(line)
        if i["data"]:
            out.append(f"  - data objects: {cap(i['data'], MAX_SYMBOLS)}")
    if len(detailed) < len(files):
        rest = [p for p in files if p not in detailed]
        dirs = {}
        for p in rest:
            dirs.setdefault(os.path.dirname(p) or ".", 0)
            dirs[os.path.dirname(p) or "."] += 1
        out.append(f"- Not listed one by one ({len(rest)} files): " +
                   ", ".join(f"{d}/ ({n})" for d, n in sorted(dirs.items())))

    out += ["", "### Links (A -> B means A loads or uses B)"]
    any_link = False
    for p in detailed:
        targets = info[p]["links"] + [u for u in uses[p] if u not in info[p]["links"]]
        if targets:
            any_link = True
            out.append(f"- `{p}` -> {cap(targets, MAX_LINKS)}")
    if not any_link:
        out.append("- (none found automatically)")

    keys = sorted({k for i in info.values() for k in i["storage"]})
    out += ["", "### Saved data keys (browser storage)",
            f"- {cap(keys, 12)}" if keys else "- (none found automatically)"]
    return "\n".join(out), fingerprint(files)


TEMPLATE = """# PROJECT_MAP
> Shortcut for reading, never the truth: the code is the truth (CORE §4.1).
> The AUTO part is rebuilt by `python3 tools/make_map.py`. Write by hand only below it.

<!-- AUTO:START -->
<!-- AUTO:END -->

## Data (by hand: where saves, settings, content live; format; version)

## Fragile spots (by hand: changes here break other parts)

## Notes (by hand)
"""


def main():
    files = project_files()
    auto, _ = build_auto(files)
    current = read("PROJECT_MAP.md") if os.path.exists(MAP_FILE) else TEMPLATE
    if "<!-- AUTO:START -->" not in current or "<!-- AUTO:END -->" not in current:
        current = TEMPLATE + "\n## Old map (kept)\n" + current
    current = current.replace("MAP STALE", "MAP STALE (resolved)") if current.startswith("MAP STALE") else current
    new = re.sub(r"<!-- AUTO:START -->.*?<!-- AUTO:END -->",
                 lambda _m: "<!-- AUTO:START -->\n" + auto + "\n<!-- AUTO:END -->",
                 current, flags=re.S)
    with open(MAP_FILE, "w", encoding="utf-8") as f:
        f.write(new)
    n = new.count("\n") + 1
    print(f"PROJECT_MAP.md updated: {len(files)} files, {n} lines.")
    if n > 200:
        print("Note: map is long. Keep the hand-written parts short.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # fail-open: never block the work
        print(f"make_map.py could not finish ({e}). Continue by reading the code (CORE §4.1).")
        sys.exit(0)
