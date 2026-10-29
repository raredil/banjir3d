"""Per-cell Manning n from ESA WorldCover 2021 (region pack PMTiles, z14 = 4 x 4 pixels per z12 DEM cell).
Writes manning_north_first.f64 (Explore) and sfincs.man (SFINCS binary, float32, active cells in m-major order) into <outdir>,
and points sfincs.inp at it. Table: data/roughness/worldcover-manning.json. Usage: python make_roughness.py <wc.pmtiles> <outdir> [low|n|high]
"""
import gzip, io, json, math, sys
import numpy as np
from PIL import Image
from pmtiles.reader import Reader, MmapSource
from make_inputs import BBOX, lon_px, lat_py

tbl = json.load(open(__file__.rsplit("/", 1)[0] + "/../../data/roughness/worldcover-manning.json"))
mode = sys.argv[3] if len(sys.argv) > 3 else "n"
cls = {int(k): v for k, v in tbl["classes"].items()}
pal = {int(k): tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for k, c in tbl["colors"].items()}
codes = sorted(pal); pal_arr = np.array([pal[c] for c in codes]); n_of = np.array([cls[c][mode] for c in codes])

Z12 = 12; ZT = 14; TS = 256
x0, x1 = math.floor(lon_px(BBOX[0])), math.ceil(lon_px(BBOX[2]))
y0, y1 = math.floor(lat_py(BBOX[3])), math.ceil(lat_py(BBOX[1]))
nx, ny = x1 - x0, y1 - y0
f = 2 ** (ZT - Z12)
big = np.full((ny * f, nx * f), np.nan); cls_img = np.zeros((ny * f, nx * f), dtype=np.int16)
with open(sys.argv[1], "rb") as fh:
    r = Reader(MmapSource(fh))
    for ty in range((y0 * f) // TS, (y1 * f - 1) // TS + 1):
        for tx in range((x0 * f) // TS, (x1 * f - 1) // TS + 1):
            d = r.get(ZT, tx, ty)
            if d is None: continue
            try: d = gzip.decompress(d)
            except Exception: pass
            a = np.array(Image.open(io.BytesIO(d)).convert("RGBA")).astype(int)
            rgb, alpha = a[..., :3], a[..., 3]
            idx = np.argmin(((rgb[:, :, None, :] - pal_arr[None, None, :, :]) ** 2).sum(-1), axis=-1)
            n = np.where(alpha > 0, n_of[idx], np.nan); c = np.where(alpha > 0, np.array(codes)[idx], 0)
            gy0, gx0 = ty * TS - y0 * f, tx * TS - x0 * f
            ys, xs = max(0, gy0), max(0, gx0); ye, xe = min(ny * f, gy0 + TS), min(nx * f, gx0 + TS)
            if ye <= ys or xe <= xs: continue
            big[ys:ye, xs:xe] = n[ys - gy0:ye - gy0, xs - gx0:xe - gx0]
            cls_img[ys:ye, xs:xe] = c[ys - gy0:ye - gy0, xs - gx0:xe - gx0]
nodata = np.isnan(big).mean()
big = np.where(np.isnan(big), tbl["default_n_for_nodata"], big)
n_cell = big.reshape(ny, f, nx, f).mean(axis=(1, 3))          # row 0 = north
frac = {tbl["classes"][str(c)]["label"]: round(float((cls_img == c).mean()), 4) for c in codes if (cls_img == c).any()}
out = sys.argv[2]
n_cell.astype("<f8").tofile(f"{out}/manning_north_first.f64")
np.flipud(n_cell).astype("<f4").ravel(order="F").tofile(f"{out}/sfincs.man")
inp = open(f"{out}/sfincs.inp").read().splitlines()
inp = [l for l in inp if not l.startswith("manningfile")] + ["manningfile = sfincs.man"]
open(f"{out}/sfincs.inp", "w").write("\n".join(inp) + "\n")
meta = json.load(open(f"{out}/meta.json")); meta.update({"manning_source": f"ESA WorldCover 2021 + data/roughness/worldcover-manning.json ({mode})", "manning_field": True,
    "class_fractions": frac, "nodata_fraction": round(float(nodata), 4), "n_mean": float(n_cell.mean()), "n_min": float(n_cell.min()), "n_max": float(n_cell.max())})
json.dump(meta, open(f"{out}/meta.json", "w"), indent=1)
print("class fractions:", frac); print(f"n per cell: mean {n_cell.mean():.3f}, min {n_cell.min():.3f}, max {n_cell.max():.3f}; nodata {nodata:.2%}")
