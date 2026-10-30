// Flood engine v2, CPU reference. 2D local-inertial shallow-water scheme (Bates et al. 2010; theta = 1 as SFINCS and LISFLOOD-FP ACC)
// on a masked grid, with per-cell Manning n, rain turned into runoff per cell with the NRCS curve number, upstream river
// inflow at points, a fixed sea level on sea cells and transmissive (zero-gradient) outflow wherever the run area ends.
// Optional: rain that differs between zones (observed events) and a drainage sink (city drains, calibrated on observed floods).
// The WebGPU solver (gpu.ts) implements exactly these steps in float32; tests compare the two (verification/gpu-parity).

export const G = 9.81;

export type EngineGrid = {
  nx: number; ny: number; dx: number;
  z: Float64Array; // bed elevation (m)
  n: Float64Array; // Manning n per cell (s m^-1/3)
  active: Uint8Array; // 1 = simulated, 0 = outside the run area (water that reaches it leaves the model)
  cn?: Float64Array; // NRCS curve number per cell (no infiltration if absent)
  sea?: Uint8Array; // 1 = sea cell, held at the sea level
  zone?: Uint16Array; // rain zone per cell (rates set per zone in FloodEngine.rates); absent = one rate everywhere
  drain?: Float64Array; // drainage capacity per cell (m/s): surface water up to this rate leaves through the city drains
};
// hMin: depth below which a face carries no flow; 0.001 m is the LISFLOOD-FP default, so thin runoff sheets still drain
export type EngineOptions = { alpha?: number; dtMax?: number; hMin?: number; seaLevel?: number; inflowCells?: number[] };
export type EngineTotals = { rain: number; infiltration: number; inflow: number; outflow: number; sea: number; drain: number }; // m3

/** NRCS curve-number direct runoff (mm) for cumulative rain p (mm), retention s (mm), initial abstraction 0.2 s. */
export const scsRunoff = (p: number, s: number) => (p > 0.2 * s ? ((p - 0.2 * s) * (p - 0.2 * s)) / (p + 0.8 * s) : 0);
/** Potential retention S (mm) from a curve number. */
export const retention = (cn: number) => (cn >= 100 ? 0 : 25400 / cn - 254);

export class FloodEngine {
  readonly g: EngineGrid;
  h: Float64Array;
  hMax: Float64Array;
  private qx: Float64Array; // east face of each cell (m2/s, + east)
  private qy: Float64Array; // south face of each cell (+ south)
  private qxN: Float64Array;
  private qyN: Float64Array;
  private bnd: Float64Array; // transmissive outflow per cell, summed over its open sides (m3/s)
  private scale: Float64Array;
  private readonly s: Float64Array | null; // retention per cell (mm)
  private readonly open: [Uint8Array, Uint8Array, Uint8Array, Uint8Array]; // N, S, W, E side of the cell is open
  t = 0;
  rainMm = 0; // cumulative gross rain (mm) since t = 0
  rate = 0; // current rain rate (mm/h), set by the caller
  rates: number[] = []; // current rain rate per zone (mm/h) when the grid has zones
  private zMm: Float64Array; // cumulative rain per zone (mm)
  inflows: number[] = []; // current discharge (m3/s) of each inflow cell, set by the caller
  readonly totals: EngineTotals = { rain: 0, infiltration: 0, inflow: 0, outflow: 0, sea: 0, drain: 0 };
  readonly alpha: number;
  readonly dtMax: number;
  readonly hMin: number;
  readonly seaLevel: number;
  readonly inflowCells: number[];
  private depthMax = 0;
  private readonly area: number;

  constructor(g: EngineGrid, o: EngineOptions = {}) {
    this.g = g;
    const N = g.nx * g.ny;
    this.h = new Float64Array(N); this.hMax = new Float64Array(N);
    this.qx = new Float64Array(N); this.qy = new Float64Array(N); this.qxN = new Float64Array(N); this.qyN = new Float64Array(N);
    this.bnd = new Float64Array(N); this.scale = new Float64Array(N);
    this.alpha = o.alpha ?? 0.5; this.dtMax = o.dtMax ?? 15; this.hMin = o.hMin ?? 0.001; this.seaLevel = o.seaLevel ?? 0;
    this.inflowCells = o.inflowCells ?? [];
    this.area = g.dx * g.dx;
    this.s = g.cn ? Float64Array.from(g.cn, retention) : null;
    let nz = 0;
    if (g.zone) for (let c = 0; c < N; c++) nz = Math.max(nz, g.zone[c] + 1);
    this.zMm = new Float64Array(nz);
    const { nx, ny, active } = g;
    const isOpen = (i: number, j: number) => i < 0 || j < 0 || i >= nx || j >= ny || !active[j * nx + i];
    this.open = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      if (!active[c]) continue;
      this.open[0][c] = +isOpen(i, j - 1); this.open[1][c] = +isOpen(i, j + 1);
      this.open[2][c] = +isOpen(i - 1, j); this.open[3][c] = +isOpen(i + 1, j);
    }
    if (g.sea) for (let c = 0; c < N; c++) if (g.sea[c] && active[c]) this.h[c] = Math.max(0, this.seaLevel - g.z[c]);
    this.initial = this.volume();
    for (let c = 0; c < N; c++) if (this.h[c] > this.depthMax) this.depthMax = this.h[c];
  }
  private readonly initial: number;

  volume(): number {
    let v = 0;
    for (let c = 0; c < this.h.length; c++) if (this.g.active[c]) v += this.h[c];
    return v * this.area;
  }
  /** (initial + rain + inflow - infiltration - outflow - sea - drain - stored) / (initial + rain + inflow). */
  massError(): number {
    const T = this.totals, inn = this.initial + T.rain + T.inflow;
    return inn > 0 ? (inn - T.infiltration - T.outflow - T.sea - T.drain - this.volume()) / inn : 0;
  }
  dtNow(): number {
    return this.depthMax <= this.hMin ? this.dtMax : Math.min(this.dtMax, (this.alpha * this.g.dx) / Math.sqrt(G * this.depthMax));
  }

  step(): number {
    const { nx, ny, dx, z, n, active, sea, zone, drain } = this.g;
    const { h, qx, qy, qxN, qyN, bnd, scale, hMin } = this;
    const dt = this.dtNow();
    const N = nx * ny;
    // 1. face fluxes (both cells active), momentum equation of Bates et al. (2010) with semi-implicit friction
    const face = (c: number, r: number, q0: number, qt: number) => {
      const etaL = z[c] + h[c], etaR = z[r] + h[r];
      const hf = Math.max(etaL, etaR) - Math.max(z[c], z[r]);
      if (hf <= hMin) return 0;
      const nn = 0.5 * (n[c] + n[r]);
      const q = (q0 - (G * hf * dt * (etaR - etaL)) / dx) / (1 + (G * dt * nn * nn * Math.sqrt(q0 * q0 + qt * qt)) / (hf * hf * Math.cbrt(hf)));
      const qm = hf * Math.sqrt(G * hf);
      return q > qm ? qm : q < -qm ? -qm : q;
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      qxN[c] = 0; qyN[c] = 0;
      if (!active[c]) continue;
      if (i < nx - 1 && active[c + 1]) {
        let qt = 0;
        if (j > 0) qt += qy[c - nx] + qy[c + 1 - nx];
        qt += qy[c] + qy[c + 1];
        qxN[c] = face(c, c + 1, qx[c], 0.25 * qt);
      }
      if (j < ny - 1 && active[c + nx]) {
        let qt = 0;
        if (i > 0) qt += qx[c - 1] + qx[c - 1 + nx];
        qt += qx[c] + qx[c + nx];
        qyN[c] = face(c, c + nx, qy[c], 0.25 * qt);
      }
    }
    // 2. transmissive outflow on open sides: the discharge arriving at the opposite face if it points outward, capped at critical flow
    const [oN, oS, oW, oE] = this.open;
    for (let c = 0; c < N; c++) {
      bnd[c] = 0;
      if (!active[c] || h[c] <= hMin) continue;
      const qc = h[c] * Math.sqrt(G * h[c]);
      let b = 0;
      if (oE[c] && !oW[c]) b += Math.min(qc, Math.max(0, qxN[c - 1]));
      if (oW[c] && !oE[c]) b += Math.min(qc, Math.max(0, -qxN[c]));
      if (oS[c] && !oN[c]) b += Math.min(qc, Math.max(0, qyN[c - nx]));
      if (oN[c] && !oS[c]) b += Math.min(qc, Math.max(0, -qyN[c]));
      bnd[c] = b * dx;
    }
    // 3. limiter: no cell gives away more water than it holds
    for (let c = 0; c < N; c++) {
      if (!active[c]) { scale[c] = 1; continue; }
      let o = bnd[c];
      const i = c % nx;
      if (qxN[c] > 0) o += qxN[c] * dx;
      if (i > 0 && qxN[c - 1] < 0) o -= qxN[c - 1] * dx;
      if (qyN[c] > 0) o += qyN[c] * dx;
      if (c >= nx && qyN[c - nx] < 0) o -= qyN[c - nx] * dx;
      const v = o * dt;
      scale[c] = v > h[c] * this.area && v > 0 ? (h[c] * this.area) / v : 1;
    }
    for (let c = 0; c < N; c++) {
      if (qxN[c] > 0) qxN[c] *= scale[c]; else if (qxN[c] < 0) qxN[c] *= scale[c + 1];
      if (qyN[c] > 0) qyN[c] *= scale[c]; else if (qyN[c] < 0) qyN[c] *= scale[c + nx];
      bnd[c] *= scale[c];
    }
    // 4. depth update with runoff (curve number), drains, inflow and the sea level
    const P0 = this.rainMm, P1 = P0 + (this.rate * dt) / 3600;
    const z0 = Float64Array.from(this.zMm), zm = this.zMm;
    for (let k = 0; k < zm.length; k++) zm[k] += ((this.rates[k] ?? 0) * dt) / 3600;
    let hm = 0, out = 0, rainV = 0, effV = 0, seaV = 0, drV = 0;
    for (let c = 0; c < N; c++) {
      if (!active[c]) continue;
      const i = c % nx;
      let div = -qxN[c] - qyN[c];
      if (i > 0) div += qxN[c - 1];
      if (c >= nx) div += qyN[c - nx];
      const p0 = zone ? z0[zone[c]] : P0, p1 = zone ? zm[zone[c]] : P1, gross = (p1 - p0) / 1000;
      const eff = this.s ? (scsRunoff(p1, this.s[c]) - scsRunoff(p0, this.s[c])) / 1000 : gross;
      let hn = h[c] + (dt * div) / dx - (bnd[c] * dt) / this.area + eff;
      if (hn < 0) hn = 0;
      if (drain && drain[c] > 0) { const d = Math.min(hn, drain[c] * dt); hn -= d; drV += d; }
      out += bnd[c] * dt; rainV += gross; effV += eff;
      if (sea && sea[c]) { const fix = Math.max(0, this.seaLevel - z[c]); seaV += hn - fix; hn = fix; }
      h[c] = hn;
      if (hn > this.hMax[c]) this.hMax[c] = hn;
      if (hn > hm) hm = hn;
    }
    let inV = 0;
    this.inflowCells.forEach((c, k) => {
      const v = (this.inflows[k] ?? 0) * dt;
      if (v <= 0 || !active[c]) return;
      h[c] += v / this.area; inV += v;
      if (h[c] > this.hMax[c]) this.hMax[c] = h[c];
      if (h[c] > hm) hm = h[c];
    });
    this.totals.rain += rainV * this.area; this.totals.infiltration += (rainV - effV) * this.area;
    this.totals.inflow += inV; this.totals.outflow += out; this.totals.sea += seaV * this.area; this.totals.drain += drV * this.area;
    this.rainMm = P1;
    this.depthMax = hm;
    this.qx = qxN; this.qxN = qx; this.qy = qyN; this.qyN = qy;
    this.t += dt;
    return dt;
  }
}
