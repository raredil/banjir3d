# Explore engine versus the analytical flood wave (2026-10-29)

Test: a flood wave advancing at constant velocity u over a horizontal, initially dry plane (Hunter et al. 2005, doi:10.1016/j.advwatres.2005.03.007; used for local-inertial tests by de Almeida and Bates 2013, doi:10.1002/wrcr.20366). Analytical depth h(x,t) = [-(7/3) n² u² (x − u t)]^(3/7) behind the front, imposed as depth in the first column. Strip 5 km × 3 cells, 1 h, hMin 0.001 m, alpha 0.5. Code: `web/src/explore/analytical.ts`; unit test in `local-inertial.test.ts` (n 0.03, 50 m: RMSE < 2 % of boundary depth, front within 100 m).

| n | u (m/s) | dx (m) | theta | RMSE (m) | RMSE / h(0) | front model / analytical (m) |
|---|---|---|---|---|---|---|
| 0.03 | 1 | 100 | 1.0 | 0.070 | 2.9 % | 3700 / 3600 |
| 0.03 | 1 | 50 | 1.0 | 0.024 | 1.0 % | 3650 / 3601 |
| 0.03 | 1 | 25 | 1.0 | 0.053 | 2.2 % | 3550 / 3602 |
| 0.03 | 1 | 12.5 | 1.0 | 0.074 | 3.1 % | 3513 / 3601 |
| 0.01 | 1 | 50 | 1.0 | 0.056 | 6.1 % | 3400 / 3608 |
| 0.01 | 1 | 50 | 0.7 | 0.142 | 15.3 % | 3200 / 3608 |
| 0.05 | 1 | 50 | 1.0 | 0.050 | 1.4 % | 3700 / 3601 |
| 0.15 | 0.5 | 38 | 1.0 | 0.130 | 3.4 % | 1900 / 1801 |

Reading: errors are 1 to 6 % of the boundary depth with theta 1.0. They do not shrink with grid refinement because the analytical solution neglects inertia (zero-inertia wave) while the local-inertial equations keep ∂q/∂t; the slope ratio is 1/(1 − Fr²), so the two differ most near the thin front (high Froude number) and at low friction, as de Almeida and Bates (2013) describe. theta 0.7 delays the front in this implementation, one reason the default stays at 1.0 (also the SFINCS default).

Reproduce (from `web/`): `npx vite-node ../verification/analytical-wave/run.ts --out ../verification/analytical-wave/results.json`
