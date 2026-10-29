// Analytical check: non-breaking flood wave over a horizontal, initially dry plane (Hunter et al. 2005; used as a
// local-inertial test by Bates et al. 2010 and de Almeida and Bates 2013). Constant velocity u, Manning n, flat bed:
//   h(x,t) = [-(7/3) n^2 u^2 (x - u t)]^(3/7) for x < u t, 0 ahead of the front; west boundary h(0,t) = [(7/3) n^2 u^3 t]^(3/7).
// Usage (from web/): npx vite-node ../verification/analytical-wave/run.ts [--out ../verification/analytical-wave/results.json]
import { writeFileSync } from "node:fs";
import { analyticalWave } from "../../web/src/explore/analytical";

const cases = [
  { n: 0.03, u: 1, dx: 100, theta: 1.0 },
  { n: 0.01, u: 1, dx: 50, theta: 1.0 },
  { n: 0.01, u: 1, dx: 50, theta: 0.7 },
  { n: 0.03, u: 1, dx: 50, theta: 1.0 },
  { n: 0.03, u: 1, dx: 25, theta: 1.0 },
  { n: 0.03, u: 1, dx: 12.5, theta: 1.0 },
  { n: 0.05, u: 1, dx: 50, theta: 1.0 },
  { n: 0.15, u: 0.5, dx: 38, theta: 1.0 },
];
const results = cases.map((c) => ({ ...c, ...analyticalWave({ ...c, length: 5000, seconds: 3600 }) }));
for (const r of results) console.log(JSON.stringify({ n: r.n, dx: r.dx, theta: r.theta, rmse: +r.rmse.toFixed(4), h0: +r.h0.toFixed(3), relRmse: +(r.rmse / r.h0).toFixed(4), rmseSub: +r.rmseSub.toFixed(4), relSub: +(r.rmseSub / r.h0).toFixed(4), front: r.frontModel, frontTrue: r.frontTrue }));
const i = process.argv.indexOf("--out");
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify({ date: new Date().toISOString().slice(0, 10), length_m: 5000, seconds: 3600, hMin: 0.001, results }, null, 1));
