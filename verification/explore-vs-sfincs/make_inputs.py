"""Build the SFINCS inputs and the Explore inputs for the SAME grid, DEM and rain.

DEM: FABDEM V1-2 from the region pack PMTiles (z12 Terrarium tiles), the same pixels the browser reads.
Usage: python make_inputs.py <dem_fabdem.pmtiles> <outdir> [--rain-mm-h 100 --rain-h 3 --hours 8 --manning 0.05]
"""
import argparse, gzip, io, json, math, os
import numpy as np
from PIL import Image
from pmtiles.reader import Reader, MmapSource

Z = 12; TS = 256; WORLD = TS * 2 ** Z; EARTH = 40075016.686
BBOX = (106.812, -6.26, 106.902, -6.17)  # W,S,E,N: the 10 x 10 km sample (docs/ASSUMPTIONS.md A7)

def lon_px(lon): return (lon + 180) / 360 * WORLD
def lat_py(lat):
    s = math.sin(math.radians(lat)); return (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * WORLD

def load_dem(path):
    x0, x1 = math.floor(lon_px(BBOX[0])), math.ceil(lon_px(BBOX[2]))
    y0, y1 = math.floor(lat_py(BBOX[3])), math.ceil(lat_py(BBOX[1]))
    nx, ny = x1 - x0, y1 - y0
    z = np.full((ny, nx), np.nan)
    with open(path, "rb") as f:
        r = Reader(MmapSource(f))
        for ty in range(y0 // TS, (y1 - 1) // TS + 1):
            for tx in range(x0 // TS, (x1 - 1) // TS + 1):
                d = r.get(Z, tx, ty)
                if d is None: continue
                try: d = gzip.decompress(d)
                except Exception: pass
                a = np.array(Image.open(io.BytesIO(d)).convert("RGB")).astype(float)
                h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
                for j in range(TS):
                    gy = ty * TS + j - y0
                    if not 0 <= gy < ny: continue
                    for i in range(TS):
                        gx = tx * TS + i - x0
                        if 0 <= gx < nx: z[gy, gx] = h[j, i]
    z[np.isnan(z)] = np.nanmin(z)
    cell = EARTH / WORLD * math.cos(math.radians((BBOX[1] + BBOX[3]) / 2))
    return z, cell  # row 0 = north

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pmtiles"); ap.add_argument("outdir")
    ap.add_argument("--rain-mm-h", type=float, default=100); ap.add_argument("--rain-h", type=float, default=3)
    ap.add_argument("--hours", type=float, default=8); ap.add_argument("--manning", type=float, default=0.05)
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    z, cell = load_dem(a.pmtiles); ny, nx = z.shape
    z.astype("<f8").tofile(f"{a.outdir}/dem_north_first.f64")
    zs = np.flipud(z)  # SFINCS rows start at the south
    np.savetxt(f"{a.outdir}/sfincs.dep", zs, fmt="%.4f")
    np.savetxt(f"{a.outdir}/sfincs.msk", np.ones((ny, nx), dtype=int), fmt="%d")
    T = int(a.hours * 3600); TR = int(a.rain_h * 3600)
    open(f"{a.outdir}/sfincs.prcp", "w").write(f"0 {a.rain_mm_h}\n{TR} {a.rain_mm_h}\n{TR + 1} 0\n{T} 0\n")
    hh, mm = divmod(T // 60, 60)
    open(f"{a.outdir}/sfincs.inp", "w").write(f"""mmax = {nx}
nmax = {ny}
dx = {cell:.6f}
dy = {cell:.6f}
x0 = 0
y0 = 0
rotation = 0
tref = 20200101 000000
tstart = 20200101 000000
tstop = 20200101 {hh:02d}{mm:02d}00
dtout = 300
dtmaxout = {T}
dthisout = 600
dtmax = 15
alpha = 0.5
theta = 1.0
huthresh = 0.05
manning = {a.manning}
advection = 0
coriolis = 0
inputformat = asc
outputformat = net
depfile = sfincs.dep
mskfile = sfincs.msk
precipfile = sfincs.prcp
""")
    json.dump({"nx": nx, "ny": ny, "cell_m": cell, "rain_mm_h": a.rain_mm_h, "rain_h": a.rain_h, "hours": a.hours, "manning": a.manning,
               "z_min": float(z.min()), "z_max": float(z.max())}, open(f"{a.outdir}/meta.json", "w"), indent=1)
    print(f"grid {nx} x {ny}, cell {cell:.2f} m, z {z.min():.1f}..{z.max():.1f} m")
