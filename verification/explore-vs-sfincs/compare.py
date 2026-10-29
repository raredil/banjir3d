"""Compare Explore (TypeScript) and SFINCS on the same grid, DEM, rain and roughness.
Usage: python compare.py <dir> <explore_tag> [<explore_tag> ...]
Reference = SFINCS (Leijnse et al. 2021; Van Ormondt et al. 2025 GMD), the peer-reviewed model named in BLUEPRINT 4.2.
"""
import json, sys
import numpy as np
import netCDF4 as nc

d = sys.argv[1]; tags = sys.argv[2:]
meta = json.load(open(f"{d}/meta.json")); nx, ny, dx = meta["nx"], meta["ny"], meta["cell_m"]; n = nx * ny
ds = nc.Dataset(f"{d}/sfincs_map.nc")
sf_h = np.flip(np.array(ds["h"][:]), axis=1).reshape(-1, n)          # (t, cells), north first
sf_max = np.flip(np.array(ds["hmax"][0]), axis=0).ravel()
sf_h = np.where(np.isfinite(sf_h), sf_h, 0); sf_max = np.where(np.isfinite(sf_max), sf_max, 0)
area = dx * dx
rain_vol = meta["rain_mm_h"] / 1000 * meta["rain_h"] * n * area
out = {"grid": f"{nx} x {ny}", "cell_m": round(dx, 2), "rain_mm_h": meta["rain_mm_h"], "rain_h": meta["rain_h"], "hours": meta["hours"], "manning": meta["manning"],
       "rain_volume_m3": rain_vol, "sfincs": {"final_volume_m3": float(sf_h[-1].sum() * area), "volume_vs_rain": float(sf_h[-1].sum() * area / rain_vol),
       "hmax_peak_m": float(sf_max.max())}, "runs": {}}

def csi(ref, test, thr):
    a, b = ref > thr, test > thr
    hit = (a & b).sum(); miss = (a & ~b).sum(); fa = (~a & b).sum()
    return dict(thr_m=thr, CSI=float(hit / max(1, hit + miss + fa)), hit_rate=float(hit / max(1, hit + miss)), false_alarm_ratio=float(fa / max(1, hit + fa)),
                sfincs_km2=float(a.sum() * area / 1e6), explore_km2=float(b.sum() * area / 1e6))

def stats(ref, test):
    m = (ref > 0.05) | (test > 0.05)
    e = test - ref
    return dict(rmse_m=float(np.sqrt(np.mean(e[m] ** 2))), mae_m=float(np.mean(np.abs(e[m]))), bias_m=float(np.mean(e[m])),
                pearson_r=float(np.corrcoef(ref[m], test[m])[0, 1]), cells_compared=int(m.sum()))

for tag in tags:
    r = json.load(open(f"{d}/explore_{tag}.json"))
    fr = np.fromfile(f"{d}/explore_{tag}_frames.f32", dtype="<f4").reshape(-1, n).astype(float)
    mx = np.fromfile(f"{d}/explore_{tag}_hmax.f64", dtype="<f8")
    k = min(len(fr), len(sf_h))
    vol_sf = sf_h[:k].sum(1) * area; vol_ex = fr[:k].sum(1) * area
    out["runs"][tag] = {
        "settings": {"theta": r["theta"], "alpha": r["alpha"], "hmin_m": r["hmin"]},
        "explore_mass_error": r["mass_error"], "explore_steps": r["steps"], "explore_final_volume_m3": float(vol_ex[-1]),
        "volume_ratio_explore_to_sfincs_final": float(vol_ex[-1] / vol_sf[-1]),
        "max_volume_diff_pct_over_run": float(np.max(np.abs(vol_ex[1:] - vol_sf[1:]) / np.maximum(vol_sf[1:], 1)) * 100),
        "hmax_peak_m": float(mx.max()),
        "hmax": stats(sf_max, mx), "final_depth": stats(sf_h[-1], fr[k - 1]),
        "extent_hmax": [csi(sf_max, mx, t) for t in (0.05, 0.1, 0.3, 1.0)],
        "extent_final": [csi(sf_h[-1], fr[k - 1], t) for t in (0.05, 0.1, 0.3)],
    }
json.dump(out, open(f"{d}/comparison.json", "w"), indent=1)

# figure
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
tag = tags[0]; mx = np.fromfile(f"{d}/explore_{tag}_hmax.f64", dtype="<f8")
fig, ax = plt.subplots(1, 4, figsize=(19, 4.6))
vmax = 2.5
for a_, (t_, f_) in zip(ax[:2], [("SFINCS hmax (m)", sf_max), (f"Explore hmax (m), {tag}", mx)]):
    im = a_.imshow(f_.reshape(ny, nx), cmap="Blues", vmin=0, vmax=vmax); a_.set_title(t_); a_.axis("off")
plt.colorbar(im, ax=ax[:2], fraction=0.02)
df = (mx - sf_max).reshape(ny, nx); im2 = ax[2].imshow(df, cmap="RdBu_r", vmin=-1, vmax=1); ax[2].set_title("Explore minus SFINCS (m)"); ax[2].axis("off"); plt.colorbar(im2, ax=ax[2], fraction=0.046)
m = (sf_max > 0.05) | (mx > 0.05); ax[3].scatter(sf_max[m], mx[m], s=2, alpha=0.25); lim = [0, max(sf_max.max(), mx.max())]; ax[3].plot(lim, lim, "k--", lw=1)
ax[3].set_xlabel("SFINCS hmax (m)"); ax[3].set_ylabel("Explore hmax (m)"); ax[3].set_title("Cell by cell"); ax[3].set_aspect("equal")
fig.tight_layout(); fig.savefig(f"{d}/comparison.png", dpi=110)
print(json.dumps(out, indent=1)[:3500])
