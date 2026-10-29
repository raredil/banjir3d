import { LocalInertial } from "./local-inertial";

// Hunter et al. (2005) analytical flood wave over a horizontal plane, used to check the local-inertial solver.
export const waveDepth = (x: number, t: number, n: number, u: number) => {
  const a = -(7 / 3) * n * n * u * u * (x - u * t);
  return a > 0 ? Math.pow(a, 3 / 7) : 0;
};

export type WaveCase = { n: number; u: number; dx: number; theta: number; length: number; seconds: number };

/** Run the solver on a 1D strip with the analytical depth imposed in the first column; compare depth profiles at the end. */
export function analyticalWave(c: WaveCase) {
  const nx = Math.round(c.length / c.dx) + 1, ny = 3;
  const z = new Float64Array(nx * ny);
  const s = new LocalInertial({ nx, ny, dx: c.dx, dy: c.dx, z }, { manning: c.n, theta: c.theta, hMin: 0.001, alpha: 0.5, dtMax: 10 });
  const bc = () => { for (let j = 0; j < ny; j++) s.h[j * nx] = waveDepth(0, s.t, c.n, c.u); };
  while (s.t < c.seconds) { bc(); s.step(); }
  bc();
  // The analytical solution neglects inertia (diffusion wave); local inertial keeps it, so the two differ near the thin front
  // where the Froude number u/sqrt(g h) is high. de Almeida and Bates (2013) find the local-inertial form reliable below Fr 0.5.
  const hFr = (c.u * c.u) / (0.25 * 9.81);
  let se = 0, k = 0, seS = 0, kS = 0, frontModel = 0;
  const j = 1;
  for (let i = 1; i < nx; i++) {
    const x = i * c.dx, hm = s.h[j * nx + i], ha = waveDepth(x, s.t, c.n, c.u);
    if (hm > 0.01) frontModel = x;
    if (ha > 0 || hm > 0) { se += (hm - ha) ** 2; k++; }
    if (ha >= hFr) { seS += (hm - ha) ** 2; kS++; }
  }
  return { rmse: Math.sqrt(se / k), rmseSub: Math.sqrt(seS / kS), hFr, h0: waveDepth(0, s.t, c.n, c.u), frontModel, frontTrue: c.u * s.t, t: s.t };
}
