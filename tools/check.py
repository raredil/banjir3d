#!/usr/bin/env python3
"""check.py: automatic health check for the project (CORE §4.1, §7, §8).

Usage (from the repo root):  python3 tools/check.py
Run at the start of every session and before every HANDOFF.
- Read-only: never changes any file.
- Needs only Python 3 (Node.js is used for JavaScript checks if present).
- Fail-open: if a check cannot run, it is skipped and reported, never blocks work.
Exit code: 0 = no errors (warnings allowed), 1 = errors to fix or list in HANDOFF.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.getcwd()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "dist", "build", "legacy", "previews", "__pycache__", ".venv", "venv"}
errors, warnings, notes = [], [], []


def read(path):
    try:
        with open(os.path.join(ROOT, path), encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return None


def walk(exts):
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for name in files:
            if os.path.splitext(name)[1].lower() in exts:
                yield os.path.relpath(os.path.join(base, name), ROOT).replace(os.sep, "/")


def git_old(path):
    """Content of a file at the last commit, or None."""
    if not shutil.which("git"):
        return None
    try:
        r = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, capture_output=True,
                           text=True, timeout=20)
        return r.stdout if r.returncode == 0 else None
    except Exception:
        return None


def check_docs():
    bp, ho, ideas = read("BLUEPRINT.md"), read("HANDOFF.md"), read("IDEAS.md")
    if bp is None:
        notes.append("No BLUEPRINT.md yet: follow START.md (save owner's words to IDEAS.md first).")
    if bp is not None and ideas is None:
        warnings.append("IDEAS.md missing: create it from the owner's messages (START.md §1).")
    if ho is not None and ho.count("\n") + 1 > 150:
        warnings.append(f"HANDOFF.md has {ho.count(chr(10)) + 1} lines (limit 150): shorten it.")
    return bp, ho, ideas


def check_must(bp, ho):
    if bp is None:
        return
    ids = sorted(set(re.findall(r"\bM(\d+)\b", bp)), key=int)
    if not ids:
        warnings.append("BLUEPRINT.md has no MUST IDs (M1, M2, ...): add them (START.md §5).")
        return
    if ho is None:
        return
    status = ho.split("MUST status", 1)[1] if "MUST status" in ho else ""
    missing = [f"M{i}" for i in ids if not re.search(rf"\bM{i}\b", status)]
    if missing:
        errors.append("MUST items without status in HANDOFF 'MUST status': " + ", ".join(missing))


def check_ideas(bp, ideas):
    if ideas is None:
        return
    ids = sorted(set(re.findall(r"\bI(\d+)\b", ideas)), key=int)
    if bp is not None and ids:
        lost = [f"I{i}" for i in ids if not re.search(rf"\bI{i}\b", bp)]
        if lost:
            errors.append("Ideas not placed in BLUEPRINT 'Idea map' (risk of losing them): " + ", ".join(lost))
    old = git_old("IDEAS.md")
    if old:
        cur_lines = set(l.strip() for l in ideas.splitlines())
        removed = [l.strip() for l in old.splitlines() if l.strip() and l.strip() not in cur_lines]
        if removed:
            errors.append(f"IDEAS.md is append-only, but {len(removed)} old line(s) were changed/removed. "
                          f"Restore them (first: '{removed[0][:60]}').")


def check_map():
    if read("PROJECT_MAP.md") is None:
        code = list(walk({".js", ".ts", ".py", ".gs", ".html", ".gd", ".cs", ".vue", ".svelte", ".jsx", ".tsx"}))
        lines = sum((read(p) or "").count("\n") for p in code)
        if len(code) > 5 or lines > 1500:
            warnings.append("No PROJECT_MAP.md but the project is big enough: run python3 tools/make_map.py")
        return
    try:
        import make_map
        stored = re.search(r"Fingerprint:\s*([0-9a-f]+)", read("PROJECT_MAP.md") or "")
        now = make_map.fingerprint(make_map.project_files())
        if not stored or stored.group(1) != now:
            warnings.append("PROJECT_MAP.md is out of date: run python3 tools/make_map.py")
    except Exception as e:
        notes.append(f"Map freshness not checked ({e}).")


SECRET_PATTERNS = [
    (r"AKIA[0-9A-Z]{16}", "AWS key"), (r"\bsk-[A-Za-z0-9_-]{20,}", "API secret key"),
    (r"\bgh[pousr]_[A-Za-z0-9]{30,}", "GitHub token"), (r"AIza[0-9A-Za-z_-]{35}", "Google API key"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "private key"),
    (r"(?i)(?:password|passwd|secret)\s*[:=]\s*['\"][^'\"]{6,}['\"]", "hard-coded password"),
]


def check_secrets():
    exts = {".js", ".mjs", ".ts", ".py", ".gs", ".html", ".json", ".env", ".yml", ".yaml", ".md", ".txt", ".cs", ".gd"}
    for p in walk(exts):
        text = read(p) or ""
        for pat, label in SECRET_PATTERNS:
            if re.search(pat, text):
                errors.append(f"Possible {label} in {p}: remove it (SECURITY.md §3).")
                break


def node_check(code, label):
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(code)
            tmp = f.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, timeout=30)
        os.unlink(tmp)
        msg = (r.stderr or "").strip()
        if r.returncode != 0 and "import statement outside a module" not in msg and "export" not in msg:
            first = next((l for l in msg.splitlines() if "Error" in l), msg[:120])
            errors.append(f"JavaScript syntax error in {label}: {first}")
    except Exception as e:
        notes.append(f"JS check skipped for {label} ({e}).")


def check_code():
    for p in walk({".json"}):
        try:
            json.loads(read(p) or "")
        except ValueError as e:
            errors.append(f"Broken JSON in {p}: {e}")
    if not shutil.which("node"):
        notes.append("Node.js not found: JavaScript syntax not checked.")
        return
    for p in walk({".js", ".cjs", ".gs"}):
        node_check(read(p) or "", p)
    script_re = re.compile(r"<script(?![^>]*\bsrc=)(?![^>]*type=['\"](?:module|text/template|application/json|importmap)['\"])[^>]*>(.*?)</script>", re.S | re.I)
    for p in walk({".html", ".htm"}):
        for n, block in enumerate(script_re.findall(read(p) or ""), 1):
            if block.strip():
                node_check(block, f"{p} (inline script #{n})")


def main():
    bp, ho, ideas = check_docs()
    for fn, args in ((check_must, (bp, ho)), (check_ideas, (bp, ideas)), (check_map, ()),
                     (check_secrets, ()), (check_code, ())):
        try:
            fn(*args)
        except Exception as e:
            notes.append(f"{fn.__name__} skipped ({e}).")
    print("=== PROJECT CHECK ===")
    for title, items in (("ERRORS (fix, or list in HANDOFF Known gaps)", errors),
                         ("WARNINGS", warnings), ("NOTES", notes)):
        if items:
            print(f"\n{title}:")
            for i in items:
                print(f"- {i}")
    if not (errors or warnings):
        print("All checks passed.")
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # fail-open
        print(f"check.py could not finish ({e}). Continue the work and mention this in HANDOFF.")
        sys.exit(0)
